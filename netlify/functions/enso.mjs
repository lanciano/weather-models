/* מצב ENSO מ-NOAA CPC.
 *
 * קיימת רק בגלל CORS: NOAA לא מחזירה את הכותרת שמתירה לדפדפנים לקרוא
 * אותה, ולכן fetch מהדף נכשל. שרת אינו כפוף לכך, אז הפונקציה מושכת
 * ומגישה הלאה. כל שאר הסעיף — ההיסטוריה והתחזית העונתית — רץ בדפדפן
 * מול Open-Meteo, שכן פתוחה.
 *
 * ONI הוא ממוצע נע תלת-חודשי של חריגת פני הים באזור Niño 3.4, והוא
 * מתעדכן אחת לחודש. לכן קאש ארוך.
 */
const SRC = "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt";

/* ספי הסיווג של NOAA */
const strengthOf = (a) =>
  a >= 2 ? "veryStrong" : a >= 1.5 ? "strong" : a >= 1 ? "moderate" : "weak";

export default async () => {
  const head = {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    /* שעה בדפדפן, יממה בקצה — המדד חודשי, אין טעם לרדוף אחריו */
    "cache-control": "public, max-age=3600",
    "netlify-cdn-cache-control": "public, max-age=86400, stale-while-revalidate=604800",
  };
  try {
    const r = await fetch(SRC, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(String(r.status));
    const rows = (await r.text()).trim().split("\n").slice(1)
      .map((l) => l.trim().split(/\s+/))
      .filter((p) => p.length === 4 && !Number.isNaN(Number(p[3])));
    const last = rows[rows.length - 1];
    if (!last) throw new Error("empty");

    const oni = Number(last[3]);
    const phase = oni >= 0.5 ? "elNino" : oni <= -0.5 ? "laNina" : "neutral";
    /* המגמה עוזרת לדעת אם האירוע מתחזק או דועך */
    const prev = rows.length > 1 ? Number(rows[rows.length - 2][3]) : oni;

    return new Response(JSON.stringify({
      oni, phase,
      strength: phase === "neutral" ? null : strengthOf(Math.abs(oni)),
      rising: oni > prev,
      season: last[0], year: Number(last[1]),
    }), { headers: head });
  } catch (e) {
    /* נכשל בשקט — הסעיף פשוט לא יוצג */
    return new Response(JSON.stringify({ error: String(e.message || e) }),
      { status: 502, headers: { ...head, "cache-control": "public, max-age=60" } });
  }
};
