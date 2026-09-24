"use client";
// "Open your district": a labelled select that navigates to the district page.
// (Without JS, the map table above links every district.)
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

export function DistrictPicker({ options, label, button }: { options: Array<{ lgd: string; name: string }>; label: string; button: string }) {
  const router = useRouter();
  const id = useId();
  const [lgd, setLgd] = useState(options[0]?.lgd ?? "");
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (lgd) router.push(`/districts/${encodeURIComponent(lgd)}`);
      }}
    >
      <div className="ks-field">
        <label htmlFor={id}>{label}</label>
        <select id={id} value={lgd} onChange={(e) => setLgd(e.target.value)}>
          {options.map((o) => (
            <option key={o.lgd} value={o.lgd}>{o.name}</option>
          ))}
        </select>
      </div>
      <button type="submit" className="ks-btn">{button}</button>
    </form>
  );
}
