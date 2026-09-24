import { notFound } from "next/navigation";
import dinners from "../../../data/dinners.json";

/* Rezeptseite hinter dem QR-Code auf dem Board.
   Kurze URL (/r/gnocchi), damit der Code klein bleibt. Die
   Rezepte stehen in data/dinners.json, es gibt also keine
   fremden Links, die irgendwann ins Leere zeigen. */

export function generateStaticParams() {
  return dinners.map(d => ({ id: d.id }));
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const d = dinners.find(x => x.id === id);
  return { title: d ? d.name + " · 10-Min-Znacht" : "Rezept" };
}

const wrap = {
  maxWidth: 520, margin: "0 auto", padding: "28px 20px 48px",
  color: "#111", lineHeight: 1.5,
};
const kicker = {
  fontSize: 12, fontWeight: 700, letterSpacing: ".08em",
  textTransform: "uppercase", color: "#666", margin: "0 0 6px",
};

export default async function Recipe({ params }) {
  const { id } = await params;
  const d = dinners.find(x => x.id === id);
  if (!d) notFound();

  return (
    <main style={wrap}>
      <p style={kicker}>10-Minuten-Znacht · {d.mins} Min.</p>
      <h1 style={{ fontSize: 28, lineHeight: 1.15, margin: "0 0 24px" }}>{d.name}</h1>

      <h2 style={kicker}>Zutaten für 4</h2>
      <ul style={{ margin: "0 0 24px", paddingLeft: 20, fontSize: 17 }}>
        {d.ingredients.map((x, i) => <li key={i}>{x}</li>)}
      </ul>

      <h2 style={kicker}>So geht's</h2>
      <ol style={{ margin: 0, paddingLeft: 22, fontSize: 17 }}>
        {d.steps.map((x, i) => <li key={i} style={{ marginBottom: 8 }}>{x}</li>)}
      </ol>
    </main>
  );
}
