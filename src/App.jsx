import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from "react";
import {
  ComposedChart, Line, Area, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea,
} from "recharts";
import { LANGS, LANG_BY, detectLang, createT, I18nCtx, useI18n, makeDates } from "./i18n";

/* ═══════════════════════ models ═══════════════════════ */
/* טקסט תיאורי חי ב-i18n.js — כאן רק מה שלא תלוי שפה */

const MODELS = [
  { id: "ecmwf_ifs025",         short: "ECMWF",  ink: "#5AB3F0", name: "IFS",                    runs: "00 · 06 · 12 · 18 UTC" },
  { id: "gfs_seamless",         short: "GFS",    ink: "#F5A24B", name: "Global Forecast System", runs: "00 · 06 · 12 · 18 UTC" },
  { id: "icon_seamless",        short: "ICON",   ink: "#6FD99A", name: "ICON",                   runs: "00 · 06 · 12 · 18 UTC" },
  { id: "ukmo_seamless",        short: "UKMO",   ink: "#C58BF0", name: "Unified Model",          runs: "00 · 06 · 12 · 18 UTC" },
  { id: "gem_seamless",         short: "GEM",    ink: "#F27878", name: "GEM",                    runs: "00 · 12 UTC" },
  { id: "meteofrance_seamless", short: "ARPEGE", ink: "#4FD8D0", name: "ARPEGE / AROME",         runs: "00 · 06 · 12 · 18 UTC" },
  { id: "jma_seamless",         short: "JMA",    ink: "#F0D45E", name: "GSM",                    runs: "00 · 06 · 12 · 18 UTC" },
];

const M = Object.fromEntries(MODELS.map((m) => [m.id, m]));
const DEFAULT_ON = ["ecmwf_ifs025", "gfs_seamless", "icon_seamless", "ukmo_seamless", "gem_seamless"];

/* 14 יום. מעבר לזה נשאר בעיקר GFS לבדו, וקו יחיד הוא לא השוואה. */
const DAYS_N = 14, PAGE = 7;

const SITE_NAME = "modelspread.app";
const VAR_KEYS = { precipitation: "varPrecip", temperature_2m: "varTemp", wind_speed_10m: "varWind" };
const VAR_UNITS = { precipitation: "unitMmH", temperature_2m: "unitC", wind_speed_10m: "unitKmh" };

/* ═══════════════════════ icons ═══════════════════════ */

/* דרך משתנים, כי var() נפתר גם ב-presentation attribute של SVG —
   כך האייקונים מתחלפים עם הערכה בלי קוד נוסף */
const C = { cloud: "var(--ic-cloud)", dark: "var(--ic-cloud2)", sun: "var(--ic-sun)",
  drop: "var(--ic-drop)", snow: "var(--ic-snow)", moon: "var(--ic-moon)" };

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
/* כוכב ארבע-קצוות רך (נבדל מ-Star של המנהיג שהוא בן חמש קצוות) */
const Twinkle = ({ cx, cy, s }) => (
  <path fill={C.moon} d={`M ${cx} ${cy - s} Q ${cx + s * 0.16} ${cy - s * 0.16} ${cx + s} ${cy}`
    + ` Q ${cx + s * 0.16} ${cy + s * 0.16} ${cx} ${cy + s}`
    + ` Q ${cx - s * 0.16} ${cy + s * 0.16} ${cx - s} ${cy}`
    + ` Q ${cx - s * 0.16} ${cy - s * 0.16} ${cx} ${cy - s} Z`} />
);
/* סהרון — קשת חיצונית ברדיוס r וקשת פנימית שטוחה (ir>r) שחוזרת. בלי mask/id */
const Moon = ({ cx = 24, cy = 20, r = 7.5, stars = false }) => {
  const ir = r * 1.45;
  return (
    <g>
      <path fill={C.moon} transform={`rotate(-18 ${cx} ${cy})`}
        d={`M ${cx} ${cy - r} A ${r} ${r} 0 0 0 ${cx} ${cy + r} A ${ir} ${ir} 0 0 1 ${cx} ${cy - r} Z`} />
      {stars && (
        <>
          {/* משולש עם קודקוד ימינה, מקונן בתוך פתח הסהרון. פריסה סימטרית
              סביב אותו רדיוס נקראת כקשת ולא כאשכול — ולכן שני הכוכבים
              השמאליים כמעט על אותו x, והשלישי לבדו מימין */}
          <Twinkle cx={cx + r * 0.79} cy={cy - r * 0.71} s={2.5} />
          <Twinkle cx={cx + r * 1.31} cy={cy - r * 0.19} s={1.35} />
          <Twinkle cx={cx + r * 0.82} cy={cy + r * 0.38} s={1.8} />
        </>
      )}
    </g>
  );
};

const ICONS = {
  clear: () => <svg viewBox="0 0 48 48"><Sun cx={24} cy={24} r={9} /></svg>,
  partly: () => <svg viewBox="0 0 48 48"><Sun cx={31} cy={16} r={6.5} /><Cloud y={2} /></svg>,
  /* רוחב ה-bbox מיושר לשאר הסט (~30) — קודם הוא היה 36 והכוכבים נראו תלושים */
  "clear-night": () => <svg viewBox="0 0 48 48"><Moon cx={21} cy={24} r={10.5} stars /></svg>,
  /* הירח מתרומם מעל הענן — בלי קרניים כמו לשמש הוא נבלע בו. הכוכב משמאל
     תופס את המקום שבו הקרניים יוצאות ב-partly, כדי ששני האייקונים יאוזנו זהה */
  "partly-night": () => <svg viewBox="0 0 48 48"><Moon cx={32} cy={11} r={8.5} /><Twinkle cx={17} cy={12} s={2.2} /><Cloud y={2} /></svg>,
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

const Globe = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3c2.6 2.6 3.9 5.6 3.9 9s-1.3 6.4-3.9 9c-2.6-2.6-3.9-5.6-3.9-9S9.4 5.6 12 3Z" />
  </svg>
);

/** הסימן של האפליקציה — אותו עיצוב כמו האייקון */
const Logo = () => (
  <svg viewBox="0 0 100 100" aria-hidden="true">
    <g fill="#F5C451" stroke="#F5C451" strokeWidth="3.4" strokeLinecap="round">
      <circle cx="63" cy="30" r="11" stroke="none" />
      <line x1="73.16" y1="36.12" x2="77.78" y2="38.91" /><line x1="66.12" y1="42.84" x2="68.91" y2="47.46" />
      <line x1="56.88" y1="42.84" x2="54.09" y2="47.46" /><line x1="49.84" y1="36.12" x2="45.22" y2="38.91" />
      <line x1="49.84" y1="23.88" x2="45.22" y2="21.09" /><line x1="56.88" y1="17.16" x2="54.09" y2="12.54" />
      <line x1="66.12" y1="17.16" x2="68.91" y2="12.54" /><line x1="73.16" y1="23.88" x2="77.78" y2="21.09" />
    </g>
    <g fill="#8A9EBE">
      <rect x="19" y="42" width="51" height="18" rx="9" />
      <circle cx="33" cy="43" r="14" /><circle cx="55" cy="40" r="17" />
    </g>
    <g strokeWidth="5.4" strokeLinecap="round">
      <line x1="29" y1="66" x2="24" y2="90" stroke="#5AB3F0" />
      <line x1="45" y1="66" x2="40" y2="80" stroke="#F5A24B" />
      <line x1="60" y1="66" x2="55" y2="96" stroke="#6FD99A" />
    </g>
  </svg>
);

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

/** קוד WMO (מ-Open-Meteo current) → אחד מהאייקונים הקיימים שלנו */
function wmoIcon(code) {
  if (code == null) return null;
  if (code === 0) return "clear";
  if (code === 1) return "clear";
  if (code === 2) return "partly";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "cloudy";
  if ([51, 53, 55, 56, 57].includes(code)) return "drizzle";
  if ([61, 63, 66, 80].includes(code)) return "rain";
  if ([65, 67, 81, 82].includes(code)) return "storm";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if (code === 95 || code === 96 || code === 99) return "storm";
  return "cloudy";
}

/** גרסת לילה לאייקון — רק לאלה שיש בהם גרם שמימי גלוי (שמש → ירח).
 *  isDay: 1 יום · 0 לילה · undefined → מתייחסים כיום (בלי לנחש) */
const NIGHT_OF = { clear: "clear-night", partly: "partly-night" };
const nightIcon = (name, isDay) => (isDay === 0 && NIGHT_OF[name]) || name;

/* ═══════════════════════ helpers ═══════════════════════ */

const pick = (o, base, m) => { if (!o) return null; const v = o[`${base}_${m}`]; return v !== undefined ? v : o[base]; };
const nums = (a) => a.filter((v) => typeof v === "number" && !Number.isNaN(v));
const fmt = (v, d = 1) => (typeof v === "number" ? v.toFixed(d) : "–");
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const isoDate = (d) => d.toISOString().slice(0, 10);

/** מרנדר **מודגש** בתוך מחרוזת מתורגמת */
function Rich({ text }) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return <>{parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**")
      ? <b key={i}>{p.slice(2, -2)}</b>
      : <React.Fragment key={i}>{p}</React.Fragment>
  )}</>;
}

function agreement(values) {
  const v = nums(values);
  if (!v.length) return null;
  const lo = Math.min(...v), hi = Math.max(...v);
  const wet = v.filter((x) => x >= 0.5).length, spread = hi - lo;
  let level, key;
  if (hi < 0.5) { level = "dry"; key = "agAllDry"; }
  else if (wet === 0) { level = "dry"; key = "agMostDry"; }
  else if (wet === v.length && spread / Math.max(hi, 0.1) < 0.45) { level = "high"; key = "agHigh"; }
  else if (spread / Math.max(hi, 0.1) > 0.7 || wet / v.length < 0.6) { level = "split"; key = "agSplit"; }
  else { level = "mid"; key = "agPartial"; }
  return { lo, hi, spread, wet, total: v.length, level, key, med: median(v) };
}

function outliers(pairs) {
  const v = pairs.filter((p) => typeof p.v === "number");
  if (v.length < 3) return [];
  const med = median(v.map((p) => p.v)), out = [];
  for (const p of v) {
    if (Math.abs(p.v - med) < 3) continue;
    if (med < 0.4 && p.v >= 3) out.push({ ...p, dir: "wet", med });
    else if (med >= 0.4 && p.v >= med * 2.5) out.push({ ...p, dir: "wet", med });
    else if (med >= 5 && p.v <= med * 0.3) out.push({ ...p, dir: "dry", med });
  }
  return out;
}

/** °C ↔ °F. toT ממיר ערך, toDT ממיר הפרש (בלי היסט) */
const toT = (c, u) => (typeof c === "number" ? (u === "f" ? c * 9 / 5 + 32 : c) : c);
const toDT = (c, u) => (typeof c === "number" ? (u === "f" ? c * 9 / 5 : c) : c);

function UnitToggle({ value, onChange, size }) {
  return (
    <span className={`utog${size === "lg" ? " lg" : ""}`} dir="ltr">
      <button className={value === "c" ? "on" : ""} onClick={() => onChange("c")}>°C</button>
      <button className={value === "f" ? "on" : ""} onClick={() => onChange("f")}>°F</button>
    </span>
  );
}

/* ═══════════════════════ root ═══════════════════════ */

const FALLBACK_NAMES = {
  he: { name: "לונדון", region: "אנגליה, בריטניה" },
  en: { name: "London", region: "England, United Kingdom" },
  ru: { name: "Лондон", region: "Англия, Великобритания" },
  es: { name: "Londres", region: "Inglaterra, Reino Unido" },
  fr: { name: "Londres", region: "Angleterre, Royaume-Uni" },
  ar: { name: "لندن", region: "إنجلترا، المملكة المتحدة" },
};
const FALLBACK_COORDS = { lat: 51.5074, lon: -0.1278 };
const fallbackFor = (lang) => ({ ...(FALLBACK_NAMES[lang] || FALLBACK_NAMES.en), ...FALLBACK_COORDS });
const loadSaved = () => {
  try {
    const s = JSON.parse(localStorage.getItem("wx-place"));
    return s && typeof s.lat === "number" && typeof s.lon === "number" ? s : null;
  } catch { return null; }
};

export default function App() {
  const [lang, setLang] = useState(detectLang);
  const meta = LANG_BY[lang] || LANG_BY.en;
  const ctx = useMemo(() => ({
    lang, t: createT(lang), dir: meta.dir, locale: meta.locale, dates: makeDates(meta.locale),
  }), [lang, meta]);

  useEffect(() => { try { localStorage.setItem("wx-lang", lang); } catch { /* private */ } }, [lang]);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = meta.dir;
  }, [lang, meta.dir]);

  return (
    <I18nCtx.Provider value={ctx}>
      <Weather lang={lang} setLang={setLang} />
    </I18nCtx.Provider>
  );
}

/* ═══════════════════════ language switch ═══════════════════════ */

const SunIc = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="4.2" />
    {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
      const r = (a * Math.PI) / 180;
      return <line key={a} x1={12 + Math.cos(r) * 7} y1={12 + Math.sin(r) * 7}
        x2={12 + Math.cos(r) * 9.4} y2={12 + Math.sin(r) * 9.4} />;
    })}
  </svg>
);
const MoonIc = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 3a9 9 0 1 0 9 9 7.2 7.2 0 0 1-9-9Z" />
  </svg>
);

/** מחליף ערכה. שני הסמלים תמיד גלויים והגלולה מחליקה ביניהם, כך שרואים
 *  את שתי האפשרויות ולא צריך לנחש מה הכפתור יעשה. */
function ThemeSwitch({ theme, setTheme }) {
  const { t } = useI18n();
  const light = theme === "light";
  return (
    <button className={`thm ${light ? "on" : ""}`} role="switch" aria-checked={light}
      onClick={() => setTheme(light ? "dark" : "light")}
      title={t(light ? "themeToDark" : "themeToLight")}
      aria-label={t(light ? "themeToDark" : "themeToLight")}>
      <span className="thm-knob" />
      <span className="thm-ic thm-moon"><MoonIc /></span>
      <span className="thm-ic thm-sun"><SunIc /></span>
    </button>
  );
}

