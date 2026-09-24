// The signed training plan as an A4 PDF, set in ledger style: engraved title, hairline and
// double rules, tabular figures, Latin + Devanagari fonts (all OFL, bundled in ./fonts).
import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { existsSync } from "node:fs";
import { join } from "node:path";

export interface PlanPdfData {
  lang: "en" | "mr";
  title: string;
  subtitle: string;
  gov: string;
  narrative: string;
  columns: { course: string; before: string; after: string; batches: string };
  rows: Array<{ name: string; before: string; after: string; batches: string }>;
  sections: Array<{ heading: string; lines: string[] }>;
  signature: { heading: string; line: string; note: string | null };
  footer: string;
  specimen: string | null; // watermark word when demo data
}

const INK = "#1C1A17";
const MUTED = "#5E574C";
const FAINT = "#756D60";
const STOCK = "#EFE8D8";
const GAP = "#7A1F24";

let registered = false;
function registerFonts() {
  if (registered) return;
  const dirs = [join(process.cwd(), "components/console/pdf/fonts"), join(process.cwd(), "apps/web/components/console/pdf/fonts")];
  const dir = dirs.find((d) => existsSync(join(d, "TiroDevanagariMarathi-Regular.ttf")));
  if (!dir) throw new Error("PDF fonts not found");
  Font.register({ family: "Tiro", src: join(dir, "TiroDevanagariMarathi-Regular.ttf") });
  Font.register({ family: "CormorantSC", src: join(dir, "CormorantSC-Medium.ttf") });
  Font.register({ family: "PlexMono", src: join(dir, "IBMPlexMono-Regular.ttf") });
  Font.registerHyphenationCallback((w) => [w]); // never hyphenate: it breaks Devanagari conjuncts
  registered = true;
}

const s = StyleSheet.create({
  page: { backgroundColor: STOCK, color: INK, fontFamily: "Tiro", fontSize: 10.5, lineHeight: 1.45, paddingTop: 36, paddingBottom: 48, paddingHorizontal: 44 },
  gov: { fontSize: 9, color: MUTED, letterSpacing: 0.6, borderBottomWidth: 0.6, borderBottomColor: FAINT, paddingBottom: 6, marginBottom: 14 },
  titleEn: { fontFamily: "CormorantSC", fontSize: 24, lineHeight: 1.25, letterSpacing: 2.4, textAlign: "center", marginBottom: 4 },
  titleMr: { fontFamily: "Tiro", fontSize: 22, lineHeight: 1.5, textAlign: "center", marginBottom: 4 },
  subtitle: { textAlign: "center", color: MUTED, marginTop: 2 },
  double: { borderBottomWidth: 2.4, borderBottomColor: INK, borderStyle: "solid", marginTop: 10, marginBottom: 1 },
  hair: { borderBottomWidth: 0.6, borderBottomColor: INK, marginBottom: 12 },
  narrative: { marginBottom: 12 },
  h2: { fontSize: 11.5, marginTop: 12, marginBottom: 4, borderBottomWidth: 0.6, borderBottomColor: FAINT, paddingBottom: 2 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: FAINT, paddingVertical: 3 },
  th: { color: MUTED, fontSize: 9 },
  cName: { flex: 3 },
  cNum: { flex: 1, textAlign: "right", fontFamily: "PlexMono", fontSize: 10 },
  cNumHead: { flex: 1, textAlign: "right" },
  line: { marginBottom: 2 },
  sig: { marginTop: 18, borderWidth: 0.8, borderColor: INK, padding: 10 },
  sigNote: { color: GAP, marginTop: 4, fontSize: 9.5 },
  footer: { position: "absolute", bottom: 22, left: 44, right: 44, fontSize: 8.5, color: MUTED, borderTopWidth: 0.5, borderTopColor: FAINT, paddingTop: 4 },
  watermark: { position: "absolute", top: 330, left: 60, fontFamily: "CormorantSC", fontSize: 88, color: INK, opacity: 0.06, transform: "rotate(-30deg)", letterSpacing: 8 },
});

function PlanDocument({ d }: { d: PlanPdfData }) {
  return (
    <Document title={d.title} author="Kaushal Setu" subject={d.subtitle} language={d.lang === "mr" ? "mr-IN" : "en-IN"}>
      <Page size="A4" style={s.page}>
        {d.specimen ? <Text style={s.watermark} fixed>{d.specimen}</Text> : null}
        <Text style={s.gov}>{d.gov}</Text>
        <Text style={d.lang === "mr" ? s.titleMr : s.titleEn}>{d.title}</Text>
        <Text style={s.subtitle}>{d.subtitle}</Text>
        <View style={s.double} />
        <View style={s.hair} />
        <Text style={s.narrative}>{d.narrative}</Text>

        <View style={[s.tr, { borderBottomColor: INK }]}>
          <Text style={[s.cName, s.th]}>{d.columns.course}</Text>
          <Text style={[s.cNumHead, s.th]}>{d.columns.before}</Text>
          <Text style={[s.cNumHead, s.th]}>{d.columns.after}</Text>
          <Text style={[s.cNumHead, s.th]}>{d.columns.batches}</Text>
        </View>
        {d.rows.map((r) => (
          <View key={r.name} style={s.tr} wrap={false}>
            <Text style={s.cName}>{r.name}</Text>
            <Text style={s.cNum}>{r.before}</Text>
            <Text style={s.cNum}>{r.after}</Text>
            <Text style={s.cNum}>{r.batches}</Text>
          </View>
        ))}

        {d.sections.map((sec) => (
          <View key={sec.heading} wrap={false}>
            <Text style={s.h2}>{sec.heading}</Text>
            {sec.lines.map((l) => <Text key={l} style={s.line}>· {l}</Text>)}
          </View>
        ))}

        <View style={s.sig} wrap={false}>
          <Text style={{ color: MUTED, fontSize: 9 }}>{d.signature.heading}</Text>
          <Text style={{ fontSize: 12, marginTop: 2 }}>{d.signature.line}</Text>
          {d.signature.note ? <Text style={s.sigNote}>{d.signature.note}</Text> : null}
        </View>

        <Text style={s.footer} fixed>{d.footer}</Text>
      </Page>
    </Document>
  );
}

export async function renderPlanPdf(d: PlanPdfData): Promise<Buffer> {
  registerFonts();
  return renderToBuffer(<PlanDocument d={d} />);
}
