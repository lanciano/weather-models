import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  ComposedChart, Line, Area, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea,
} from "recharts";

/* ═══════════════════════ models ═══════════════════════ */

const MODELS = [
  { id: "ecmwf_ifs025", short: "ECMWF", ink: "#5AB3F0", name: "IFS", agency: "המרכז האירופי לתחזיות לטווח בינוני", home: "רדינג, אנגליה · בולוניה, איטליה", grid: "9 ק״מ · מוגש בגריד 25 ק״מ", runs: "00 · 06 · 12 · 18 UTC",
    note: "המודל הגלובלי המדויק ביותר שקיים, כבר יותר מעשור ברציפות. אם מודל אחר סותר אותו, ברוב המקרים הטעות אצל האחר. חלש יותר בפירוט מקומי — הוא מכוון לתמונה הגדולה ולטווח של 3–10 ימים." },
  { id: "gfs_seamless", short: "GFS", ink: "#F5A24B", name: "Global Forecast System", agency: "NOAA / NCEP", home: "ארצות הברית", grid: "13 ק״מ · עד 16 ימים", runs: "00 · 06 · 12 · 18 UTC",
    note: "המודל הפתוח והנפוץ בעולם — רוב אפליקציות מזג האוויר החינמיות רצות עליו. נוטה להגזים בכמויות משקעים ולהמציא סופות שלא יקרו בטווח הארוך. אם רק הוא צועק גשם, קח בערבון מוגבל." },
  { id: "icon_seamless", short: "ICON", ink: "#6FD99A", name: "ICON", agency: "DWD — השירות המטאורולוגי הגרמני", home: "אופנבך, גרמניה", grid: "13 ק״מ גלובלי · 7 ק״מ אירופה", runs: "00 · 06 · 12 · 18 UTC",
    note: "גריד מבוסס איקוסהדרון במקום רשת קווי אורך ורוחב, מה שנותן רזולוציה אחידה על כל כדור הארץ. חזק במיוחד באגן הים התיכון, ולכן רלוונטי לישראל יותר מרוב הגלובליים." },
  { id: "ukmo_seamless", short: "UKMO", ink: "#C58BF0", name: "Unified Model", agency: "Met Office", home: "אקסטר, אנגליה", grid: "10 ק״מ", runs: "00 · 06 · 12 · 18 UTC",
    note: "אותו קוד רץ בכל הסקאלות, מתחזית עולמית ועד תחזית שכונתית — מכאן השם. שמרני יחסית: כשהוא כן חוזה גשם, שווה להקשיב." },
  { id: "gem_seamless", short: "GEM", ink: "#F27878", name: "GEM", agency: "Environment Canada", home: "מונטריאול, קנדה", grid: "15 ק״מ", runs: "00 · 12 UTC",
    note: "הקול השלישי בחדר. כשהוא מסכים עם ECMWF ו-GFS זה מחזק מאוד את התחזית, וכשהוא בורח לכיוון אחר זה סימן טוב שהמצב לא יציב." },
  { id: "meteofrance_seamless", short: "ARPEGE", ink: "#4FD8D0", name: "ARPEGE / AROME", agency: "Météo-France", home: "טולוז, צרפת", grid: "11 ק״מ · 1.3 ק״מ מעל צרפת", runs: "00 · 06 · 12 · 18 UTC",
    note: "בנוי במשותף עם ECMWF ומתמחה בים התיכון המערבי. מטפל יפה בסופות שמתפתחות מעל ים חם — בדיוק הסוג שמגיע אלינו בחורף." },
  { id: "jma_seamless", short: "JMA", ink: "#F0D45E", name: "GSM", agency: "הסוכנות המטאורולוגית היפנית", home: "טוקיו, יפן", grid: "20 ק״מ", runs: "00 · 06 · 12 · 18 UTC",
    note: "מכויל סביב מונסונים וטייפונים באסיה. מחוץ לאזור שלו הוא לא הכי חד, אבל מוסיף זווית שונה לגמרי ולכן שימושי כבדיקת שפיות." },
];

const M = Object.fromEntries(MODELS.map((m) => [m.id, m]));
const DEFAULT_ON = ["ecmwf_ifs025", "gfs_seamless", "icon_seamless", "ukmo_seamless", "gem_seamless"];

const VARS = {
  precipitation: { label: "משקעים", unit: "מ״מ/ש׳" },
  temperature_2m: { label: "טמפרטורה", unit: "°C" },
  wind_speed_10m: { label: "רוח", unit: "קמ״ש" },
};

const DAYS_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const DAYS_S = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

/* ═══════════════════════ icons ═══════════════════════ */

const C = { cloud: "#8397B7", dark: "#64789B", sun: "#F5C451", drop: "#57B6EF", snow: "#BFE3FF" };

const Cloud = ({ fill = C.cloud, y = 0 }) => (
  <g fill={fill} transform={`translate(0 ${y})`}>
    <rect x="11" y="25" width="27" height="9.5" rx="4.75" />
    <circle cx="19" cy="25" r="7.2" /><circle cx="30" cy="23" r="9.2" />
  </g>
);
const Sun = ({ cx = 24, cy = 20, r = 7.5 }) => (
  <g>
    <circle cx={cx} cy={cy} r={r} fill={C.sun} />
    {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
      const t = (a * Math.PI) / 180;
      return <line key={a} x1={cx + Math.cos(t) * (r + 3.2)} y1={cy + Math.sin(t) * (r + 3.2)}
        x2={cx + Math.cos(t) * (r + 7)} y2={cy + Math.sin(t) * (r + 7)}
        stroke={C.sun} strokeWidth="2.4" strokeLinecap="round" />;
    })}
  </g>
);
const Drops = ({ xs, len = 6 }) => (
  <g>{xs.map(([x, y], i) => <line key={i} x1={x} y1={y} x2={x - 2.4} y2={y + len} stroke={C.drop} strokeWidth="2.6" strokeLinecap="round" />)}</g>
);

const ICONS = {
  clear: () => <svg viewBox="0 0 48 48"><Sun cx={24} cy={24} r={9} /></svg>,
  partly: () => <svg viewBox="0 0 48 48"><Sun cx={31} cy={16} r={6.5} /><Cloud y={2} /></svg>,
  cloudy: () => <svg viewBox="0 0 48 48"><Cloud fill={C.dark} y={-4} /><Cloud y={3} /></svg>,
  drizzle: () => <svg viewBox="0 0 48 48"><Cloud y={-4} /><Drops xs={[[20, 34], [29, 34]]} len={5} /></svg>,
  rain: () => <svg viewBox="0 0 48 48"><Cloud fill={C.dark} y={-5} /><Drops xs={[[17, 33], [24, 35], [31, 33], [20.5, 39], [27.5, 39]]} /></svg>,
  storm: () => (
    <svg viewBox="0 0 48 48"><Cloud fill={C.dark} y={-6} />
      <Drops xs={[[15, 32], [33, 32], [17, 39], [31, 39]]} />
      <path d="M26 30 L20 39 L24 39 L21.5 46 L29 36 L24.5 36 Z" fill={C.sun} /></svg>
  ),
  snow: () => (
    <svg viewBox="0 0 48 48"><Cloud y={-5} />
      {[[18, 36], [24, 40], [30, 36]].map(([x, y], i) => (
        <g key={i} stroke={C.snow} strokeWidth="2" strokeLinecap="round">
          <line x1={x - 3} y1={y} x2={x + 3} y2={y} />
          <line x1={x - 1.5} y1={y - 2.6} x2={x + 1.5} y2={y + 2.6} />
          <line x1={x + 1.5} y1={y - 2.6} x2={x - 1.5} y2={y + 2.6} />
        </g>))}
    </svg>
  ),
};
const LABEL = { clear: "בהיר", partly: "מעונן חלקית", cloudy: "מעונן", drizzle: "טפטוף", rain: "גשם", storm: "גשם כבד", snow: "שלג" };

function pickIcon(med, cloud, tmax) {
  if (med >= 0.5 && typeof tmax === "number" && tmax <= 2) return "snow";
  if (med >= 12) return "storm";
  if (med >= 3) return "rain";
  if (med >= 0.4) return "drizzle";
  if (typeof cloud !== "number") return "partly";
  if (cloud >= 70) return "cloudy";
  if (cloud >= 30) return "partly";
  return "clear";
}

/* ═══════════════════════ math ═══════════════════════ */

const pick = (o, base, m) => { if (!o) return null; const v = o[`${base}_${m}`]; return v !== undefined ? v : o[base]; };
const nums = (a) => a.filter((v) => typeof v === "number" && !Number.isNaN(v));
const fmt = (v, d = 1) => (typeof v === "number" ? v.toFixed(d) : "–");
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const isoDate = (d) => d.toISOString().slice(0, 10);

