/* Einmaliger Test (Runde 4): Eventfrog Public API V1 Spezifikation. */
import YAML from "yaml";
const r = await fetch("https://docs.api.eventfrog.net/openapi/publicapi-v1/bundle.yaml");
const spec = YAML.parse(await r.text());
console.log("servers:", JSON.stringify(spec.servers));
console.log("security:", JSON.stringify(spec.components?.securitySchemes));
const deref = (x) => x && x.$ref ? x.$ref.split("/").reduce((o, k) => k === "#" ? spec : o?.[k], null) : x;
for (const [p, ops] of Object.entries(spec.paths || {})) {
  for (const [m, op0] of Object.entries(ops)) {
    const op = deref(op0);
    if (!op || typeof op !== "object") continue;
    console.log(`\n### ${m.toUpperCase()} ${p}  ${op.summary || ""}`);
    for (const p0 of op.parameters || []) {
      const x = deref(p0);
      console.log(`  - ${x.name} (${x.in}, ${x.schema?.type || deref(x.schema)?.type || ""}${x.schema?.format ? "/" + x.schema.format : ""}) ${(x.description || "").replace(/\s+/g, " ").slice(0, 140)}`);
    }
  }
}
for (const [k, v0] of Object.entries(spec.components?.schemas || {})) {
  const v = deref(v0);
  if (!/event|location|rubric|page|result/i.test(k)) continue;
  console.log(`\nSCHEMA ${k}: ` + Object.entries(v.properties || {}).map(([n, s]) => `${n}:${deref(s)?.type || (s.$ref || "").split("/").pop()}`).join(", "));
}
