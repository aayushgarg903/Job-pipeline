// Writers: the write side of the contract. Inputs are validated at this boundary.
import type { SurveyInput, Writers } from "@ks/contracts";
import type { Sql } from "./client";

/** Reserved occupation for survey roles we can't map yet (seeded in data/occupations.json). */
export const UNMAPPED_NCO = "0000.0000";

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
  if (i.consent) {
    assert(!Number.isNaN(Date.parse(i.consent.at)), "consent.at must be an ISO timestamp");
    assert(typeof i.consent.noticeVersion === "string" && i.consent.noticeVersion.trim().length > 0 && i.consent.noticeVersion.length <= 64, "consent.noticeVersion");
    assert(typeof i.consent.purpose === "string" && i.consent.purpose.trim().length > 0 && i.consent.purpose.length <= 500, "consent.purpose");
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
        // New responses start unverified: facts ignore them until an officer approves the
        // 'survey-verify' review item (resolveReview), per Architecture §6.1 anti-gaming.
        const c = input.consent ?? null;
        // Roles we can't map yet (survey "Other", or a code missing from our NCO list) land in a
        // reserved bucket; the review item carries the employer's own words for an officer to map.
        const [known] = await tx<{ n: number }[]>`select count(*)::int as n from ks.occupation where nco_code = ${input.nco}`;
        const nco = known && known.n > 0 ? input.nco : UNMAPPED_NCO;
        const [row] = await tx<{ id: string }[]>`
          insert into ks.survey_response (employer_id, lgd_code, nco_code, sector, expected_hires_12m,
            posting_to_hire_ratio, csat_recent_hires, weeks_to_productivity, comment, verified,
            consent_at, consent_notice_version, consent_purpose)
          values (${employerId}, ${input.lgd}, ${nco}, ${input.sector}, ${input.expectedHires12m},
            ${input.postingToHireRatio}, ${input.csatRecentHires}, ${input.weeksToProductivity}, ${input.comment}, false,
            ${c?.at ?? null}::timestamptz, ${c?.noticeVersion ?? null}, ${c?.purpose ?? null})
          returning id`;
        const id = row!.id;
        await tx`insert into ks.review_item (kind, ref_id, payload)
                 values ('survey-verify', ${id}, ${JSON.stringify({ employer: name, lgd: input.lgd, nco: input.nco, storedAs: nco, comment: input.comment, expectedHires12m: input.expectedHires12m })}::text::jsonb)`;
        for (const s of input.skills) {
          await tx`insert into ks.survey_skill (response_id, skill_id, importance, proficiency)
                   values (${id}, ${s.skillId}, ${s.importance}, ${s.proficiency})
                   on conflict (response_id, skill_id) do update set importance = excluded.importance, proficiency = excluded.proficiency`;
        }
        return { id };
      });
    },

    // Identity is the caller's job (the web layer resolves the signed-in employer). One review per
    // (pr_id, employer_id): a second verdict from the same employer replaces the first.
    async reviewPr({ prId, employerId, verdict, comment }) {
      assert(typeof prId === "string" && prId.length > 0 && prId.length <= 200, "prId");
      assert(UUID.test(employerId), "employerId must be a uuid");
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
      // signedBy is stored as given: the web layer guarantees it is an authenticated officer.
      assert(signedBy == null || (typeof signedBy === "string" && signedBy.length <= 200), "signedBy");
      const [row] = await sql<{ id: string }[]>`
        insert into ks.training_plan (lgd_code, fy, inputs, solution, objective, status, signed_by, signed_at)
        values (${lgd}, ${fy}, ${JSON.stringify(input)}::text::jsonb, ${JSON.stringify(result)}::text::jsonb, ${result.objective}, ${result.status},
                ${signedBy}, ${signedBy ? sql`now()` : null})
        returning id`;
      return { id: row!.id };
    },

    async resolveReview({ id, decision, by }) {
      assert(decision === "approve" || decision === "reject", "decision");
      await sql.begin(async (tx) => {
        const [item] = await tx<Array<{ kind: string; ref_id: string; payload: Record<string, unknown> }>>`
          update ks.review_item set status = ${decision === "approve" ? "approved" : "rejected"}, decided_by = ${by}, decided_at = now()
          where id = ${id} returning kind, ref_id, payload`;
        assert(item, `review item ${id} not found`);
        // Approving an unknown-skill candidate that names a canonical skill teaches the alias table.
        const alias = typeof item.payload.text === "string" ? item.payload.text.toLowerCase().trim() : null;
        const skillId = typeof item.payload.suggestedSkillId === "string" ? item.payload.suggestedSkillId : null;
        if (item.kind === "survey-verify") {
          const ok = decision === "approve";
          await tx`update ks.survey_response set verified = ${ok}, verified_at = case when ${ok} then now() end
                   where id = ${item.ref_id}::uuid`;
        }
        if (decision === "approve" && item.kind === "unknown-skill" && alias && skillId) {
          await tx`insert into ks.skill_alias (alias, skill_id, source, confidence) values (${alias}, ${skillId}, 'review', 1)
                   on conflict do nothing`;
        }
      });
    },
  };
}
