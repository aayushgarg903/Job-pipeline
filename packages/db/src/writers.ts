// Writers: the write side of the contract. Inputs are validated at this boundary.
import type { SurveyInput, Writers } from "@ks/contracts";
import type { Sql } from "./client";

const IMPORTANCE = new Set(["mandatory", "preferred", "nice"]);
const VERDICTS = new Set(["endorse", "change", "irrelevant"]);
/** Endorsements needed to move a draft PR to employer-validated. */
export const PR_VALIDATION_THRESHOLD = 3;

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`invalid input: ${msg}`);
}

function validateSurvey(i: SurveyInput) {
  assert(i.employerName?.trim().length >= 2, "employerName");
  assert(/^\d{3}$/.test(i.lgd), "lgd must be a 3-digit LGD code");
  assert(Number.isInteger(i.expectedHires12m) && i.expectedHires12m >= 0 && i.expectedHires12m < 100_000, "expectedHires12m");
  assert(i.postingToHireRatio == null || (i.postingToHireRatio >= 0 && i.postingToHireRatio <= 50), "postingToHireRatio");
  assert(i.csatRecentHires == null || [1, 2, 3, 4, 5].includes(i.csatRecentHires), "csatRecentHires");
  assert(i.weeksToProductivity == null || (i.weeksToProductivity >= 0 && i.weeksToProductivity <= 104), "weeksToProductivity");
  assert(Array.isArray(i.skills) && i.skills.length <= 40, "skills");
  for (const s of i.skills) {
    assert(IMPORTANCE.has(s.importance), `importance ${s.importance}`);
    assert([1, 2, 3, 4].includes(s.proficiency), `proficiency ${s.proficiency}`);
  }
}

export function createWriters(sql: Sql): Writers {
  return {
    async submitSurvey(input) {
      validateSurvey(input);
      return sql.begin(async (tx) => {
        const name = input.employerName.trim();
        const [existing] = await tx<{ id: string }[]>`
          select id from ks.employer where lower(name) = lower(${name}) and lgd_code = ${input.lgd} limit 1`;
        const employerId = existing?.id ?? (await tx<{ id: string }[]>`
          insert into ks.employer (name, lgd_code, sector) values (${name}, ${input.lgd}, ${input.sector}) returning id`)[0]!.id;
        const [row] = await tx<{ id: string }[]>`
          insert into ks.survey_response (employer_id, lgd_code, nco_code, sector, expected_hires_12m,
            posting_to_hire_ratio, csat_recent_hires, weeks_to_productivity, comment)
          values (${employerId}, ${input.lgd}, ${input.nco}, ${input.sector}, ${input.expectedHires12m},
            ${input.postingToHireRatio}, ${input.csatRecentHires}, ${input.weeksToProductivity}, ${input.comment})
          returning id`;
        const id = row!.id;
        for (const s of input.skills) {
          await tx`insert into ks.survey_skill (response_id, skill_id, importance, proficiency)
                   values (${id}, ${s.skillId}, ${s.importance}, ${s.proficiency})
                   on conflict (response_id, skill_id) do update set importance = excluded.importance, proficiency = excluded.proficiency`;
        }
        return { id };
      });
    },

    async reviewPr({ prId, employerId, verdict, comment }) {
      assert(VERDICTS.has(verdict), `verdict ${verdict}`);
      assert(comment == null || comment.length <= 4000, "comment too long");
      await sql.begin(async (tx) => {
        await tx`insert into ks.pr_review (pr_id, employer_id, verdict, comment) values (${prId}, ${employerId}, ${verdict}, ${comment})
                 on conflict (pr_id, employer_id) do update set verdict = excluded.verdict, comment = excluded.comment, reviewed_at = now()`;
        await tx`update ks.curriculum_pr p set status = 'employer-validated', validated_at = now()
                 where p.id = ${prId} and p.status = 'draft'
                   and (select count(*) from ks.pr_review r where r.pr_id = p.id and r.verdict = 'endorse') >= ${PR_VALIDATION_THRESHOLD}`;
      });
    },

    async savePlan({ lgd, fy, input, result, signedBy }) {
      assert(/^\d{3}$/.test(lgd), "lgd");
      assert(/^FY\d{2}$/.test(fy), "fy must look like FY27");
      const [row] = await sql<{ id: string }[]>`
        insert into ks.training_plan (lgd_code, fy, inputs, solution, objective, status, signed_by, signed_at)
        values (${lgd}, ${fy}, ${sql.json(input as never)}, ${sql.json(result as never)}, ${result.objective}, ${result.status},
                ${signedBy}, ${signedBy ? sql`now()` : null})
        returning id`;
      return { id: row!.id };
    },

    async resolveReview({ id, decision, by }) {
      assert(decision === "approve" || decision === "reject", "decision");
      await sql.begin(async (tx) => {
        const [item] = await tx<Array<{ kind: string; payload: Record<string, unknown> }>>`
          update ks.review_item set status = ${decision === "approve" ? "approved" : "rejected"}, decided_by = ${by}, decided_at = now()
          where id = ${id} returning kind, payload`;
        assert(item, `review item ${id} not found`);
        // Approving an unknown-skill candidate that names a canonical skill teaches the alias table.
        const alias = typeof item.payload.text === "string" ? item.payload.text.toLowerCase().trim() : null;
        const skillId = typeof item.payload.suggestedSkillId === "string" ? item.payload.suggestedSkillId : null;
        if (decision === "approve" && item.kind === "unknown-skill" && alias && skillId) {
          await tx`insert into ks.skill_alias (alias, skill_id, source, confidence) values (${alias}, ${skillId}, 'review', 1)
                   on conflict do nothing`;
        }
      });
    },
  };
}
