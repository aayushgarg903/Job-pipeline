// Builds public/geo/mh-districts.geo.json: Maharashtra's 36 districts with { lgd, name }.
//
// Base: datameet/maps dists11.geojson (Census 2011, 35 MH districts).
// Palghar was carved out of Thane in 2014, so Thane and Palghar geometries come from
// udit-001/india-maps-data (the only open file we found with the 2014 split).
// Coordinates are rounded to 3 decimals (~110 m), duplicate vertices dropped, and
// exterior rings forced clockwise (d3-geo's spherical convention).
//
// Usage: node apps/web/scripts/build-geo.mjs [datameet.geojson] [udit-maharashtra.geojson]
// With no arguments it fetches both files.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAW = "https://raw." + "githubusercontent.com";
const DATAMEET = `${RAW}/datameet/maps/master/website/docs/data/geojson/dists11.geojson`;
const UDIT = `${RAW}/udit-001/india-maps-data/main/geojson/states/maharashtra.geojson`;

// Best-effort LGD district codes (state 27). The data agent owns the canonical table.
const LGD = {
  "Ahmadnagar": ["466", "Ahilyanagar"], "Akola": ["467", "Akola"], "Amravati": ["468", "Amravati"],
  "Aurangabad": ["469", "Chhatrapati Sambhajinagar"], "Bid": ["470", "Beed"], "Bhandara": ["471", "Bhandara"],
  "Buldana": ["472", "Buldhana"], "Chandrapur": ["473", "Chandrapur"], "Dhule": ["474", "Dhule"],
  "Garhchiroli": ["475", "Gadchiroli"], "Gondiya": ["476", "Gondia"], "Hingoli": ["477", "Hingoli"],
  "Jalgaon": ["478", "Jalgaon"], "Jalna": ["479", "Jalna"], "Kolhapur": ["480", "Kolhapur"],
  "Latur": ["481", "Latur"], "Mumbai": ["482", "Mumbai City"], "Mumbai Suburban": ["483", "Mumbai Suburban"],
  "Nagpur": ["484", "Nagpur"], "Nanded": ["485", "Nanded"], "Nandurbar": ["486", "Nandurbar"],
  "Nashik": ["487", "Nashik"], "Osmanabad": ["488", "Dharashiv"], "Parbhani": ["489", "Parbhani"],
  "Pune": ["490", "Pune"], "Raigarh": ["491", "Raigad"], "Ratnagiri": ["492", "Ratnagiri"],
  "Sangli": ["493", "Sangli"], "Satara": ["494", "Satara"], "Sindhudurg": ["495", "Sindhudurg"],
  "Solapur": ["496", "Solapur"], "Thane": ["497", "Thane"], "Wardha": ["498", "Wardha"],
  "Washim": ["499", "Washim"], "Yavatmal": ["500", "Yavatmal"], "Palghar": ["665", "Palghar"],
};

async function load(arg, url) {
  if (arg) return JSON.parse(await readFile(arg, "utf8"));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

const r3 = (n) => Math.round(n * 1000) / 1000;
const signedArea = (ring) => {
  let s = 0;
  for (let i = 0; i < ring.length - 1; i++) s += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return s / 2;
};
// Douglas-Peucker at 0.003 deg (~330 m): sub-pixel at the 600px map width we render.
const TOL = 0.003;
function perpDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / len;
}
function simplify(pts) {
  if (pts.length < 5) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let max = 0, idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = perpDist(pts[i], pts[s], pts[e]);
      if (d > max) { max = d; idx = i; }
    }
    if (max > TOL && idx > 0) { keep[idx] = 1; stack.push([s, idx], [idx, e]); }
  }
  const out = pts.filter((_, i) => keep[i]);
  return out.length >= 4 ? out : pts;
}
function cleanRing(ring, exterior) {
  const out = [];
  for (const [x, y] of simplify(ring)) {
    const p = [r3(x), r3(y)];
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  if (out.length < 4) return null;
  const first = out[0], last = out[out.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) out.push([...first]);
  const cw = signedArea(out) < 0;
  if (exterior !== cw) out.reverse();
  return out;
}
function cleanPolygon(rings) {
  const ext = cleanRing(rings[0], true);
  if (!ext) return null;
  return [ext, ...rings.slice(1).map((r) => cleanRing(r, false)).filter(Boolean)];
}
function cleanGeometry(g) {
  if (g.type === "Polygon") return { type: "Polygon", coordinates: cleanPolygon(g.coordinates) };
  const polys = g.coordinates.map(cleanPolygon).filter(Boolean);
  return polys.length === 1 ? { type: "Polygon", coordinates: polys[0] } : { type: "MultiPolygon", coordinates: polys };
}

const [dm, ud] = await Promise.all([load(process.argv[2], DATAMEET), load(process.argv[3], UDIT)]);
const base = dm.features.filter((f) => f.properties.ST_NM === "Maharashtra" && f.properties.DISTRICT !== "Thane");
const split = ud.features.filter((f) => ["Thane", "Palghar"].includes(f.properties.district));
if (base.length !== 34 || split.length !== 2) throw new Error(`unexpected counts ${base.length}/${split.length}`);

const features = [...base.map((f) => [f.properties.DISTRICT, f.geometry]), ...split.map((f) => [f.properties.district, f.geometry])]
  .map(([src, geometry]) => {
    const hit = LGD[src];
    if (!hit) throw new Error(`no LGD mapping for ${src}`);
    return { type: "Feature", properties: { lgd: hit[0], name: hit[1] }, geometry: cleanGeometry(geometry) };
  })
  .sort((a, b) => a.properties.lgd.localeCompare(b.properties.lgd));

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "public", "geo", "mh-districts.geo.json");
await mkdir(dirname(out), { recursive: true });
await writeFile(out, JSON.stringify({ type: "FeatureCollection", features }));
console.log(`wrote ${features.length} districts to ${out}`);
