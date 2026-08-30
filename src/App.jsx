import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  ComposedChart, Line, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea,
} from "recharts";

/* ═══════════════════════════ models ═══════════════════════════ */

const MODELS = [
  {
    id: "ecmwf_ifs025", short: "ECMWF", ink: "#5AB3F0",
    name: "IFS", agency: "המרכז האירופי לתחזיות לטווח בינוני",
    home: "רדינג, אנגליה · בולוניה, איטליה",
    grid: "9 ק״מ · מוגש בגריד 25 ק״מ",
    runs: "00 · 06 · 12 · 18 UTC",
    note: "המודל הגלובלי המדויק ביותר שקיים, כבר יותר מעשור ברציפות. אם מודל אחר סותר אותו, ברוב המקרים הטעות אצל האחר. חלש יותר בפירוט מקומי — הוא מכוון לתמונה הגדולה ולטווח של 3–10 ימים.",
  },
  {
    id: "gfs_seamless", short: "GFS", ink: "#F5A24B",
    name: "Global Forecast System", agency: "NOAA / NCEP",
    home: "ארצות הברית",
    grid: "13 ק״מ · עד 16 ימים",
    runs: "00 · 06 · 12 · 18 UTC",
    note: "המודל הפתוח והנפוץ בעולם — רוב אפליקציות מזג האוויר החינמיות רצות עליו. נוטה להגזים בכמויות משקעים ולהמציא סופות שלא יקרו בטווח הארוך. אם רק הוא צועק גשם, קח בערבון מוגבל.",
  },
  {
    id: "icon_seamless", short: "ICON", ink: "#6FD99A",
    name: "ICON", agency: "DWD — השירות המטאורולוגי הגרמני",
    home: "אופנבך, גרמניה",
    grid: "13 ק״מ גלובלי · 7 ק״מ אירופה",
    runs: "00 · 06 · 12 · 18 UTC",
    note: "גריד מבוסס איקוסהדרון במקום רשת קווי אורך ורוחב, מה שנותן רזולוציה אחידה על כל כדור הארץ. חזק במיוחד באגן הים התיכון, ולכן רלוונטי לישראל יותר מרוב הגלובליים.",
  },
  {
    id: "ukmo_seamless", short: "UKMO", ink: "#C58BF0",
    name: "Unified Model", agency: "Met Office",
    home: "אקסטר, אנגליה",
    grid: "10 ק״מ",
    runs: "00 · 06 · 12 · 18 UTC",
    note: "אותו קוד רץ בכל הסקאלות, מתחזית עולמית ועד תחזית שכונתית — מכאן השם. שמרני יחסית: כשהוא כן חוזה גשם, שווה להקשיב.",
  },
  {
    id: "gem_seamless", short: "GEM", ink: "#F27878",
    name: "GEM", agency: "Environment Canada",
    home: "מונטריאול, קנדה",
    grid: "15 ק״מ",
    runs: "00 · 12 UTC",
    note: "הקול השלישי בחדר. כשהוא מסכים עם ECMWF ו-GFS זה מחזק מאוד את התחזית, וכשהוא בורח לכיוון אחר זה סימן טוב שהמצב לא יציב.",
  },
  {
    id: "meteofrance_seamless", short: "ARPEGE", ink: "#4FD8D0",
    name: "ARPEGE / AROME", agency: "Météo-France",
    home: "טולוז, צרפת",
    grid: "11 ק״מ · 1.3 ק״מ מעל צרפת",
    runs: "00 · 06 · 12 · 18 UTC",
    note: "בנוי במשותף עם ECMWF ומתמחה בים התיכון המערבי. מטפל יפה בסופות שמתפתחות מעל ים חם — בדיוק הסוג שמגיע אלינו בחורף.",
  },
  {
    id: "jma_seamless", short: "JMA", ink: "#F0D45E",
    name: "GSM", agency: "הסוכנות המטאורולוגית היפנית",
    home: "טוקיו, יפן",
    grid: "20 ק״מ",
    runs: "00 · 06 · 12 · 18 UTC",
    note: "מכויל סביב מונסונים וטייפונים באסיה. מחוץ לאזור שלו הוא לא הכי חד, אבל מוסיף זווית שונה לגמרי ולכן שימושי כבדיקת שפיות.",
  },
];

const M = Object.fromEntries(MODELS.map((m) => [m.id, m]));
const DEFAULT_ON = ["ecmwf_ifs025", "gfs_seamless", "icon_seamless", "ukmo_seamless", "gem_seamless"];

