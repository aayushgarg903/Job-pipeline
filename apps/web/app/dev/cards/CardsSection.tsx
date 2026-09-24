// Every Card variant and state, in one language. Rendered twice by the gallery (en, mr).
import type { Lang } from "@ks/contracts";
import { Card, GatewayCard, SkeletonCard, VERDICTS, formatNumber } from "@ks/ui";
import type { Tr } from "@/lib/cards";
import { buildCards, type GalleryData } from "./data";

export function CardsSection({ d, t, lang, idPrefix }: { d: GalleryData; t: Tr; lang: Lang; idPrefix: string }) {
  const { district, course, skill } = buildCards(d, t, lang);
  const L = {
    asOf: t("card.asOf"), specimen: t("card.specimen"), specimenWord: t("card.specimenWord"), lapsed: t("card.lapsed"),
    lapsedWord: t("card.lapsedWord"), endorsed: t.raw("card.endorsed") as string, placeOnTable: t("card.placeOnTable"), onTable: t("card.onTable"),
    open: t("card.open"), why: t("card.why"),
  };
  const E = t.raw("evidence") as never;
  const prov = (n: number, label: string, lapsed = false) => ({ sources: [{ kind: "surveys" as const, label, n }], asOf: d.overview.asOf, isDemo: true, lapsed });
  const pr = d.pr!;
  const plan = d.plan!;
  const moved = plan.rows.reduce((s, r) => s + Math.max(0, r.seats - r.seatsPrev), 0);
  const mr = lang === "mr";
  const lapsedCourse = course[4] ? { ...course[4], provenance: { ...course[4].provenance, lapsed: true } } : null;

  return (
    <div className="grid gap-8">
      <section aria-labelledby={`${idPrefix}-district`}>
        <h3 id={`${idPrefix}-district`} className="ks-section__title">District · resting, selected (On table), low signal</h3>
        <div className="ks-card-grid">
          {district.map((p, i) => <Card key={p.code} {...p} labels={L} evidenceLabels={E} selected={i === 1} />)}
        </div>
      </section>

      <section aria-labelledby={`${idPrefix}-course`}>
        <h3 id={`${idPrefix}-course`} className="ks-section__title">Course · HEALTHY · REVISE · OVERSUPPLIED, lapsed watermark, picked up</h3>
        <div className="ks-card-grid">
          {course.slice(0, 4).map((p, i) => <Card key={p.code} {...p} labels={L} evidenceLabels={E} className={i === 0 ? "is-lifted" : undefined} />)}
          {lapsedCourse ? <Card {...lapsedCourse} labels={L} evidenceLabels={E} /> : null}
          <SkeletonCard variant="course" label={mr ? "कार्ड उघडत आहे" : "Loading a course card"} />
        </div>
      </section>

      <section aria-labelledby={`${idPrefix}-other`}>
        <h3 id={`${idPrefix}-other`} className="ks-section__title">Skill · Employer · Candidate · Training plan · Curriculum PR (sealed)</h3>
        <div className="ks-card-grid">
          <Card {...skill} labels={L} evidenceLabels={E} />
          <Card
            variant="employer"
            code={mr ? "उद्यम · अन्न प्रक्रिया" : "Udyam · Food processing"}
            name={mr ? "उदाहरण: कोल्ड स्टोरेज युनिट" : "Example: cold-store unit"}
            title={mr ? "दिंडोरी, नाशिक · नमुना नियोक्ता" : "Dindori, Nashik · illustrative employer"}
            figure={{ label: mr ? "मान्यता" : "Reviews", value: "12", evidence: d.evidence["487"]?.slice(1, 3) }}
            verdict={{ tone: "neutral", word: mr ? "2 खुले बदल" : "2 open PRs" }}
            human={mr ? "सर्वेक्षण 5 मिनिटांत पूर्ण केले; मार्चपर्यंत 2 सौर तंत्रज्ञ हवे आहेत." : "Answered the survey in 5 minutes. Needs 2 solar technicians by March."}
            provenance={prov(1, mr ? "सर्वेक्षण" : "survey")}
            lang={lang}
            labels={L}
            evidenceLabels={E}
          />
          <Card
            variant="candidate"
            code="C-7F3A"
            name={mr ? "उदाहरण: प्रिया, नाशिक" : "Example: Priya, Nashik"}
            title={mr ? "नमुना व्यक्ती · खरी व्यक्ती नाही" : "Illustrative person · not a real profile"}
            figure={{ label: mr ? "तयार" : "Ready", value: "3/5" }}
            verdict={{ tone: "ok", glyph: "→", word: mr ? "सौर पीव्ही तंत्रज्ञ" : "Solar PV technician" }}
            human={mr ? "नाशिकमध्ये सौर बसवणीसाठी लागणाऱ्या 5 पैकी 3 कौशल्ये तुमच्याकडे आहेत. 12 आठवड्यांचा एक अभ्यासक्रम उरलेली भरून काढतो." : "You already have 3 of the 5 skills a solar installer in Nashik needs. One 12-week course closes the rest."}
            provenance={prov(175, mr ? "जवळपासच्या नोकऱ्या" : "jobs nearby")}
            lang={lang}
            labels={L}
          />
          <Card
            variant="plan"
            code={mr ? "नाशिक · FY27" : "Nashik · FY27"}
            name={mr ? "प्रशिक्षण आराखडा" : "Training plan"}
            title={mr ? "सहीची वाट पाहत आहे" : "Waiting for a signature"}
            figure={{ label: mr ? "नोकऱ्या" : "Placed", value: formatNumber(plan.expectedPlacements, lang) }}
            verdict={{ ...VERDICTS.HEALTHY, word: mr ? `${moved} जागा हलवल्या` : `${moved} seats moved` }}
            human={mr ? `पुढच्या वर्षी सुमारे ${plan.expectedPlacements} लोकांना नोकरी मिळू शकते. 2 सौर प्रशिक्षक नेमावे लागतील.` : `About ${plan.expectedPlacements} people could be placed next year. It needs 2 more solar trainers.`}
            provenance={prov(3, mr ? "अभ्यासक्रम" : "courses")}
            lang={lang}
            labels={L}
          />
          <Card
            variant="pr"
            code={`SSC/Q2212 · PR #101`}
            name={mr ? "पॉवर बीआय जोडा" : "Add Power BI"}
            title={mr ? "नियोक्त्यांनी तपासले" : "Employer-validated"}
            figure={{ label: mr ? "मते" : "Votes", value: String(pr.endorsements) }}
            verdict={{ tone: "watch", glyph: "~", word: mr ? "+10 तास · −6 तास" : "+10h · −6h" }}
            human={mr ? "जुने मॅक्रो काढून 10 तास पॉवर बीआय; 11 स्थानिक नियोक्ते हे आवश्यक मानतात." : "Swap 6 hours of old macros for 10 hours of Power BI, which 11 local employers call a must-have."}
            endorsements={pr.endorsements}
            provenance={prov(11, mr ? "नियोक्ते" : "employers")}
            lang={lang}
            labels={L}
          />
          <GatewayCard
            variant="candidate"
            code={t("home.candidate.code")}
            name={t("home.candidate.name")}
            title={t("home.candidate.title")}
            human={t("home.candidate.human")}
            href="/me"
            cta={t("home.candidate.cta")}
            lang={lang}
            headingLevel={3}
          />
        </div>
      </section>
    </div>
  );
}
