"use client";
// Survey step 4: pick up to 5 skills (searchable through readers.searchSkills via a Server
// Action), each with importance (must-have / preferred / nice) and day-one level (1-4).
// Chosen rows are React state, so they autosave under their own key (the stepper's autosave
// only restores fields that exist at mount). Buttons, not a combobox: simpler and 44px targets.
import type { Lang } from "@ks/contracts";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { searchSkillsAction } from "@/app/actions/public";
import { FieldError, errId, fieldId } from "./survey-fields";
import { MAX_SKILLS } from "./survey-schema";

export interface CatalogSkill { id: string; labelEn: string; labelMr: string | null }
type Importance = "mandatory" | "preferred" | "nice";
interface Row { id: string; importance: Importance; proficiency: string }

const IMPORTANCE: Importance[] = ["mandatory", "preferred", "nice"];

function read(key: string): Row[] {
  try {
    const raw = window.localStorage.getItem(key);
    const v = raw ? (JSON.parse(raw) as Row[]) : [];
    return Array.isArray(v) ? v.slice(0, MAX_SKILLS) : [];
  } catch {
    return [];
  }
}
function write(key: string, rows: Row[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(rows));
  } catch {
    /* storage blocked: the form still works, it just won't remember */
  }
}

export function clearSkillPicker(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function SkillPicker({
  storageKey, catalog, suggest, lang, invalid,
}: {
  storageKey: string;
  catalog: CatalogSkill[];
  /** Skills that are common for the chosen role, offered as one-tap adds. */
  suggest: string[];
  lang: Lang;
  invalid: boolean;
}) {
  const t = useTranslations("public.survey.fields");
  const tImp = useTranslations("public.survey.importance");
  const tProf = useTranslations("public.survey.proficiency");
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<CatalogSkill[] | null>(null);
  const [pending, start] = useTransition();
  const [announce, setAnnounce] = useState("");
  const search = useRef<HTMLInputElement>(null);
  const loaded = useRef(false);
  const byId = new Map(catalog.map((s) => [s.id, s]));
  const label = (s: CatalogSkill | undefined, id: string) => (s ? (lang === "mr" && s.labelMr ? s.labelMr : s.labelEn) : id);

  useEffect(() => {
    setRows(read(storageKey).filter((r) => byId.has(r.id)));
    loaded.current = true;
  }, [storageKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (loaded.current) write(storageKey, rows);
    // The search box carries the "at least one skill" rule, so Next and submit are blocked natively.
    search.current?.setCustomValidity(rows.length ? "" : t("skillsNone"));
  }, [rows, storageKey, t]);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults(null);
      return;
    }
    const h = setTimeout(() => {
      start(async () => {
        const found = await searchSkillsAction(term);
        setResults(found);
      });
    }, 200);
    return () => clearTimeout(h);
  }, [q]);

  const chosen = new Set(rows.map((r) => r.id));
  const full = rows.length >= MAX_SKILLS;

  function add(s: CatalogSkill) {
    if (chosen.has(s.id) || full) return;
    setRows((r) => [...r, { id: s.id, importance: "mandatory", proficiency: "2" }]);
    setAnnounce(t("skillAdded", { skill: label(s, s.id) }));
    setQ("");
    search.current?.focus();
  }
  function remove(id: string) {
    setRows((r) => r.filter((x) => x.id !== id));
    setAnnounce(t("skillRemoved", { skill: label(byId.get(id), id) }));
    search.current?.focus();
  }
  const update = (id: string, patch: Partial<Row>) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const addButton = (s: CatalogSkill) => (
    <li key={s.id}>
      <button type="button" className="ks-btn ks-btn--secondary w-full justify-start text-left" onClick={() => add(s)} disabled={full}>
        <span aria-hidden="true">+</span> {t("skillAdd", { skill: label(s, s.id) })}
      </button>
    </li>
  );
  const suggestions = suggest.map((id) => byId.get(id)).filter((s): s is CatalogSkill => !!s && !chosen.has(s.id));
  const visible = (results ?? []).filter((s) => !chosen.has(s.id));

  return (
    <div className="grid gap-4">
      <div className="ks-field">
        <label htmlFor={fieldId("skills")}>{t("skillSearch")}</label>
        <p id={`${fieldId("skills")}-hint`} className="ks-field__hint m-0">
          {t("skillSearchHint")}
        </p>
        <input
          ref={search}
          id={fieldId("skills")}
          data-field="skills"
          type="search"
          autoComplete="off"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (visible[0]) add(visible[0]);
          }}
          disabled={full}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={[`${fieldId("skills")}-hint`, invalid ? errId("skills") : null].filter(Boolean).join(" ")}
          className="w-full"
        />
        <FieldError field="skills" />
      </div>

      {q.trim() ? (
        <div aria-busy={pending}>
          {pending && !results ? <p className="m-0 text-ink-muted">{t("skillSearching")}</p> : null}
          {results && !visible.length ? <p className="m-0 text-ink-muted">{t("skillNoMatch")}</p> : null}
          {visible.length ? <ul className="m-0 grid list-none gap-1 p-0">{visible.map(addButton)}</ul> : null}
        </div>
      ) : suggestions.length && !full ? (
        <ul className="m-0 grid list-none gap-1 p-0">{suggestions.map(addButton)}</ul>
      ) : null}

      <section aria-labelledby="sv-chosen">
        <h3 id="sv-chosen" className="m-0 mb-2 text-base font-semibold">
          {t("skillsChosen", { n: rows.length, max: MAX_SKILLS })}
        </h3>
        {rows.length === 0 ? <p className="m-0 text-ink-muted">{t("skillsNone")}</p> : null}
        {full ? <p className="m-0 mb-2 text-ink-muted">{t("skillsFull")}</p> : null}
        <ol className="m-0 grid list-none gap-3 p-0">
          {rows.map((r) => {
            const name = label(byId.get(r.id), r.id);
            return (
              <li key={r.id} className="grid gap-3 border border-ink-muted bg-stock-nimbus p-3">
                <input type="hidden" name="skill" value={r.id} />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong>{name}</strong>
                  <button type="button" className="ks-btn ks-btn--ghost" onClick={() => remove(r.id)} aria-label={t("skillRemove", { skill: name })}>
                    <span aria-hidden="true">×</span> {t("skillRemove", { skill: "" }).trim()}
                  </button>
                </div>
                <fieldset className="m-0 grid min-w-0 gap-1 border-0 p-0">
                  <legend className="mb-1 p-0 font-medium">{t("importance")}</legend>
                  {IMPORTANCE.map((imp) => (
                    <label key={imp} className="flex min-h-11 cursor-pointer items-center gap-3 border border-ink-faint px-3 py-2 has-[:checked]:border-ink has-[:checked]:bg-stock-eggshell">
                      <input type="radio" name={`imp_${r.id}`} value={imp} checked={r.importance === imp} onChange={() => update(r.id, { importance: imp })} className="size-5 shrink-0 accent-[var(--ink)]" />
                      <span>{tImp(imp)}</span>
                    </label>
                  ))}
                </fieldset>
                <div className="ks-field">
                  <label htmlFor={`prof_${r.id}`}>{t("proficiency")}</label>
                  <select id={`prof_${r.id}`} name={`prof_${r.id}`} value={r.proficiency} onChange={(e) => update(r.id, { proficiency: e.target.value })} className="w-full">
                    {["1", "2", "3", "4"].map((p) => (
                      <option key={p} value={p}>
                        {tProf(p)}
                      </option>
                    ))}
                  </select>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}