const VARS = {
  precipitation: { label: "משקעים", unit: "מ״מ/ש׳" },
  temperature_2m: { label: "טמפרטורה", unit: "°C" },
  wind_speed_10m: { label: "רוח", unit: "קמ״ש" },
};

const DAYS_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

/* ═══════════════════════════ icons ═══════════════════════════ */

const C = { cloud: "#8397B7", cloudDark: "#64789B", sun: "#F5C451", drop: "#57B6EF", bolt: "#F5C451", snow: "#BFE3FF" };

const Cloud = ({ fill = C.cloud, y = 0 }) => (
  <g fill={fill} transform={`translate(0 ${y})`}>
    <rect x="11" y="25" width="27" height="9.5" rx="4.75" />
    <circle cx="19" cy="25" r="7.2" />
    <circle cx="30" cy="23" r="9.2" />
  </g>
);

const Sun = ({ cx = 24, cy = 20, r = 7.5 }) => (
  <g>
    <circle cx={cx} cy={cy} r={r} fill={C.sun} />
    {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
      const rad = (a * Math.PI) / 180;
      return (
        <line key={a}
          x1={cx + Math.cos(rad) * (r + 3.2)} y1={cy + Math.sin(rad) * (r + 3.2)}
          x2={cx + Math.cos(rad) * (r + 7)} y2={cy + Math.sin(rad) * (r + 7)}
          stroke={C.sun} strokeWidth="2.4" strokeLinecap="round" />
      );
    })}
  </g>
);

const Drops = ({ xs, len = 6, color = C.drop, w = 2.6 }) => (
  <g>
    {xs.map(([x, y], i) => (
      <line key={i} x1={x} y1={y} x2={x - 2.4} y2={y + len}
        stroke={color} strokeWidth={w} strokeLinecap="round" />
    ))}
  </g>
);

const ICONS = {
  clear: () => <svg viewBox="0 0 48 48"><Sun cx={24} cy={24} r={9} /></svg>,
  partly: () => (
    <svg viewBox="0 0 48 48"><Sun cx={31} cy={16} r={6.5} /><Cloud y={2} /></svg>
  ),
  cloudy: () => (
    <svg viewBox="0 0 48 48"><Cloud fill={C.cloudDark} y={-4} /><Cloud y={3} /></svg>
  ),
  drizzle: () => (
    <svg viewBox="0 0 48 48"><Cloud y={-4} /><Drops xs={[[20, 34], [29, 34]]} len={5} /></svg>
  ),
  rain: () => (
    <svg viewBox="0 0 48 48">
      <Cloud fill={C.cloudDark} y={-5} />
      <Drops xs={[[17, 33], [24, 35], [31, 33], [20.5, 39], [27.5, 39]]} len={6} />
    </svg>
  ),
  storm: () => (
    <svg viewBox="0 0 48 48">
      <Cloud fill={C.cloudDark} y={-6} />
      <Drops xs={[[15, 32], [33, 32], [17, 39], [31, 39]]} len={6} />
      <path d="M26 30 L20 39 L24 39 L21.5 46 L29 36 L24.5 36 Z" fill={C.bolt} />
    </svg>
  ),
  snow: () => (
    <svg viewBox="0 0 48 48">
      <Cloud y={-5} />
      {[[18, 36], [24, 40], [30, 36]].map(([x, y], i) => (
        <g key={i} stroke={C.snow} strokeWidth="2" strokeLinecap="round">
          <line x1={x - 3} y1={y} x2={x + 3} y2={y} />
          <line x1={x - 1.5} y1={y - 2.6} x2={x + 1.5} y2={y + 2.6} />
          <line x1={x + 1.5} y1={y - 2.6} x2={x - 1.5} y2={y + 2.6} />
        </g>
      ))}
    </svg>
  ),
};

const ICON_LABEL = {
  clear: "בהיר", partly: "מעונן חלקית", cloudy: "מעונן",
  drizzle: "טפטוף", rain: "גשם", storm: "גשם כבד", snow: "שלג",
};

function pickIcon(medRain, cloudMean, tmax) {
  if (medRain >= 0.5 && typeof tmax === "number" && tmax <= 2) return "snow";
  if (medRain >= 12) return "storm";
  if (medRain >= 3) return "rain";
  if (medRain >= 0.4) return "drizzle";
  if (typeof cloudMean !== "number") return "partly";
  if (cloudMean >= 70) return "cloudy";
  if (cloudMean >= 30) return "partly";
  return "clear";
}

