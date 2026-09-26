/* Temporaer: Inhalt von myBasel Kinder, lolabrause RSS, flohmarkttermine. */
const UA = { "user-agent": "Mozilla/5.0 (compatible; Fahrplan-Board/1.0)" };
const get = async (u) => (await fetch(u, { headers: UA, signal: AbortSignal.timeout(15000) })).text();
const lines = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, "\n").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/&#8211;/g, "-").split("\n").map(s => s.trim()).filter(Boolean);
const show = (name, arr, n = 70) => { console.log(`\n===== ${name}`); console.log(arr.slice(0, n).map(s => "  " + s.slice(0, 150)).join("\n")); };
const mb = lines(await get("https://www.mybasel.ch/veranstaltungen/kinder"));
const i = mb.findIndex(s => /\d{1,2}\.\d{1,2}\.|Sept|Okt/.test(s));
show("mybasel kinder", mb.slice(Math.max(0, i - 5)), 90);
const rss = await get("https://lolabrause.ch/feed/");
show("lolabrause rss", [...rss.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?(?:<pubDate>([\s\S]*?)<\/pubDate>)?/g)].map(m => `${m[3] || ""} | ${m[1]} | ${m[2]}`), 15);
const ft = lines(await get("https://flohmarkttermine.ch/"));
const j = ft.findIndex(s => /Basel/.test(s));
show("flohmarkttermine (ab Basel)", ft.slice(Math.max(0, j - 10)), 50);
const ftb = lines(await get("https://flohmarkttermine.ch/?s=basel"));
show("flohmarkttermine suche basel", ftb.filter(s => /Basel|Muttenz|Allschwil|Binningen|Bottmingen|Reinach|Riehen|Pratteln|\d{1,2}\.\d{1,2}/.test(s)), 40);
