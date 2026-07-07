// Generates the downloadable CSV tables behind /data/cosiest-hotel-towns — the raw city and
// country league tables, straight from src/data/dataStoryCosiest.json (same source the report
// page reads). Re-run whenever dataStoryCosiest.json is regenerated:
//   node scripts/generate-cosiest-towns-csv.mjs
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(
  await import("node:fs").then((fs) =>
    fs.readFileSync(path.join(__dirname, "../src/data/dataStoryCosiest.json"), "utf8")
  )
);

function csvEscape(v) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows, columns) {
  const header = columns.join(",");
  const lines = rows.map((r) => columns.map((c) => csvEscape(r[c])).join(","));
  return [header, ...lines].join("\n") + "\n";
}

const cities = [...data.city_league_table_full]
  .sort((a, b) => b.mean - a.mean)
  .map((c) => ({ city: c.city, country: c.country, n: c.n, mean: c.mean.toFixed(2), pct7plus: c.share_ge7.toFixed(1) }));

const countries = [...data.country_league_table_full]
  .sort((a, b) => b.mean - a.mean)
  .map((c) => ({ country: c.country, n: c.n, mean: c.mean.toFixed(2), pct7plus: c.share_ge7.toFixed(1) }));

const outDir = path.join(__dirname, "../public/data");
writeFileSync(path.join(outDir, "cosiest-hotel-towns-cities.csv"), toCsv(cities, ["city", "country", "n", "mean", "pct7plus"]));
writeFileSync(path.join(outDir, "cosiest-hotel-towns-countries.csv"), toCsv(countries, ["country", "n", "mean", "pct7plus"]));

console.log(`Wrote ${cities.length} city rows and ${countries.length} country rows to public/data/`);