/* ═══════════════════════════ math ═══════════════════════════ */

const pick = (obj, base, model) => {
  if (!obj) return null;
  const v = obj[`${base}_${model}`];
  return v !== undefined ? v : obj[base];
};
const nums = (a) => a.filter((v) => typeof v === "number" && !Number.isNaN(v));
const fmt = (v, d = 1) => (typeof v === "number" ? v.toFixed(d) : "–");
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

function agreement(values) {
  const v = nums(values);
  if (!v.length) return null;
  const lo = Math.min(...v), hi = Math.max(...v);
  const wet = v.filter((x) => x >= 0.5).length;
  const spread = hi - lo;
  let level, text;
  if (hi < 0.5) { level = "dry"; text = "כולם: יבש"; }
  else if (wet === 0) { level = "dry"; text = "כמעט כולם יבשים"; }
  else if (wet === v.length && spread / Math.max(hi, 0.1) < 0.45) { level = "high"; text = "הסכמה גבוהה"; }
  else if (spread / Math.max(hi, 0.1) > 0.7 || wet / v.length < 0.6) { level = "split"; text = "מחלוקת"; }
  else { level = "mid"; text = "הסכמה חלקית"; }
  return { lo, hi, spread, wet, total: v.length, level, text, med: median(v) };
}

/** מודל שבורח מהחבורה: לפחות 3 מ״מ מהחציון, ופי 2.5 ממנו (או ההפך) */
function outliers(pairs) {
  const v = pairs.filter((p) => typeof p.v === "number");
  if (v.length < 3) return [];
  const med = median(v.map((p) => p.v));
  const out = [];
  for (const p of v) {
    const d = Math.abs(p.v - med);
    if (d < 3) continue;
    if (med < 0.4 && p.v >= 3) out.push({ ...p, dir: "wet", med });
    else if (med >= 0.4 && p.v >= med * 2.5) out.push({ ...p, dir: "wet", med });
    else if (med >= 5 && p.v <= med * 0.3) out.push({ ...p, dir: "dry", med });
  }
  return out;
}

/* ═══════════════════════════ app ═══════════════════════════ */

