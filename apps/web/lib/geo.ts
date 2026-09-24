// Maharashtra district boundaries (36, with { lgd, name }). Built by scripts/build-geo.mjs.
// Imported statically so server components can pass it to <Choropleth>/<MapWithTable>.
import type { DistrictGeo } from "@ks/ui";
import raw from "@/public/geo/mh-districts.geo.json";

export const mhDistricts = raw as unknown as DistrictGeo;
