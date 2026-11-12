"""
בונה את src/he-places.json — טבלת יישובים לחיפוש בעברית.

למה: החיפוש של Open-Meteo לא מוצא בעברית חלק גדול מהיישובים בישראל
(אריאל, ראש העין, קצרין, מעלה אדומים...), אף שב-GeoNames, המאגר שהוא
עצמו נשען עליו, השמות העבריים קיימים. לכן הטבלה כוללת את כל רשימת
היישובים של הלמ״ס ולא רק את החסרים — אי אפשר לדעת מראש מה Open-Meteo ימצא.

מקורות (להוריד לתיקייה אחת ולהעביר כארגומנט):
  cbs.json  — רשימת היישובים של הלמ״ס, data.gov.il:
      https://data.gov.il/api/3/action/datastore_search?resource_id=5c78e9fa-c2e2-4771-93ff-7f400a12f7ba&limit=2000
  IL/IL.txt, PS/PS.txt, SY/SY.txt — GeoNames (CC BY 4.0), לקואורדינטות ולאוכלוסייה:
      https://download.geonames.org/export/dump/IL.zip , PS.zip , SY.zip
      (מ-SY נלקחים רק יישובים בתחום רמת הגולן — מג'דל שמס, מסעדה, בוקעאתא)

הרצה:  python3 scripts/build-he-places.py <תיקיית-הנתונים>
"""
import json, math, re, statistics, sys, unicodedata
from pathlib import Path

src = Path(sys.argv[1])
out = Path(__file__).resolve().parent.parent / "src" / "he-places.json"

def he_norm(s):
    s = "".join(c for c in unicodedata.normalize("NFD", s) if not unicodedata.combining(c))
    s = re.sub(r"[\"'׳״`‘’\-–־()]", " ", s)
    s = re.sub(r"\bקרית\b", "קריית", s)
    return " ".join(s.split())

def en_norm(s):
    s = "".join(c for c in unicodedata.normalize("NFD", s) if not unicodedata.combining(c)).upper()
    s = re.sub(r"[^A-Z]", "", s)
    # הלמ״ס כותב Q ו-Z במקום שבו GeoNames כותב לרוב K ו-TS/TZ
    s = re.sub(r"^K[AE]FAR", "KFAR", s)
    for a, b in (("TZ", "Z"), ("TS", "Z"), ("Q", "K"), ("CH", "KH"), ("EI", "E"), ("II", "I"), ("YY", "Y")):
        s = s.replace(a, b)
    return re.sub(r"(.)\1+", r"\1", s)   # ALLONE מול Alonei

# מחוז הלמ״ס (הספרה הראשונה של סמל הנפה) → קוד admin1 של GeoNames
DIST_ADMIN = {1: {"06"}, 2: {"03", "00"}, 3: {"04"}, 4: {"02"}, 5: {"05"}, 6: {"01"}, 7: {"WE"}}

geo = []
for f in ("IL/IL.txt", "PS/PS.txt", "SY/SY.txt"):
    for line in (src / f).read_text(encoding="utf-8").splitlines():
        c = line.split("\t")
        if c[6] != "P":
            continue
        if f.startswith("SY") and not (32.6 < float(c[4]) < 33.4 and 35.6 < float(c[5]) < 35.95):
            continue
        alts = [a for a in c[3].split(",") if a]
        geo.append({
            "id": c[0], "lat": float(c[4]), "lon": float(c[5]), "code": c[7],
            "admin": c[10], "pop": int(c[14] or 0),
            "he": {he_norm(a) for a in alts if re.search(r"[א-ת]", a)},
            "en": {en_norm(a) for a in [c[1], c[2], *alts] if re.search(r"[A-Za-z]", a)},
        })

def best(cands, dist):
    # עדיפות לאותו מחוז, אחר כך ליישוב אמיתי (PPL*) על פני STLMT כפול, אחר כך לאוכלוסייה
    same = [g for g in cands if g["admin"] in DIST_ADMIN.get(dist, set())]
    pool = same or cands
    return max(pool, key=lambda g: (g["code"].startswith("PPL"), g["pop"]))

recs = json.loads((src / "cbs.json").read_text(encoding="utf-8"))["result"]["records"]
rows, miss, off, found = [], [], [], []
for r in recs:
    he, en = r["שם_ישוב"].strip(), r["שם_ישוב_לועזי"].strip()
    dist = int(str(r["סמל_נפה"])[0]) if r["סמל_נפה"] else 0
    if not he or not dist:
        continue
    # "גת (קיבוץ)", "אשדות יעקב (מאוחד)" — הסוגריים מבדילים בתוך הלמ״ס, לא ב-GeoNames
    he_b, en_b = re.sub(r"\(.*?\)", "", he), re.sub(r"\(.*?\)", "", en)
    cands = []
    for h, e in ((he, en), (he_b, en_b)):
        hn, enn = he_norm(h), en_norm(e) if e else None
        cands = [g for g in geo if hn in g["he"]] or ([g for g in geo if enn in g["en"]] if enn else [])
        if cands:
            break
    if not cands:
        miss.append(he)
        continue
    g = best(cands, dist)
    # שמות הלמ״ס מגיעים לפעמים עם רווחים סביב מקפים ("תל אביב - יפו")
    name = re.sub(r"\s*-\s*", "-", " ".join(he.split()))
    found.append((name, he, dist, r["סמל_נפה"], g, g["admin"] in DIST_ADMIN.get(dist, set())))

# התאמה מחוץ למחוז של הלמ״ס לפעמים נכונה (GeoNames משייך התנחלויות למחוזות
# בישראל) ולפעמים שם זהה במקום אחר — נערן הגיע לגולן, נווה שלום לנתניה.
# מבחן: מרחק מחציון היישובים שהותאמו בתוך המחוז באותה נפה.
# נבדקו ידנית: המיקום ב-GeoNames נכון, הם פשוט בקצה של נפה ארוכה
# (בקעת הירדן, דרום הר חברון)
EDGE_OK = {"בית הערבה", "מצפה יריחו", "שני"}
def km(a, b):
    return math.hypot((a[0] - b[0]) * 111, (a[1] - b[1]) * 94)
anchor = {}
for _, _, _, nafa, g, ok in found:
    if ok:
        anchor.setdefault(nafa, []).append((g["lat"], g["lon"]))
anchor = {k: (statistics.median(p[0] for p in v), statistics.median(p[1] for p in v)) for k, v in anchor.items()}
for name, he, dist, nafa, g, ok in found:
    if not ok:
        d = km((g["lat"], g["lon"]), anchor[nafa]) if nafa in anchor else 999
        if d > 30 and he not in EDGE_OK:
            off.append(f"{he}: {g['lat']:.2f},{g['lon']:.2f} — {d:.0f} ק״מ מהנפה, נפסל")
            continue
    rows.append([name, round(g["lat"], 4), round(g["lon"], 4), dist, g["pop"]])

rows.sort(key=lambda x: -x[4])
out.write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"{len(rows)} יישובים נכתבו ל-{out.name}, {len(miss)} בלי התאמה")
print("בלי התאמה:", ", ".join(miss))
print(f"\n{len(off)} נפסלו גאוגרפית:"); print("\n".join(off))