export default function App() {
  const [place, setPlace] = useState({ name: "תל אביב-יפו", region: "ישראל", lat: 32.0853, lon: 34.7818 });
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const [active, setActive] = useState(DEFAULT_ON);
  const [variable, setVariable] = useState("precipitation");
  const [dayFocus, setDayFocus] = useState(null);
  const [openModel, setOpenModel] = useState(null);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const boxRef = useRef(null);

  const load = useCallback(async () => {
    if (!active.length) { setData(null); setLoading(false); return; }
    setLoading(true); setError(null);
    const url =
      "https://api.open-meteo.com/v1/forecast" +
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
    } catch (e) {
      setError(e.message || "לא הצלחתי להביא נתונים"); setData(null);
    } finally { setLoading(false); }
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

  /* hourly trace */
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
    () => (dayFocus === null ? trace : trace.filter((r) => r.dayIdx === dayFocus)),
    [trace, dayFocus]
  );

  /* days */
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
      if (data.hourly?.time) {
        for (let h = i * 24; h < (i + 1) * 24 && h < data.hourly.time.length; h++) {
          const per = nums(active.map((m) => pick(data.hourly, "cloud_cover", m)?.[h]));
          if (per.length) cc.push(mean(per));
        }
      }
      const tMax = tmax.length ? mean(tmax) : null;
      return {
        i, iso, dow: DAYS_HE[d.getDay()], date: `${d.getDate()}.${d.getMonth() + 1}`,
        rain, pairs, ag,
        tmax: tMax, tmin: tmin.length ? mean(tmin) : null,
        wind: wind.length ? Math.max(...wind) : null,
        icon: pickIcon(ag?.med ?? 0, cc.length ? mean(cc) : null, tMax),
        outs: outliers(pairs),
      };
    });
  }, [data, active]);

  const allOuts = useMemo(() => days.flatMap((d) => d.outs.map((o) => ({ ...o, day: d }))), [days]);

  const weekTotals = useMemo(() => {
    if (!data?.daily?.time) return [];
    return active.map((m) => ({
      id: m,
      total: nums(pick(data.daily, "precipitation_sum", m) || []).reduce((a, b) => a + b, 0),
    })).sort((a, b) => b.total - a.total);
  }, [data, active]);

  const maxY = useMemo(() => {
    if (variable !== "precipitation") return undefined;
    const v = nums(shown.flatMap((r) => active.map((m) => r[m])));
    if (!v.length) return 1;
    return Math.max(1, Math.ceil(Math.max(...v) * 1.15 * 10) / 10);
  }, [shown, active, variable]);

  const V = VARS[variable];
  const PAD_L = 46, PAD_R = 10;

  return (
    <div dir="rtl" className="wx">
      <style>{CSS}</style>
      <div className="sky" />

      {/* ── head ── */}
      <header className="head">
        <div className="head-l">
          <div className="eyebrow">תחזית רב־מודלית</div>
          <h1>מה העולם חושב שיקרה כאן</h1>
          <p className="dek">
            שבעה מכונים לאומיים מריצים סופר־מחשבים על אותה אטמוספירה ומגיעים לתשובות שונות.
            זה מה שהם אומרים על <b>{place.name}</b> בשבעת הימים הקרובים.
          </p>
        </div>
        <div className="head-r" ref={boxRef}>
          <label className="lab" htmlFor="q">חיפוש מקום</label>
          <input id="q" className="srch" value={query} autoComplete="off"
            placeholder="תל אביב, ירושלים, רייקיאוויק…"
            onChange={(e) => setQuery(e.target.value)} />
          {searching && <div className="hint">מחפש…</div>}
          {!!results.length && (
            <ul className="res">
              {results.map((r) => (
                <li key={r.id}>
                  <button onClick={() => {
                    setPlace({ name: r.name, region: [r.admin1, r.country].filter(Boolean).join(", "), lat: r.latitude, lon: r.longitude });
                    setQuery(""); setResults([]); setDayFocus(null);
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
          </div>
        </div>
      </header>

      {/* ── week strip ── */}
      <section className="week">
        <div className="sec-head">
          <h2>שבעת הימים הקרובים</h2>
          <span className="sub">האייקון מייצג את מה שרוב המודלים חוזים. לחצו על יום לפירוט שעתי.</span>
        </div>
        <div className="cards">
          {days.map((d) => {
            const Ic = ICONS[d.icon];
            return (
              <button key={d.i} onClick={() => setDayFocus(dayFocus === d.i ? null : d.i)}
                className={`card ${dayFocus === d.i ? "focus" : ""} ${d.outs.length ? "flagged" : ""}`}>
                <div className="c-head">
                  <span className="c-dow">{d.dow}</span>
                  <span className="c-date">{d.date}</span>
                </div>
                <div className="c-icon"><Ic /></div>
                <div className="c-cond">{ICON_LABEL[d.icon]}</div>
                <div className="c-temp"><b>{fmt(d.tmax, 0)}°</b><span>{fmt(d.tmin, 0)}°</span></div>
                <div className={`c-verdict v-${d.ag?.level || "dry"}`}>{d.ag?.text || "—"}</div>
                <div className="c-count">{d.ag ? d.ag.wet : 0} מתוך {d.ag ? d.ag.total : 0} חוזים גשם</div>
                <div className="c-range">
                  <div className="track">
                    {d.pairs.map((p) => typeof p.v === "number" && (
                      <span key={p.id} className="tick" title={`${M[p.id].short} · ${fmt(p.v)} מ״מ`}
                        style={{ background: M[p.id].ink, insetInlineStart: `${Math.min(100, (p.v / Math.max(1, d.ag?.hi || 1)) * 100)}%` }} />
                    ))}
                  </div>
                  <div className="rn2"><span>{fmt(d.ag?.lo)}</span><span className="rmid">יבש → גשום</span><span>{fmt(d.ag?.hi)} מ״מ</span></div>
                </div>
                {!!d.outs.length && (
                  <div className="flag">חריגה: {d.outs.map((o) => M[o.id].short).join(", ")}</div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── outliers ── */}
      {!!allOuts.length && (
        <section className="alerts">
          <h2>מודלים שבורחים מהחבורה</h2>
          <p className="sub">
            כשמודל בודד מנבא משהו רחוק מאוד מכל השאר, זה בדרך כלל לא נבואה — זה סימן שהמערכת גבולית
            והפרש קטן בתנאי ההתחלה שולח אותה לכיוון אחר לגמרי.
          </p>
          <div className="alist">
            {allOuts.map((o, k) => (
              <div className="alert" key={k} style={{ borderInlineStartColor: M[o.id].ink }}>
                <span className="a-day">{o.day.dow} {o.day.date}</span>
                <span className="a-txt">
                  <b style={{ color: M[o.id].ink }}>{M[o.id].short}</b>{" "}
                  {o.dir === "wet" ? "חוזה לבדו" : "יבש לעומת השאר —"}{" "}
                  <b>{fmt(o.v)} מ״מ</b> מול חציון של {fmt(o.med)} מ״מ
                </span>
                <button className="a-go" onClick={() => setDayFocus(o.day.i)}>הצג ביום זה ←</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── pens ── */}
      <section className="pens">
        <div className="sec-head">
          <h2>עטים על הנייר</h2>
          <span className="sub">כבו והדליקו מודלים כדי לראות איך התמונה משתנה</span>
        </div>
        <div className="pen-row">
          {MODELS.map((m) => {
            const on = active.includes(m.id);
            return (
              <button key={m.id} onClick={() => toggle(m.id)} aria-pressed={on}
                className={`pen ${on ? "on" : ""}`}
                style={on ? { borderColor: m.ink, color: m.ink, background: m.ink + "1A" } : undefined}>
                <span className="nib" style={{ background: on ? m.ink : "transparent", borderColor: on ? m.ink : "#4A5A78" }} />
                {m.short}
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
          <div className="scope">
            {dayFocus !== null && <button className="back" onClick={() => setDayFocus(null)}>← כל השבוע</button>}
            <span className="unit">{V.unit}</span>
          </div>
        </div>

        <div className="panel">
          {loading && <div className="veil">מוריד ריצות מודל…</div>}
          {error && <div className="veil err">{error}<button onClick={load}>נסה שוב</button></div>}
          {!active.length && <div className="veil">כל העטים כבויים. הדליקו לפחות מודל אחד.</div>}

          {/* day bands */}
          <div className="bands" dir="ltr" style={{ marginLeft: PAD_L, marginRight: PAD_R }}>
            {dayFocus === null
              ? days.map((d) => {
                  const Ic = ICONS[d.icon];
                  return (
                    <button key={d.i} className="band" onClick={() => setDayFocus(d.i)}>
                      <span className="b-ic"><Ic /></span>
                      <span className="b-day">{d.dow}</span>
                      <span className="b-date">{d.date}</span>
                    </button>
                  );
                })
              : days[dayFocus] && (
                  <div className="band solo">
                    <span className="b-day">יום {days[dayFocus].dow}</span>
                    <span className="b-date">{days[dayFocus].date} · {ICON_LABEL[days[dayFocus].icon]}</span>
                  </div>
                )}
          </div>

          <div dir="ltr" style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <ComposedChart data={shown} margin={{ top: 6, right: PAD_R, bottom: 4, left: 0 }}>
                <XAxis dataKey="i" type="number" domain={["dataMin", "dataMax"]}
                  ticks={dayFocus === null ? [] : shown.filter((r) => r.hour % 3 === 0).map((r) => r.i)}
                  tickFormatter={(i) => trace[i]?.label || ""}
                  tick={{ fontSize: 12, fill: "#8FA1BC" }} axisLine={{ stroke: "#2E4166" }}
                  tickLine={false} interval={0} height={dayFocus === null ? 6 : 24} />
                <YAxis domain={variable === "precipitation" ? [0, maxY] : ["auto", "auto"]}
                  width={PAD_L} tick={{ fontSize: 12, fill: "#8FA1BC" }} axisLine={false} tickLine={false} />
                {dayFocus === null && days.filter((d) => d.i % 2 === 1).map((d) => (
                  <ReferenceArea key={d.i} x1={d.i * 24} x2={d.i * 24 + 23} fill="#FFFFFF" fillOpacity={0.028} strokeOpacity={0} />
                ))}
                {dayFocus === null && days.slice(1).map((d) => (
                  <ReferenceLine key={d.i} x={d.i * 24} stroke="#2E4166" strokeWidth={1} />
                ))}
                <Tooltip content={<Ink variable={variable} trace={trace} />}
                  cursor={{ stroke: "#7E93B8", strokeWidth: 1, strokeDasharray: "3 3" }} />
                <Area dataKey="band" stroke="none" fill="#9BB6E8" fillOpacity={0.16} isAnimationActive={false} connectNulls />
                {active.map((m) => (
                  <Line key={m} dataKey={m} stroke={M[m].ink} strokeWidth={2} dot={false}
                    type={variable === "precipitation" ? "step" : "monotone"} connectNulls animationDuration={800} />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="pkey"><span className="kb" /> אזור אי־ההסכמה — הפער בין המודל הקיצוני ביותר לכל כיוון</div>
        </div>
      </section>

      {/* ── totals ── */}
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

      {/* ── learn ── */}
      <section className="learn">
        <h2>מי מריץ מה</h2>
        <div className="lgrid">
          {MODELS.map((m) => {
            const open = openModel === m.id;
            return (
              <article key={m.id} className={`mc ${open ? "open" : ""}`}>
                <button className="mc-top" onClick={() => setOpenModel(open ? null : m.id)} aria-expanded={open}>
                  <span className="mc-rule" style={{ background: m.ink }} />
                  <span className="mc-t">
                    <span className="mc-short" style={{ color: m.ink }}>{m.short}</span>
                    <span className="mc-name">{m.name}</span>
                  </span>
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
          <p>השני הוא <b>הכאוס</b>. הפרש זעיר בתנאי ההתחלה תופח לתחזיות שונות לגמרי בתוך ימים. לכן הפער בין המודלים מתרחב ככל שמתרחקים — וזה בדיוק מה שרואים כאן: <b>רוחב אזור אי־ההסכמה הוא מדד ישיר לכמה כדאי לסמוך על התחזית</b>. רצועה צרה ליום שלישי שווה יותר מקו יחיד יפה ליום שישי.</p>
        </div>
      </section>

      <footer className="foot">
        נתונים דרך Open-Meteo, שמוריד את קבצי ה־GRIB2 הגולמיים משרתי NOAA, ECMWF, DWD, Met Office,
        Environment Canada, Météo-France ו־JMA. כל הריצות האלה פתוחות לציבור בחינם.
      </footer>
    </div>
  );
}

/* ═══════════════════════════ tooltip ═══════════════════════════ */

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

/* ═══════════════════════════ styles ═══════════════════════════ */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Hebrew:wght@300;400;500;600;700&display=swap');

.wx{
  --night:#0E1728; --panel:#16223A; --panel2:#1B2942; --rule:#2A3B5A; --rule2:#22314D;
  --text:#E9EEF7; --muted:#8FA1BC; --dim:#B7C4D8;
  --sky:#5AB3F0; --warm:#F5A24B; --mint:#6FD99A; --rose:#F27878;
  position:relative; min-height:100%; background:var(--night); color:var(--text);
  font-family:'IBM Plex Sans Hebrew',system-ui,sans-serif; font-weight:400; line-height:1.6;
  font-variant-numeric:tabular-nums; padding:0 20px 64px; overflow:hidden;
}
.wx *{box-sizing:border-box}
.wx h1,.wx h2,.wx h3{font-family:inherit;margin:0;letter-spacing:-.02em;line-height:1.15}
.wx h1{font-weight:700} .wx h2{font-weight:600} .wx h3{font-weight:600}
.wx b{font-weight:600}
.wx button{font-family:inherit;cursor:pointer;color:inherit}
.wx button:focus-visible,.wx input:focus-visible{outline:2px solid var(--sky);outline-offset:2px}
.sky{position:absolute;inset:0 0 auto;height:420px;pointer-events:none;
  background:radial-gradient(90% 90% at 80% -20%,rgba(90,179,240,.16),transparent 62%),
  radial-gradient(70% 80% at 12% -10%,rgba(197,139,240,.12),transparent 60%)}

.sec-head{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin-bottom:14px}
.sub{font-size:13.5px;color:var(--muted);font-weight:300}

/* head */
.head{position:relative;display:flex;gap:40px;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;
  max-width:1120px;margin:0 auto;padding:48px 0 30px;border-bottom:1px solid var(--rule)}
.head-l{flex:1 1 420px;min-width:0}
.eyebrow{font-size:11.5px;letter-spacing:.22em;color:var(--sky);margin-bottom:14px;font-weight:500}
.head h1{font-size:clamp(30px,5vw,50px)}
.dek{max-width:54ch;margin:14px 0 0;font-size:15px;color:var(--dim);font-weight:300}
.head-r{flex:0 1 300px;position:relative}
.lab{display:block;font-size:12px;color:var(--muted);margin-bottom:7px;font-weight:500}
.srch{width:100%;background:var(--panel);border:1px solid var(--rule);border-radius:10px;
  padding:11px 13px;font-size:15px;font-family:inherit;color:var(--text)}
.srch::placeholder{color:#6B7D9B;font-weight:300}
.hint{font-size:12px;color:var(--muted);margin-top:6px}
.res{position:absolute;z-index:30;inset-inline:0;top:100%;margin:6px 0 0;padding:5px;list-style:none;
  background:var(--panel2);border:1px solid var(--rule);border-radius:10px;max-height:290px;overflow:auto;
  box-shadow:0 14px 34px rgba(0,0,0,.42)}
.res button{display:block;width:100%;text-align:start;background:none;border:0;padding:9px 11px;border-radius:7px}
.res button:hover{background:#26385A}
.rn{display:block;font-size:14.5px;font-weight:500}
.rr{display:block;font-size:12px;color:var(--muted);font-weight:300}
.coords{margin-top:9px;font-size:12px;color:var(--muted);font-weight:300}

/* week cards */
.week{max-width:1120px;margin:36px auto 0}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.card{background:var(--panel);border:1px solid var(--rule2);border-radius:14px;
  padding:14px 13px 15px;text-align:start;display:flex;flex-direction:column;gap:7px;transition:.16s}
.card:hover{background:var(--panel2);border-color:#38507C;transform:translateY(-2px)}
.card.focus{border-color:var(--sky);background:#1C3151;box-shadow:0 0 0 1px var(--sky) inset}
.card.flagged{border-color:#6E4A2E}
.c-head{display:flex;justify-content:space-between;align-items:baseline}
.c-dow{font-size:17px;font-weight:600}
.c-date{font-size:12px;color:var(--muted);font-weight:300}
.c-icon{width:62px;height:62px;margin:2px auto 0}
.c-icon svg{width:100%;height:100%;display:block}
.c-cond{text-align:center;font-size:13px;color:var(--dim);font-weight:400}
.c-temp{display:flex;justify-content:center;gap:9px;align-items:baseline;font-size:15px;color:var(--muted)}
.c-temp b{font-size:20px;font-weight:600;color:var(--text)}
.c-verdict{font-size:12.5px;font-weight:600;margin-top:3px}
.v-high{color:var(--mint)} .v-mid{color:var(--warm)} .v-split{color:var(--rose)} .v-dry{color:#6E819F}
.c-count{font-size:12px;color:var(--muted);font-weight:300}
.c-range{margin-top:auto;padding-top:6px}
.track{position:relative;height:15px;border-bottom:1px solid var(--rule)}
.tick{position:absolute;bottom:0;width:2.5px;height:12px;border-radius:2px;transform:translateX(50%)}
.rn2{display:flex;justify-content:space-between;gap:4px;margin-top:5px;font-size:10.5px;color:var(--muted);font-weight:300}
.rmid{opacity:.6;font-size:10px}
.flag{margin-top:4px;font-size:11.5px;font-weight:500;color:var(--warm);
  background:rgba(245,162,75,.12);border-radius:6px;padding:3px 7px;text-align:center}

/* alerts */
.alerts{max-width:1120px;margin:36px auto 0;background:var(--panel);border:1px solid var(--rule2);
  border-radius:14px;padding:20px 20px 18px}
.alerts h2{font-size:19px}
.alerts .sub{display:block;margin:8px 0 14px;max-width:70ch;line-height:1.65}
.alist{display:flex;flex-direction:column;gap:8px}
.alert{display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:var(--panel2);
  border-inline-start:3px solid;border-radius:8px;padding:10px 13px;font-size:13.5px}
.a-day{font-weight:600;flex:0 0 96px}
.a-txt{flex:1;color:var(--dim);font-weight:300;min-width:200px}
.a-txt b{color:var(--text)}
.a-go{background:none;border:0;font-size:12.5px;color:var(--sky);font-weight:500;padding:0}

/* pens */
.pens{max-width:1120px;margin:36px auto 0}
.pens h2{font-size:19px}
.pen-row{display:flex;flex-wrap:wrap;gap:8px}
.pen{display:inline-flex;align-items:center;gap:8px;background:var(--panel);border:1px solid var(--rule);
  color:#6E819F;padding:7px 15px;border-radius:999px;font-size:13.5px;font-weight:500;transition:.15s}
.pen:hover{border-color:#42598A}
.nib{width:9px;height:9px;border-radius:999px;border:1.5px solid;display:inline-block}

/* graph */
.graph{max-width:1120px;margin:22px auto 0}
.gbar{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:10px}
.vars{display:flex;background:var(--panel);border:1px solid var(--rule);border-radius:10px;overflow:hidden}
.vtab{background:transparent;border:0;padding:8px 18px;font-size:13.5px;color:var(--muted);font-weight:500}
.vtab.on{background:var(--sky);color:#0E1728;font-weight:600}
.scope{display:flex;align-items:center;gap:14px}
.unit{font-size:12px;color:var(--muted);font-weight:300}
.back{background:none;border:0;font-size:13px;color:var(--sky);font-weight:500;padding:0}

.panel{position:relative;background:var(--panel);border:1px solid var(--rule2);border-radius:14px;padding:12px 12px 0}
.bands{display:flex;gap:6px;margin-bottom:8px}
.band{flex:1;display:flex;flex-direction:column;align-items:center;gap:1px;background:transparent;
  border:0;border-radius:9px;padding:7px 2px;transition:.15s;min-width:0}
.band:hover{background:#22314D}
.band.solo{align-items:flex-start;padding-inline-start:2px}
.b-ic{width:30px;height:30px;margin-bottom:1px}
.b-ic svg{width:100%;height:100%;display:block}
.b-day{font-size:15px;font-weight:600;white-space:nowrap}
.band.solo .b-day{font-size:19px}
.b-date{font-size:11.5px;color:var(--muted);font-weight:300}
.pkey{display:flex;align-items:center;gap:9px;font-size:12px;color:var(--muted);font-weight:300;
  border-top:1px solid var(--rule2);margin-top:6px;padding:10px 4px 12px}
.kb{width:26px;height:11px;border-radius:3px;background:#9BB6E8;opacity:.3;flex:none}
.veil{position:absolute;inset:0;z-index:6;display:flex;flex-direction:column;gap:12px;align-items:center;
  justify-content:center;background:rgba(14,23,40,.86);border-radius:14px;font-size:13.5px;color:var(--muted)}
.veil.err{color:var(--rose)}
.veil button{background:var(--sky);color:#0E1728;border:0;padding:8px 18px;border-radius:8px;font-weight:600;font-size:13px}

/* tooltip */
.tip{background:#1C2B47;border:1px solid #3A507A;border-radius:10px;padding:10px 12px;
  font-size:13px;min-width:158px;box-shadow:0 12px 30px rgba(0,0,0,.5)}
.tip-h{font-size:12px;color:var(--muted);padding-bottom:7px;margin-bottom:6px;border-bottom:1px solid #33486F}
.tip-r{display:flex;align-items:center;gap:8px;padding:2px 0}
.tip-nib{width:9px;height:3px;border-radius:2px;flex:none}
.tip-n{flex:1;font-weight:500}
.tip-v{font-size:12.5px;color:var(--dim)}
.tip-v em{font-style:normal;font-size:10.5px;color:var(--muted)}

/* totals */
.totals{max-width:1120px;margin:40px auto 0}
.totals h2,.learn h2,.week h2{font-size:24px}
.trows{margin-top:16px;display:flex;flex-direction:column;gap:8px}
.tot{display:flex;align-items:center;gap:12px}
.tname{flex:0 0 72px;font-size:13.5px;font-weight:600}
.tbar{flex:1;height:10px;background:var(--panel2);border-radius:5px;overflow:hidden}
.tbar span{display:block;height:100%;border-radius:5px}
.tnum{flex:0 0 74px;font-size:12.5px;color:var(--muted);font-weight:300}
.tnote{font-size:13.5px;color:var(--dim);font-weight:300;margin-top:15px;max-width:64ch;
  border-inline-start:2px solid var(--sky);padding-inline-start:13px}

/* learn */
.learn{max-width:1120px;margin:52px auto 0;padding-top:28px;border-top:1px solid var(--rule)}
.lgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(248px,1fr));gap:10px;margin-top:18px}
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
.primer{margin-top:38px;max-width:68ch}
.primer h3{font-size:20px;margin-bottom:13px}
.primer p{font-size:15px;line-height:1.8;color:var(--dim);font-weight:300;margin:0 0 14px}
.primer b{color:var(--text);font-weight:600}
.foot{max-width:1120px;margin:48px auto 0;padding-top:18px;border-top:1px solid var(--rule2);
  font-size:12.5px;color:var(--muted);font-weight:300;line-height:1.75}

@media (max-width:640px){
  .head{padding-top:32px;gap:24px}
  .head-r{flex:1 1 100%}
  .cards{grid-template-columns:repeat(2,1fr)}
  .b-day{font-size:12px} .b-ic{width:22px;height:22px} .b-date{font-size:10px}
}
@media (prefers-reduced-motion:reduce){.wx *{transition:none!important;animation:none!important}}
`;
