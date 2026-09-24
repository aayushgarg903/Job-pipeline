"use client";
// The map is always paired with a sortable table of the same data (Design.md §4.4).
// Sorting the table re-orders keyboard focus on the map; focusing a row highlights the district.
import type { Lang } from "@ks/contracts";
import { useState } from "react";
import { Choropleth, type ChoroplethLabels, type ChoroplethProps, type DistrictGeo } from "./Choropleth";
import { DataTable, type DataColumn, type DataTableLabels, type SortDir } from "./DataTable";

export interface DistrictRow extends Record<string, unknown> {
  lgd: string;
  name: string;
  value: number | null;
  coverage: number;
  display?: string;
}

export interface MapWithTableProps<T extends DistrictRow> {
  geo: DistrictGeo;
  rows: T[];
  columns: Array<DataColumn<T>>;
  caption: string;
  /** "/districts/{lgd}" */
  hrefTemplate?: string;
  onSelect?: (lgd: string) => void;
  breaks?: ChoroplethProps["breaks"];
  initialSort?: { key: string; dir: SortDir };
  lang?: Lang;
  mapLabels?: Partial<ChoroplethLabels>;
  tableLabels?: Partial<DataTableLabels>;
}

export function MapWithTable<T extends DistrictRow>({
  geo, rows, columns, caption, hrefTemplate, onSelect, breaks, initialSort, lang, mapLabels, tableLabels,
}: MapWithTableProps<T>) {
  const [order, setOrder] = useState<string[]>(() => rows.map((r) => r.lgd));
  const [focus, setFocus] = useState<string | null>(null);
  return (
    <div className="ks-map-table">
      <Choropleth
        geo={geo}
        data={rows.map((r) => ({ lgd: r.lgd, name: r.name, value: r.value, coverage: r.coverage, display: r.display }))}
        order={order}
        selected={focus}
        breaks={breaks}
        onSelect={onSelect}
        hrefTemplate={hrefTemplate}
        onFocusDistrict={setFocus}
        lang={lang}
        labels={mapLabels}
      />
      <DataTable
        caption={caption}
        columns={columns}
        rows={rows}
        rowKey="lgd"
        initialSort={initialSort}
        onOrderChange={setOrder}
        rowHref={hrefTemplate}
        selectedKey={focus}
        onRowFocus={setFocus}
        lang={lang}
        labels={tableLabels}
      />
    </div>
  );
}
