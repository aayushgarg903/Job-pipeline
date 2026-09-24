"use client";
// The state map with its GeoJSON imported on the client side of the boundary, so the
// outlines ship once in a cacheable JS chunk instead of again inside every /state response
// (the server-rendered SVG already carries them).
import { MapWithTable, type DistrictRow, type MapWithTableProps } from "@ks/ui";
import { mhDistricts } from "@/lib/geo";

export function StateMap<T extends DistrictRow>(props: Omit<MapWithTableProps<T>, "geo">) {
  return <MapWithTable geo={mhDistricts} {...props} />;
}