function agreement(values) {
  const v = nums(values);
  if (!v.length) return null;
  const lo = Math.min(...v), hi = Math.max(...v);
  const wet = v.filter((x) => x >= 0.5).length, spread = hi - lo;
  let level, text;
  if (hi < 0.5) { level = "dry"; text = "כולם: יבש"; }
  else if (wet === 0) { level = "dry"; text = "כמעט כולם יבשים"; }
  else if (wet === v.length && spread / Math.max(hi, 0.1) < 0.45) { level = "high"; text = "הסכמה גבוהה"; }
  else if (spread / Math.max(hi, 0.1) > 0.7 || wet / v.length < 0.6) { level = "split"; text = "מחלוקת"; }
  else { level = "mid"; text = "הסכמה חלקית"; }
  return { lo, hi, spread, wet, total: v.length, level, text, med: median(v) };
}

function outliers(pairs) {
  const v = pairs.filter((p) => typeof p.v === "number");
  if (v.length < 3) return [];
  const med = median(v.map((p) => p.v)), out = [];
  for (const p of v) {
    const d = Math.abs(p.v - med);
    if (d < 3) continue;
    if (med < 0.4 && p.v >= 3) out.push({ ...p, dir: "wet", med });
    else if (med >= 0.4 && p.v >= med * 2.5) out.push({ ...p, dir: "wet", med });
    else if (med >= 5 && p.v <= med * 0.3) out.push({ ...p, dir: "dry", med });
  }
  return out;
}

/* ═══════════════════════ app ═══════════════════════ */

const FALLBACK = { name: "תל אביב-יפו", region: "ישראל", lat: 32.0853, lon: 34.7818 };
const loadSaved = () => {
  try {
    const s = JSON.parse(localStorage.getItem("wx-place"));
    return s && typeof s.lat === "number" && typeof s.lon === "number" ? s : null;
  } catch { return null; }
};

