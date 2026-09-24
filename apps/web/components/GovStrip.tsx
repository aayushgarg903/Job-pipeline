// GIGW-style bilingual header strip. A neutral text lockup only: no State Emblem image.
// Static and bilingual on purpose, so it is part of the prerendered shell. Not a landmark:
// the top bar below is the page's one banner.
export function GovStrip() {
  return (
    <div className="ks-gov">
      <div className="ks-gov__inner">
        <p className="ks-gov__lockup" style={{ margin: 0 }}>
          <span>Government of Maharashtra</span>
          <span aria-hidden="true">·</span>
          <span lang="mr">महाराष्ट्र शासन</span>
        </p>
        <p className="ks-gov__dept" style={{ margin: 0 }}>
          <span>Skills, Employment, Entrepreneurship and Innovation Department</span>
          <span aria-hidden="true"> · </span>
          <span lang="mr">कौशल्य, रोजगार, उद्योजकता व नाविन्यता विभाग</span>
        </p>
      </div>
    </div>
  );
}
