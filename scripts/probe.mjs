/* Temporaer: Struktur museenbasel.ch Agenda. */
const UA = { "user-agent": "Mozilla/5.0 (Fahrplan-Board probe)" };
const h = await (await fetch("https://www.museenbasel.ch/de/agenda", { headers: UA })).text();
let i = h.indexOf("26.09.26");
console.log("FIRST BLOCK:\n", h.slice(Math.max(0, i - 1500), i + 2500).replace(/\s+/g, " "));
const links = [...new Set(h.match(/href="[^"]*agenda[^"]*"/g) || [])].slice(0, 25);
console.log("\nLINKS:", links.join("\n"));
const filt = [...new Set(h.match(/(zielgruppe|filter|kategorie|category|target)[^"'&<>]{0,60}/gi) || [])].slice(0, 30);
console.log("\nFILTER:", filt.join("\n"));