export default function App() {
  const [place, setPlace] = useState(() => loadSaved() || FALLBACK);
  const [locating, setLocating] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const [active, setActive] = useState(DEFAULT_ON);
  const [variable, setVariable] = useState("precipitation");
  const [daySel, setDaySel] = useState(0);
  const [scope, setScope] = useState("week");
  const [openModel, setOpenModel] = useState(null);
  const [hoverIdx, setHoverIdx] = useState(null);
  const [hHover, setHHover] = useState(null);
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width:760px)").matches
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width:760px)");
    const h = (e) => setNarrow(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const boxRef = useRef(null);

  /* לזכור את המקום האחרון */
  useEffect(() => {
    try { localStorage.setItem("wx-place", JSON.stringify(place)); } catch { /* מצב פרטי */ }
  }, [place]);

  /* לאתר את המיקום הנוכחי */
  const locate = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude, lon = pos.coords.longitude;
        let name = "המיקום שלי", region = "";
        try {
          const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=he`);
          const j = await r.json();
          name = j.city || j.locality || j.principalSubdivision || name;
          region = [j.principalSubdivision, j.countryName].filter(Boolean).join(", ");
        } catch { /* בלי שם, רק קואורדינטות */ }
        setPlace({ name, region, lat, lon });
        setDaySel(0); setScope("week"); setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000, maximumAge: 600000 }
    );
  }, []);

  /* בכניסה ראשונה בלבד — לנסות לזהות איפה אנחנו */
  useEffect(() => { if (!loadSaved()) locate(); }, [locate]);

  const load = useCallback(async () => {
    if (!active.length) { setData(null); setLoading(false); return; }
    setLoading(true); setError(null);
    const url = "https://api.open-meteo.com/v1/forecast" +
      `?latitude=${place.lat}&longitude=${place.lon}` +
      "&hourly=precipitation,temperature_2m,wind_speed_10m,cloud_cover" +
      "&daily=precipitation_sum,temperature_2m_max,temperature_2m_min,wind_speed_10m_max" +
      `&models=${active.join(",")}&timezone=auto&forecast_days=7`;
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`השרת החזיר ${r.status}`);
      const j = await r.json();
      if (j.error) throw new Error(j.reason || "בקשה לא תקינה");
      setData(j);
    } catch (e) { setError(e.message || "לא הצלחתי להביא נתונים"); setData(null); }
    finally { setLoading(false); }
  }, [place, active]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    let dead = false;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=he&format=json`);
        const j = await r.json();
        if (!dead) setResults(j.results || []);
      } catch { if (!dead) setResults([]); }
      finally { if (!dead) setSearching(false); }
    }, 350);
    return () => { dead = true; clearTimeout(t); };
  }, [query]);

  useEffect(() => {
    const h = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setResults([]); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const toggle = (id) => setActive((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const trace = useMemo(() => {
    if (!data?.hourly?.time) return [];
    return data.hourly.time.map((iso, i) => {
      const d = new Date(iso);
      const row = { iso, i, hour: d.getHours(), dayIdx: Math.floor(i / 24), label: `${String(d.getHours()).padStart(2, "0")}:00` };
      const vals = [];
      active.forEach((m) => {
        const v = pick(data.hourly, variable, m)?.[i];
        row[m] = typeof v === "number" ? v : null;
        if (typeof v === "number") vals.push(v);
      });
      row.band = vals.length > 1 ? [Math.min(...vals), Math.max(...vals)] : null;
      return row;
    });
  }, [data, active, variable]);

  const shown = useMemo(
    () => (scope === "week" ? trace : trace.filter((r) => r.dayIdx === daySel)),
    [trace, scope, daySel]
  );

  const days = useMemo(() => {
    if (!data?.daily?.time) return [];
    return data.daily.time.map((iso, i) => {
      const d = new Date(iso);
      const rain = active.map((m) => pick(data.daily, "precipitation_sum", m)?.[i]);
      const tmax = nums(active.map((m) => pick(data.daily, "temperature_2m_max", m)?.[i]));
      const tmin = nums(active.map((m) => pick(data.daily, "temperature_2m_min", m)?.[i]));
      const wind = nums(active.map((m) => pick(data.daily, "wind_speed_10m_max", m)?.[i]));
      const ag = agreement(rain);
      const pairs = active.map((m, k) => ({ id: m, v: rain[k] }));
      const cc = [];
      if (data.hourly?.time) for (let h = i * 24; h < (i + 1) * 24 && h < data.hourly.time.length; h++) {
        const per = nums(active.map((m) => pick(data.hourly, "cloud_cover", m)?.[h]));
        if (per.length) cc.push(mean(per));
      }
      const tMax = tmax.length ? mean(tmax) : null;
      return {
        i, iso, dow: DAYS_HE[d.getDay()], dowS: DAYS_S[d.getDay()], date: `${d.getDate()}.${d.getMonth() + 1}`,
        rain, pairs, ag, tmax: tMax, tmin: tmin.length ? mean(tmin) : null,
        wind: wind.length ? Math.max(...wind) : null,
        icon: pickIcon(ag?.med ?? 0, cc.length ? mean(cc) : null, tMax),
        outs: outliers(pairs),
      };
    });
  }, [data, active]);

  const sel = days[daySel];
  const maxWeekRain = useMemo(() => Math.max(1, ...days.map((d) => d.ag?.hi || 0)), [days]);

  /* שעה־שעה ליום הנבחר: חציון המודלים, התרחיש הגשום, וכמה מסכימים */
  const hourly24 = useMemo(() => {
    if (!data?.hourly?.time) return [];
    const out = [];
    for (let i = daySel * 24; i < (daySel + 1) * 24 && i < data.hourly.time.length; i++) {
      const vals = nums(active.map((m) => pick(data.hourly, "precipitation", m)?.[i]));
      const temps = nums(active.map((m) => pick(data.hourly, "temperature_2m", m)?.[i]));
      const t = new Date(data.hourly.time[i]);
      const med = vals.length ? median(vals) : 0;
      const max = vals.length ? Math.max(...vals) : 0;
      out.push({
        i, h: t.getHours(), label: `${String(t.getHours()).padStart(2, "0")}:00`,
        med, max, extra: Math.max(0, max - med),
        wet: vals.filter((v) => v >= 0.1).length,
        total: vals.length,
        temp: temps.length ? median(temps) : null,
      });
    }
    return out;
  }, [data, active, daySel]);

  const hourlyDry = hourly24.length > 0 && hourly24.every((r) => r.max < 0.05);
  const maxYH = useMemo(() => {
    const v = Math.max(0.6, ...hourly24.map((r) => r.max)) * 1.15;
    const step = v <= 1 ? 0.25 : v <= 3 ? 0.5 : v <= 10 ? 1 : v <= 30 ? 5 : 10;
    return Math.ceil(v / step) * step;
  }, [hourly24]);
  const peak = useMemo(
    () => hourly24.reduce((a, b) => (b.med > (a?.med ?? -1) ? b : a), null),
    [hourly24]
  );

  const weekTotals = useMemo(() => {
    if (!data?.daily?.time) return [];
    return active.map((m) => ({ id: m, total: nums(pick(data.daily, "precipitation_sum", m) || []).reduce((a, b) => a + b, 0) }))
      .sort((a, b) => b.total - a.total);
  }, [data, active]);

  const maxY = useMemo(() => {
    if (variable !== "precipitation") return undefined;
    const v = nums(shown.flatMap((r) => active.map((m) => r[m])));
    return v.length ? Math.max(1, Math.ceil(Math.max(...v) * 1.15 * 10) / 10) : 1;
  }, [shown, active, variable]);

  const V = VARS[variable];
  const PAD_L = 44, PAD_R = 10;

  return (
    <div dir="rtl" className="wx">
      <style>{CSS}</style>
      <div className="sky" />

      <header className="head">
        <div className="head-l">
          <div className="eyebrow">תחזית רב־מודלית</div>
          <h1>חיזוי מזג אוויר חכם</h1>
          <p className="dek">
            שבעה מכונים לאומיים מריצים סופר־מחשבים על אותה אטמוספירה ומגיעים לתשובות שונות.
            זה מה שהם אומרים על <b>{place.name}</b> — ומי מהם צדק כאן בעבר.
          </p>
        </div>
        <div className="head-r" ref={boxRef}>
          <label className="lab" htmlFor="q">חיפוש מקום</label>
          <input id="q" className="srch" value={query} autoComplete="off"
            placeholder="תל אביב, ירושלים, רייקיאוויק…" onChange={(e) => setQuery(e.target.value)} />
          {searching && <div className="hint">מחפש…</div>}
          {!!results.length && (
            <ul className="res">
              {results.map((r) => (
                <li key={r.id}>
                  <button onClick={() => {
                    setPlace({ name: r.name, region: [r.admin1, r.country].filter(Boolean).join(", "), lat: r.latitude, lon: r.longitude });
                    setQuery(""); setResults([]); setDaySel(0); setScope("week");
                  }}>
                    <span className="rn">{r.name}</span>
                    <span className="rr">{[r.admin1, r.country].filter(Boolean).join(", ")}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="coords">
            {place.region && <>{place.region} · </>}{place.lat.toFixed(3)}°, {place.lon.toFixed(3)}°
            <button className="geo" onClick={locate} disabled={locating}>
              {locating ? "מאתר…" : "המיקום שלי"}
            </button>
          </div>
        </div>
      </header>

      {/* ── week strip ── */}
      <section className="week">
        {loading && <div className="wload">טוען תחזיות…</div>}
        {error && <div className="werr">{error} <button onClick={load}>נסה שוב</button></div>}

        <div className="wrow">
          {days.map((d) => {
            const Ic = ICONS[d.icon];
            return (
              <button key={d.i} className={`wcell ${daySel === d.i ? "on" : ""}`}
                onClick={() => { setDaySel(d.i); setScope("day"); }}>
                <span className="w-dow"><i className="lg">{d.dow}</i><i className="sm">{d.dowS}</i></span>
                <span className="w-date">{d.date}</span>
                <span className="w-ic"><Ic /></span>
                <span className="w-t"><b>{fmt(d.tmax, 0)}°</b><em>{fmt(d.tmin, 0)}°</em></span>
                <span className={`w-mm ${d.ag && d.ag.med >= 0.1 ? "wet" : ""}`}>
                  {d.ag && d.ag.med >= 0.1 ? `${fmt(d.ag.med)} מ״מ` : "יבש"}
                </span>
                <span className="w-bar"><i style={{ width: `${Math.min(100, ((d.ag?.med || 0) / maxWeekRain) * 100)}%` }} /></span>
                {!!d.outs.length && <span className="w-warn" />}
              </button>
            );
          })}
        </div>

        {sel && (
          <div className="detail">
            <div className="d-main">
              <span className="d-ic">{React.createElement(ICONS[sel.icon])}</span>
              <div className="d-txt">
                <div className="d-day">יום {sel.dow} · {sel.date}</div>
                <div className="d-cond">{LABEL[sel.icon]}</div>
                <div className="d-temps"><b>{fmt(sel.tmax, 0)}°</b> <span>/ {fmt(sel.tmin, 0)}°</span>
                  {typeof sel.wind === "number" && <span className="d-wind">· רוח עד {fmt(sel.wind, 0)} קמ״ש</span>}</div>
              </div>
              <div className={`d-verdict v-${sel.ag?.level || "dry"}`}>
                <b>{sel.ag?.text || "—"}</b>
                <span>{sel.ag ? sel.ag.wet : 0} מתוך {sel.ag ? sel.ag.total : 0} מודלים חוזים גשם</span>
              </div>
            </div>

            <div className="d-scale">
              <div className="d-track">
                {sel.pairs.map((p) => typeof p.v === "number" && (
                  <span key={p.id} className="d-tick" title={`${M[p.id].short} · ${fmt(p.v)} מ״מ`}
                    style={{ background: M[p.id].ink, insetInlineStart: `${Math.min(100, (p.v / Math.max(1, sel.ag?.hi || 1)) * 100)}%` }} />
                ))}
              </div>
              <div className="d-nums">
                <span>{fmt(sel.ag?.lo)} מ״מ · התרחיש היבש</span>
                <span>{fmt(sel.ag?.hi)} מ״מ · התרחיש הגשום</span>
              </div>
              <div className="d-chips">
                {[...sel.pairs].filter((p) => typeof p.v === "number").sort((a, b) => a.v - b.v).map((p) => (
                  <span className="d-chip" key={p.id} style={{ borderColor: M[p.id].ink + "66" }}>
                    <i style={{ background: M[p.id].ink }} />
                    <b style={{ color: M[p.id].ink }}>{M[p.id].short}</b>
                    <em>{fmt(p.v)} מ״מ</em>
                  </span>
                ))}
              </div>
            </div>

            {!!sel.outs.length && (
              <div className="d-outs">
                {sel.outs.map((o, k) => (
                  <div className="d-out" key={k} style={{ borderInlineStartColor: M[o.id].ink }}>
                    <b style={{ color: M[o.id].ink }}>{M[o.id].short}</b>{" "}
                    {o.dir === "wet" ? "בורח מהחבורה:" : "יבש לעומת השאר:"} <b>{fmt(o.v)} מ״מ</b> מול חציון של {fmt(o.med)} מ״מ.
                    כשמודל בודד רחוק כל כך, זה בדרך כלל סימן שהמערכת גבולית — לא נבואה.
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── שעה־שעה ── */}
      {!!hourly24.length && (
        <section className="hourly">
          <div className="sec-head">
            <h2>שעה־שעה</h2>
            <span className="sub">יום {sel?.dow} · {sel?.date}</span>
          </div>

          <div className="hpanel">
            <div className={`hlead ${hourlyDry ? "dry" : ""}`}>
              {hourlyDry ? (
                <>כל {active.length} המודלים חוזים <b>יום יבש</b> — אין שעה אחת שבה אפילו אחד מהם מצפה למשקעים.
                  הקו הכתום הוא הטמפרטורה לאורך היום.</>
              ) : peak && peak.med > 0.05 ? (
                <>השיא הצפוי סביב <b>{peak.label}</b> — כ־<b>{fmt(peak.med)} מ״מ</b> לפי חציון המודלים,
                  ועד <b>{fmt(peak.max)} מ״מ</b> בתרחיש הגשום.</>
              ) : (
                <>רוב המודלים חוזים יום יבש, אבל יש שעות שבהן חלקם מצפים למשקעים קלים.</>
              )}
            </div>

            {narrow && <HourReadout row={hHover ? hourly24.find((r) => r.label === hHover) : null} pos="top" />}

            <div dir="ltr" style={{ width: "100%", height: narrow ? 200 : 240 }}>
              <ResponsiveContainer>
                <ComposedChart data={hourly24} margin={{ top: 10, right: 4, bottom: 0, left: 0 }} barCategoryGap="18%">
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#8FA1BC" }}
                    axisLine={{ stroke: "#2E4166" }} tickLine={false} interval={narrow ? 3 : 2} />
                  <YAxis yAxisId="l" domain={[0, maxYH]} width={38} tick={{ fontSize: 11, fill: "#8FA1BC" }}
                    axisLine={false} tickLine={false} />
                  <YAxis yAxisId="r" orientation="right" domain={["auto", "auto"]} width={38}
                    tick={{ fontSize: 11, fill: "#F5A24B" }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: "#FFFFFF", fillOpacity: 0.05 }}
                    content={<HourTip narrow={narrow} onHover={setHHover} />} />
                  <Bar yAxisId="l" dataKey="med" stackId="p" fill="#5AB3F0" animationDuration={700} />
                  <Bar yAxisId="l" dataKey="extra" stackId="p" fill="#9BB6E8" fillOpacity={0.28}
                    radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  <Line yAxisId="r" dataKey="temp" stroke="#F5A24B" strokeWidth={2} dot={false}
                    activeDot={<TempDot />} type="monotone" connectNulls animationDuration={800} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {!narrow && <HourReadout row={hHover ? hourly24.find((r) => r.label === hHover) : null} />}

            <div className="hagree" dir="ltr">
              {hourly24.map((r) => (
                <span key={r.i} className="hcell" title={`${r.label} · ${r.wet}/${r.total}`}>
                  <i style={{ opacity: r.total ? 0.1 + (r.wet / r.total) * 0.9 : 0.1 }} />
                  {r.h % 6 === 0 && <em>{String(r.h).padStart(2, "0")}</em>}
                </span>
              ))}
            </div>

            <div className="hlegend">
              <span><i className="sw solid" /> חלק כהה בעמודה — חציון המודלים</span>
              <span><i className="sw ghost" /> ההמשך הבהיר — עד לתרחיש הגשום ביותר</span>
              <span><i className="sw warm" /> טמפרטורה (ציר ימין)</span>
              <span><i className="sw grad" /> כמה מודלים מסכימים שתרד טיפה</span>
            </div>
          </div>
        </section>
      )}

      {/* ── pens ── */}
      <section className="pens">
        <div className="sec-head"><h2>עטים על הנייר</h2><span className="sub">כבו והדליקו מודלים כדי לראות איך התמונה משתנה</span></div>
        <div className="pen-row">
          {MODELS.map((m) => {
            const on = active.includes(m.id);
            return (
              <button key={m.id} onClick={() => toggle(m.id)} aria-pressed={on} className={`pen ${on ? "on" : ""}`}
                style={on ? { borderColor: m.ink, color: m.ink, background: m.ink + "1A" } : undefined}>
                <span className="nib" style={{ background: on ? m.ink : "transparent", borderColor: on ? m.ink : "#4A5A78" }} />{m.short}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── chart ── */}
      <section className="graph">
        <div className="gbar">
          <div className="vars">
            {Object.entries(VARS).map(([k, v]) => (
              <button key={k} className={`vtab ${variable === k ? "on" : ""}`} onClick={() => setVariable(k)}>{v.label}</button>
            ))}
          </div>
          <div className="vars">
            <button className={`vtab ${scope === "week" ? "on" : ""}`} onClick={() => setScope("week")}>כל השבוע</button>
            <button className={`vtab ${scope === "day" ? "on" : ""}`} onClick={() => setScope("day")}>יום {sel?.dow}</button>
          </div>
        </div>

        <div className="panel">
          {!active.length && <div className="veil">כל העטים כבויים. הדליקו לפחות מודל אחד.</div>}
          <div className="ptop"><span className="unit">{V.unit}</span></div>

          {scope === "week" && (
            <div className="bands" dir="ltr" style={{ marginLeft: PAD_L, marginRight: PAD_R }}>
              {days.map((d) => (
                <button key={d.i} className={`band ${daySel === d.i ? "on" : ""}`} onClick={() => { setDaySel(d.i); setScope("day"); }}>
                  <span className="b-ic">{React.createElement(ICONS[d.icon])}</span>
                  <span className="b-day">{d.dow}</span><span className="b-date">{d.date}</span>
                </button>
              ))}
            </div>
          )}

          {narrow && <Readout row={hoverIdx != null ? trace[hoverIdx] : null} models={active} variable={variable} pos="top" />}

          <div dir="ltr" style={{ width: "100%", height: narrow ? 230 : 290 }}>
            <ResponsiveContainer>
              <ComposedChart data={shown} margin={{ top: 6, right: PAD_R, bottom: 4, left: 0 }}>
                <XAxis dataKey="i" type="number" domain={["dataMin", "dataMax"]}
                  ticks={scope === "week" ? [] : shown.filter((r) => r.hour % 3 === 0).map((r) => r.i)}
                  tickFormatter={(i) => trace[i]?.label || ""} tick={{ fontSize: 12, fill: "#8FA1BC" }}
                  axisLine={{ stroke: "#2E4166" }} tickLine={false} interval={0} height={scope === "week" ? 6 : 24} />
                <YAxis domain={variable === "precipitation" ? [0, maxY] : ["auto", "auto"]} width={PAD_L}
                  tick={{ fontSize: 12, fill: "#8FA1BC" }} axisLine={false} tickLine={false} />
                {scope === "week" && days.filter((d) => d.i % 2 === 1).map((d) => (
                  <ReferenceArea key={d.i} x1={d.i * 24} x2={d.i * 24 + 23} fill="#FFFFFF" fillOpacity={0.028} strokeOpacity={0} />
                ))}
                {scope === "week" && days.slice(1).map((d) => <ReferenceLine key={d.i} x={d.i * 24} stroke="#2E4166" />)}
                <Tooltip content={<ChartTip variable={variable} trace={trace} narrow={narrow} onHover={setHoverIdx} />}
                  cursor={{ stroke: "#7E93B8", strokeDasharray: "3 3" }} />
                <Area dataKey="band" stroke="none" fill="#9BB6E8" fillOpacity={0.16} isAnimationActive={false} connectNulls />
                {active.map((m) => (
                  <Line key={m} dataKey={m} stroke={M[m].ink} strokeWidth={2} dot={false}
                    type={variable === "precipitation" ? "step" : "monotone"} connectNulls animationDuration={800} />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {!narrow && <Readout row={hoverIdx != null ? trace[hoverIdx] : null} models={active} variable={variable} />}

          <div className="pkey"><span className="kb" /> אזור אי־ההסכמה — הפער בין המודל הקיצוני ביותר לכל כיוון</div>
        </div>
      </section>

      <Scorecard place={place} models={active} />

      {weekTotals.length > 1 && (
        <section className="totals">
          <h2>סך הכל לשבוע, לפי מודל</h2>
          <div className="trows">
            {weekTotals.map((t) => (
              <div className="tot" key={t.id}>
                <span className="tname" style={{ color: M[t.id].ink }}>{M[t.id].short}</span>
                <span className="tbar"><span style={{ background: M[t.id].ink, width: `${weekTotals[0].total > 0 ? (t.total / weekTotals[0].total) * 100 : 0}%` }} /></span>
                <span className="tnum">{fmt(t.total)} מ״מ</span>
              </div>
            ))}
          </div>
          <p className="tnote">
            {weekTotals[0].total - weekTotals[weekTotals.length - 1].total > 8
              ? "פער גדול בין המודלים לאורך השבוע — סימן שהמערכת עוד לא התייצבה. שווה לבדוק שוב אחרי הריצה הבאה."
              : "המודלים קרובים יחסית זה לזה השבוע. תחזית יציבה."}
          </p>
        </section>
      )}

      <section className="learn">
        <h2>מי מריץ מה</h2>
        <div className="lgrid">
          {MODELS.map((m) => {
            const open = openModel === m.id;
            return (
              <article key={m.id} className={`mc ${open ? "open" : ""}`}>
                <button className="mc-top" onClick={() => setOpenModel(open ? null : m.id)} aria-expanded={open}>
                  <span className="mc-rule" style={{ background: m.ink }} />
                  <span className="mc-t"><span className="mc-short" style={{ color: m.ink }}>{m.short}</span><span className="mc-name">{m.name}</span></span>
                  <span className="mc-p">{open ? "−" : "+"}</span>
                </button>
                {open && (
                  <div className="mc-body">
                    <dl>
                      <div><dt>מפעיל</dt><dd>{m.agency}</dd></div>
                      <div><dt>מיקום</dt><dd>{m.home}</dd></div>
                      <div><dt>גודל תא</dt><dd>{m.grid}</dd></div>
                      <div><dt>ריצות ביום</dt><dd>{m.runs}</dd></div>
                    </dl>
                    <p>{m.note}</p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
        <div className="primer">
          <h3>למה בכלל יש יותר ממודל אחד</h3>
          <p>מודל חיזוי מחלק את האטמוספירה לתאים — כל תא הוא קופסה של כמה קילומטרים על כמה קילומטרים, בעשרות שכבות מהקרקע ועד לסטרטוספירה. הוא מכניס לכל תא את מה שנמדד עכשיו, מריץ את משוואות זרימת הנוזלים קדימה בצעדים של דקות, וחוזר על זה מאות אלפי פעמים.</p>
          <p>שני דברים מייצרים את ההבדלים. הראשון הוא <b>איך כל מודל מטפל במה שקטן מדי מכדי להיכנס לתא</b> — ענן בודד, טיפה שמתעבה, ערבול מעל שדה חרוש. אין דרך לחשב את זה ישירות, אז כל מכון כותב לזה קירוב משלו. הקירובים האלה הם מקור המחלוקת האמיתי.</p>
          <p>השני הוא <b>הכאוס</b>. הפרש זעיר בתנאי ההתחלה תופח לתחזיות שונות לגמרי בתוך ימים. לכן הפער בין המודלים מתרחב ככל שמתרחקים — <b>רוחב אזור אי־ההסכמה הוא מדד ישיר לכמה כדאי לסמוך על התחזית</b>.</p>
        </div>
      </section>

      <footer className="foot">
        נתונים דרך Open-Meteo, שמוריד את קבצי ה־GRIB2 הגולמיים משרתי NOAA, ECMWF, DWD, Met Office,
        Environment Canada, Météo-France ו־JMA. כרטיס הציונים מבוסס על ארכיון הריצות הקודמות מול סדרת האנליזה.
      </footer>
    </div>
  );
}

/* ═══════════════════════ readout ═══════════════════════ */

/** מגשר: מקבל את אירועי המגע של recharts ומדווח החוצה, ומצייר טולטיפ רק במסך רחב */
function ChartTip({ active, payload, label, variable, trace, narrow, onHover }) {
  const live = !!(active && payload && payload.length);
  useEffect(() => { onHover(live ? label : null); }, [live, label, onHover]);
  if (narrow || !live) return null;
  return <Ink active={active} payload={payload} label={label} variable={variable} trace={trace} />;
}

function Readout({ row, models, variable, pos }) {
  const cls = `readout${pos === "top" ? " top" : ""}`;
  if (!row) {
    return <div className={`${cls} empty`}>העבירו את האצבע או הסמן על הגרף כדי לראות מה כל מודל אומר</div>;
  }
  const d = new Date(row.iso);
  const vals = models
    .map((m) => ({ id: m, v: row[m] }))
    .filter((p) => typeof p.v === "number")
    .sort((a, b) => b.v - a.v);
  return (
    <div className={cls}>
      <span className="ro-time">
        <b>{String(d.getHours()).padStart(2, "0")}:00</b>
        <em>{DAYS_HE[d.getDay()]}</em>
      </span>
      <div className="ro-chips">
        {vals.map((p) => (
          <span className="ro-chip" key={p.id} style={{ borderColor: M[p.id].ink + "55" }}>
            <i style={{ background: M[p.id].ink }} />
            <b style={{ color: M[p.id].ink }}>{M[p.id].short}</b>
            <em>{p.v.toFixed(1)}</em>
          </span>
        ))}
        <span className="ro-unit">{VARS[variable].unit}</span>
      </div>
    </div>
  );
}

function HourTip({ active, payload, label, narrow, onHover }) {
  const live = !!(active && payload && payload.length);
  useEffect(() => { onHover(live ? label : null); }, [live, label, onHover]);
  if (narrow || !live) return null;
  const r = payload[0]?.payload;
  if (!r) return null;
  return (
    <div dir="rtl" className="tip">
      <div className="tip-h">{r.label}</div>
      <div className="tip-r"><span className="tip-n">חציון המודלים</span><span className="tip-v">{fmt(r.med)} מ״מ</span></div>
      <div className="tip-r"><span className="tip-n">התרחיש הגשום</span><span className="tip-v">{fmt(r.max)} מ״מ</span></div>
      <div className="tip-r"><span className="tip-n">מסכימים על טיפה</span><span className="tip-v">{r.wet} מתוך {r.total}</span></div>
      {typeof r.temp === "number" && (
        <div className="tip-r"><span className="tip-n">טמפרטורה</span><span className="tip-v">{fmt(r.temp, 0)}°</span></div>
      )}
    </div>
  );
}

/** בועה קטנה עם המעלות, צמודה לנקודה שהאצבע נמצאת עליה */
function TempDot({ cx, cy, payload }) {
  if (cx == null || cy == null || typeof payload?.temp !== "number") return null;
  const w = 42, h = 22, gap = 11;
  const above = cy > h + gap + 6;
  const y = above ? cy - gap - h : cy + gap;
  const ty = above ? cy - gap : cy + gap;
  return (
    <g style={{ pointerEvents: "none" }}>
      <circle cx={cx} cy={cy} r={5.5} fill="#F5A24B" stroke="#0E1728" strokeWidth={2.5} />
      <path d={above
        ? `M${cx - 5} ${ty} L${cx} ${ty + 5} L${cx + 5} ${ty} Z`
        : `M${cx - 5} ${ty} L${cx} ${ty - 5} L${cx + 5} ${ty} Z`}
        fill="#F5A24B" />
      <rect x={cx - w / 2} y={y} width={w} height={h} rx={8} fill="#F5A24B" />
      <text x={cx} y={y + h / 2} textAnchor="middle" dominantBaseline="central"
        fontSize="13.5" fontWeight="700" fill="#0E1728"
        fontFamily="'IBM Plex Sans Hebrew',system-ui,sans-serif">
        {Math.round(payload.temp)}°
      </text>
    </g>
  );
}

function HourReadout({ row, pos }) {
  const cls = `readout${pos === "top" ? " top" : ""}`;
  if (!row) {
    return <div className={`${cls} empty`}>געו בגרף כדי לראות מה צפוי בכל שעה</div>;
  }
  return (
    <div className={cls}>
      <span className="ro-time"><b>{row.label}</b></span>
      <div className="ro-chips">
        <span className="ro-chip" style={{ borderColor: "#5AB3F055" }}>
          <i style={{ background: "#5AB3F0" }} /><b style={{ color: "#5AB3F0" }}>חציון</b><em>{fmt(row.med)} מ״מ</em>
        </span>
        <span className="ro-chip" style={{ borderColor: "#9BB6E855" }}>
          <i style={{ background: "#9BB6E8", opacity: 0.6 }} /><b style={{ color: "#9BB6E8" }}>גשום</b><em>{fmt(row.max)} מ״מ</em>
        </span>
        <span className="ro-chip" style={{ borderColor: "#8FA1BC44" }}>
          <b style={{ color: "var(--muted)" }}>מסכימים</b><em>{row.wet}/{row.total}</em>
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════ scorecard ═══════════════════════ */

const findSeries = (hourly, base, lead, model) => {
  if (!hourly) return null;
  const v = `${base}_previous_day${lead}`;
  const cands = [`${v}_${model}`, `${base}_${model}_previous_day${lead}`, v];
  for (const c of cands) if (Array.isArray(hourly[c])) return hourly[c];
  const k = Object.keys(hourly).find((k) => k.startsWith(base) && k.includes(`previous_day${lead}`));
  return k ? hourly[k] : null;
};

/** שעות → ימים. מדלג על ימים חלקיים בקצוות. */
function bucketDaily(times, values, mode) {
  const acc = new Map(), out = new Map();
  if (!times) return out;
  for (let i = 0; i < times.length; i++) {
    const d = times[i].slice(0, 10);
    let e = acc.get(d);
    if (!e) { e = { n: 0, valid: 0, sum: 0, max: -Infinity }; acc.set(d, e); }
    e.n++;
    const v = values?.[i];
    if (typeof v === "number" && !Number.isNaN(v)) { e.valid++; e.sum += v; if (v > e.max) e.max = v; }
  }
  for (const [d, e] of acc) {
    if (e.n < 24 || e.valid < 20) continue;
    out.set(d, mode === "sum" ? e.sum : e.max);
  }
  return out;
}

function score(pred, obs) {
  if (!pred || !obs) return null;
  let n = 0, sae = 0, hit = 0, miss = 0, fa = 0, dry = 0;
  for (const [d, o] of obs) {
    const p = pred.get(d);
    if (typeof p !== "number") continue;
    n++; sae += Math.abs(p - o);
    const ow = o >= 1, pw = p >= 0.5;
    if (ow && pw) hit++; else if (ow) miss++; else if (pw) fa++; else dry++;
  }
  return n >= 5 ? { n, mae: sae / n, hit, miss, fa, dry } : null;
}

function Scorecard({ place, models }) {
  const [win, setWin] = useState(90);
  const [lead, setLead] = useState(3);
  const [state, setState] = useState({ status: "idle" });

  useEffect(() => { setState({ status: "idle" }); }, [place, lead, win, models]);

  const run = useCallback(async () => {
    if (!models.length) return;
    setState({ status: "loading" });
    const past = Math.min(win, 92);
    const end = new Date(); end.setDate(end.getDate() - 1);
    const start = new Date(end); start.setDate(start.getDate() - past);
    const geo = `latitude=${place.lat}&longitude=${place.lon}&timezone=auto`;

    try {
      // האמת: סדרת האנליזה
      const tRes = await fetch(`https://historical-forecast-api.open-meteo.com/v1/forecast?${geo}` +
        `&start_date=${isoDate(start)}&end_date=${isoDate(end)}&daily=precipitation_sum,temperature_2m_max`);
      const truth = await tRes.json();
      if (truth.error) throw new Error(truth.reason);
      const oRain = new Map(), oTemp = new Map();
      (truth.daily?.time || []).forEach((d, i) => {
        const r = truth.daily.precipitation_sum?.[i], t = truth.daily.temperature_2m_max?.[i];
        if (typeof r === "number") oRain.set(d, r);
        if (typeof t === "number") oTemp.set(d, t);
      });
      if (!oRain.size) throw new Error("לא חזרו נתוני אמת לתקופה הזו");

      // מה כל מודל ניבא, שעה־שעה, בטווח הנבחר
      const rows = await Promise.all(models.map(async (m) => {
        try {
          const url = `https://previous-runs-api.open-meteo.com/v1/forecast?${geo}` +
            `&hourly=precipitation_previous_day${lead},temperature_2m_previous_day${lead}` +
            `&models=${m}&past_days=${past}&forecast_days=1`;
          const r = await fetch(url);
          const j = await r.json();
          if (j.error) return { id: m, err: j.reason };
          const pr = findSeries(j.hourly, "precipitation", lead, m);
          const pt = findSeries(j.hourly, "temperature_2m", lead, m);
          if (!pr) return { id: m, err: "אין סדרה בטווח הזה", keys: Object.keys(j.hourly || {}) };
          return {
            id: m,
            rain: score(bucketDaily(j.hourly.time, pr, "sum"), oRain),
            temp: score(bucketDaily(j.hourly.time, pt, "max"), oTemp),
          };
        } catch (e) { return { id: m, err: e.message }; }
      }));

      const ok = rows.filter((r) => r.rain);
      if (!ok.length) {
        const why = rows.find((r) => r.err)?.err;
        throw new Error(why ? `לא הצלחתי לחשב ציונים — ${why}` : "לא הצלחתי לחשב ציונים לתקופה הזו");
      }
      ok.sort((a, b) => a.rain.mae - b.rain.mae);
      setState({
        status: "done", rows: ok, failed: rows.filter((r) => !r.rain),
        days: ok[0].rain.n, wetDays: ok[0].rain.hit + ok[0].rain.miss,
      });
    } catch (e) { setState({ status: "error", msg: e.message || "משהו נכשל" }); }
  }, [place, models, win, lead]);

  const s = state;
  const worst = s.rows ? Math.max(...s.rows.map((r) => r.rain.mae), 0.01) : 1;

  return (
    <section className="score">
      <div className="sec-head"><h2>מי צדק כאן בעבר</h2></div>
      <p className="sub wide">
        לכל מודל יש ארכיון של מה שהוא <b>ניבא</b> בעבר. משווים אותו למה שבאמת קרה ומקבלים דירוג
        אמיתי — <b>לנקודה הזו בלבד</b>. המודל שמנצח בתל אביב הוא לא בהכרח זה שמנצח בהרי הגולן.
      </p>

      <div className="s-ctl">
        <div className="s-grp">
          <span className="s-lab">כמה ימים מראש נבדק</span>
          <div className="vars">
            {[1, 2, 3, 5].map((d) => <button key={d} className={`vtab ${lead === d ? "on" : ""}`} onClick={() => setLead(d)}>{d}</button>)}
          </div>
        </div>
        <div className="s-grp">
          <span className="s-lab">תקופת הבדיקה</span>
          <div className="vars">
            {[30, 60, 90].map((d) => <button key={d} className={`vtab ${win === d ? "on" : ""}`} onClick={() => setWin(d)}>{d} יום</button>)}
          </div>
        </div>
        <button className="s-run" onClick={run} disabled={s.status === "loading"}>
          {s.status === "loading" ? "מחשב…" : "חשב ציונים"}
        </button>
      </div>

      {s.status === "idle" && <div className="s-empty">בחרו טווח ולחצו “חשב ציונים”. הבדיקה רצה על ארכיון הריצות של Open-Meteo, עד 92 יום אחורה.</div>}
      {s.status === "error" && <div className="s-err">{s.msg}</div>}

      {s.status === "done" && (
        <>
          <div className="s-lead">
            על פני <b>{s.days}</b> ימים ב{place.name}, מתוכם <b>{s.wetDays}</b> ימים גשומים,
            הכי מדויק בטווח של {lead} ימים מראש היה{" "}
            <b style={{ color: M[s.rows[0].id].ink }}>{M[s.rows[0].id].short}</b>.
          </div>

          <div className="s-table">
            <div className="s-hrow">
              <span>מודל</span><span>טעות ממוצעת</span><span>פספס גשם</span><span>התריע לשווא</span><span>טעות מעלות</span>
            </div>
            {s.rows.map((r, k) => (
              <div className={`s-row ${k === 0 ? "best" : ""}`} key={r.id}>
                <span className="s-name" style={{ color: M[r.id].ink }}>
                  {M[r.id].short}{k === 0 && <i className="s-crown">הכי מדויק</i>}
                </span>
                <span className="s-mae">
                  <i className="s-bar"><em style={{ background: M[r.id].ink, width: `${(r.rain.mae / worst) * 100}%` }} /></i>
                  <b>{fmt(r.rain.mae, 2)} מ״מ</b>
                </span>
                <span className="s-n" data-l="פספס">{r.rain.miss} ימים</span>
                <span className="s-n" data-l="שווא">{r.rain.fa} ימים</span>
                <span className="s-n" data-l="מעלות">{r.temp ? `${fmt(r.temp.mae, 1)}°` : "–"}</span>
              </div>
            ))}
          </div>

          {!!s.failed.length && (
            <div className="s-note">אין ארכיון מספיק ל: {s.failed.map((f) => `${M[f.id]?.short}${f.err ? ` (${f.err})` : ""}`).join(" · ")}</div>
          )}

          <div className="s-legend">
            <p><b>טעות ממוצעת</b> — בכמה מ״מ המודל פספס ביום ממוצע. נמוך יותר טוב יותר.</p>
            <p><b>פספס גשם</b> — ימים שבהם ירד גשם משמעותי והמודל אמר יבש. זו הטעות שהכי כואבת.</p>
            <p><b>התריע לשווא</b> — ימים שבהם המודל הבטיח גשם ולא ירד. מודל עם המון התרעות שווא נראה בטוח בעצמו אבל שווה פחות.</p>
            <p className="s-caveat">
              ה״אמת“ כאן היא סדרת אנליזה — שחזור של מה שקרה מתוך מדידות שהוטמעו למודל, לא מד גשם פיזי.
              היא טובה לטמפרטורה ולמגמות, אבל מחליקה גשמים מקומיים חזקים. אמת מדויקת יותר לישראל תגיע
              מתחנות המדידה של השירות המטאורולוגי.
            </p>
          </div>
        </>
      )}
    </section>
  );
}

/* ═══════════════════════ tooltip ═══════════════════════ */

function Ink({ active, payload, label, variable, trace }) {
  if (!active || !payload?.length) return null;
  const row = trace[label];
  const lines = payload.filter((p) => p.dataKey !== "band" && typeof p.value === "number").sort((a, b) => b.value - a.value);
  if (!lines.length) return null;
  const d = row ? new Date(row.iso) : null;
  return (
    <div dir="rtl" className="tip">
      <div className="tip-h">{d ? `${DAYS_HE[d.getDay()]} · ${String(d.getHours()).padStart(2, "0")}:00` : ""}</div>
      {lines.map((p) => (
        <div className="tip-r" key={p.dataKey}>
          <span className="tip-nib" style={{ background: p.stroke }} />
          <span className="tip-n">{M[p.dataKey]?.short}</span>
          <span className="tip-v">{p.value.toFixed(1)} <em>{VARS[variable].unit}</em></span>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════ styles ═══════════════════════ */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Hebrew:wght@300;400;500;600;700&display=swap');

html,body,#root{margin:0;padding:0;min-height:100%;background:#0E1728}
body{-webkit-font-smoothing:antialiased;overscroll-behavior-y:none}

.wx{
  --night:#0E1728; --panel:#16223A; --panel2:#1B2942; --rule:#2A3B5A; --rule2:#22314D;
  --text:#E9EEF7; --muted:#8FA1BC; --dim:#B7C4D8;
  --sky:#5AB3F0; --warm:#F5A24B; --mint:#6FD99A; --rose:#F27878;
  position:relative;min-height:100vh;background:var(--night);color:var(--text);
  font-family:'IBM Plex Sans Hebrew',system-ui,sans-serif;font-weight:400;line-height:1.6;
  font-variant-numeric:tabular-nums;overflow:hidden;
  padding:env(safe-area-inset-top) max(18px,env(safe-area-inset-right))
          calc(60px + env(safe-area-inset-bottom)) max(18px,env(safe-area-inset-left));
}
.wx *{box-sizing:border-box}
.wx h1,.wx h2,.wx h3{margin:0;letter-spacing:-.02em;line-height:1.15}
.wx h1{font-weight:700} .wx h2{font-weight:600} .wx h3{font-weight:600}
.wx b{font-weight:600}
.wx button{font-family:inherit;cursor:pointer;color:inherit}
.wx button:focus-visible,.wx input:focus-visible{outline:2px solid var(--sky);outline-offset:2px}
.sky{position:absolute;inset:0 0 auto;height:420px;pointer-events:none;
  background:radial-gradient(90% 90% at 80% -20%,rgba(90,179,240,.16),transparent 62%),
  radial-gradient(70% 80% at 12% -10%,rgba(197,139,240,.12),transparent 60%)}
.sec-head{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin-bottom:12px}
.sub{font-size:13.5px;color:var(--muted);font-weight:300}
.sub.wide{max-width:72ch;line-height:1.7;margin:0 0 18px}
.sub b{color:var(--dim)}

.head{position:relative;display:flex;gap:36px;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;
  max-width:1120px;margin:0 auto;padding:42px 0 26px;border-bottom:1px solid var(--rule)}
.head-l{flex:1 1 400px;min-width:0}
.eyebrow{font-size:11.5px;letter-spacing:.22em;color:var(--sky);margin-bottom:12px;font-weight:500}
.head h1{font-size:clamp(30px,5.5vw,50px)}
.dek{max-width:54ch;margin:13px 0 0;font-size:15px;color:var(--dim);font-weight:300}
.head-r{flex:0 1 300px;position:relative}
.lab{display:block;font-size:12px;color:var(--muted);margin-bottom:7px;font-weight:500}
.srch{width:100%;background:var(--panel);border:1px solid var(--rule);border-radius:10px;
  padding:11px 13px;font-size:16px;font-family:inherit;color:var(--text)}
.srch::placeholder{color:#6B7D9B;font-weight:300}
.hint{font-size:12px;color:var(--muted);margin-top:6px}
.res{position:absolute;z-index:30;inset-inline:0;top:100%;margin:6px 0 0;padding:5px;list-style:none;
  background:var(--panel2);border:1px solid var(--rule);border-radius:10px;max-height:290px;overflow:auto;
  box-shadow:0 14px 34px rgba(0,0,0,.42)}
.res button{display:block;width:100%;text-align:start;background:none;border:0;padding:9px 11px;border-radius:7px}
.res button:hover{background:#26385A}
.rn{display:block;font-size:14.5px;font-weight:500}
.rr{display:block;font-size:12px;color:var(--muted);font-weight:300}
.coords{margin-top:9px;font-size:12px;color:var(--muted);font-weight:300;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.geo{background:none;border:0;padding:0;font-size:12px;color:var(--sky);font-weight:500;text-decoration:underline;text-underline-offset:3px}
.geo:disabled{color:var(--muted);text-decoration:none}

.week{max-width:1120px;margin:26px auto 0}
.wload,.werr{font-size:13.5px;color:var(--muted);padding:10px 0}
.werr{color:var(--rose)}
.werr button{background:var(--sky);color:#0E1728;border:0;border-radius:7px;padding:5px 12px;font-weight:600;font-size:12.5px;margin-inline-start:8px}
.wrow{display:grid;grid-template-columns:repeat(7,1fr);gap:5px}
.wcell{position:relative;display:flex;flex-direction:column;align-items:center;gap:3px;
  background:var(--panel);border:1px solid var(--rule2);border-radius:12px;padding:10px 3px 9px;transition:.15s;min-width:0}
.wcell:hover{background:var(--panel2)}
.wcell.on{border-color:var(--sky);background:#1C3151;box-shadow:0 0 0 1px var(--sky) inset}
.w-dow{font-size:14px;font-weight:600;white-space:nowrap}
.w-dow .sm{display:none;font-style:normal}
.w-dow .lg{font-style:normal}
.w-date{font-size:11px;color:var(--muted);font-weight:300}
.w-ic{width:40px;height:40px;margin:1px 0}
.w-ic svg,.b-ic svg,.d-ic svg{width:100%;height:100%;display:block}
.w-t{display:flex;gap:5px;align-items:baseline;font-size:12px;color:var(--muted)}
.w-t b{font-size:16px;color:var(--text);font-weight:600}
.w-t em{font-style:normal}
.w-mm{font-size:11px;color:#6E819F;font-weight:400;white-space:nowrap}
.w-mm.wet{color:var(--sky);font-weight:600}
.w-bar{width:calc(100% - 14px);height:4px;background:#22314D;border-radius:3px;overflow:hidden;margin-top:4px}
.w-bar i{height:100%;background:var(--sky);border-radius:3px;display:block}
.w-warn{position:absolute;top:7px;inset-inline-end:7px;width:7px;height:7px;border-radius:50%;background:var(--warm)}

.detail{margin-top:10px;background:var(--panel);border:1px solid var(--rule);border-radius:14px;padding:16px 16px 14px}
.d-main{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.d-ic{width:66px;height:66px;flex:none}
.d-txt{flex:1;min-width:150px}
.d-day{font-size:18px;font-weight:600}
.d-cond{font-size:14px;color:var(--dim)}
.d-temps{font-size:14px;color:var(--muted);margin-top:2px}
.d-temps b{font-size:24px;color:var(--text)}
.d-wind{margin-inline-start:4px;font-size:13px}
.d-verdict{display:flex;flex-direction:column;gap:1px;text-align:end;min-width:180px}
.d-verdict b{font-size:16px}
.d-verdict span{font-size:12.5px;color:var(--muted);font-weight:300}
.v-high b{color:var(--mint)} .v-mid b{color:var(--warm)} .v-split b{color:var(--rose)} .v-dry b{color:#6E819F}
.d-scale{margin-top:20px}
.d-track{position:relative;height:16px;border-bottom:1px solid var(--rule)}
.d-tick{position:absolute;bottom:0;width:3px;height:13px;border-radius:2px;transform:translateX(50%)}
.d-nums{display:flex;justify-content:space-between;margin-top:6px;font-size:11.5px;color:var(--muted);font-weight:300}
.d-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
.d-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid;border-radius:999px;
  padding:4px 11px;font-size:12.5px;background:rgba(255,255,255,.02)}
.d-chip i{width:7px;height:7px;border-radius:50%;flex:none}
.d-chip b{font-weight:600}
.d-chip em{font-style:normal;color:var(--dim);font-weight:300}
.d-outs{margin-top:14px;display:flex;flex-direction:column;gap:7px}
.d-out{background:var(--panel2);border-inline-start:3px solid;border-radius:8px;padding:9px 12px;
  font-size:13px;color:var(--dim);font-weight:300;line-height:1.6}
.d-out b{color:var(--text)}

.pens{max-width:1120px;margin:30px auto 0}
.pens h2{font-size:19px}
.pen-row{display:flex;flex-wrap:wrap;gap:8px}
.pen{display:inline-flex;align-items:center;gap:8px;background:var(--panel);border:1px solid var(--rule);
  color:#6E819F;padding:7px 15px;border-radius:999px;font-size:13.5px;font-weight:500;transition:.15s}
.pen:hover{border-color:#42598A}
.nib{width:9px;height:9px;border-radius:999px;border:1.5px solid;display:inline-block}

.graph{max-width:1120px;margin:22px auto 0}
.gbar{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px}
.vars{display:flex;background:var(--panel);border:1px solid var(--rule);border-radius:10px;overflow:hidden}
.vtab{background:transparent;border:0;padding:8px 15px;font-size:13.5px;color:var(--muted);font-weight:500;white-space:nowrap}
.vtab.on{background:var(--sky);color:#0E1728;font-weight:600}
.panel{position:relative;background:var(--panel);border:1px solid var(--rule2);border-radius:14px;padding:10px 12px 0}
.ptop{display:flex;justify-content:flex-end;font-size:11.5px;color:var(--muted);font-weight:300;margin-bottom:4px}
.bands{display:flex;gap:5px;margin-bottom:6px}
.band{flex:1;display:flex;flex-direction:column;align-items:center;gap:1px;background:transparent;border:0;
  border-radius:9px;padding:6px 2px;transition:.15s;min-width:0}
.band:hover,.band.on{background:#22314D}
.b-ic{width:28px;height:28px}
.b-day{font-size:14px;font-weight:600;white-space:nowrap}
.b-date{font-size:11px;color:var(--muted);font-weight:300}
.pkey{display:flex;align-items:center;gap:9px;font-size:12px;color:var(--muted);font-weight:300;
  border-top:1px solid var(--rule2);margin-top:6px;padding:10px 4px 12px}
.kb{width:26px;height:11px;border-radius:3px;background:#9BB6E8;opacity:.3;flex:none}
.veil{position:absolute;inset:0;z-index:6;display:flex;align-items:center;justify-content:center;
  background:rgba(14,23,40,.86);border-radius:14px;font-size:13.5px;color:var(--muted)}

/* readout */
.readout{display:flex;align-items:center;gap:12px;flex-wrap:wrap;min-height:38px;
  border-top:1px solid var(--rule2);margin-top:8px;padding:9px 2px 3px}
.readout.empty{font-size:12.5px;color:var(--muted);font-weight:300}
.readout.top{border-top:0;margin:0 0 10px;padding:8px 11px;min-height:40px;
  background:var(--panel2);border:1px solid var(--rule);border-radius:11px;
  justify-content:center;gap:10px}
.readout.top .ro-chips{justify-content:center}
.readout.top .ro-chip em{font-weight:600}
.ro-time{display:inline-flex;align-items:baseline;gap:6px;white-space:nowrap}
.ro-time b{font-size:15px;font-weight:700;color:var(--text);line-height:1}
.ro-time em{font-style:normal;font-size:12px;color:var(--muted);font-weight:400}
.ro-chips{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.ro-chip{display:inline-flex;align-items:center;gap:5px;border:1px solid;border-radius:999px;
  padding:3px 9px;font-size:12px;background:rgba(255,255,255,.02)}
.ro-chip i{width:6px;height:6px;border-radius:50%;flex:none}
.ro-chip b{font-weight:600}
.ro-chip em{font-style:normal;color:var(--text);font-weight:500}
.ro-unit{font-size:11px;color:var(--muted);font-weight:300}

/* hourly */
.hourly{max-width:1120px;margin:40px auto 0}
.hourly h2{font-size:24px}
.hpanel{background:var(--panel);border:1px solid var(--rule2);border-radius:14px;padding:14px 12px 12px}
.hlead{font-size:14px;color:var(--dim);font-weight:300;line-height:1.6;margin:0 4px 10px;
  border-inline-start:2px solid var(--sky);padding-inline-start:12px}
.hlead.dry{border-inline-start-color:var(--warm)}
.hlead b{color:var(--text)}
.hagree{display:flex;gap:2px;margin:8px 0 0;padding:0 38px}
.hcell{flex:1;position:relative;min-width:0}
.hcell i{display:block;height:8px;border-radius:2px;background:var(--sky)}
.hcell em{position:absolute;top:11px;inset-inline-start:0;font-style:normal;font-size:10px;color:var(--muted)}
.hlegend{display:flex;flex-wrap:wrap;gap:6px 18px;margin-top:26px;padding-top:11px;
  border-top:1px solid var(--rule2);font-size:12px;color:var(--muted);font-weight:300}
.hlegend span{display:inline-flex;align-items:center;gap:7px}
.sw{width:16px;height:9px;border-radius:3px;flex:none}
.sw.solid{background:var(--sky)}
.sw.ghost{background:#9BB6E8;opacity:.28}
.sw.warm{background:var(--warm)}
.sw.grad{background:linear-gradient(90deg,rgba(90,179,240,.15),var(--sky))}

.tip{background:#1C2B47;border:1px solid #3A507A;border-radius:10px;padding:10px 12px;font-size:13px;min-width:158px;
  box-shadow:0 12px 30px rgba(0,0,0,.5)}
.tip-h{font-size:12px;color:var(--muted);padding-bottom:7px;margin-bottom:6px;border-bottom:1px solid #33486F}
.tip-r{display:flex;align-items:center;gap:8px;padding:2px 0}
.tip-nib{width:9px;height:3px;border-radius:2px;flex:none}
.tip-n{flex:1;font-weight:500}
.tip-v{font-size:12.5px;color:var(--dim)}
.tip-v em{font-style:normal;font-size:10.5px;color:var(--muted)}

.score{max-width:1120px;margin:44px auto 0;background:var(--panel);border:1px solid var(--rule);border-radius:16px;padding:22px}
.score h2{font-size:24px}
.s-ctl{display:flex;gap:18px;flex-wrap:wrap;align-items:flex-end;margin-bottom:14px}
.s-grp{display:flex;flex-direction:column;gap:6px}
.s-lab{font-size:12px;color:var(--muted);font-weight:500}
.s-run{background:var(--sky);color:#0E1728;border:0;border-radius:10px;padding:10px 22px;font-weight:600;font-size:14px}
.s-run:disabled{opacity:.55}
.s-empty,.s-err,.s-note{font-size:13.5px;color:var(--muted);font-weight:300;padding:10px 0}
.s-err{color:var(--rose)}
.s-lead{font-size:15.5px;color:var(--dim);font-weight:300;margin:6px 0 16px;
  border-inline-start:2px solid var(--sky);padding-inline-start:13px;line-height:1.6}
.s-lead b{color:var(--text)}
.s-table{display:flex;flex-direction:column;gap:5px}
.s-hrow,.s-row{display:grid;grid-template-columns:1.3fr 2fr 1fr 1fr .9fr;gap:10px;align-items:center;padding:9px 12px}
.s-hrow{font-size:11.5px;color:var(--muted);font-weight:500;padding-bottom:2px}
.s-row{background:var(--panel2);border-radius:9px;font-size:13.5px}
.s-row.best{box-shadow:0 0 0 1px var(--mint) inset}
.s-name{font-weight:600;display:flex;flex-direction:column;gap:1px}
.s-crown{font-style:normal;font-size:10.5px;color:var(--mint);font-weight:500}
.s-mae{display:flex;align-items:center;gap:9px}
.s-bar{flex:1;height:7px;background:#101A2E;border-radius:4px;overflow:hidden;display:block;min-width:36px}
.s-bar em{display:block;height:100%;border-radius:4px}
.s-mae b{font-weight:600;white-space:nowrap;font-size:13px}
.s-n{color:var(--dim);font-weight:300}
.s-legend{margin-top:18px;border-top:1px solid var(--rule2);padding-top:14px}
.s-legend p{margin:0 0 7px;font-size:13px;color:var(--dim);font-weight:300;line-height:1.65}
.s-legend b{color:var(--text)}
.s-caveat{color:var(--muted)!important;font-size:12.5px!important;margin-top:11px!important}

.totals{max-width:1120px;margin:40px auto 0}
.totals h2,.learn h2{font-size:24px}
.trows{margin-top:16px;display:flex;flex-direction:column;gap:8px}
.tot{display:flex;align-items:center;gap:12px}
.tname{flex:0 0 72px;font-size:13.5px;font-weight:600}
.tbar{flex:1;height:10px;background:var(--panel2);border-radius:5px;overflow:hidden}
.tbar span{display:block;height:100%;border-radius:5px}
.tnum{flex:0 0 74px;font-size:12.5px;color:var(--muted);font-weight:300}
.tnote{font-size:13.5px;color:var(--dim);font-weight:300;margin-top:15px;max-width:64ch;
  border-inline-start:2px solid var(--sky);padding-inline-start:13px}
.learn{max-width:1120px;margin:48px auto 0;padding-top:26px;border-top:1px solid var(--rule)}
.lgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;margin-top:16px}
.mc{background:var(--panel);border:1px solid var(--rule2);border-radius:12px;overflow:hidden}
.mc.open{background:var(--panel2);border-color:var(--rule)}
.mc-top{display:flex;align-items:center;gap:11px;width:100%;background:none;border:0;padding:13px 14px;text-align:start}
.mc-rule{width:3px;height:26px;border-radius:2px;flex:none}
.mc-t{flex:1;min-width:0}
.mc-short{display:block;font-size:14.5px;font-weight:600}
.mc-name{display:block;font-size:12px;color:var(--muted);font-weight:300}
.mc-p{font-size:17px;color:var(--muted)}
.mc-body{padding:0 14px 15px}
.mc-body dl{margin:0 0 11px;display:flex;flex-direction:column;gap:4px}
.mc-body dl>div{display:flex;gap:9px;font-size:12.5px}
.mc-body dt{flex:0 0 70px;color:var(--muted);font-weight:300}
.mc-body dd{margin:0}
.mc-body p{margin:0;font-size:13.5px;line-height:1.7;color:var(--dim);font-weight:300;
  border-top:1px solid var(--rule2);padding-top:11px}
.primer{margin-top:34px;max-width:68ch}
.primer h3{font-size:20px;margin-bottom:12px}
.primer p{font-size:15px;line-height:1.8;color:var(--dim);font-weight:300;margin:0 0 13px}
.primer b{color:var(--text);font-weight:600}
.foot{max-width:1120px;margin:44px auto 0;padding-top:16px;border-top:1px solid var(--rule2);
  font-size:12.5px;color:var(--muted);font-weight:300;line-height:1.75}

@media (max-width:760px){
  .wx{padding:env(safe-area-inset-top) max(12px,env(safe-area-inset-right))
      calc(48px + env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left))}
  .head{padding-top:28px;gap:20px}
  .head-r{flex:1 1 100%}
  .wrow{gap:3px}
  .wcell{padding:8px 1px 7px;border-radius:9px;gap:2px}
  .w-dow{font-size:13px}
  .w-dow .lg{display:none} .w-dow .sm{display:inline}
  .w-date{font-size:9.5px}
  .w-ic{width:30px;height:30px}
  .w-t{gap:3px;font-size:10px} .w-t b{font-size:13px}
  .w-mm{font-size:9.5px}
  .w-bar{width:calc(100% - 8px);height:3px;margin-top:3px}
  .w-warn{width:6px;height:6px;top:4px;inset-inline-end:4px}
  .detail{padding:14px 13px}
  .d-ic{width:54px;height:54px}
  .d-verdict{text-align:start;min-width:0;flex:1 1 100%;margin-top:4px}
  .d-chip{font-size:11.5px;padding:3px 9px;gap:5px}
  .readout{gap:8px;padding-top:8px}
  .readout.top{gap:8px;padding:7px 9px;min-height:36px}
  .ro-time{flex:none}
  .ro-time b{font-size:15px}
  .ro-time em{font-size:11px}
  .ro-chip{font-size:11px;padding:2px 7px;gap:4px}
  .readout.top .ro-chip{font-size:11px;padding:2px 8px}
  .hpanel{padding:12px 8px 10px}
  .hlead{font-size:13px;margin-inline:0}
  .hagree{padding:0 34px}
  .hlegend{gap:5px 12px;font-size:11.5px;margin-top:24px}
  .band .b-day{font-size:11px} .b-ic{width:20px;height:20px} .b-date{font-size:9.5px}
  .score{padding:16px 14px;border-radius:12px}
  .s-hrow{display:none}
  .s-row{grid-template-columns:1fr 1fr;gap:7px 10px;font-size:13px;padding:11px 12px}
  .s-mae{grid-column:1 / -1;order:2}
  .s-name{order:1;grid-column:1 / -1}
  .s-n{order:3;font-size:12px}
  .s-n::before{content:attr(data-l) ": ";color:var(--muted)}
}
@media (prefers-reduced-motion:reduce){.wx *{transition:none!important;animation:none!important}}
`;