function LangSwitch({ lang, setLang }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div className="lang" ref={ref}>
      <button className="lang-btn" onClick={() => setOpen(!open)} aria-label={t("langLabel")} aria-expanded={open}>
        <span className="lang-ic"><Globe /></span>
        <span className="lang-cur">{LANG_BY[lang].native}</span>
      </button>
      {open && (
        <ul className="lang-menu">
          {LANGS.map((l) => (
            <li key={l.code}>
              <button className={l.code === lang ? "on" : ""} dir={l.dir}
                onClick={() => { setLang(l.code); setOpen(false); }}>
                <span className="lm-native">{l.native}</span>
                <span className="lm-flag" role="img" aria-label={l.english}>{l.flag}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ═══════════════════════ app ═══════════════════════ */

function Weather({ lang, setLang }) {
  const { t, dir, dates } = useI18n();

  /* כהה היא ברירת המחדל — גם כשאין ערך שמור וגם כשה-localStorage חסום */
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("wx-theme") === "light" ? "light" : "dark"; }
    catch { return "dark"; }
  });
  useEffect(() => {
    try { localStorage.setItem("wx-theme", theme); } catch { /* private */ }
    /* גם צבע סרגל הדפדפן במובייל, לא רק הדף */
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", theme === "light" ? "#F2F6FC" : "#0E1728");
    document.documentElement.style.background = theme === "light" ? "#F2F6FC" : "#0E1728";
  }, [theme]);

  const [place, setPlace] = useState(() => loadSaved() || fallbackFor(lang));
  const [locating, setLocating] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const [active, setActive] = useState(DEFAULT_ON);
  const [variable, setVariable] = useState("precipitation");
  const [daySel, setDaySel] = useState(0);
  const [page, setPage] = useState(0);
  const swipe = useRef(null);
  const [scope, setScope] = useState("week");
  const [openModel, setOpenModel] = useState(null);
  const [hoverIdx, setHoverIdx] = useState(null);
  const [hHover, setHHover] = useState(null);
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width:760px)").matches
  );
  const [unitT, setUnitT] = useState(() => {
    try {
      const s = localStorage.getItem("wx-unit");
      if (s === "c" || s === "f") return s;
    } catch { /* private */ }
    return "c";
  });
  useEffect(() => { try { localStorage.setItem("wx-unit", unitT); } catch { /* private */ } }, [unitT]);

  const [data, setData] = useState(null);
  const [amb, setAmb] = useState(null);
  const [marine, setMarine] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const boxRef = useRef(null);
  const lastLoad = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia("(max-width:760px)");
    const h = (e) => setNarrow(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  useEffect(() => {
    setPlace((cur) => {
      const wasFallback = FALLBACK_COORDS.lat === cur.lat && FALLBACK_COORDS.lon === cur.lon
        && Object.values(FALLBACK_NAMES).some((f) => f.name === cur.name);
      return wasFallback ? fallbackFor(lang) : cur;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  useEffect(() => {
    try { localStorage.setItem("wx-place", JSON.stringify(place)); } catch { /* private */ }
  }, [place]);

  const locate = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude, lon = pos.coords.longitude;
        let name = t("myLocation"), region = "";
        try {
          const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=${LANG_BY[lang].geo}`);
          const j = await r.json();
          name = j.city || j.locality || j.principalSubdivision || name;
          region = [j.principalSubdivision, j.countryName].filter(Boolean).join(", ");
        } catch { /* coords only */ }
        setPlace({ name, region, lat, lon });
        setDaySel(0); setPage(0); setScope("week"); setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000, maximumAge: 600000 }
    );
  }, [lang, t]);

  useEffect(() => { if (!loadSaved()) locate(); }, [locate]);

  const load = useCallback(async () => {
    if (!active.length) { setData(null); setLoading(false); return; }
    setLoading(true); setError(null);
    const url = "https://api.open-meteo.com/v1/forecast" +
      `?latitude=${place.lat}&longitude=${place.lon}` +
      "&hourly=precipitation,snowfall,temperature_2m,apparent_temperature,wind_speed_10m,wind_gusts_10m,cloud_cover" +
      "&daily=precipitation_sum,snowfall_sum,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,wind_speed_10m_max,wind_gusts_10m_max" +
      `&models=${active.join(",")}&timezone=auto&forecast_days=${DAYS_N}`;
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`${r.status}`);
      const j = await r.json();
      if (j.error) throw new Error(j.reason || "bad request");
      setData(j);
      lastLoad.current = Date.now();
    } catch (e) { setError(e.message || "error"); setData(null); }
    finally { setLoading(false); }
  }, [place, active]);

  useEffect(() => { load(); }, [load]);

  /* המודלים מתעדכנים בערך אחת לשעה. מרעננים כשחוזרים ללשונית — המקרה
     שבו הנתונים באמת מיושנים — ובנוסף כל רבע שעה ברקע. */
  useEffect(() => {
    const stale = () => Date.now() - lastLoad.current > 10 * 60 * 1000;
    const onVisible = () => { if (document.visibilityState === "visible" && stale()) load(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    const timer = setInterval(() => { if (document.visibilityState === "visible") load(); }, 15 * 60 * 1000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      clearInterval(timer);
    };
  }, [load]);

  /* קריאות משנה: מדדי סביבה ממקור יחיד, וים אם יש ים.
     שתיהן נכשלות בשקט — הן מוסיפות מידע, לא נושאות את האתר. */
  useEffect(() => {
    let dead = false;
    const geo = `latitude=${place.lat}&longitude=${place.lon}&timezone=auto&forecast_days=${DAYS_N}`;

    (async () => {
      try {
        /* current נשען כאן דווקא על היעדר models: בלעדיו Open-Meteo מחזיר
           best-match, בדיוק כמו הבקשה שמזינה את האייקונים בחיפוש. עם models
           הוא מחזיר את המודל הראשון ברשימה — ומשם נבעו האייקונים הסותרים. */
        const r = await fetch("https://api.open-meteo.com/v1/forecast?" + geo +
          "&hourly=relative_humidity_2m,surface_pressure,wind_direction_10m,uv_index&daily=uv_index_max" +
          "&current=weather_code,is_day");
        const j = await r.json();
        if (!dead) setAmb(j.error ? null : j);
      } catch { if (!dead) setAmb(null); }
    })();

    (async () => {
      try {
        const r = await fetch("https://marine-api.open-meteo.com/v1/marine?" + geo +
          "&daily=wave_height_max,wave_period_max");
        const j = await r.json();
        const ok = !j.error && Array.isArray(j.daily?.wave_height_max) &&
          j.daily.wave_height_max.some((v) => typeof v === "number");
        if (!dead) setMarine(ok ? j : null);
      } catch { if (!dead) setMarine(null); }
    })();

    return () => { dead = true; };
  }, [place]);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    let dead = false;
    const tm = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=${LANG_BY[lang].geo}&format=json`);
        const j = await r.json();
        const list = j.results || [];
        if (dead) return;
        setResults(list);
        setSearching(false);

        /* מזג אוויר נוכחי לכל התוצאות בבקשה אחת — לא שש בקשות נפרדות */
        if (list.length) {
          try {
            const lats = list.map((p) => p.latitude).join(",");
            const lons = list.map((p) => p.longitude).join(",");
            const wr = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=temperature_2m,weather_code,is_day&forecast_days=1`);
            const wj = await wr.json();
            if (dead) return;
            const arr = Array.isArray(wj) ? wj : [wj];
            setResults((cur) => cur.map((p, i) => {
              const c = arr[i]?.current;
              return c ? { ...p, curTemp: c.temperature_2m, curCode: c.weather_code, curDay: c.is_day } : p;
            }));
          } catch { /* לא קריטי — התוצאות כבר מוצגות בלי אייקון */ }
        }
      } catch { if (!dead) { setResults([]); setSearching(false); } }
    }, 350);
    return () => { dead = true; clearTimeout(tm); };
  }, [query, lang]);

  useEffect(() => {
    const h = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setResults([]); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const toggle = (id) => setActive((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const trace = useMemo(() => {
    if (!data?.hourly?.time) return [];
    const isTemp = variable === "temperature_2m";
    return data.hourly.time.map((iso, i) => {
      const d = new Date(iso);
      const row = { iso, i, hour: d.getHours(), dayIdx: Math.floor(i / 24), label: `${String(d.getHours()).padStart(2, "0")}:00` };
      const vals = [];
      active.forEach((m) => {
        let v = pick(data.hourly, variable, m)?.[i];
        if (typeof v === "number" && isTemp) v = toT(v, unitT);
        row[m] = typeof v === "number" ? v : null;
        if (typeof v === "number") vals.push(v);
      });
      row.band = vals.length > 1 ? [Math.min(...vals), Math.max(...vals)] : null;
      return row;
    });
  }, [data, active, variable, unitT]);

  const shown = useMemo(
    () => (scope === "week"
      ? trace.filter((r) => r.dayIdx >= page * PAGE && r.dayIdx < (page + 1) * PAGE)
      : trace.filter((r) => r.dayIdx === daySel)),
    [trace, scope, daySel, page]
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

      /* שלג: ה-API מדווח ס״מ של שלג, בעוד precipitation נותן מים שקולים.
         היחס בערך 1:7, אז משווים על אותה סקאלה כדי לדעת אם השלג הוא הרוב. */
      const snowCm = nums(active.map((m) => pick(data.daily, "snowfall_sum", m)?.[i]));
      const snow = snowCm.length ? median(snowCm) : null;
      const medRain = ag?.med ?? 0;
      const snowy = typeof snow === "number" && snow > 0.2 && snow / 7 >= medRain * 0.5;

      /* מדדים נוספים */
      const feels = nums(active.map((m) => pick(data.daily, "apparent_temperature_max", m)?.[i]));
      const feelsLo = nums(active.map((m) => pick(data.daily, "apparent_temperature_min", m)?.[i]));
      const gust = nums(active.map((m) => pick(data.daily, "wind_gusts_10m_max", m)?.[i]));

      const h0 = i * 24, h1 = h0 + 24;
      const slice = (arr) => (Array.isArray(arr) ? nums(arr.slice(h0, h1)) : []);
      const rh = slice(amb?.hourly?.relative_humidity_2m);
      const pr = slice(amb?.hourly?.surface_pressure);
      const wd = amb?.hourly?.wind_direction_10m?.[h0 + 12];
      const uv = amb?.daily?.uv_index_max?.[i];
      const wave = marine?.daily?.wave_height_max?.[i];

      return {
        i, iso, dow: dates.weekday(d), dowS: dates.weekdayShort(d), date: dates.dayMonth(d),
        rain, pairs, ag, tmax: toT(tMax, unitT), tmin: toT(tmin.length ? mean(tmin) : null, unitT),
        wind: wind.length ? Math.max(...wind) : null,
        feels: toT(feels.length ? median(feels) : null, unitT),
        feelsMinC: feelsLo.length ? median(feelsLo) : null,
        feelsMaxC: feels.length ? median(feels) : null,
        gust: gust.length ? Math.max(...gust) : null,
        rh: rh.length ? Math.round(mean(rh)) : null,
        pressure: pr.length ? Math.round(mean(pr)) : null,
        pTrend: pr.length > 6 ? pr[pr.length - 1] - pr[0] : null,
        windDir: typeof wd === "number" ? wd : null,
        uv: typeof uv === "number" ? uv : null,
        wave: typeof wave === "number" ? wave : null,
        snow, snowy,
        icon: snowy ? "snow" : pickIcon(ag?.med ?? 0, cc.length ? mean(cc) : null, tMax),
        outs: outliers(pairs),
      };
    });
  }, [data, amb, marine, active, dates, unitT]);

  /* מה קורה עכשיו ומה צפוי בשעה הקרובה — נגזר מהשעה הנוכחית בסדרה השעתית */
  const now = useMemo(() => {
    if (!data?.hourly?.time) return null;
    const t0 = Date.now();
    let idx = data.hourly.time.findIndex((iso) => new Date(iso).getTime() > t0);
    if (idx <= 0) idx = 1;
    const cur = idx - 1;

    const at = (base, i) => nums(active.map((m) => pick(data.hourly, base, m)?.[i]));
    const temps = at("temperature_2m", cur);
    const feels = at("apparent_temperature", cur);
    const cloud = at("cloud_cover", cur);
    const nextRain = at("precipitation", idx);
    const nextSnow = at("snowfall", idx);

    if (!temps.length) return null;
    const medRain = nextRain.length ? median(nextRain) : 0;
    const medSnow = nextSnow.length ? median(nextSnow) : 0;
    const snowy = medSnow > 0.05 && medSnow / 7 >= medRain * 0.5;

    /* האייקון נגזר מ-weather_code של amb.current — אותו מקור best-match בדיוק
       שמזין את האייקון ליד שם העיר בחיפוש, ולכן השניים זהים מהבנייה.
       pickIcon נשאר כגיבוי לזמן שבו amb עוד לא הגיע או נכשל: הוא לא מכיר
       ערפל, וסף הטפטוף שלו גבוה פי ארבעה מזה של WMO — ומכאן הפערים שהיו.
       הטמפרטורה וההתרעה על השעה הקרובה נשארות רב-מודליות. */
    const wmo = wmoIcon(amb?.current?.weather_code);
    const base = wmo || (snowy ? "snow" : pickIcon(medRain, cloud.length ? mean(cloud) : null, median(temps)));
    return {
      temp: toT(median(temps), unitT),
      feels: feels.length ? toT(median(feels), unitT) : null,
      /* is_day מאותו current — הופך שמש לירח אחרי השקיעה */
      icon: nightIcon(base, amb?.current?.is_day),
      wet: nextRain.filter((v) => v >= 0.1).length,
      total: nextRain.length,
      rain: medRain,
      snowy,
    };
  }, [data, amb, active, unitT]);

  const sel = days[daySel];
  const pages = Math.max(1, Math.ceil(days.length / PAGE));
  const view = useMemo(() => days.slice(page * PAGE, page * PAGE + PAGE), [days, page]);
  const maxWeekRain = useMemo(() => Math.max(1, ...days.map((d) => d.ag?.hi || 0)), [days]);

  /* בחירת יום משנה את גובה פאנל הפירוט והסקשן השעתי — שניהם מעל הגרף.
     מודדים איפה הגרף יושב על המסך לפני ואחרי, ומפצים על ההפרש. */
  const panelRef = useRef(null);
  const anchorTop = useRef(null);

  const anchor = () => { anchorTop.current = panelRef.current?.getBoundingClientRect().top ?? null; };

  useLayoutEffect(() => {
    if (anchorTop.current == null) return;
    const after = panelRef.current?.getBoundingClientRect().top;
    if (after != null) window.scrollBy(0, after - anchorTop.current);
    anchorTop.current = null;
  }, [daySel, scope]);

  const pickDay = (i) => { anchor(); setDaySel(i); setScope("day"); };
  const showWeek = () => { anchor(); setScope("week"); };

  const goPage = useCallback((n) => {
    const p = Math.min(pages - 1, Math.max(0, n));
    setPage(p);
    setDaySel((cur) => (cur >= p * PAGE && cur < (p + 1) * PAGE ? cur : p * PAGE));
  }, [pages]);

  const onTouchStart = (e) => { swipe.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (swipe.current == null) return;
    const dx = e.changedTouches[0].clientX - swipe.current;
    swipe.current = null;
    if (dx < -55) goPage(page + 1);
    else if (dx > 55) goPage(page - 1);
  };

  const hourly24 = useMemo(() => {
    if (!data?.hourly?.time) return [];
    const out = [];
    for (let i = daySel * 24; i < (daySel + 1) * 24 && i < data.hourly.time.length; i++) {
      const vals = nums(active.map((m) => pick(data.hourly, "precipitation", m)?.[i]));
      const snows = nums(active.map((m) => pick(data.hourly, "snowfall", m)?.[i]));
      const temps = nums(active.map((m) => pick(data.hourly, "temperature_2m", m)?.[i]));
      const feelsH = nums(active.map((m) => pick(data.hourly, "apparent_temperature", m)?.[i]));
      const d = new Date(data.hourly.time[i]);
      const med = vals.length ? median(vals) : 0;
      const max = vals.length ? Math.max(...vals) : 0;
      out.push({
        i, h: d.getHours(), label: `${String(d.getHours()).padStart(2, "0")}:00`,
        med, max, extra: Math.max(0, max - med),
        wet: vals.filter((v) => v >= 0.1).length, total: vals.length,
        snow: snows.length ? median(snows) : null,
        temp: temps.length ? toT(median(temps), unitT) : null,
        feels: feelsH.length ? toT(median(feelsH), unitT) : null,
      });
    }
    return out;
  }, [data, active, daySel, unitT]);

  const hourlyDry = hourly24.length > 0 && hourly24.every((r) => r.max < 0.05);
  const maxYH = useMemo(() => {
    const v = Math.max(0.6, ...hourly24.map((r) => r.max)) * 1.15;
    const step = v <= 1 ? 0.25 : v <= 3 ? 0.5 : v <= 10 ? 1 : v <= 30 ? 5 : 10;
    return Math.ceil(v / step) * step;
  }, [hourly24]);
  const peak = useMemo(
    () => hourly24.reduce((a, b) => (b.med > (a?.med ?? -1) ? b : a), null), [hourly24]
  );

  const weekTotals = useMemo(() => {
    if (!data?.daily?.time) return [];
    const from = page * PAGE, to = from + PAGE;
    return active.map((m) => ({
      id: m,
      total: nums((pick(data.daily, "precipitation_sum", m) || []).slice(from, to)).reduce((a, b) => a + b, 0),
    })).sort((a, b) => b.total - a.total);
  }, [data, active, page]);

  const maxY = useMemo(() => {
    if (variable !== "precipitation") return undefined;
    const v = nums(shown.flatMap((r) => active.map((m) => r[m])));
    return v.length ? Math.max(1, Math.ceil(Math.max(...v) * 1.15 * 10) / 10) : 1;
  }, [shown, active, variable]);

  const PAD_L = 44, PAD_R = 10;
  const degLabel = unitT === "f" ? "°F" : "°C";
  const unit = variable === "temperature_2m" ? degLabel : t(VAR_UNITS[variable]);
  const mm = t("unitMm");

  /* המודל שהיה הכי מדויק כאן — רק אם המדגם מספיק גדול, ורק מבין הפעילים */
  const skill = useSkill(place, t);
  const leader = useMemo(() => {
    if (!skill || skill.wetDays < MIN_WET) return null;
    const best = skill.order.find((r) => active.includes(r.id));
    return best ? best.id : null;
  }, [skill, active]);

  return (
    <div dir={dir} className="wx" data-theme={theme}>
      <style>{CSS}</style>
      <div className="sky" />

      <div className="topbar">
        <span className="brand">
          <span className="brand-ic"><Logo /></span>
          <span className="brand-name">{SITE_NAME}</span>
        </span>
        <span className="topbar-r">
          <ThemeSwitch theme={theme} setTheme={setTheme} />
          <LangSwitch lang={lang} setLang={setLang} />
        </span>
      </div>

      <div className="eyebrow-row"><div className="eyebrow">{t("eyebrow")}</div></div>

      <header className="head">
        <div className="head-l">
          <h1>{t("title")}</h1>
          <p className="dek"><Rich text={t("dek", { place: place.name })} /></p>
        </div>
        <div className="head-r" ref={boxRef}>
          <label className="lab" htmlFor="q">{t("searchLabel")}</label>
          <div className="srch-wrap">
            <span className="srch-ic">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round">
                <circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.4 15.4 20 20" />
              </svg>
            </span>
            <input id="q" className="srch" value={query} autoComplete="off" type="search"
              placeholder={t("searchPlaceholder")} onChange={(e) => setQuery(e.target.value)} />
            {/* מחוץ לזרימה בכוונה — כאן היה div שנכנס ויוצא ודחף את כל הדף
                בכל הקלדה. הריפוד הסופי של .srch שמור תמיד, גם כשאין ספינר */}
            <span className={`srch-spin ${searching ? "on" : ""}`} aria-hidden="true" />
            {!!results.length && (
              <ul className="res">
                {results.map((r) => {
                  const ic = wmoIcon(r.curCode);
                  const Ic = ic ? ICONS[nightIcon(ic, r.curDay)] : null;
                  return (
                    <li key={r.id}>
                      <button onClick={() => {
                        setPlace({ name: r.name, region: [r.admin1, r.country].filter(Boolean).join(", "), lat: r.latitude, lon: r.longitude });
                        setQuery(""); setResults([]); setDaySel(0); setPage(0); setScope("week");
                      }}>
                        <span className="res-txt">
                          <span className="rn">{r.name}</span>
                          <span className="rr">{[r.admin1, r.country].filter(Boolean).join(", ")}</span>
                        </span>
                        {Ic && (
                          <span className="res-wx">
                            <span className="res-ic"><Ic /></span>
                            {typeof r.curTemp === "number" && <span className="res-t">{fmt(toT(r.curTemp, unitT), 0)}°</span>}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <span className="sr-live" role="status">{searching ? t("searching") : ""}</span>
          <div className="coords">
            {place.region && <>{place.region} · </>}{place.lat.toFixed(3)}°, {place.lon.toFixed(3)}°
            <button className="geo" onClick={locate} disabled={locating}>
              {locating ? t("locating") : t("myLocation")}
            </button>
          </div>
        </div>
      </header>

      {/* ── מי רטוב עכשיו בעולם ── */}
      <WetNow unitT={unitT} onPick={(p) => {
        setPlace(p);
        setQuery(""); setResults([]); setDaySel(0); setPage(0); setScope("week");
      }} />

      {/* ── week strip ── */}
      <section className="week">
        {loading && <div className="wload">{t("loading")}</div>}
        {error && <div className="werr">{error} <button onClick={load}>{t("retry")}</button></div>}

        {/* עוגן המיקום בקופסה משלו. המקום נשמר ב-localStorage, אז בטעינה
            חוזרת צריך להיות ברור מיד על איזו עיר מסתכלים. לא מותנה ב-now
            כדי שהשם יופיע כבר בזמן הטעינה, לפני שהנתונים חוזרים. */}
        <div className="placebar">{place.name}</div>

        {now && (
          <div className="nowbar">
            <span className="now-ic">{React.createElement(ICONS[now.icon])}</span>
            <span className="now-txt">
              <span className="now-lab">{t("nowLabel")}</span>
              <b>{fmt(now.temp, 0)}°</b>
              {typeof now.feels === "number" && Math.round(now.feels) !== Math.round(now.temp) && (
                <em>{t("nowFeels", { v: fmt(now.feels, 0) })}</em>
              )}
            </span>
          </div>
        )}

        {now && now.total > 0 && now.wet > now.total / 2 && (
          <div className="soon">
            <span className="soon-ic">{React.createElement(ICONS[now.snowy ? "snow" : "rain"])}</span>
            <span>
              <Rich text={now.snowy
                ? t("rainSoonSnow", { n: now.wet, total: now.total })
                : t("rainSoon", { n: now.wet, total: now.total, v: fmt(now.rain) })} />
            </span>
          </div>
        )}

        <div className="week-nav">
          {page > 0 && (
            <button className="nav-arrow" onClick={() => goPage(page - 1)} aria-label={t("pagePrev")}>
              <Chev flip={dir === "rtl"} />
            </button>
          )}

          <div className="wrow" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            {view.map((d) => {
              const Ic = ICONS[d.icon];
              return (
                <button key={d.i} className={`wcell ${daySel === d.i ? "on" : ""}`}
                  onClick={() => setDaySel(d.i)}>
                  <span className="w-dow"><i className="lg">{d.dow}</i><i className="sm">{d.dowS}</i></span>
                  <span className="w-date">{d.date}</span>
                  <span className="w-ic"><Ic /></span>
                  <span className="w-t"><b>{fmt(d.tmax, 0)}°</b><em>{fmt(d.tmin, 0)}°</em></span>
                  <span className={`w-mm ${(d.snowy || (d.ag && d.ag.med >= 0.1)) ? "wet" : ""}`}>
                    {d.snowy ? `${fmt(d.snow)} ${t("unitCm")}`
                      : d.ag && d.ag.med >= 0.1 ? `${fmt(d.ag.med)} ${mm}` : t("dryWord")}
                  </span>
                  <span className="w-bar"><i style={{ width: `${Math.min(100, ((d.ag?.med || 0) / maxWeekRain) * 100)}%` }} /></span>
                  {!!d.outs.length && <span className="w-warn" />}
                </button>
              );
            })}
          </div>

          {page < pages - 1 && (
            <button className="nav-arrow" onClick={() => goPage(page + 1)} aria-label={t("pageNext")}>
              <Chev flip={dir !== "rtl"} />
            </button>
          )}
        </div>

        {sel && (
          <div className="detail">
            <div className="d-main">
              <span className="d-ic">{React.createElement(ICONS[sel.icon])}</span>
              <div className="d-txt">
                <div className="d-day">{t("scopeDay", { day: sel.dow })} · {sel.date}</div>
                <div className="d-cond">{t(`cond.${sel.icon}`)}</div>
                <div className="d-temps">
                  <span className="dt-main"><b>{fmt(sel.tmax, 0)}°</b> <span>/ {fmt(sel.tmin, 0)}°</span></span>
                  <span className="dt-more">
                    {typeof sel.feels === "number" && (
                      <span className="d-feels">{t("feelsLike")} {fmt(sel.feels, 0)}°</span>
                    )}
                    {typeof sel.wind === "number" && <span className="d-wind">{t("windTo", { v: fmt(sel.wind, 0) })}</span>}
                  </span>
                </div>
              </div>
              <div className={`d-verdict v-${sel.ag?.level || "dry"}`}>
                <b>{sel.ag ? t(sel.ag.key) : "—"}</b>
                <span>
                  {sel.ag && sel.ag.hi >= 0.1
                    ? t("modelsRainSpread", {
                        wet: sel.ag.wet, total: sel.ag.total,
                        lo: fmt(sel.ag.lo), hi: fmt(sel.ag.hi),
                      })
                    : t("modelsRain", { wet: sel.ag ? sel.ag.wet : 0, total: sel.ag ? sel.ag.total : 0 })}
                </span>
              </div>
            </div>

            <div className="d-scale">
              {sel.ag && sel.ag.hi >= 0.1 && (
                <>
                  <div className="d-track">
                    {sel.pairs.map((p) => typeof p.v === "number" && (
                      <span key={p.id} className="d-tick" title={`${M[p.id].short} · ${fmt(p.v)} ${mm}`}
                        style={{ background: M[p.id].ink, insetInlineStart: `${Math.min(100, (p.v / Math.max(1, sel.ag?.hi || 1)) * 100)}%` }} />
                    ))}
                  </div>
                  <div className="d-nums">
                    <span>{t("scaleDry", { v: fmt(sel.ag?.lo) })}</span>
                    <span>{t("scaleWet", { v: fmt(sel.ag?.hi) })}</span>
                  </div>
                </>
              )}
              <div className="d-chips">
                {[...sel.pairs].filter((p) => typeof p.v === "number").sort((a, b) => a.v - b.v).map((p) => (
                  <span className={`d-chip ${p.id === leader ? "lead" : ""}`} key={p.id} style={{ borderColor: M[p.id].ink + "66" }}>
                    <i style={{ background: M[p.id].ink }} />
                    <b style={{ color: M[p.id].ink }}>{M[p.id].short}</b>
                    {p.id === leader && <span className="chip-star" style={{ color: M[p.id].ink }}><Star /></span>}
                    <em>{fmt(p.v)} {mm}</em>
                  </span>
                ))}
              </div>
            </div>

            {sel.snowy && (
              <div className="snownote">
                <Rich text={t("snowNote", { v: fmt(sel.snow) })} />
              </div>
            )}

            {sel.ag && sel.ag.total < active.length && (
              <div className="reach">{t("modelsReach", { n: sel.ag.total, total: active.length })}</div>
            )}

            <Conditions day={sel} unitT={unitT} elevation={data?.elevation} />
            <Observations day={sel} />

            {!!sel.outs.length && (
              <div className="d-outs">
                {sel.outs.map((o, k) => (
                  <div className="d-out" key={k} style={{ borderInlineStartColor: M[o.id].ink }}>
                    <Rich text={t(o.dir === "wet" ? "outWet" : "outDry", {
                      model: M[o.id].short, v: fmt(o.v), med: fmt(o.med),
                    })} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── hourly ── */}
      {!!hourly24.length && (
        <section className="hourly">
          <div className="sec-head">
            <h2>{t("hourlyTitle")}</h2>
            <span className="sub">{t("scopeDay", { day: sel?.dow })} · {sel?.date}</span>
            <span className="sh-end"><UnitToggle value={unitT} onChange={setUnitT} /></span>
          </div>

          <div className="hpanel">
            <div className={`hlead ${hourlyDry ? "dry" : ""}`}>
              <Rich text={
                hourlyDry ? t("hourlyDry", { n: active.length })
                  : peak && peak.med > 0.05
                    ? t("hourlyPeak", { time: peak.label, med: fmt(peak.med), max: fmt(peak.max) })
                    : t("hourlyMixed")
              } />
            </div>

            {narrow && <HourReadout row={hHover ? hourly24.find((r) => r.label === hHover) : null} pos="top" />}

            <div className="chart-box" dir="ltr" style={{ width: "100%", height: narrow ? 200 : 240 }}>
              <span className="chart-unit" style={{ width: 38 }}>{mm}</span>
              <span className="chart-unit right" style={{ width: 38, color: "#F5A24B" }}>{degLabel}</span>
              <ResponsiveContainer>
                <ComposedChart data={hourly24} margin={{ top: 10, right: 4, bottom: 0, left: 0 }} barCategoryGap="18%">
                  <XAxis dataKey="label" reversed={dir === "rtl"} tick={{ fontSize: 11, fill: "var(--muted)" }}
                    axisLine={{ stroke: "var(--line2)" }} tickLine={false} interval={narrow ? 3 : 2} />
                  <YAxis yAxisId="l" domain={[0, maxYH]} width={38} tick={{ fontSize: 11, fill: "var(--muted)" }}
                    axisLine={false} tickLine={false} />
                  <YAxis yAxisId="r" orientation="right" domain={["auto", "auto"]} width={38}
                    tick={{ fontSize: 11, fill: "#F5A24B" }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: "var(--pure)", fillOpacity: 0.05 }} offset={54}
                    content={<HourTip narrow={narrow} onHover={setHHover} />} />
                  <Bar yAxisId="l" dataKey="med" stackId="p" fill="#5AB3F0" animationDuration={700} />
                  <Bar yAxisId="l" dataKey="extra" stackId="p" fill="var(--ink2)" fillOpacity={0.28}
                    radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  <Line yAxisId="r" dataKey="feels" stroke="#F5A24B" strokeWidth={1.4} dot={false}
                    strokeDasharray="4 3" strokeOpacity={0.65} activeDot={false}
                    type="monotone" connectNulls isAnimationActive={false} />
                  <Line yAxisId="r" dataKey="temp" stroke="#F5A24B" strokeWidth={2} dot={false}
                    activeDot={<TempDot />} type="monotone" connectNulls animationDuration={800} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {!narrow && <HourReadout row={hHover ? hourly24.find((r) => r.label === hHover) : null} />}

            <div className="hagree" dir={dir}>
              {hourly24.map((r) => (
                <span key={r.i} className="hcell" title={`${r.label} · ${r.wet}/${r.total}`}>
                  <i style={{ opacity: r.total ? 0.1 + (r.wet / r.total) * 0.9 : 0.1 }} />
                  {r.h % 6 === 0 && <em>{String(r.h).padStart(2, "0")}</em>}
                </span>
              ))}
            </div>

            <div className="hlegend">
              <span><i className="sw solid" /> {t("legMedian")}</span>
              <span><i className="sw ghost" /> {t("legGhost")}</span>
              <span><i className="sw warm" /> {t("legTemp")}</span>
              <span><i className="sw dash" /> {t("feelsLike")}</span>
              <span><i className="sw grad" /> {t("legAgree")}</span>
            </div>
          </div>
        </section>
      )}

      <Radar place={place} theme={theme} />

      {/* ── pens ── */}
      <section className="pens">
        <div className="sec-head"><h2>{t("pensTitle")}</h2><span className="sub">{t("pensSub")}</span></div>
        <div className="pen-row">
          {MODELS.map((m) => {
            const on = active.includes(m.id);
            const win = m.id === leader;
            return (
              <button key={m.id} onClick={() => toggle(m.id)} aria-pressed={on} className={`pen ${on ? "on" : ""}`}
                style={on ? { borderColor: m.ink, color: m.ink, background: m.ink + "1A" } : undefined}>
                <span className="nib" style={{ background: on ? m.ink : "transparent", borderColor: on ? m.ink : "var(--faint2)" }} />
                {m.short}
                {win && <span className="pen-star" title={t("skillTag")}><Star /></span>}
              </button>
            );
          })}
        </div>
        {skill && (
          <div className={`skill ${leader ? "" : "thin"}`}>
            {leader ? (
              <>
                <span className="sk-star" style={{ color: M[leader].ink }}><Star /></span>
                <span>
                  <Rich text={t("skillLead", { model: M[leader].short, days: skill.days, wet: skill.wetDays })} />
                  <em className="sk-caveat">{t("skillCaveat")}</em>
                </span>
              </>
            ) : (
              <span>{t("skillThin", { days: skill.days })}</span>
            )}
          </div>
        )}
      </section>

      {/* ── chart ── */}
      <section className="graph">
        <div className="gbar">
          <div className="vars">
            {Object.entries(VAR_KEYS).map(([k, key]) => (
              <button key={k} className={`vtab ${variable === k ? "on" : ""}`} onClick={() => setVariable(k)}>{t(key)}</button>
            ))}
          </div>
          {variable === "temperature_2m" && <UnitToggle value={unitT} onChange={setUnitT} size="lg" />}
        </div>

        <div className="panel" ref={panelRef}>
          {!active.length && <div className="veil">{t("pensEmpty")}</div>}

          <div className="daystrip">
            <div className="bands" dir={dir}>
              {view.map((d) => (
                <button key={d.i} className={`band ${scope === "day" && daySel === d.i ? "on" : ""}`}
                  onClick={() => pickDay(d.i)}>
                  <span className="b-ic">{React.createElement(ICONS[d.icon])}</span>
                  <span className="b-day"><i className="lg">{d.dow}</i><i className="sm">{d.dowS}</i></span>
                  <span className="b-date">{d.date}</span>
                </button>
              ))}
            </div>

            <div className="ds-foot">
              {scope === "day" && sel ? (
                <>
                  <span className="ds-side">
                    <button className="back-week" onClick={showWeek}>
                      <span className="bw-ic"><Chev flip={dir === "rtl"} /></span>
                      {t("scopeWeek")}
                    </button>
                  </span>
                  <span className="dn-day">
                    <span className="dn-ic">{React.createElement(ICONS[sel.icon])}</span>
                    <b>{sel.dow}</b><em>{sel.date}</em>
                  </span>
                  <span className="ds-side" />
                </>
              ) : (
                <span className="ds-hint">{t("dayHint")}</span>
              )}
            </div>
          </div>

          {narrow && <Readout row={hoverIdx != null ? trace[hoverIdx] : null} models={active} dates={dates} pos="top" />}

          <div className="chart-box" dir="ltr" style={{ width: "100%", height: narrow ? 230 : 290 }}>
            <span className="chart-unit" style={{ width: PAD_L }}>{unit}</span>
            <ResponsiveContainer>
              <ComposedChart data={shown} margin={{ top: 6, right: PAD_R, bottom: 4, left: 0 }}>
                <XAxis dataKey="i" type="number" domain={["dataMin", "dataMax"]} reversed={dir === "rtl"}
                  ticks={scope === "week" ? [] : shown.filter((r) => r.hour % 3 === 0).map((r) => r.i)}
                  tickFormatter={(i) => trace[i]?.label || ""} tick={{ fontSize: 12, fill: "var(--muted)" }}
                  axisLine={{ stroke: "var(--line2)" }} tickLine={false} interval={0} height={scope === "week" ? 6 : 24} />
                <YAxis domain={variable === "precipitation" ? [0, maxY] : ["auto", "auto"]} width={PAD_L}
                  tick={{ fontSize: 12, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                {scope === "week" && view.filter((d) => d.i % 2 === 1).map((d) => (
                  <ReferenceArea key={d.i} x1={d.i * 24} x2={d.i * 24 + 23} fill="var(--pure)" fillOpacity={0.028} strokeOpacity={0} />
                ))}
                {scope === "week" && view.slice(1).map((d) => <ReferenceLine key={d.i} x={d.i * 24} stroke="var(--line2)" />)}
                <Tooltip content={<ChartTip unit={unit} trace={trace} dates={dates} narrow={narrow} onHover={setHoverIdx} />}
                  cursor={{ stroke: "var(--dim2)", strokeDasharray: "3 3" }} />
                <Area dataKey="band" stroke="none" fill="var(--ink2)" fillOpacity={0.16} isAnimationActive={false} connectNulls />
                {active.map((m) => {
                  const win = m === leader;
                  return (
                    <Line key={m} dataKey={m} stroke={M[m].ink}
                      strokeWidth={leader ? (win ? 3.2 : 1.6) : 2}
                      strokeOpacity={leader && !win ? 0.7 : 1} dot={false}
                      type={variable === "precipitation" ? "step" : "monotone"}
                      connectNulls animationDuration={800} />
                  );
                })}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {!narrow && <Readout row={hoverIdx != null ? trace[hoverIdx] : null} models={active} dates={dates} />}

          <div className="pkey">
            <span className="pkey-row">
              <span className="kb" />
              <span className="pkey-txt">
                <b>{t("bandKey")}</b>
                <em>{t("bandKeySub")}</em>
              </span>
            </span>
          </div>
        </div>
      </section>

      <Scorecard place={place} models={active} unitT={unitT} />

      {weekTotals.length > 1 && (
        <section className="totals">
          <h2>{t("totalsTitle")}</h2>
          <div className="trows">
            {weekTotals.map((tt) => (
              <div className="tot" key={tt.id}>
                <span className="tname" style={{ color: M[tt.id].ink }}>{M[tt.id].short}</span>
                <span className="tbar"><span style={{ background: M[tt.id].ink, width: `${weekTotals[0].total > 0 ? (tt.total / weekTotals[0].total) * 100 : 0}%` }} /></span>
                <span className="tnum">{fmt(tt.total)} {mm}</span>
              </div>
            ))}
          </div>
          <p className="tnote">
            {weekTotals[0].total - weekTotals[weekTotals.length - 1].total > 8 ? t("totalsSpread") : t("totalsStable")}
          </p>
        </section>
      )}

      <section className="learn">
        <h2>{t("learnTitle")}</h2>
        <div className="lgrid">
          {MODELS.map((m) => {
            const open = openModel === m.id;
            const info = t(`models.${m.id}`) || {};
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
                      <div><dt>{t("fOperator")}</dt><dd>{info.agency}</dd></div>
                      <div><dt>{t("fHome")}</dt><dd>{info.home}</dd></div>
                      <div><dt>{t("fGrid")}</dt><dd>{info.grid}</dd></div>
                      <div><dt>{t("fRuns")}</dt><dd>{m.runs}</dd></div>
                    </dl>
                    <p>{info.note}</p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
        <div className="primer">
          <h3>{t("primerTitle")}</h3>
          <p><Rich text={t("primer1")} /></p>
          <p><Rich text={t("primer2")} /></p>
          <p><Rich text={t("primer3")} /></p>
        </div>
      </section>

      <footer className="foot">
        <p className="foot-data">{t("foot")}</p>
        <p className="foot-credit">
          <span className="foot-name">{SITE_NAME}</span>
          <span className="foot-dot">·</span>
          <span>{t("credit")}</span>
        </p>
      </footer>
    </div>
  );
}

/* ═══════════════════════ background skill ═══════════════════════ */

const SKILL_LEAD = 3, SKILL_PAST = 90, MIN_WET = 8;

/** רץ פעם ביום לכל מיקום, ברקע, ונשמר מקומית. אף פעם לא חוסם את התחזית. */
function useSkill(place, t) {
  const [skill, setSkill] = useState(null);
  const key = `wx-skill:${place.lat.toFixed(2)},${place.lon.toFixed(2)}:${isoDate(new Date())}`;

  useEffect(() => {
    let dead = false;
    setSkill(null);

    try {
      const c = JSON.parse(localStorage.getItem(key));
      if (c && typeof c.wetDays === "number") { setSkill(c); return; }
    } catch { /* private mode */ }

    const timer = setTimeout(async () => {
      try {
        const res = await computeSkill({
          lat: place.lat, lon: place.lon, models: MODELS.map((m) => m.id),
          lead: SKILL_LEAD, past: SKILL_PAST,
          msg: { noTruth: "", noSeries: "", noScores: "", noScoresWhy: () => "" },
        });
        const slim = {
          order: res.rows.map((r) => ({ id: r.id, mae: r.rain.mae })),
          days: res.days, wetDays: res.wetDays,
        };
        if (dead) return;
        setSkill(slim);
        try { localStorage.setItem(key, JSON.stringify(slim)); } catch { /* private */ }
      } catch { /* לא קריטי — פשוט לא תהיה הבלטה */ }
    }, 2500);

    return () => { dead = true; clearTimeout(timer); };
  }, [key, place.lat, place.lon]);

  return skill;
}

const Chev = ({ flip }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
    strokeLinecap="round" strokeLinejoin="round"
    style={flip ? { transform: "scaleX(-1)" } : undefined}>
    <path d="M15 5 L8 12 L15 19" />
  </svg>
);

const Star = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4 6.2 20.5l1.1-6.5L2.6 9.4l6.5-.9z" />
  </svg>
);

/* ═══════════════════════ radar ═══════════════════════ */

/* לולאה אזורית קבועה, לא מפה שמנווטים בה — אז מחשבים את אריחי
   ה-Web Mercator ישירות ומוותרים על ספריית מפות שלמה. */
/* מפתח CARTO — חינמי, עד 5M אריחים בחודש. הוא גלוי בקוד לקוח מטבע הדברים.
   להחלפה: carto.com/basemaps/apikey */
const CARTO_KEY = "cb1_2zwn_1_5d15dc4bdc6b8dc82110188f";

const RADAR_Z = 6, TILE = 256;
/* אריח PNG שקוף לחלוטין. מעליו יש כבר החזרים כלשהם, כלומר כיסוי מכ״ם */
const EMPTY_TILE = 400;
const lonToTile = (lon, z) => ((lon + 180) / 360) * 2 ** z;
const latToTile = (lat, z) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
};
const wrapX = (x, z) => ((x % 2 ** z) + 2 ** z) % 2 ** z;

function TileGrid({ url, cols, rows, x0, y0, left, top, opacity, cls }) {
  const out = [];
  for (let dy = 0; dy < rows; dy++) {
    for (let dx = 0; dx < cols; dx++) {
      const x = wrapX(x0 + dx, RADAR_Z), y = y0 + dy;
      if (y < 0 || y >= 2 ** RADAR_Z) continue;
      out.push(
        <img key={`${dx}-${dy}`} src={url(x, y)} alt="" loading="eager" draggable={false}
          /* אריח מכ״ם ללא כיסוי מחזיר 404 — מסתירים במקום להציג תמונה שבורה */
          onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
          onLoad={(e) => { e.currentTarget.style.visibility = "visible"; }}
          style={{
            position: "absolute", width: TILE + 1, height: TILE + 1,
            left: Math.round(left + dx * TILE), top: Math.round(top + dy * TILE),
          }} />
      );
    }
  }
  return <div className={cls} style={{ position: "absolute", inset: 0, opacity }}>{out}</div>;
}

/* ערים לפאנל "יורד עכשיו" — פרושות על קווי רוחב ואורך כדי שתמיד
   יהיה מקום רטוב אי-שם. שם, קוד מדינה, קו רוחב, קו אורך. */
const WORLD = [
  ["Reykjavik","Iceland",64.15,-21.94], ["Torshavn","Faroe Islands",62.01,-6.77], ["Bergen","Norway",60.39,5.32],
  ["Oslo","Norway",59.91,10.75], ["Stockholm","Sweden",59.33,18.07], ["Helsinki","Finland",60.17,24.94],
  ["Tallinn","Estonia",59.44,24.75], ["Riga","Latvia",56.95,24.11], ["Vilnius","Lithuania",54.69,25.28],
  ["Copenhagen","Denmark",55.68,12.57], ["Dublin","Ireland",53.35,-6.26], ["Glasgow","United Kingdom",55.86,-4.25],
  ["Manchester","United Kingdom",53.48,-2.24], ["London","United Kingdom",51.51,-0.13], ["Amsterdam","Netherlands",52.37,4.9],
  ["Brussels","Belgium",50.85,4.35], ["Hamburg","Germany",53.55,9.99], ["Berlin","Germany",52.52,13.4],
  ["Munich","Germany",48.14,11.58], ["Zurich","Switzerland",47.37,8.54], ["Vienna","Austria",48.21,16.37],
  ["Prague","Czechia",50.08,14.44], ["Warsaw","Poland",52.23,21.01], ["Budapest","Hungary",47.5,19.04],
  ["Bucharest","Romania",44.43,26.1], ["Kyiv","Ukraine",50.45,30.52], ["Minsk","Belarus",53.9,27.57],
  ["Moscow","Russia",55.76,37.62], ["St Petersburg","Russia",59.93,30.34], ["Kazan","Russia",55.79,49.11],
  ["Novosibirsk","Russia",55.03,82.92], ["Vladivostok","Russia",43.12,131.89], ["Paris","France",48.86,2.35],
  ["Lyon","France",45.76,4.84], ["Milan","Italy",45.46,9.19], ["Rome","Italy",41.9,12.5],
  ["Naples","Italy",40.85,14.27], ["Barcelona","Spain",41.39,2.17], ["Madrid","Spain",40.42,-3.7],
  ["Lisbon","Portugal",38.72,-9.14], ["Porto","Portugal",41.15,-8.61], ["Athens","Greece",37.98,23.73],
  ["Istanbul","Türkiye",41.01,28.98], ["Ankara","Türkiye",39.93,32.86], ["Tbilisi","Georgia",41.72,44.79],
  ["Baku","Azerbaijan",40.41,49.87], ["Tehran","Iran",35.69,51.39], ["Dubai","United Arab Emirates",25.2,55.27],
  ["Karachi","Pakistan",24.86,67.0], ["Lahore","Pakistan",31.55,74.34], ["Delhi","India",28.61,77.21],
  ["Mumbai","India",19.08,72.88], ["Kolkata","India",22.57,88.36], ["Chennai","India",13.08,80.27],
  ["Bengaluru","India",12.97,77.59], ["Kathmandu","Nepal",27.72,85.32], ["Dhaka","Bangladesh",23.81,90.41],
  ["Colombo","Sri Lanka",6.93,79.86], ["Yangon","Myanmar",16.87,96.2], ["Bangkok","Thailand",13.76,100.5],
  ["Hanoi","Vietnam",21.03,105.85], ["Ho Chi Minh City","Vietnam",10.82,106.63], ["Phnom Penh","Cambodia",11.56,104.92],
  ["Kuala Lumpur","Malaysia",3.14,101.69], ["Singapore","Singapore",1.35,103.82], ["Jakarta","Indonesia",-6.21,106.85],
  ["Bali","Indonesia",-8.65,115.22], ["Manila","Philippines",14.6,120.98], ["Hong Kong","Hong Kong",22.32,114.17],
  ["Taipei","Taiwan",25.03,121.57], ["Guangzhou","China",23.13,113.26], ["Shanghai","China",31.23,121.47],
  ["Chengdu","China",30.57,104.07], ["Beijing","China",39.9,116.41], ["Seoul","South Korea",37.57,126.98],
  ["Tokyo","Japan",35.68,139.69], ["Osaka","Japan",34.69,135.5], ["Sapporo","Japan",43.06,141.35],
  ["Sydney","Australia",-33.87,151.21], ["Melbourne","Australia",-37.81,144.96], ["Brisbane","Australia",-27.47,153.03],
  ["Perth","Australia",-31.95,115.86], ["Darwin","Australia",-12.46,130.84], ["Auckland","New Zealand",-36.85,174.76],
  ["Wellington","New Zealand",-41.29,174.78], ["Suva","Fiji",-18.14,178.44], ["Nairobi","Kenya",-1.29,36.82],
  ["Kampala","Uganda",0.35,32.58], ["Addis Ababa","Ethiopia",9.03,38.74], ["Dar es Salaam","Tanzania",-6.79,39.21],
  ["Kinshasa","DR Congo",-4.44,15.27], ["Lagos","Nigeria",6.52,3.38], ["Abuja","Nigeria",9.06,7.49],
  ["Accra","Ghana",5.6,-0.19], ["Abidjan","Côte d'Ivoire",5.36,-4.01], ["Dakar","Senegal",14.72,-17.47],
  ["Douala","Cameroon",4.05,9.77], ["Libreville","Gabon",0.42,9.47], ["Antananarivo","Madagascar",-18.88,47.51],
  ["Cape Town","South Africa",-33.92,18.42], ["Johannesburg","South Africa",-26.2,28.05], ["Maputo","Mozambique",-25.97,32.57],
  ["Cairo","Egypt",30.04,31.24], ["Casablanca","Morocco",33.57,-7.59], ["Anchorage","United States",61.22,-149.9],
  ["Vancouver","Canada",49.28,-123.12], ["Calgary","Canada",51.05,-114.07], ["Winnipeg","Canada",49.9,-97.14],
  ["Toronto","Canada",43.65,-79.38], ["Montreal","Canada",45.5,-73.57], ["Halifax","Canada",44.65,-63.58],
  ["Seattle","United States",47.61,-122.33], ["Portland","United States",45.52,-122.68], ["San Francisco","United States",37.77,-122.42],
  ["Los Angeles","United States",34.05,-118.24], ["Denver","United States",39.74,-104.98], ["Chicago","United States",41.88,-87.63],
  ["Houston","United States",29.76,-95.37], ["New Orleans","United States",29.95,-90.07], ["Atlanta","United States",33.75,-84.39],
  ["Miami","United States",25.76,-80.19], ["New York","United States",40.71,-74.01], ["Boston","United States",42.36,-71.06],
  ["Mexico City","Mexico",19.43,-99.13], ["Guatemala City","Guatemala",14.63,-90.51], ["San Jose","Costa Rica",9.93,-84.08],
  ["Panama City","Panama",8.98,-79.52], ["Havana","Cuba",23.11,-82.37], ["San Juan","Puerto Rico",18.47,-66.11],
  ["Bogota","Colombia",4.71,-74.07], ["Medellin","Colombia",6.24,-75.57], ["Caracas","Venezuela",10.49,-66.88],
  ["Quito","Ecuador",-0.18,-78.47], ["Lima","Peru",-12.05,-77.04], ["La Paz","Bolivia",-16.5,-68.15],
  ["Manaus","Brazil",-3.12,-60.02], ["Belem","Brazil",-1.46,-48.5], ["Brasilia","Brazil",-15.79,-47.88],
  ["Sao Paulo","Brazil",-23.55,-46.63], ["Rio de Janeiro","Brazil",-22.91,-43.17], ["Montevideo","Uruguay",-34.9,-56.16],
  ["Buenos Aires","Argentina",-34.6,-58.38], ["Santiago","Chile",-33.45,-70.67], ["Ushuaia","Argentina",-54.8,-68.3],
];

/* קודי WMO של משקעים בפועל — טפטוף, גשם, ממטרים, שלג וסופות */
const WET_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67,
  71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99]);

/* 60 ולא 100: בשיעור פגיעה של ~17% זה עדיין כ-10 ערים רטובות, הרבה
   מעבר לחמש שמוצגות, אבל בקשה קלה בהרבה על המכסה */
const WET_SAMPLE = 60, WET_TTL = 10 * 60 * 1000, WET_KEY = "wx-wet";

/** משאיר רק ערים שהאריח שלהן ב-RainViewer אינו ריק, כלומר יש שם מכ״ם.
 *  נכשל בשקט אל תוך הרשימה המקורית — עדיף להציג ערים מאשר פאנל ריק. */
async function withRadar(cities) {
  try {
    const meta = await (await fetch("https://api.rainviewer.com/public/weather-maps.json")).json();
    const host = meta.host || "https://tilecache.rainviewer.com";
    const frame = (meta.radar?.past || []).slice(-1)[0];
    if (!frame) return cities;
    const hits = await Promise.all(cities.map(async (c) => {
      try {
        const x = wrapX(Math.floor(lonToTile(c.lon, RADAR_Z)), RADAR_Z);
        const y = Math.floor(latToTile(c.lat, RADAR_Z));
        const r = await fetch(`${host}${frame.path}/${TILE}/${RADAR_Z}/${x}/${y}/2/1_1.png`);
        return (await r.blob()).size > EMPTY_TILE;
      } catch { return true; }
    }));
    const kept = cities.filter((_, i) => hits[i]);
    return kept.length ? kept : cities;
  } catch { return cities; }
}

const shuffled = (a) => {
  const s = [...a];
  for (let i = s.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [s[i], s[j]] = [s[j], s[i]];
  }
  return s;
};

/** איפה יורד גשם או שלג ברגע זה. דגימה אקראית של ערים בבקשה מרובת
 *  קואורדינטות אחת, סינון לפי קוד WMO, וחמש מתוך הפגיעות. */
function WetNow({ onPick, unitT }) {
  const { t } = useI18n();
  const [rows, setRows] = useState(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let dead = false;

    /* קאש קצר: מה שיורד בעולם לא משתנה בין רענון לרענון, ובלעדיו כל
       טעינה מחדש שילמה עוד בקשה מהמכסה — וגזלה אותה מהתחזית של
       המשתמש עצמו. רענון ידני עוקף אותו. */
    if (!nonce) {
      try {
        const c = JSON.parse(localStorage.getItem(WET_KEY));
        if (c && Date.now() - c.at < WET_TTL && c.rows?.length) { setRows(c.rows); return; }
      } catch { /* private mode */ }
    }

    setRows(null);
    /* התחזית של המשתמש נשלחת ראשונה ומקבלת את המכסה; הפאנל הזה משני */
    const timer = setTimeout(async () => {
      try {
        const pick = shuffled(WORLD).slice(0, WET_SAMPLE);
        const lats = pick.map((c) => c[2]).join(",");
        const lons = pick.map((c) => c[3]).join(",");
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}` +
          "&current=weather_code,temperature_2m,is_day&forecast_days=1");
        if (!r.ok) throw new Error(`${r.status}`);
        const j = await r.json();
        if (dead) return;
        const arr = Array.isArray(j) ? j : [j];
        const wet = [];
        pick.forEach((c, i) => {
          const cur = arr[i]?.current;
          if (cur && WET_CODES.has(cur.weather_code)) {
            wet.push({ name: c[0], cc: c[1], lat: c[2], lon: c[3],
              code: cur.weather_code, temp: cur.temperature_2m, day: cur.is_day });
          }
        });
        /* מסננים ערים שאין עליהן כיסוי מכ״ם, כדי שלחיצה על עיר מהפאנל
           לא תוביל למפה ריקה. כאן די בפריים אחד — בניגוד לבדיקה שבמכ״ם
           עצמו — כי אלה ערים שיורד בהן גשם ברגע זה, ולכן אם יש כיסוי הוא
           חייב להראות משהו. אריח ריק כאן פירושו היעדר מכ״ם, לא היעדר גשם. */
        const covered = await withRadar(shuffled(wet).slice(0, 14));
        const five = covered.slice(0, 6);
        if (dead) return;
        setRows(five);
        try { localStorage.setItem(WET_KEY, JSON.stringify({ at: Date.now(), rows: five })); }
        catch { /* private mode */ }
      } catch { if (!dead) setRows([]); }
    }, 1500);

    return () => { dead = true; clearTimeout(timer); };
  }, [nonce]);

  if (rows && !rows.length) return null;

  return (
    <section className="wet">
      <div className="wet-head">
        <h2>{t("wetTitle")}</h2>
        <span className="sub">{t("wetSub")}</span>
        <button className="wet-again" onClick={() => setNonce((n) => n + 1)}
          disabled={!rows} title={t("wetRefresh")} aria-label={t("wetRefresh")}>
          <Refresh />
        </button>
      </div>
      <div className="wet-row">
        {!rows && <span className="wet-load">{t("loading")}</span>}
        {rows?.map((r) => {
          const ic = nightIcon(wmoIcon(r.code), r.day);
          const Ic = ICONS[ic];
          return (
            <button key={`${r.name}-${r.lat}`} className="wet-chip"
              title={t(`cond.${ic.replace("-night", "")}`)}
              onClick={() => onPick({ name: r.name, region: r.cc, lat: r.lat, lon: r.lon })}>
              <span className="wet-ic"><Ic /></span>
              <span className="wet-txt">
                <span className="wet-n">{r.name}</span>
                {/* האייקון כבר נושא את סוג המשקעים, אז השורה השנייה עונה
                    על "איפה" — שם המדינה עוזר בערים פחות מוכרות */}
                <span className="wet-c">{r.cc}</span>
              </span>
              <span className="wet-t">{fmt(toT(r.temp, unitT), 0)}°</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

const Refresh = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v6h-6" />
  </svg>
);

function Radar({ place, theme }) {
  const { t, dir, locale } = useI18n();
  const [frames, setFrames] = useState(null);
  const [host, setHost] = useState("");
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [visible, setVisible] = useState(false);
  const [bare, setBare] = useState(false);
  const [box, setBox] = useState({ w: 0, h: 300 });
  const wrapRef = useRef(null);

  /* רשימת הפריימים — ה-API עצמו אומר מה זמין, אז לא מניחים */
  const loadFrames = useCallback(async () => {
    try {
      const r = await fetch("https://api.rainviewer.com/public/weather-maps.json");
      const j = await r.json();
      const past = j?.radar?.past || [];
      const soon = j?.radar?.nowcast || [];
      /* כל פריים = כ-12 אריחים. מגבילים את הסדרה כדי לא להעמיס
         על השרת שלהם ועל הגלישה של המשתמש. */
      const trimmed = past.slice(-8);
      const all = [...trimmed, ...soon.slice(0, 3)].filter((f) => f && f.path);
      setHost(j.host || "https://tilecache.rainviewer.com");
      setFrames(all);
      setI(Math.max(0, trimmed.length - 1));
    } catch { setFrames([]); }
  }, []);

  useEffect(() => {
    loadFrames();
    const timer = setInterval(loadFrames, 10 * 60 * 1000);
    return () => clearInterval(timer);
  }, [loadFrames]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!playing || !visible || !frames?.length) return;
    const timer = setInterval(() => setI((n) => (n + 1) % frames.length), 700);
    return () => clearInterval(timer);
  }, [playing, visible, frames]);

  /* לא מנפישים פאנל שלא רואים */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const grid = useMemo(() => {
    if (!box.w) return null;
    const fx = lonToTile(place.lon, RADAR_Z), fy = latToTile(place.lat, RADAR_Z);
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const cols = Math.ceil(box.w / TILE) + 2, rows = Math.ceil(box.h / TILE) + 2;
    const cx = Math.floor(cols / 2), cy = Math.floor(rows / 2);
    return {
      cols, rows,
      x0: x0 - cx, y0: y0 - cy,
      left: box.w / 2 - (fx - x0) * TILE - cx * TILE,
      top: box.h / 2 - (fy - y0) * TILE - cy * TILE,
    };
  }, [box, place.lat, place.lon]);

  const frame = frames?.[i];
  const stamp = frame ? new Date(frame.time * 1000) : null;
  const nowIdx = useMemo(() => {
    if (!frames?.length) return 0;
    const t0 = Date.now() / 1000;
    let best = 0;
    frames.forEach((f, k) => { if (f.time <= t0) best = k; });
    return best;
  }, [frames]);

  /* אריח ריק לגמרי מ-RainViewer שוקל בדיוק 334 בייט, ולכן הגודל מבדיל
     בין "יש מכ״ם" ל"אין מכ״ם" — RainViewer לא חושף מפת כיסוי בשום צורה
     אחרת. אבל חובה לדגום את כל הלולאה ולא פריים בודד: נמדד שאתונה
     וליסבון מחזירות נתונים ב-1 מתוך 13 פריימים בלבד, כלומר בדיקת פריים
     אחד הייתה מכריזה עליהן "ללא כיסוי" ברוב הזמן. מוסקבה, ניירובי,
     מנילה ואושוואיה הן 0 מתוך 13 — שם באמת אין מכ״ם. */
  useEffect(() => {
    if (!host || !frames?.length) return;
    let dead = false;
    (async () => {
      const x = wrapX(Math.floor(lonToTile(place.lon, RADAR_Z)), RADAR_Z);
      const y = Math.floor(latToTile(place.lat, RADAR_Z));
      const sizes = await Promise.all(frames.map(async (f) => {
        try {
          const r = await fetch(`${host}${f.path}/${TILE}/${RADAR_Z}/${x}/${y}/2/1_1.png`);
          return (await r.blob()).size;
        } catch { return -1; }
      }));
      if (dead) return;
      const seen = sizes.filter((n) => n >= 0);
      setBare(seen.length > 0 && seen.every((n) => n <= EMPTY_TILE));
    })();
    return () => { dead = true; };
  }, [host, frames, place.lat, place.lon]);

  return (
    <section className="radar">
      <div className="sec-head">
        <h2>{t("radarTitle")}</h2>
        <span className="sub">{t("radarSub")}</span>
      </div>
      <p className="radar-lead"><Rich text={t("radarLead")} /></p>

      <div className="radar-panel">
        <div className="radar-map" ref={wrapRef} dir="ltr">
          {grid && (
            <>
              {/* Dark Matter הפוך מהאינטואיציה — ים בהיר מיבשה — ולכן צריך שם
                  את הטריק של sepia. ב-light_all היחס כבר נכון (ים 212 מול
                  יבשה 250) ורק צריך להעצים את הכחול שכבר קיים במים. */}
              <TileGrid cls={`rd-base ${theme === "light" ? "lite" : ""}`} {...grid} opacity={1}
                url={(x, y) => `https://basemaps.cartocdn.com/${theme === "light" ? "light_all" : "dark_all"}/${RADAR_Z}/${x}/${y}.png?key=${CARTO_KEY}`} />
              {/* כל פריים נטען פעם אחת ומוחלף בשקיפות. החלפת src בכל צעד
                  הייתה מושכת את כל האריחים מחדש — ומכאן ה-429. */}
              {host && visible && frames?.map((f, k) => (
                <TileGrid key={f.time} cls="rd-fall" {...grid} opacity={k === i ? 1 : 0}
                  url={(x, y) => `${host}${f.path}/${TILE}/${RADAR_Z}/${x}/${y}/2/1_1.png`} />
              ))}
            </>
          )}
          <span className="rd-pin" />
          {!frames && <div className="rd-veil">{t("radarLoading")}</div>}
          {frames && !frames.length && <div className="rd-veil">{t("radarNone")}</div>}
          {/* מפת הבסיס נשארת גלויה — היא עדיין אומרת איפה אנחנו */}
          {!!frames?.length && bare && <div className="rd-nocov">{t("radarNone")}</div>}
        </div>

        {!!frames?.length && (
          <div className="radar-ctl">
            <button className="rd-play" onClick={() => setPlaying(!playing)}
              aria-label={playing ? t("radarPause") : t("radarPlay")}>
              {playing
                ? <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="4" height="14" rx="1.4" /><rect x="13.5" y="5" width="4" height="14" rx="1.4" /></svg>
                : <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.2 19 12 8 18.8Z" /></svg>}
            </button>

            <input className="rd-slider" type="range" min={0} max={frames.length - 1} value={i}
              onChange={(e) => { setPlaying(false); setI(Number(e.target.value)); }}
              dir={dir} aria-label={t("radarTitle")} />

            <span className={`rd-time ${i > nowIdx ? "soon" : ""}`}>
              {stamp ? new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(stamp) : "--:--"}
              {i > nowIdx && <em>{t("radarSoon")}</em>}
              {i === nowIdx && <em>{t("radarNow")}</em>}
            </span>
          </div>
        )}

        <div className="radar-credit">
          <a href="https://www.rainviewer.com/" target="_blank" rel="noopener noreferrer">{t("radarCredit")}</a>
          <span>© CARTO · © OpenStreetMap</span>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════ conditions ═══════════════════════ */

const DIR_KEYS = ["dirN", "dirNE", "dirE", "dirSE", "dirS", "dirSW", "dirW", "dirNW"];
const dirKey = (deg) => DIR_KEYS[Math.round(((deg % 360) + 360) % 360 / 45) % 8];

function uvKey(v) {
  if (v < 3) return "uvLow";
  if (v < 6) return "uvMod";
  if (v < 8) return "uvHigh";
  if (v < 11) return "uvVHigh";
  return "uvExtreme";
}
const UV_COLOR = { uvLow: "#6FD99A", uvMod: "#F0D45E", uvHigh: "#F5A24B", uvVHigh: "#F27878", uvExtreme: "#C58BF0" };

/** חץ שמצביע לאן הרוח הולכת */
const Arrow = ({ deg }) => (
  <svg viewBox="0 0 24 24" style={{ transform: `rotate(${deg + 180}deg)` }}>
    <path d="M12 3.5 L12 20.5 M12 3.5 L7.5 9 M12 3.5 L16.5 9"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function Tile({ label, value, unit, note, color, children }) {
  return (
    <div className="tile">
      <span className="ti-lab">{label}</span>
      <span className="ti-val" style={color ? { color } : undefined}>
        {children}{value}{unit && <em>{unit}</em>}
      </span>
      {note && <span className="ti-note">{note}</span>}
    </div>
  );
}

function Conditions({ day, unitT, elevation }) {
  const { t } = useI18n();
  if (!day) return null;
  const deg = unitT === "f" ? "°F" : "°C";
  const hasWave = typeof day.wave === "number";
  const tiles = [];

  /* "מרגיש כמו" כבר מופיע בשורת הטמפרטורות מעל, אז כשיש גלים
     הוא מפנה את מקומו — שש קוביות בדיוק, בלי שורה יתומה */
  if (typeof day.feels === "number" && !hasWave)
    tiles.push(<Tile key="f" label={t("feelsLike")} value={fmt(day.feels, 0)} unit={deg} />);

  if (typeof day.gust === "number")
    tiles.push(<Tile key="g" label={t("gusts")} value={fmt(day.gust, 0)} unit={t("unitKmh")}
      color={day.gust >= 60 ? "#F5A24B" : undefined} />);

  if (typeof day.windDir === "number")
    tiles.push(
      <Tile key="d" label={t("windDir")} value="" note={t(dirKey(day.windDir))}>
        <span className="ti-arrow"><Arrow deg={day.windDir} /></span>
      </Tile>
    );

  if (typeof day.rh === "number")
    tiles.push(<Tile key="h" label={t("humidity")} value={day.rh} unit={t("unitPct")} />);

  if (typeof day.pressure === "number") {
    const tr = day.pTrend;
    const word = tr == null ? null : tr <= -1.5 ? t("pFalling") : tr >= 1.5 ? t("pRising") : t("pSteady");
    tiles.push(<Tile key="p" label={t("pressure")} value={day.pressure} unit={t("unitHpa")}
      note={word && (tr <= -1.5 ? `↓ ${word}` : tr >= 1.5 ? `↑ ${word}` : `→ ${word}`)}
      color={tr != null && tr <= -6 ? "#F5A24B" : undefined} />);
  }

  if (typeof day.uv === "number") {
    const k = uvKey(day.uv);
    tiles.push(<Tile key="u" label={t("uv")} value={fmt(day.uv, 0)} note={t(k)} color={UV_COLOR[k]} />);
  }

  if (hasWave)
    tiles.push(<Tile key="w" label={t("waves")} value={fmt(day.wave, 1)} unit={t("unitM")}
      color={day.wave >= 2 ? "#F5A24B" : undefined} />);

  if (!tiles.length) return null;
  return (
    <div className="cond-wrap">
      <div className="cond-head">
        <span className="cond-title">{t("condTitle")}</span>
        {typeof elevation === "number" && (
          <span className="cond-elev">{t("elevNote", { v: Math.round(elevation) })}</span>
        )}
      </div>
      <div className="tiles">{tiles}</div>
    </div>
  );
}

function Observations({ day }) {
  const { t } = useI18n();
  if (!day) return null;
  const out = [];
  if (typeof day.gust === "number" && day.gust >= 60) out.push(t("obsGust", { v: fmt(day.gust, 0) }));
  if (typeof day.feelsMaxC === "number" && day.feelsMaxC >= 38) out.push(t("obsHeat", { v: fmt(toT(day.feelsMaxC, "c"), 0) }));
  if (typeof day.feelsMinC === "number" && day.feelsMinC <= 0) out.push(t("obsCold", { v: fmt(day.feelsMinC, 0) }));
  if (typeof day.uv === "number" && day.uv >= 8) out.push(t("obsUv", { v: fmt(day.uv, 0) }));
  if (typeof day.wave === "number" && day.wave >= 2) out.push(t("obsWave", { v: fmt(day.wave, 1) }));
  if (typeof day.pTrend === "number" && day.pTrend <= -6) out.push(t("obsPressure", { v: fmt(Math.abs(day.pTrend), 0) }));
  if (!out.length) return null;
  return (
    <div className="obs">
      <span className="obs-title">{t("obsTitle")}</span>
      {out.map((o, k) => <div className="obs-row" key={k}>{o}</div>)}
    </div>
  );
}

/* ═══════════════════════ readouts ═══════════════════════ */

function ChartTip({ active, payload, label, unit, trace, dates, narrow, onHover }) {
  const live = !!(active && payload && payload.length);
  useEffect(() => { onHover(live ? label : null); }, [live, label, onHover]);
  if (narrow || !live) return null;
  const row = trace[label];
  const lines = payload.filter((p) => p.dataKey !== "band" && typeof p.value === "number").sort((a, b) => b.value - a.value);
  if (!lines.length) return null;
  const d = row ? new Date(row.iso) : null;
  return (
    <div className="tip">
      <div className="tip-h">{d ? `${dates.weekday(d)} · ${String(d.getHours()).padStart(2, "0")}:00` : ""}</div>
      {lines.map((p) => (
        <div className="tip-r" key={p.dataKey}>
          <span className="tip-nib" style={{ background: p.stroke }} />
          <span className="tip-n">{M[p.dataKey]?.short}</span>
          <span className="tip-v">{p.value.toFixed(1)} <em>{unit}</em></span>
        </div>
      ))}
    </div>
  );
}

function Readout({ row, models, dates, pos }) {
  const { t } = useI18n();
  const cls = `readout${pos === "top" ? " top" : ""}`;
  if (!row) return <div className={`${cls} empty`}>{t("chartHint")}</div>;
  const d = new Date(row.iso);
  const vals = models.map((m) => ({ id: m, v: row[m] }))
    .filter((p) => typeof p.v === "number").sort((a, b) => b.v - a.v);
  return (
    <div className={cls}>
      <span className="ro-time">
        <b>{String(d.getHours()).padStart(2, "0")}:00</b>
        <em>{dates.weekday(d)}</em>
      </span>
      <div className="ro-chips">
        {vals.map((p) => (
          <span className="ro-chip" key={p.id} style={{ borderColor: M[p.id].ink + "55" }}>
            <i style={{ background: M[p.id].ink }} />
            <b style={{ color: M[p.id].ink }}>{M[p.id].short}</b>
            <em>{p.v.toFixed(1)}</em>
          </span>
        ))}
      </div>
    </div>
  );
}

function TempDot({ cx, cy, payload }) {
  if (cx == null || cy == null || typeof payload?.temp !== "number") return null;
  /* שתי בועות נפרדות היו מתנגשות כשהערכים קרובים — שניהם באותה בועה */
  const feels = typeof payload.feels === "number"
    && Math.round(payload.feels) !== Math.round(payload.temp)
    ? Math.round(payload.feels) : null;
  const w = feels != null ? 74 : 42;
  const h = feels != null ? 36 : 22;
  const gap = 11;
  const above = cy > h + gap + 6;
  const y = above ? cy - gap - h : cy + gap;
  const ty = above ? cy - gap : cy + gap;
  const ink = "var(--night)";
  return (
    <g style={{ pointerEvents: "none" }}>
      <circle cx={cx} cy={cy} r={5.5} fill="#F5A24B" stroke={ink} strokeWidth={2.5} />
      <path d={above ? `M${cx - 5} ${ty} L${cx} ${ty + 5} L${cx + 5} ${ty} Z`
        : `M${cx - 5} ${ty} L${cx} ${ty - 5} L${cx + 5} ${ty} Z`} fill="#F5A24B" />
      <rect x={cx - w / 2} y={y} width={w} height={h} rx={9} fill="#F5A24B" />

      {feels == null ? (
        <text x={cx} y={y + h / 2} textAnchor="middle" dominantBaseline="central"
          fontSize="13.5" fontWeight="700" fill={ink}>{Math.round(payload.temp)}°</text>
      ) : (
        <>
          {/* דגימות קו זהות לגרף — רציף לטמפרטורה, מקווקו ל"מרגיש כמו" */}
          <line x1={cx - w / 2 + 9} y1={y + 12} x2={cx - w / 2 + 24} y2={y + 12}
            stroke={ink} strokeWidth={2.6} strokeLinecap="round" />
          <text x={cx - w / 2 + 30} y={y + 12} textAnchor="start" dominantBaseline="central"
            fontSize="13" fontWeight="700" fill={ink}>{Math.round(payload.temp)}°</text>

          <line x1={cx - w / 2 + 9} y1={y + 25} x2={cx - w / 2 + 24} y2={y + 25}
            stroke={ink} strokeWidth={1.6} strokeDasharray="3.5 2.5" strokeLinecap="round" opacity={0.75} />
          <text x={cx - w / 2 + 30} y={y + 25} textAnchor="start" dominantBaseline="central"
            fontSize="11.5" fontWeight="600" fill={ink} opacity={0.8}>{feels}°</text>
        </>
      )}
    </g>
  );
}

/** "4 מתוך 4" קורא רע — כשכולם או אף אחד מסכימים, אומרים את זה במילים */
function agreeText(t, wet, total) {
  if (!total) return "–";
  if (wet === total) return t("tipAgreeAll");
  if (wet === 0) return t("tipAgreeNone");
  return t("ofTotal", { a: wet, b: total });
}

function HourTip({ active, payload, label, narrow, onHover }) {
  const { t } = useI18n();
  const live = !!(active && payload && payload.length);
  useEffect(() => { onHover(live ? label : null); }, [live, label, onHover]);
  if (narrow || !live) return null;
  const r = payload[0]?.payload;
  if (!r) return null;
  const mm = t("unitMm");
  return (
    <div className="tip">
      <div className="tip-h">{r.label}</div>
      <div className="tip-r"><span className="tip-n">{t("tipMedian")}</span><span className="tip-v">{fmt(r.med)} {mm}</span></div>
      <div className="tip-r"><span className="tip-n">{t("tipWettest")}</span><span className="tip-v">{fmt(r.max)} {mm}</span></div>
      <div className="tip-r"><span className="tip-n">{t("tipAgree")}</span><span className="tip-v">{agreeText(t, r.wet, r.total)}</span></div>
      {typeof r.snow === "number" && r.snow > 0.05 && (
        <div className="tip-r"><span className="tip-n">{t("snow")}</span><span className="tip-v">{fmt(r.snow)} {t("unitCm")}</span></div>
      )}
      {typeof r.temp === "number" && (
        <div className="tip-r"><span className="tip-n">{t("tipTemp")}</span><span className="tip-v">{fmt(r.temp, 0)}°</span></div>
      )}
      {typeof r.feels === "number" && (
        <div className="tip-r"><span className="tip-n">{t("feelsLike")}</span><span className="tip-v">{fmt(r.feels, 0)}°</span></div>
      )}
    </div>
  );
}

function HourReadout({ row, pos }) {
  const { t } = useI18n();
  const cls = `readout${pos === "top" ? " top" : ""}`;
  if (!row) return <div className={`${cls} empty`}>{t("hourHint")}</div>;
  const mm = t("unitMm");
  return (
    <div className={cls}>
      <span className="ro-time"><b>{row.label}</b></span>
      <div className="ro-chips">
        <span className="ro-chip" style={{ borderColor: "#5AB3F055" }}>
          <i style={{ background: "#5AB3F0" }} /><b style={{ color: "#5AB3F0" }}>{t("roMedian")}</b><em>{fmt(row.med)} {mm}</em>
        </span>
        <span className="ro-chip" style={{ borderColor: "var(--ink2)55" }}>
          <i style={{ background: "var(--ink2)", opacity: 0.6 }} /><b style={{ color: "var(--ink2)" }}>{t("roWet")}</b><em>{fmt(row.max)} {mm}</em>
        </span>
        <span className="ro-chip" style={{ borderColor: "var(--muted)44" }}>
          <b style={{ color: "var(--muted)" }}>{t("roAgree")}</b><em>{row.wet}/{row.total}</em>
        </span>
        {typeof row.snow === "number" && row.snow > 0.05 && (
          <span className="ro-chip" style={{ borderColor: "#BFE3FF55" }}>
            <i style={{ background: "#BFE3FF" }} />
            <b style={{ color: "#BFE3FF" }}>{t("snow")}</b><em>{fmt(row.snow)} {t("unitCm")}</em>
          </span>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════ scorecard ═══════════════════════ */

const findSeries = (hourly, base, lead, model) => {
  if (!hourly) return null;
  const v = `${base}_previous_day${lead}`;
  for (const c of [`${v}_${model}`, `${base}_${model}_previous_day${lead}`, v]) {
    if (Array.isArray(hourly[c])) return hourly[c];
  }
  const k = Object.keys(hourly).find((k) => k.startsWith(base) && k.includes(`previous_day${lead}`));
  return k ? hourly[k] : null;
};

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

/** מריץ את כל ההשוואה מול העבר. משמש גם את כרטיס הציונים וגם את החישוב ברקע. */
async function computeSkill({ lat, lon, models, lead, past, msg }) {
  const geo = `latitude=${lat}&longitude=${lon}&timezone=auto`;
  const end = new Date(); end.setDate(end.getDate() - 1);
  const start = new Date(end); start.setDate(start.getDate() - past);

  const tRes = await fetch(`https://historical-forecast-api.open-meteo.com/v1/forecast?${geo}` +
    `&start_date=${isoDate(start)}&end_date=${isoDate(end)}&daily=precipitation_sum,temperature_2m_max`);
  const truth = await tRes.json();
  if (truth.error) throw new Error(truth.reason);

  const oRain = new Map(), oTemp = new Map();
  (truth.daily?.time || []).forEach((d, i) => {
    const r = truth.daily.precipitation_sum?.[i], tp = truth.daily.temperature_2m_max?.[i];
    if (typeof r === "number") oRain.set(d, r);
    if (typeof tp === "number") oTemp.set(d, tp);
  });
  if (!oRain.size) throw new Error(msg.noTruth);

  const rows = await Promise.all(models.map(async (m) => {
    try {
      const r = await fetch(`https://previous-runs-api.open-meteo.com/v1/forecast?${geo}` +
        `&hourly=precipitation_previous_day${lead},temperature_2m_previous_day${lead}` +
        `&models=${m}&past_days=${past}&forecast_days=1`);
      const j = await r.json();
      if (j.error) return { id: m, err: j.reason };
      const pr = findSeries(j.hourly, "precipitation", lead, m);
      const pt = findSeries(j.hourly, "temperature_2m", lead, m);
      if (!pr) return { id: m, err: msg.noSeries };
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
    throw new Error(why ? msg.noScoresWhy(why) : msg.noScores);
  }
  ok.sort((a, b) => a.rain.mae - b.rain.mae);
  return {
    rows: ok, failed: rows.filter((r) => !r.rain),
    days: ok[0].rain.n, wetDays: ok[0].rain.hit + ok[0].rain.miss,
  };
}

function Scorecard({ place, models, unitT }) {
  const { t } = useI18n();
  const [win, setWin] = useState(90);
  const [lead, setLead] = useState(3);
  const [state, setState] = useState({ status: "idle" });

  useEffect(() => { setState({ status: "idle" }); }, [place, lead, win, models]);

  const run = useCallback(async () => {
    if (!models.length) return;
    setState({ status: "loading" });
    try {
      const res = await computeSkill({
        lat: place.lat, lon: place.lon, models, lead, past: Math.min(win, 92),
        msg: {
          noTruth: t("errNoTruth"), noSeries: t("errNoSeries"), noScores: t("errNoScores"),
          noScoresWhy: (why) => t("errNoScoresWhy", { why }),
        },
      });
      setState({ status: "done", ...res });
    } catch (e) { setState({ status: "error", msg: e.message || t("errGeneric") }); }
  }, [place, models, win, lead, t]);

  const s = state;
  const worst = s.rows ? Math.max(...s.rows.map((r) => r.rain.mae), 0.01) : 1;
  const mm = t("unitMm");

  return (
    <section className="score">
      <div className="sec-head"><h2>{t("scoreTitle")}</h2></div>
      <p className="sub wide"><Rich text={t("scoreIntro")} /></p>

      <div className="s-ctl">
        <div className="s-grp">
          <span className="s-lab">{t("scoreLeadLabel")}</span>
          <div className="vars">
            {[1, 2, 3, 5].map((d) => <button key={d} className={`vtab ${lead === d ? "on" : ""}`} onClick={() => setLead(d)}>{d}</button>)}
          </div>
        </div>
        <div className="s-grp">
          <span className="s-lab">{t("scoreWinLabel")}</span>
          <div className="vars">
            {[30, 60, 90].map((d) => <button key={d} className={`vtab ${win === d ? "on" : ""}`} onClick={() => setWin(d)}>{t("scoreDaysOpt", { n: d })}</button>)}
          </div>
        </div>
        <button className="s-run" onClick={run} disabled={s.status === "loading"}>
          {s.status === "loading" ? t("scoreRunning") : t("scoreRun")}
        </button>
      </div>

      {s.status === "idle" && <div className="s-empty">{t("scoreIdle")}</div>}
      {s.status === "error" && <div className="s-err">{s.msg}</div>}

      {s.status === "done" && (
        <>
          <div className="s-lead">
            <Rich text={t("scoreResult", {
              days: s.days, place: place.name, wet: s.wetDays, lead, model: M[s.rows[0].id].short,
            })} />
          </div>

          <div className="s-table">
            <div className="s-hrow">
              <span>{t("thModel")}</span><span>{t("thMae")}</span><span>{t("thMiss")}</span>
              <span>{t("thFa")}</span><span>{t("thTempErr")}</span>
            </div>
            {s.rows.map((r, k) => (
              <div className={`s-row ${k === 0 ? "best" : ""}`} key={r.id}>
                <span className="s-name" style={{ color: M[r.id].ink }}>
                  {M[r.id].short}{k === 0 && <i className="s-crown">{t("bestTag")}</i>}
                </span>
                <span className="s-mae">
                  <i className="s-bar"><em style={{ background: M[r.id].ink, width: `${(r.rain.mae / worst) * 100}%` }} /></i>
                  <b>{fmt(r.rain.mae, 2)} {mm}</b>
                </span>
                <span className="s-n" data-l={t("thMiss")}>{r.rain.miss} {t("daysUnit")}</span>
                <span className="s-n" data-l={t("thFa")}>{r.rain.fa} {t("daysUnit")}</span>
                <span className="s-n" data-l={t("thTempErr")}>{r.temp ? `${fmt(toDT(r.temp.mae, unitT), 1)}${unitT === "f" ? "°F" : "°C"}` : "–"}</span>
              </div>
            ))}
          </div>

          {!!s.failed.length && (
            <div className="s-note">{t("noArchive", {
              list: s.failed.map((f) => `${M[f.id]?.short}${f.err ? ` (${f.err})` : ""}`).join(" · "),
            })}</div>
          )}

          <div className="s-legend">
            <p><Rich text={t("legMae")} /></p>
            <p><Rich text={t("legMiss")} /></p>
            <p><Rich text={t("legFa")} /></p>
            <p className="s-caveat">{t("caveat")}</p>
          </div>
        </>
      )}
    </section>
  );
}

/* ═══════════════════════ styles ═══════════════════════ */

const CSS = `

html,body,#root{margin:0;padding:0;min-height:100%;background:var(--night)}
body{-webkit-font-smoothing:antialiased;overscroll-behavior-y:none}

.wx{
  /* כהה — ברירת המחדל, ולא נגעתי באף ערך קיים */
  --night:#0E1728; --panel:#16223A; --panel2:#1B2942; --rule:#2A3B5A; --rule2:#22314D;
  --text:#E9EEF7; --muted:#8FA1BC; --dim:#B7C4D8;
  --faint:#6E819F; --faint2:#4A5A78; --dim2:#7E93B8; --muted2:#8296B5; --ink2:#9BB6E8;
  --line:#26385A; --line2:#2E4166; --line3:#42598A; --line4:#33486F; --edge:#3A507A;
  --sel:#1C3151; --deep:#141C2B; --deep2:#101A2E; --deep3:#1C2B47; --pure:#FFFFFF;
  --ic-cloud:#8397B7; --ic-cloud2:#64789B; --ic-sun:#F5C451;
  --ic-drop:#57B6EF; --ic-snow:#BFE3FF; --ic-moon:#C9D6EF;
  --shadow:rgba(0,0,0,.5);
  /* .02 ו-.025 קורסים ל-tint-s, ו-.04 ו-.05 ל-tint: ההפרש ביניהם הוא
     פחות מ-1.5/255 בבהירות מעל פאנל כהה, כלומר בלתי נראה */
  --tint:rgba(255,255,255,.04); --tint-s:rgba(255,255,255,.02);
  --veil:rgba(11,20,32,.88);
  /* צבעי המודלים אינם כאן — הם ב-MODELS ונשארים זהים בשתי הערכות */
  --sky:#5AB3F0; --warm:#F5A24B; --mint:#6FD99A; --rose:#F27878;
  position:relative;min-height:100vh;background:var(--night);color:var(--text);
  font-family:'IBM Plex Sans Hebrew','IBM Plex Sans Arabic','IBM Plex Sans',system-ui,sans-serif;
  font-weight:400;line-height:1.6;font-variant-numeric:tabular-nums;overflow:hidden;
  padding:env(safe-area-inset-top) max(18px,env(safe-area-inset-right))
          calc(60px + env(safe-area-inset-bottom)) max(18px,env(safe-area-inset-left));
}

/* בהיר — היפוך התפקידים, לא היפוך המספרים. --text מקבל את גוון הפאנל
   הכהה, ולכן הניגודיות והאופי נשמרים במקום להפוך לשחור-לבן גולמי. */
.wx[data-theme="light"]{
  --night:#F2F6FC; --panel:#FFFFFF; --panel2:#E9F0FA; --rule:#C6D5E9; --rule2:#DCE5F2;
  /* כל גוני הטקסט נמדדו מול הרקע הבהיר ביותר (F2F6FC#) ומכהים עד AA.
     המטרות נבחרו מדורגות ולא אחידות, כדי לשמור על ההיררכיה: 5.4 ,6.1
     ,5.0 ,4.6 ,4.5 במקום לרסק את כולם ל-4.5. */
  --text:#16223A; --muted:#576679; --dim:#3E5170;
  --faint:#5E708C; --faint2:#5E7292; --dim2:#4E5E78; --muted2:#5C6B80; --ink2:#2F5488;
  --line:#D3DFEF; --line2:#C7D5E8; --line3:#B0C3DC; --line4:#BACBE0; --edge:#B7C8DE;
  --sel:#DCE9FB; --deep:#EAF0F8; --deep2:#EEF3FA; --deep3:#E4EBF5; --pure:#16223A;
  --ic-cloud:#8FA3C0; --ic-cloud2:#6C82A6; --ic-sun:#F0B429;
  --ic-drop:#3A9BDC; --ic-snow:#7FB8E8; --ic-moon:#8FA6CC;
  --shadow:rgba(22,34,58,.16);
  --tint:rgba(22,34,58,.045); --tint-s:rgba(22,34,58,.022);
  --veil:rgba(255,255,255,.92);
  --sky:#2673B1;
}
.wx *{box-sizing:border-box}
.wx h1,.wx h2,.wx h3{margin:0;letter-spacing:-.02em;line-height:1.15}
.wx h1{font-weight:700} .wx h2{font-weight:600} .wx h3{font-weight:600}
.wx b{font-weight:600}
.wx button{font-family:inherit;cursor:pointer;color:inherit;-webkit-tap-highlight-color:transparent}
.wx button:focus-visible,.wx input:not(.srch):focus-visible{outline:2px solid var(--sky);outline-offset:2px}
/* recharts מקבל מיקוד בלחיצה וספארי מצייר סביבו מסגרת — לא רלוונטי בגרף */
/* recharts מצייר מחדש את הצורות בכל עדכון טולטיפ. אם המגע התחיל על צורה,
   iOS ממשיך לשלוח אליה אירועים והיא כבר הוחלפה — ההחלקה נתקעת.
   שקיפות למגע מבטיחה שהיעד הוא תמיד ה-div העוטף, שלא מוחלף. */
.chart-box .recharts-surface{pointer-events:none}
.chart-box .recharts-wrapper{touch-action:pan-y}
.chart-box *:focus,.chart-box *:focus-visible,
.chart-box .recharts-wrapper,.chart-box .recharts-surface{outline:none!important}
.sky{position:absolute;inset:0 0 auto;height:420px;pointer-events:none;
  background:radial-gradient(90% 90% at 80% -20%,rgba(90,179,240,.16),transparent 62%),
  radial-gradient(70% 80% at 12% -10%,rgba(197,139,240,.12),transparent 60%)}
.sec-head{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin-bottom:12px}
.sh-end{margin-inline-start:auto;align-self:center}
.sub{font-size:13.5px;color:var(--muted);font-weight:300}
.sub.wide{max-width:72ch;line-height:1.7;margin:0 0 18px}
.sub b{color:var(--dim)}

/* language */
.topbar{position:relative;z-index:40;max-width:1120px;margin:0 auto;padding-top:18px;
  display:flex;align-items:center;justify-content:space-between;gap:16px}
.brand{display:inline-flex;align-items:center;gap:9px;min-width:0}
.brand-ic{width:30px;height:30px;flex:none}
.brand-ic svg{width:100%;height:100%;display:block}
.brand-name{font-size:16px;font-weight:600;letter-spacing:-.01em;color:var(--text);
  white-space:nowrap;direction:ltr}
.eyebrow-row{max-width:1120px;margin:0 auto;padding-top:14px}
.lang{position:relative}
.topbar-r{display:inline-flex;align-items:center;gap:10px}
/* גאומטריה שמתחלקת בדיוק: מסגרת 1 + ריפוד 3 + גלולה 24 + ריפוד 3 + מסגרת 1
   = 32 גובה, ורוחב 56 לשתי משבצות של 24. כך המרווח סביב הגלולה הוא 4
   מכל הכיוונים בשני המצבים. קודם הכפתור היה 25 גובה עם גלולה 24 ב-top:4,
   ולכן היא בלטה 3px החוצה. */
.thm{position:relative;display:inline-flex;align-items:center;flex:none;
  width:56px;height:32px;padding:3px;background:var(--panel);
  border:1px solid var(--rule);border-radius:999px;transition:.15s}
.thm-knob{position:absolute;top:3px;inset-inline-start:3px;width:24px;height:24px;
  border-radius:999px;background:var(--sel);
  transition:transform .22s cubic-bezier(.4,0,.2,1)}
.thm.on .thm-knob{transform:translateX(24px)}
[dir="rtl"] .thm.on .thm-knob{transform:translateX(-24px)}
/* כל סמל ממורכז במשבצת 24 משלו, ולכן הגלולה נוחתת עליו בדיוק */
.thm-ic{position:relative;z-index:1;width:24px;height:24px;flex:none;
  display:flex;align-items:center;justify-content:center;transition:.15s}
.thm-ic svg{width:15px;height:15px;display:block}
.thm-moon{color:var(--ic-moon)}
.thm-sun{color:var(--faint)}
.thm.on .thm-moon{color:var(--faint)}
.thm.on .thm-sun{color:var(--ic-sun)}
.lang-btn{display:inline-flex;align-items:center;gap:8px;background:var(--panel);
  border:1px solid var(--rule);border-radius:999px;padding:6px 14px 6px 11px;
  font-size:13px;font-weight:500;color:var(--dim);transition:.15s}
.lang-ic{width:17px;height:17px;display:block;color:var(--sky);flex:none}
.lang-ic svg{width:100%;height:100%;display:block}
.lang-menu{position:absolute;z-index:50;inset-inline-end:0;top:100%;margin:7px 0 0;padding:5px;
  list-style:none;min-width:186px;background:var(--panel2);border:1px solid var(--rule);
  border-radius:11px;box-shadow:0 16px 38px var(--shadow)}
.lang-menu button{display:flex;align-items:baseline;justify-content:space-between;gap:10px;
  width:100%;background:none;border:0;padding:8px 11px;border-radius:7px;text-align:start}
.lang-menu button.on{background:var(--sel);box-shadow:0 0 0 1px var(--sky) inset}
.lm-native{font-size:14px;font-weight:500}
.lm-flag{font-size:17px;line-height:1;flex:none}

/* °C / °F */
.utog{display:inline-flex;align-items:center;background:var(--tint);
  border:1px solid var(--rule2);border-radius:999px;padding:2px;flex:none}
.utog button{background:none;border:0;padding:2px 9px;border-radius:999px;
  font-size:11.5px;font-weight:500;color:var(--muted);line-height:1.5;transition:.15s}
.utog button.on{background:var(--rule);color:var(--text);font-weight:600}
/* גרסה בגודל הלשוניות, לשבת לצידן */
.utog.lg{background:var(--panel);border:1px solid var(--rule);border-radius:10px;
  padding:0;overflow:hidden}
.utog.lg button{padding:8px 15px;border-radius:0;font-size:13.5px;line-height:1.5}
.utog.lg button.on{background:var(--sky);color:var(--night);font-weight:600}

.head{position:relative;display:flex;gap:36px;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;
  max-width:1120px;margin:0 auto;padding:16px 0 26px;border-bottom:1px solid var(--rule)}
/* שתי העמודות גדלות יחד ולא רק הכותרת: קודם head-l בלעה את כל השארית,
   וכותרת קצרה ממנה הותירה חלל מולה. הבסיסים 320+260 (ולא 400+300)
   מורידים את נקודת השבירה לשורה נפרדת מ-772px ל-652, כדי שטלפון אופקי
   יישאר בשתי עמודות ולא יערום את החיפוש מתחת לכותרת. */
.head-l{flex:1 1 320px;min-width:0}
.eyebrow{font-size:11.5px;letter-spacing:.22em;color:var(--sky);font-weight:500;line-height:1.4}
.head h1{font-size:clamp(30px,5.5vw,50px)}
/* כותרת בשורה אחת בכל שפה. עמודת הכותרת היא 12px+ מחצית המכולה, ולכן
   הגודל נגזר ממחצית ה-vw ולא מ-vw מלא. המקדם שונה לכל שפה כי היחס
   בין רוחב המחרוזת לגודל הגופן שונה — נמדד: ערבית 10.5, אנגלית 12.8,
   עברית 13.2, צרפתית 15.4, רוסית 18.1, ספרדית 19.1. משם גם התקרות:
   הן הגודל שהעמודה (572px) מרשה, ולכן ספרדית עוצרת ב-29 וערבית ב-50.
   הרצפה 30 היא הערך המקורי ונשמרת, כדי שמסכים צרים ייראו כמו קודם —
   שם השפות הארוכות ממילא נשברות. ברוסית ובספרדית היא יורדת ל-28 ול-26,
   כי התקרה שלהן נמוכה מ-30 ורצפה גבוהה ממנה הייתה מנטרלת אותה. */
html[lang="ar"] .head h1{font-size:clamp(30px,calc(4.61vw - 0.55px),50px)}
html[lang="en"] .head h1{font-size:clamp(30px,calc(3.78vw - 0.45px),43px)}
html[lang="he"] .head h1{font-size:clamp(26px,calc(3.67vw - 0.44px),41px)}
html[lang="fr"] .head h1{font-size:clamp(30px,calc(3.16vw - 0.38px),36px)}
html[lang="ru"] .head h1{font-size:clamp(28px,calc(2.69vw - 0.32px),30px)}
html[lang="es"] .head h1{font-size:clamp(26px,calc(2.55vw - 0.31px),29px)}
.dek{max-width:54ch;margin:13px 0 0;font-size:15px;color:var(--dim);font-weight:300}
.head-r{flex:1 1 260px;min-width:0;max-width:520px;position:relative}
.lab{display:block;font-size:15px;color:var(--dim);margin-bottom:8px;font-weight:500;letter-spacing:.02em}
.srch-wrap{position:relative}
.srch-ic{position:absolute;top:50%;inset-inline-start:13px;transform:translateY(-50%);
  width:18px;height:18px;color:var(--sky);pointer-events:none;z-index:1}
.srch-ic svg{width:100%;height:100%;display:block}
.srch{width:100%;background:var(--panel2);border:1px solid var(--edge);border-radius:10px;
  padding:12px 13px;padding-inline-start:40px;padding-inline-end:36px;
  font-size:16px;font-family:inherit;color:var(--text);
  transition:.15s;-webkit-appearance:none;appearance:none}
.srch::-webkit-search-cancel-button{-webkit-appearance:none;appearance:none}
.srch::placeholder{color:var(--muted2);font-weight:400}
.srch:focus{outline:none;border-color:var(--sky);background:var(--sel);
  box-shadow:0 0 0 3px rgba(90,179,240,.16)}
/* ממורכז ב-margin ולא ב-translateY, כדי שאנימציית הסיבוב לא תדרוס אותו */
.srch-spin{position:absolute;top:50%;inset-inline-end:13px;width:15px;height:15px;margin-top:-7.5px;
  border:2px solid var(--edge);border-top-color:var(--sky);border-radius:50%;
  opacity:0;pointer-events:none;transition:opacity .15s}
.srch-spin.on{opacity:1;animation:srch-spin .6s linear infinite}
@keyframes srch-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.srch-spin.on{animation:none}}
/* מוסר לקוראי מסך בלבד — אפס שטח, ולכן אפס קפיצה */
.sr-live{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;
  clip-path:inset(50%);white-space:nowrap;border:0}
.res{position:absolute;z-index:30;inset-inline:0;top:100%;margin:6px 0 0;padding:5px;list-style:none;
  background:var(--panel2);border:1px solid var(--rule);border-radius:10px;max-height:290px;overflow:auto;
  box-shadow:0 14px 34px var(--shadow)}
.res button{display:flex;align-items:center;gap:10px;width:100%;text-align:start;background:none;border:0;padding:8px 11px;border-radius:7px}
.res-txt{flex:1;min-width:0}
.res-wx{display:flex;align-items:center;gap:5px;flex:none;color:var(--dim)}
.res-ic{width:26px;height:26px;flex:none}
.res-ic svg{width:100%;height:100%;display:block}
.res-t{font-size:13px;font-weight:500;font-variant-numeric:tabular-nums;white-space:nowrap}
.rn{display:block;font-size:14.5px;font-weight:500}
.rr{display:block;font-size:12px;color:var(--muted);font-weight:300}
/* פאנל "יורד עכשיו". צ'יפים בשורה אחת ולא רשימה אנכית, כדי שהוא לא
   ידחוף את מזג האוויר של המשתמש עצמו אל מתחת לקיפול.
   ה-max-width הוא אותו 1120 של כל שאר הסקשנים — בלעדיו הוא נמתח על כל
   רוחב החלון ובלט מהעמודה בדסקטופ רחב. */
.wet{max-width:1120px;margin:18px auto 0}
.wet-head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:9px}
.wet-head h2{font-size:15px;font-weight:600;margin:0}
.wet-head .sub{font-size:12px;color:var(--muted);font-weight:300}
.wet-again{margin-inline-start:auto;width:26px;height:26px;flex:none;padding:4px;
  background:none;border:0;color:var(--muted);border-radius:7px;transition:.15s}
.wet-again:hover:not(:disabled){color:var(--sky);background:var(--panel2)}
.wet-again:disabled{opacity:.4}
.wet-again svg{width:100%;height:100%;display:block}
/* grid-auto-flow:column שומר הכול בשורה אחת, ו-minmax(150px,1fr) גורם
   לצ'יפים למלא בדיוק את הרוחב הזמין בדסקטופ ולהתכווץ עד 150px במובייל —
   ומשם והלאה השורה נגללת. רספונסיבי בלי למדוד רוחב ב-JS. */
.wet-row{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(150px,1fr);
  gap:8px;overflow-x:auto;padding-bottom:2px;
  scrollbar-width:none;-ms-overflow-style:none}
.wet-row::-webkit-scrollbar{display:none}
.wet-load{font-size:12.5px;color:var(--muted);font-weight:300;padding:6px 2px}
.wet-chip{display:flex;align-items:center;gap:8px;min-width:0;
  background:var(--panel);border:1px solid var(--rule2);border-radius:12px;
  padding:7px 11px 7px 8px;text-align:start;transition:.15s}
.wet-chip:hover{border-color:var(--sky);background:var(--panel2)}
.wet-ic{width:30px;height:30px;flex:none}
.wet-ic svg{width:100%;height:100%;display:block}
.wet-txt{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1}
/* שמות הערים והמדינות ברשימה הם תמיד לטיניים. בלי direction:ltr הם יורשים
   RTL מהדף העברי, וה-ellipsis נחתך בתחילת המילה — "‎...terdam" במקום
   "Amster…" */
.wet-n,.wet-c{direction:ltr;text-align:start;white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis}
.wet-n{font-size:13.5px;font-weight:500}
.wet-c{font-size:11px;color:var(--muted);font-weight:300}
.wet-t{font-size:14px;font-weight:600;color:var(--dim);font-variant-numeric:tabular-nums;
  margin-inline-start:2px}
.coords{margin-top:9px;font-size:12px;color:var(--muted);font-weight:300;
  display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.geo{background:none;border:0;padding:0;font-size:12px;color:var(--sky);font-weight:500;
  text-decoration:underline;text-underline-offset:3px}
.geo:disabled{color:var(--muted);text-decoration:none}

.week{max-width:1120px;margin:26px auto 0}
.wload,.werr{font-size:13.5px;color:var(--muted);padding:10px 0}
.werr{color:var(--rose)}
.werr button{background:var(--sky);color:var(--night);border:0;border-radius:7px;padding:5px 12px;font-weight:600;font-size:12.5px;margin-inline-start:8px}
.week-nav{display:flex;align-items:stretch;gap:6px}
.week-nav .wrow{flex:1;min-width:0}
.wrow{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;touch-action:pan-y}
.nav-arrow{width:26px;flex:none;display:flex;align-items:center;justify-content:center;
  background:var(--panel);border:1px solid var(--rule2);border-radius:12px;
  color:var(--muted);padding:0;transition:.15s}
.nav-arrow:active{background:var(--panel2);color:var(--sky)}
.nav-arrow svg{width:15px;height:15px;display:block}
.snownote{margin-top:14px;background:rgba(191,227,255,.07);border:1px solid rgba(191,227,255,.22);
  border-radius:11px;padding:10px 13px;font-size:13px;color:var(--dim);font-weight:300;line-height:1.6}
.snownote b{color:#BFE3FF;font-weight:600}
.reach{margin-top:12px;font-size:12.5px;color:var(--muted);font-weight:300;line-height:1.55;
  border-inline-start:2px solid var(--rule);padding-inline-start:11px}
.wcell{position:relative;display:flex;flex-direction:column;align-items:center;gap:3px;
  background:var(--panel);border:1px solid var(--rule2);border-radius:12px;padding:10px 3px 9px;transition:.15s;min-width:0}
.wcell.on{border-color:var(--sky);background:var(--sel);box-shadow:0 0 0 1px var(--sky) inset}
.w-dow{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.w-dow .sm{display:none;font-style:normal}
.w-dow .lg{font-style:normal}
.w-date{font-size:11px;color:var(--muted);font-weight:300;white-space:nowrap}
.w-ic{width:40px;height:40px;margin:1px 0}
.w-ic svg,.b-ic svg,.d-ic svg{width:100%;height:100%;display:block}
.w-t{display:flex;gap:5px;align-items:baseline;font-size:12px;color:var(--muted)}
.w-t b{font-size:16px;color:var(--text);font-weight:600}
.w-t em{font-style:normal}
.w-mm{font-size:11px;color:var(--faint);font-weight:400;white-space:nowrap}
.w-mm.wet{color:var(--sky);font-weight:600}
.w-bar{width:calc(100% - 14px);height:4px;background:var(--rule2);border-radius:3px;overflow:hidden;margin-top:4px}
.w-bar i{height:100%;background:var(--sky);border-radius:3px;display:block}
.w-warn{position:absolute;top:7px;inset-inline-end:7px;width:7px;height:7px;border-radius:50%;background:var(--warm)}

/* עכשיו + התרעת השעה הקרובה */
/* flex ולא grid: הגריד 1fr auto 1fr מרכז את עמודת הטקסט בלבד, והאייקון
   תלוי מחוצה לה — כך שהקבוצה הנראית יצאה מוסטת בחצי רוחב האייקון והמרווח
   (55px נמדדו). הוא נדרש רק כשהשם ישב כאן והבלוק היה דו-שורתי; מאז שהשם
   עבר ל-.placebar זו שורה אחת, ומירכוז הקבוצה כולה הוא הנכון. */
.nowbar{display:flex;align-items:center;justify-content:center;gap:12px;
  margin-bottom:10px;
  background:var(--panel);border:1px solid var(--rule2);
  border-radius:0 0 14px 14px;padding:11px 15px}
/* הגודל נקבע כשהכרטיס היה שורה אחת. מאז הבלוק גדל לשתי שורות (61px
   בדסקטופ, 57 במובייל) והאייקון נשאר קטן ביחס. 52/44 עדיין נמוך מגובה
   הבלוק, ולכן ההגדלה לא מוסיפה ולו פיקסל לגובה הכרטיס. */
.now-ic{width:52px;height:52px;flex:none}
.now-ic svg,.soon-ic svg{width:100%;height:100%;display:block}
/* שורה משלו מעל "עכשיו", מחוברת אליה לכרטיס אחד (בלי בורדר תחתון ובלי
   מרווח). כשהשם ישב בתוך שורת "עכשיו" הוא נאלץ להתיישר מול משהו — המספר,
   המילה "עכשיו", או מרכז הבלוק — וכל בחירה הזיזה משהו אחר. בשורה משלו
   אין מול מה להתיישר והמירכוז פשוט עובד. */
.placebar{margin-bottom:0;padding:11px 15px;text-align:center;
  background:var(--panel);border:1px solid var(--rule2);border-bottom:0;
  border-radius:14px 14px 0 0;
  font-size:19px;font-weight:700;color:var(--text)}
.now-txt{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.now-lab{font-size:12px;color:var(--muted);font-weight:500;letter-spacing:.04em}
.now-txt b{font-size:30px;font-weight:700;line-height:1}
.now-txt em{font-style:normal;font-size:13px;color:var(--dim);font-weight:300}
.soon{display:flex;align-items:center;gap:11px;margin-bottom:10px;
  background:rgba(90,179,240,.09);border:1px solid rgba(90,179,240,.3);border-radius:12px;
  padding:10px 14px;font-size:13.5px;color:var(--dim);font-weight:300;line-height:1.55}
.soon b{color:var(--text);font-weight:600}
.soon-ic{width:32px;height:32px;flex:none}
.detail{margin-top:10px;background:var(--panel);border:1px solid var(--rule);border-radius:14px;padding:16px 16px 14px}
.d-main{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.d-ic{width:66px;height:66px;flex:none}
.d-txt{flex:1;min-width:150px}
.d-day{font-size:18px;font-weight:600}
.d-cond{font-size:14px;color:var(--dim)}
.d-temps{font-size:14px;color:var(--muted);margin-top:2px}
.d-temps b{font-size:24px;color:var(--text)}
.dt-main{display:inline}
.dt-more{display:inline;font-size:13px;line-height:1.5}
.dt-more::before{content:" · ";color:var(--rule)}
.dt-more>span+span::before{content:" · ";color:var(--rule)}

/* radar */
.radar{max-width:1120px;margin:40px auto 0}
.radar h2{font-size:24px}
.radar-lead{font-size:14px;color:var(--dim);font-weight:300;line-height:1.7;
  max-width:74ch;margin:0 0 14px;border-inline-start:2px solid var(--sky);padding-inline-start:13px}
.radar-lead b{color:var(--text);font-weight:600}
.radar-panel{background:var(--panel);border:1px solid var(--rule2);border-radius:14px;
  padding:12px 12px 10px}
.radar-map{position:relative;width:100%;height:320px;overflow:hidden;border-radius:10px;
  background:var(--deep);isolation:isolate}
.radar-map img{user-select:none;-webkit-user-drag:none}
/* Dark Matter כהה מאוד מלכתחילה — מבהירים כדי שהיבשה והתוויות ייקראו */
/* Dark Matter הוא מונוכרום מוחלט: יבשה rgb(9,9,9) וים rgb(38,38,38), R=G=B
   בשניהם. sepia מוסיף רוויה ביחס לבהירות, ולכן אחרי hue-rotate לכחול הים
   מקבל צבע (#333f64) והיבשה נשארת כמעט שחורה (#10131f) — בלי מפתח או ספק
   אריחים חדש. saturate שהיה כאן קודם היה no-op על מקור חסר גוון. */
.rd-base{filter:brightness(1.30) contrast(.95) sepia(1) hue-rotate(188deg) saturate(2.4)}
.rd-fall{filter:saturate(1.25) contrast(1.1);transition:opacity .18s linear}
.rd-pin{position:absolute;top:50%;left:50%;width:11px;height:11px;margin:-5.5px 0 0 -5.5px;
  border-radius:50%;background:var(--warm);box-shadow:0 0 0 2.5px var(--night),0 0 0 4px rgba(245,162,75,.45);z-index:3}
.rd-veil{position:absolute;inset:0;z-index:4;display:flex;align-items:center;justify-content:center;
  text-align:center;padding:20px;background:var(--veil);font-size:13.5px;color:var(--muted);
  font-weight:300;line-height:1.6}
.rd-base.lite{filter:saturate(3.4) contrast(1.06) brightness(.99)}
.rd-nocov{position:absolute;z-index:4;inset-inline:10px;bottom:10px;
  padding:9px 12px;border-radius:10px;text-align:center;
  background:var(--veil);border:1px solid var(--rule2);
  font-size:12.5px;color:var(--dim);font-weight:300;line-height:1.5}
.radar-ctl{display:flex;align-items:center;gap:12px;padding:11px 4px 4px}
.rd-play{width:34px;height:34px;flex:none;display:flex;align-items:center;justify-content:center;
  background:var(--panel2);border:1px solid var(--rule);border-radius:999px;color:var(--sky);padding:0}
.rd-play svg{width:15px;height:15px;display:block}
.rd-slider{flex:1;min-width:0;accent-color:var(--sky);background:transparent;height:22px}
.rd-time{flex:none;display:flex;flex-direction:column;align-items:flex-end;line-height:1.25;
  font-size:14px;font-weight:600;color:var(--text);min-width:74px}
.rd-time em{font-style:normal;font-size:10.5px;font-weight:500;color:var(--muted);letter-spacing:.03em}
.rd-time.soon{color:var(--sky)}
.rd-time.soon em{color:var(--sky)}
.radar-credit{display:flex;flex-wrap:wrap;gap:4px 12px;padding:8px 4px 2px;
  border-top:1px solid var(--rule2);margin-top:6px;font-size:11px;color:var(--faint);font-weight:300}
.radar-credit a{color:var(--faint);text-decoration:underline;text-underline-offset:2px}
/* tiles */
.cond-wrap{margin-top:18px;border-top:1px solid var(--rule2);padding-top:14px}
.cond-head{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:10px}
.cond-title{font-size:12px;color:var(--muted);font-weight:500;letter-spacing:.04em}
.cond-elev{font-size:11.5px;color:var(--faint);font-weight:300}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(104px,1fr));gap:8px}
.tile{background:var(--panel2);border:1px solid var(--rule2);border-radius:11px;
  padding:10px 11px;display:flex;flex-direction:column;gap:2px;min-width:0}
.ti-lab{font-size:11px;color:var(--muted);font-weight:400;white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis}
.ti-val{font-size:19px;font-weight:600;line-height:1.25;display:flex;align-items:center;gap:5px}
.ti-val em{font-style:normal;font-size:11.5px;color:var(--muted);font-weight:400}
.ti-note{font-size:11px;color:var(--dim);font-weight:300;white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis}
.ti-arrow{width:19px;height:19px;color:var(--sky);flex:none}
.ti-arrow svg{width:100%;height:100%;display:block;transform-origin:50% 50%}

/* observations */
.obs{margin-top:14px;background:rgba(245,162,75,.07);border:1px solid rgba(245,162,75,.25);
  border-radius:11px;padding:11px 13px}
.obs-title{display:block;font-size:11.5px;color:var(--warm);font-weight:600;
  letter-spacing:.04em;margin-bottom:6px}
.obs-row{font-size:13px;color:var(--dim);font-weight:300;line-height:1.6;padding:1px 0}
.d-verdict{display:flex;flex-direction:column;gap:2px;text-align:end;min-width:200px;max-width:320px}
.d-verdict b{font-size:16px}
.d-verdict span{font-size:12.5px;color:var(--muted);font-weight:300;line-height:1.5}
.v-high b{color:var(--mint)} .v-mid b{color:var(--warm)} .v-split b{color:var(--rose)} .v-dry b{color:var(--faint)}
.d-scale{margin-top:16px}
.d-chips:first-child{margin-top:0}
.d-track{position:relative;height:16px;border-bottom:1px solid var(--rule)}
.d-tick{position:absolute;bottom:0;width:3px;height:13px;border-radius:2px;transform:translateX(50%)}
.d-nums{display:flex;justify-content:space-between;margin-top:6px;font-size:11.5px;color:var(--muted);font-weight:300}
.d-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
.d-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid;border-radius:999px;
  padding:4px 11px;font-size:12.5px;background:var(--tint-s)}
.d-chip i{width:7px;height:7px;border-radius:50%;flex:none}
.d-chip b{font-weight:600}
.d-chip em{font-style:normal;color:var(--dim);font-weight:300}
.d-outs{margin-top:14px;display:flex;flex-direction:column;gap:7px}
.d-out{background:var(--panel2);border-inline-start:3px solid;border-radius:8px;padding:9px 12px;
  font-size:13px;color:var(--dim);font-weight:300;line-height:1.6}
.d-out b{color:var(--text)}

.pens{max-width:1120px;margin:30px auto 0}
.pens h2{font-size:24px}
.pen-row{display:flex;flex-wrap:wrap;gap:8px}
.pen{display:inline-flex;align-items:center;gap:8px;background:var(--panel);border:1px solid var(--rule);
  color:var(--faint);padding:7px 15px;border-radius:999px;font-size:13.5px;font-weight:500;transition:.15s}
.nib{width:9px;height:9px;border-radius:999px;border:1.5px solid;display:inline-block}
.pen-star{width:11px;height:11px;display:block;flex:none;margin-inline-start:-2px}
.pen-star svg,.sk-star svg,.chip-star svg{width:100%;height:100%;display:block}
.chip-star{width:9px;height:9px;display:block;flex:none;margin-inline-start:-2px}
.d-chip.lead{background:var(--tint)}
.skill{display:flex;align-items:flex-start;gap:9px;margin-top:12px;
  font-size:13px;color:var(--dim);font-weight:300;line-height:1.6;max-width:74ch}
.skill.thin{color:var(--muted);font-size:12.5px}
.skill b{color:var(--text)}
.sk-star{width:14px;height:14px;flex:none;margin-top:3px}
.sk-caveat{display:block;font-style:normal;font-size:11.5px;color:var(--muted);margin-top:2px}

.graph{max-width:1120px;margin:22px auto 0}
.gbar{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px}
.vars{display:flex;background:var(--panel);border:1px solid var(--rule);border-radius:10px;overflow:hidden}
.vtab{background:transparent;border:0;padding:8px 15px;font-size:13.5px;color:var(--muted);font-weight:500;white-space:nowrap}
.vtab.on{background:var(--sky);color:var(--night);font-weight:600}
.panel{position:relative;background:var(--panel);border:1px solid var(--rule2);border-radius:14px;padding:10px 12px 0}
/* שורת הימים תמיד מוצגת — הימים נראים כמו כפתורים, ומתחת שורה שלעולם לא ריקה */
.daystrip{margin-bottom:8px}
.bands{display:flex;gap:5px}
.band{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;
  background:var(--tint-s);border:1px solid var(--rule2);
  border-radius:10px;padding:8px 2px;transition:.15s;min-width:0;cursor:pointer}
.band.on{background:var(--rule2);border-color:var(--sky);box-shadow:0 0 0 1px var(--sky) inset}
.b-ic{width:30px;height:30px}
.b-day{font-size:13.5px;font-weight:600;white-space:nowrap;line-height:1.2}
.b-day .sm{display:none;font-style:normal}
.b-day .lg{font-style:normal}
.b-date{font-size:11px;color:var(--muted);font-weight:300;white-space:nowrap}

.ds-foot{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px;
  border-top:1px solid var(--rule2);margin-top:9px;padding-top:10px;min-height:44px}
.ds-side{display:flex;align-items:center}
.ds-side:last-child{justify-content:flex-end}
.ds-hint{grid-column:1 / -1;text-align:center;font-size:12.5px;color:var(--muted);font-weight:300}
.back-week{display:inline-flex;align-items:center;gap:8px;flex:none;
  background:var(--panel2);border:1px solid var(--rule);border-radius:999px;padding:8px 16px;
  font-size:13.5px;font-weight:600;color:var(--sky);transition:.15s;cursor:pointer}
.back-week:active{background:var(--line);border-color:var(--sky)}
.bw-ic{width:15px;height:15px;display:block;flex:none}
.bw-ic svg{width:100%;height:100%;display:block}
.dn-day{display:inline-flex;align-items:center;justify-content:center;gap:8px;
  font-size:14px;color:var(--dim);white-space:nowrap}
.dn-day b{font-weight:600;color:var(--text);font-size:15px}
.dn-day em{font-style:normal;font-size:12.5px;color:var(--muted)}
.dn-ic{width:26px;height:26px;flex:none}
.dn-ic svg{width:100%;height:100%;display:block}
.pkey{display:flex;align-items:flex-start;gap:14px;
  font-size:12px;color:var(--muted);font-weight:300;line-height:1.5;
  border-top:1px solid var(--rule2);margin-top:6px;padding:10px 4px 12px}
.pkey-row{display:flex;align-items:flex-start;gap:9px;flex:1;min-width:0}
.pkey-txt{min-width:0;display:flex;flex-direction:column;gap:1px}
.pkey-txt b{font-weight:500;color:var(--dim);font-size:12.5px}
.pkey-txt em{font-style:normal;font-size:11.5px;color:var(--muted)}
/* היחידה שייכת לציר — מיושרת לאותו קצה כמו המספרים, ופיזית קבועה בכל שפה */
.chart-box{position:relative;margin-top:20px}
.chart-unit{position:absolute;top:-17px;left:0;z-index:2;pointer-events:none;
  font-size:11px;color:var(--muted);font-weight:300;white-space:nowrap;
  text-align:right;padding-right:5px;direction:ltr}
.chart-unit.right{left:auto;right:0;text-align:left;padding-right:0;padding-left:5px}
.kb{width:26px;height:11px;border-radius:3px;background:var(--ink2);opacity:.3;flex:none;margin-top:3px}
.veil{position:absolute;inset:0;z-index:6;display:flex;align-items:center;justify-content:center;
  background:var(--veil);border-radius:14px;font-size:13.5px;color:var(--muted)}

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
  padding:3px 9px;font-size:12px;background:var(--tint-s)}
.ro-chip i{width:6px;height:6px;border-radius:50%;flex:none}
.ro-chip b{font-weight:600}
.ro-chip em{font-style:normal;color:var(--text);font-weight:500}

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
.sw.ghost{background:var(--ink2);opacity:.28}
.sw.warm{background:var(--warm)}
.sw.dash{background:repeating-linear-gradient(90deg,var(--warm) 0 4px,transparent 4px 7px);opacity:.7}
.sw.grad{background:linear-gradient(90deg,rgba(90,179,240,.15),var(--sky))}

.tip{background:var(--deep3);border:1px solid var(--edge);border-radius:10px;padding:10px 12px;font-size:13px;min-width:158px;
  box-shadow:0 12px 30px var(--shadow)}
.tip-h{font-size:12px;color:var(--muted);padding-bottom:7px;margin-bottom:6px;border-bottom:1px solid var(--line4)}
.tip-r{display:flex;align-items:center;gap:8px;padding:2px 0}
.tip-nib{width:9px;height:3px;border-radius:2px;flex:none}
.tip-n{flex:1;font-weight:500}
.tip-v{font-size:12.5px;color:var(--dim);white-space:nowrap}
.tip-v em{font-style:normal;font-size:10.5px;color:var(--muted)}

.score{max-width:1120px;margin:44px auto 0;background:var(--panel);border:1px solid var(--rule);border-radius:16px;padding:22px}
.score h2{font-size:24px}
.s-ctl{display:flex;gap:18px;flex-wrap:wrap;align-items:flex-end;margin-bottom:14px}
.s-grp{display:flex;flex-direction:column;gap:6px}
.s-lab{font-size:12px;color:var(--muted);font-weight:500}
/* .wx button{color:inherit} הוא (0,1,1) ומנצח .s-run שהוא (0,1,0) —
   ולכן הצבע נדרס. הסלקטור המקונן מעלה ל-(0,2,0) ומחזיר את השליטה. */
.wx .s-run{background:var(--sky);color:var(--night);border:0;border-radius:10px;padding:10px 22px;font-weight:600;font-size:14px}
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
.s-bar{flex:1;height:7px;background:var(--deep2);border-radius:4px;overflow:hidden;display:block;min-width:36px}
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
.mc-body dt{flex:0 0 82px;color:var(--muted);font-weight:300}
.mc-body dd{margin:0}
.mc-body p{margin:0;font-size:13.5px;line-height:1.7;color:var(--dim);font-weight:300;
  border-top:1px solid var(--rule2);padding-top:11px}
.primer{margin-top:34px;max-width:68ch}
.primer h3{font-size:20px;margin-bottom:12px}
.primer p{font-size:15px;line-height:1.8;color:var(--dim);font-weight:300;margin:0 0 13px}
.primer b{color:var(--text);font-weight:600}
.foot{max-width:1120px;margin:44px auto 0;padding-top:16px;border-top:1px solid var(--rule2);
  font-size:12.5px;color:var(--muted);font-weight:300;line-height:1.75}
.foot p{margin:0}
.foot-credit{margin-top:10px!important;padding-top:10px;border-top:1px solid var(--rule2);
  font-size:12px;color:var(--faint);letter-spacing:.01em;
  display:flex;flex-wrap:wrap;align-items:baseline;gap:7px}
.foot-name{font-size:13px;font-weight:600;color:var(--dim);letter-spacing:.01em;direction:ltr}
.foot-dot{color:var(--rule)}

@media (max-width:760px){
  .wx{padding:env(safe-area-inset-top) max(12px,env(safe-area-inset-right))
      calc(48px + env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left))}
  .topbar{padding-top:12px;gap:10px}
  .brand-ic{width:26px;height:26px}
  .brand-name{font-size:14.5px}
  .eyebrow-row{padding-top:11px}
  .eyebrow{font-size:10.5px;letter-spacing:.16em}
  .head{padding-top:12px;gap:20px}
  /* 240 ולא 100%: ברוחב הזה עדיין נכנסות שתי עמודות, וטלפון אופקי
     שומר את החיפוש לצד הכותרת במקום מתחתיה */
  .head-r{flex:1 1 240px}
  .wrow{gap:3px}
  .week-nav{gap:4px}
  .nav-arrow{width:19px;border-radius:9px}
  .nav-arrow svg{width:12px;height:12px}
  .reach{font-size:11.5px;margin-top:10px}
  .wcell{padding:8px 1px 7px;border-radius:9px;gap:2px}
  .w-dow{font-size:13px}
  .w-dow .lg{display:none} .w-dow .sm{display:inline}
  .w-date{font-size:9.5px}
  .w-ic{width:30px;height:30px}
  .w-t{gap:3px;font-size:10px} .w-t b{font-size:13px}
  .w-mm{font-size:9.5px}
  .w-bar{width:calc(100% - 8px);height:3px;margin-top:3px}
  .w-warn{width:6px;height:6px;top:4px;inset-inline-end:4px}
  .placebar{padding:10px 12px;font-size:17px;border-radius:12px 12px 0 0}
  .nowbar{padding:10px 12px;gap:11px;border-radius:0 0 12px 12px}
  .now-ic{width:44px;height:44px}
  .now-txt{gap:8px}
  .now-txt b{font-size:26px}
  .now-txt em{font-size:12px}
  .soon{padding:9px 11px;gap:9px;font-size:12.5px}
  .soon-ic{width:26px;height:26px}
  .detail{padding:14px 13px}
  .d-ic{width:54px;height:54px}
  .d-verdict{text-align:start;min-width:0;max-width:none;flex:1 1 100%;margin-top:4px}
  /* בשורה אחת זה גולש בשפות הארוכות — במובייל יורד שורה */
  .dt-main{display:block}
  .dt-more{display:block;margin-top:3px}
  .dt-more::before{content:none}
  /* "כולם: יבש" תופס גובה בלי להוסיף מידע — בדסקטופ יש מקום, כאן לא */
  .d-verdict.v-dry{display:none}
  .d-chip{font-size:11.5px;padding:3px 9px;gap:5px}
  .tiles{grid-template-columns:repeat(3,1fr);gap:5px}
  .tile{padding:7px 7px 6px;border-radius:9px;gap:0}
  .ti-lab{font-size:9.5px}
  .ti-val{font-size:15px;gap:3px;line-height:1.35}
  .ti-val em{font-size:9.5px}
  .ti-note{font-size:9.5px;line-height:1.3}
  .ti-arrow{width:14px;height:14px}
  .cond-wrap{margin-top:14px;padding-top:12px}
  .cond-head{gap:8px;margin-bottom:8px}
  .cond-elev{font-size:10.5px}
  .radar-panel{padding:10px 10px 8px}
  .radar-map{height:250px;border-radius:9px}
  .radar-lead{font-size:13px}
  .radar-ctl{gap:10px;padding:10px 2px 3px}
  .rd-play{width:31px;height:31px}
  .rd-time{font-size:13px;min-width:64px}
  .rd-time em{font-size:9.5px}
  .radar-credit{font-size:10px;gap:3px 9px}
  .obs-row{font-size:12.5px}
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
  .band{padding:7px 1px;border-radius:8px;gap:1px}
  .b-day{font-size:12.5px}
  .b-day .lg{display:none} .b-day .sm{display:inline}
  .b-ic{width:26px;height:26px}
  .b-date{font-size:9.5px}
  .bands{gap:4px}
  /* התוויות באנגלית ובצרפתית ארוכות — ריפוד צר יותר שומר הכל בשורה אחת */
  .gbar{gap:8px}
  .vtab{padding:8px 10px;font-size:13px}
  .utog.lg button{padding:8px 11px;font-size:13px}
  /* במרכוז אין מספיק רוחב לשמות ארוכים — במובייל הכפתור בצד אחד והיום בנגדי */
  .ds-foot{display:flex;align-items:center;justify-content:space-between;
    margin-top:8px;padding-top:9px;min-height:40px;gap:8px}
  .ds-side:last-child{display:none}
  .ds-hint{flex:1;text-align:center;font-size:11.5px}
  .dn-day{min-width:0;justify-content:flex-end;gap:5px;font-size:13px}
  .dn-day b{font-size:13.5px;overflow:hidden;text-overflow:ellipsis}
  .dn-day em{font-size:11.5px;flex:none}
  .dn-ic{width:20px;height:20px}
  .back-week{font-size:12.5px;padding:7px 13px;gap:6px;flex:none}
  .bw-ic{width:14px;height:14px}
  .dn-day em{font-size:11.5px}
  .dn-ic{width:22px;height:22px}
  .score{padding:16px 14px;border-radius:12px}
  .s-hrow{display:none}
  .s-row{grid-template-columns:1fr 1fr;gap:7px 10px;font-size:13px;padding:11px 12px}
  .s-mae{grid-column:1 / -1;order:2}
  .s-name{order:1;grid-column:1 / -1}
  .s-n{order:3;font-size:12px}
  .s-n::before{content:attr(data-l) ": ";color:var(--muted)}
}

/* רק כאן באמת אין מקום לשתי עמודות: 320+20+240 = 580 מול המכולה.
   מעל זה — טלפון אופקי — הכותרת והחיפוש נשארים זה לצד זה. */
@media (max-width:640px){
  .head-r{flex:1 1 100%}
}
/* ריחוף רק במכשירים עם מצביע אמיתי.
   ב-iOS כלל :hover גורם ללחיצה הראשונה "להדליק" ריחוף ורק לשנייה להפעיל. */
@media (hover:hover) and (pointer:fine){
  .lang-btn:hover{border-color:var(--line3);color:var(--text)}
  .lang-menu button:hover{background:var(--line)}
  .utog button:hover{color:var(--dim)}
  .res button:hover{background:var(--line)}
  .nav-arrow:hover:not(:disabled){background:var(--panel2);border-color:var(--sky);color:var(--sky)}
  .wcell:hover{background:var(--panel2)}
  .pen:hover{border-color:var(--line3)}
  .band:hover{background:var(--rule2);border-color:var(--line3)}
  .band.on:hover{border-color:var(--sky)}
  .back-week:hover{background:var(--line);border-color:var(--sky)}
}
@media (prefers-reduced-motion:reduce){.wx *{transition:none!important;animation:none!important}}
`;
