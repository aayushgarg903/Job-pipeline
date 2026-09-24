"use server";
// Resolves ?table= refs that aren't rendered on the current page (e.g. a shared link),
// so the Compare tray can show their cards. Validates input at the boundary.
import type { Lang } from "@ks/contracts";
import { parseTable, type CompareItem } from "@ks/ui";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { courseCard, districtCard, skillCard, toCompareItem, type Tr } from "@/lib/cards";
import { getReaders } from "@/lib/readers";

const Refs = z.array(z.string().max(80)).max(4);

export async function resolveTableRefs(input: string[]): Promise<CompareItem[]> {
  const refs = parseTable(Refs.parse(input).join(","));
  const r = await getReaders();
  const lang = ((await getLocale()) === "mr" ? "mr" : "en") as Lang;
  const t = (await getTranslations()) as unknown as Tr;
  const s0 = await r.stateOverview();
  const nameOf = async (lgd: string) => {
    const d = await r.district(lgd);
    return d ? (lang === "mr" ? d.district.nameMr : d.district.nameEn) : lgd;
  };

  const out: CompareItem[] = [];
  for (const ref of refs) {
    // Course ids carry their own colon (iti-nashik-satpur:CTS-ELEC): split on the first one only.
    const at = ref.indexOf(":");
    const kind = ref.slice(0, at), id = ref.slice(at + 1);
    if (kind === "district") {
      const s = await r.district(id);
      if (!s) continue;
      const cells = await r.districtCells(id, 5);
      const item = toCompareItem(districtCard(s, t, lang, cells.find((c) => c.skillId === s.topShortage?.skillId)));
      if (item) out.push(item);
    } else if (kind === "course") {
      const c = await r.course(id);
      if (!c) continue;
      const skills = new Map((await r.searchSkills("", 500)).map((s) => [s.id, lang === "mr" && s.labelMr ? s.labelMr : s.labelEn]));
      const item = toCompareItem(courseCard(c, await nameOf(c.lgd), t, lang, (sid) => skills.get(sid) ?? sid, s0.asOf));
      if (item) out.push(item);
    } else if (kind === "skill") {
      const s = await r.skill(id);
      const cells = await r.skillCells(id);
      const top = [...cells].sort((a, b) => b.gap - a.gap)[0];
      if (!s || !top) continue;
      const item = toCompareItem(skillCard(s, top, await nameOf(top.lgd), 0, t, lang, s0.asOf));
      if (item) out.push(item);
    }
  }
  return out;
}
