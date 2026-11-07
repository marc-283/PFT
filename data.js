/* PFT 1.4.0 – Texts (EN/DE), sports and exercises, helpers, storage (IndexedDB) and the data model. */
"use strict";
  const VERSION = window.PFT_VERSION || "1.2.0";

  /* ================= Language ================= */
  const LANG_KEY = "pft.lang";
  let LANG = (() => { try { const v = localStorage.getItem(LANG_KEY); return v === "de" || v === "en" ? v : "en"; } catch { return "en"; } })();
  /* T(english, german) – every visible text goes through here */
  const T = (en, de) => (LANG === "de" ? de : en);
  const NOUN = {
    session: ["session", "sessions", "Einheit", "Einheiten"], workout: ["workout", "workouts", "Training", "Trainings"], template: ["workout", "workouts", "Workout", "Workouts"],
    exercise: ["exercise", "exercises", "Übung", "Übungen"], set: ["set", "sets", "Satz", "Sätze"], rep: ["rep", "reps", "Wdh.", "Wdh."], run: ["run", "runs", "Lauf", "Läufe"],
    record: ["record", "records", "Rekord", "Rekorde"], week: ["week", "weeks", "Woche", "Wochen"], match: ["match", "matches", "Spiel", "Spiele"], goal: ["goal", "goals", "Tor", "Tore"],
    assist: ["assist", "assists", "Vorlage", "Vorlagen"], entry: ["entry", "entries", "Eintrag", "Einträge"], meal: ["meal", "meals", "Mahlzeit", "Mahlzeiten"], food: ["food", "foods", "Lebensmittel", "Lebensmittel"],
    day: ["day", "days", "Tag", "Tage"], item: ["item", "items", "Zutat", "Zutaten"], level: ["level", "levels", "Stufe", "Stufen"], skill: ["skill", "skills", "Skill", "Skills"]
  };
  let nf, nf1, nf0, dFmt, dateFmt, dayMonth, monthFmt, monthLong, monShort, wdShort;
  function setLocale() {
    const loc = LANG === "de" ? "de-DE" : "en-GB";
    nf = new Intl.NumberFormat(loc, { maximumFractionDigits: 2 });
    nf1 = new Intl.NumberFormat(loc, { maximumFractionDigits: 1 });
    nf0 = new Intl.NumberFormat(loc, { maximumFractionDigits: 0 });
    dFmt = new Intl.DateTimeFormat(loc, { weekday: "short", day: "numeric", month: "short" });
    dateFmt = new Intl.DateTimeFormat(loc, { day: "numeric", month: "short", year: "numeric" });
    dayMonth = new Intl.DateTimeFormat(loc, { day: "numeric", month: "short" });
    monthFmt = new Intl.DateTimeFormat(loc, { month: "long", year: "numeric" });
    monthLong = new Intl.DateTimeFormat(loc, { month: "long" });
    monShort = new Intl.DateTimeFormat(loc, { month: "short" });
    wdShort = new Intl.DateTimeFormat(loc, { weekday: "short" });
    document.documentElement.lang = LANG;
  }
  setLocale();
  const pl = (n, key) => { const w = NOUN[key]; return `${nf.format(n)} ${LANG === "de" ? (n === 1 ? w[2] : w[3]) : n === 1 ? w[0] : w[1]}`; };
  const nounOnly = (n, key) => { const w = NOUN[key]; return LANG === "de" ? (n === 1 ? w[2] : w[3]) : n === 1 ? w[0] : w[1]; };
  /* Static texts in the HTML carry data-t="English|Deutsch" (also data-tp for placeholders, data-ta for aria-labels) */
  function applyStatic() {
    const pick = (v) => { const [en, de] = v.split("|"); return LANG === "de" ? de ?? en : en; };
    document.querySelectorAll("[data-t]").forEach((el) => { el.textContent = pick(el.dataset.t); });
    document.querySelectorAll("[data-tp]").forEach((el) => { el.placeholder = pick(el.dataset.tp); });
    document.querySelectorAll("[data-ta]").forEach((el) => { el.setAttribute("aria-label", pick(el.dataset.ta)); });
  }

  /* ================= Fixed data ================= */
  const GROUPS = ["Brust", "Rücken", "Schultern", "Beine", "Po", "Bizeps", "Trizeps", "Bauch", "Ganzkörper"];
  const GROUP_EN = { "Brust": "Chest", "Rücken": "Back", "Schultern": "Shoulders", "Beine": "Legs", "Po": "Glutes", "Bizeps": "Biceps", "Trizeps": "Triceps", "Bauch": "Core", "Ganzkörper": "Full body" };
  const groupName = (g) => (LANG === "de" ? g : GROUP_EN[g] || g);
  const GROUP_COLORS = { "Brust": "#FF5FA8", "Rücken": "#3FA9FF", "Schultern": "#C77DFF", "Beine": "#2EE6D6", "Po": "#FFB4A2", "Bizeps": "#FF8A3D", "Trizeps": "#F5C04A", "Bauch": "#7FD1FF", "Ganzkörper": "#D4D4D8" };
  const kindText = (k) => (k === "kg" ? T("Weight × reps", "Gewicht × Wdh.") : k === "bw" ? T("Bodyweight", "Körpergewicht") : T("Hold time", "Haltezeit"));
  const kindShort = (k) => (k === "kg" ? T("kg × reps", "kg × Wdh.") : k === "bw" ? T("bodyweight", "Körpergewicht") : T("hold time", "Haltezeit"));
  const kindHint = (k) => (k === "kg" ? T("Weight and reps per set – e.g. bench press.", "Gewicht und Wiederholungen pro Satz – z. B. Bankdrücken.")
    : k === "bw" ? T("Reps, optionally with added weight – e.g. pull-ups.", "Wiederholungen, optional mit Zusatzgewicht – z. B. Klimmzüge.")
      : T("Seconds per set – e.g. plank or handstand.", "Sekunden pro Satz – z. B. Plank oder Handstand."));
  const SPORTS = {
    gym: { en: "Gym", de: "Gym", color: "#FFE83A", ab: "Gy" },
    cali: { en: "Calisthenics", de: "Calisthenics", color: "#2EE6D6", ab: "Ca" },
    run: { en: "Running", de: "Laufen", color: "#3FA9FF", ab: "Ru", abDe: "La", types: ["Locker", "Tempo", "Intervalle", "Langer Lauf", "Wettkampf"] },
    hyrox: { en: "Hyrox", de: "Hyrox", color: "#FF8A3D", ab: "Hy", types: ["Training", "Simulation", "Wettkampf"] },
    fb: { en: "Football", de: "Fußball", color: "#30D97F", ab: "Fo", abDe: "Fu", types: ["Training", "Spiel"] },
    other: { en: "Other", de: "Sonstiges", color: "#C77DFF", ab: "Ot", abDe: "So" }
  };
  const sportName = (k) => (SPORTS[k] ? SPORTS[k][LANG] : k);
  const sportAb = (k) => (LANG === "de" && SPORTS[k].abDe) || SPORTS[k].ab;
  const TYPE_EN = { "Locker": "Easy", "Tempo": "Tempo", "Intervalle": "Intervals", "Langer Lauf": "Long run", "Wettkampf": "Race", "Training": "Training", "Simulation": "Simulation", "Spiel": "Match" };
  const typeName = (t) => (LANG === "de" ? t : TYPE_EN[t] || t);
  const isLift = (s) => s.sport === "gym" || s.sport === "cali";

  /* Built-in exercises: [key, German, English, muscle group, kind] – kind: kg = weight × reps, bw = bodyweight reps, time = seconds */
  const BASE_EX = [
    ["bench", "Bankdrücken", "Bench press", "Brust", "kg"], ["incline-bench", "Schrägbankdrücken (LH)", "Incline bench press", "Brust", "kg"], ["incline-db", "Schrägbankdrücken (KH)", "Incline dumbbell press", "Brust", "kg"],
    ["db-bench", "Bankdrücken (KH)", "Dumbbell bench press", "Brust", "kg"], ["chest-press", "Brustpresse", "Chest press", "Brust", "kg"], ["fly", "Butterfly", "Pec deck", "Brust", "kg"],
    ["cable-fly", "Kabelzug-Flys", "Cable fly", "Brust", "kg"], ["dips", "Dips", "Dips", "Trizeps", "bw"], ["pushup", "Liegestütze", "Push-ups", "Brust", "bw"],
    ["deadlift", "Kreuzheben", "Deadlift", "Rücken", "kg"], ["pullup", "Klimmzüge", "Pull-ups", "Rücken", "bw"], ["chinup", "Chin-ups", "Chin-ups", "Rücken", "bw"],
    ["latpull", "Latzug", "Lat pulldown", "Rücken", "kg"], ["bb-row", "Langhantelrudern", "Barbell row", "Rücken", "kg"], ["cable-row", "Kabelrudern", "Seated cable row", "Rücken", "kg"],
    ["db-row", "Kurzhantelrudern einarmig", "One-arm dumbbell row", "Rücken", "kg"], ["tbar-row", "T-Bar-Rudern", "T-bar row", "Rücken", "kg"], ["hyperext", "Hyperextensions", "Back extensions", "Rücken", "bw"],
    ["ohp", "Schulterdrücken (LH)", "Overhead press", "Schultern", "kg"], ["db-ohp", "Schulterdrücken (KH)", "Dumbbell shoulder press", "Schultern", "kg"], ["lat-raise", "Seitheben", "Lateral raise", "Schultern", "kg"],
    ["face-pull", "Face Pulls", "Face pulls", "Schultern", "kg"], ["rear-fly", "Reverse Butterfly", "Reverse fly", "Schultern", "kg"],
    ["squat", "Kniebeuge", "Squat", "Beine", "kg"], ["front-squat", "Frontkniebeuge", "Front squat", "Beine", "kg"], ["leg-press", "Beinpresse", "Leg press", "Beine", "kg"],
    ["rdl", "Rumänisches Kreuzheben", "Romanian deadlift", "Beine", "kg"], ["lunge", "Ausfallschritte", "Lunges", "Beine", "kg"], ["bss", "Bulgarian Split Squat", "Bulgarian split squat", "Beine", "kg"],
    ["leg-ext", "Beinstrecker", "Leg extension", "Beine", "kg"], ["leg-curl", "Beinbeuger", "Leg curl", "Beine", "kg"], ["calf", "Wadenheben", "Calf raise", "Beine", "kg"], ["goblet", "Goblet Squat", "Goblet squat", "Beine", "kg"],
    ["hip-thrust", "Hip Thrust", "Hip thrust", "Po", "kg"], ["abductor", "Abduktoren-Maschine", "Hip abduction", "Po", "kg"],
    ["bb-curl", "Bizepscurls (LH)", "Barbell curl", "Bizeps", "kg"], ["db-curl", "Bizepscurls (KH)", "Dumbbell curl", "Bizeps", "kg"], ["hammer", "Hammercurls", "Hammer curl", "Bizeps", "kg"], ["preacher", "Scottcurls", "Preacher curl", "Bizeps", "kg"],
    ["pushdown", "Trizepsdrücken am Kabel", "Triceps pushdown", "Trizeps", "kg"], ["skull", "French Press (SZ)", "Skull crusher", "Trizeps", "kg"], ["oh-tri", "Trizeps über Kopf (Kabel)", "Overhead triceps extension", "Trizeps", "kg"], ["cgbp", "Enges Bankdrücken", "Close-grip bench press", "Trizeps", "kg"],
    ["plank", "Plank", "Plank", "Bauch", "time"], ["crunch", "Crunches", "Crunches", "Bauch", "bw"], ["hang-leg", "Beinheben hängend", "Hanging leg raise", "Bauch", "bw"], ["cable-crunch", "Kabel-Crunch", "Cable crunch", "Bauch", "kg"], ["ab-wheel", "Ab Wheel", "Ab wheel", "Bauch", "bw"],
    ["wallball", "Wall Balls", "Wall balls", "Ganzkörper", "kg"], ["farmer", "Farmer's Walk", "Farmer's walk", "Ganzkörper", "kg"], ["kb-swing", "Kettlebell Swings", "Kettlebell swings", "Ganzkörper", "kg"], ["burpee", "Burpees", "Burpees", "Ganzkörper", "bw"]
  ];
  /* Calisthenics: [key, German, English, group, kind, type, progression levels [English, German] easiest first] */
  const CTYPES = [["static", "Statics", "Halte-Skills"], ["dynamic", "Dynamic skills", "Dynamische Skills"], ["basic", "Basics", "Grundübungen"]];
  const CALI_EX = [
    ["handstand", "Handstand", "Handstand", "Schultern", "time", "static", [["Chest to wall", "Brust zur Wand"], ["Back to wall", "Rücken zur Wand"], ["Freestanding", "Frei"]]],
    ["lsit", "L-Sitz", "L-sit", "Bauch", "time", "static", [["Tuck", "Gehockt"], ["One leg", "Ein Bein"], ["Full", "Voll"], ["V-sit", "V-Sitz"]]],
    ["elbow-lever", "Elbow Lever", "Elbow lever", "Bauch", "time", "static", [["Tuck", "Gehockt"], ["Straddle", "Gegrätscht"], ["Full", "Voll"], ["One arm", "Einarmig"]]],
    ["front-lever", "Front Lever", "Front lever", "Rücken", "time", "static", [["Tuck", "Gehockt"], ["Adv. tuck", "Adv. Tuck"], ["One leg", "Ein Bein"], ["Straddle", "Gegrätscht"], ["Full", "Voll"]]],
    ["back-lever", "Back Lever", "Back lever", "Rücken", "time", "static", [["Tuck", "Gehockt"], ["Adv. tuck", "Adv. Tuck"], ["Straddle", "Gegrätscht"], ["Full", "Voll"]]],
    ["planche", "Planche", "Planche", "Schultern", "time", "static", [["Lean", "Lean"], ["Tuck", "Gehockt"], ["Adv. tuck", "Adv. Tuck"], ["Straddle", "Gegrätscht"], ["Full", "Voll"]]],
    ["flag", "Human Flag", "Human flag", "Ganzkörper", "time", "static", [["Tuck", "Gehockt"], ["Straddle", "Gegrätscht"], ["Full", "Voll"]]],
    ["support", "Stütz", "Support hold", "Trizeps", "time", "static", [["Bars", "Barren"], ["Rings", "Ringe"], ["Rings turned out", "Ringe ausgedreht"]]],
    ["hollow", "Hollow Body Hold", "Hollow body hold", "Bauch", "time", "static", null],
    ["dead-hang", "Toter Hang", "Dead hang", "Rücken", "time", "static", [["Two arms", "Beidarmig"], ["One arm", "Einarmig"]]],
    ["muscle-up", "Muscle-up", "Muscle-up", "Rücken", "bw", "dynamic", [["Banded", "Mit Band"], ["Kipping", "Mit Schwung"], ["Strict (bar)", "Strikt (Stange)"], ["Rings", "Ringe"]]],
    ["pull-over", "Hüftaufschwung", "Pull-over (hip circle)", "Rücken", "bw", "dynamic", [["With swing", "Mit Schwung"], ["Strict", "Strikt"]]],
    ["hspu", "Handstand-Liegestütze", "Handstand push-ups", "Schultern", "bw", "dynamic", [["Pike", "Pike"], ["Elevated pike", "Erhöhte Pike"], ["Wall", "An der Wand"], ["Freestanding", "Frei"]]],
    ["skin-cat", "Skin the Cat", "Skin the cat", "Schultern", "bw", "dynamic", null],
    ["dragon-flag", "Dragon Flag", "Dragon flag", "Bauch", "bw", "dynamic", [["Tuck", "Gehockt"], ["One leg", "Ein Bein"], ["Full", "Voll"]]],
    ["toes-bar", "Toes to Bar", "Toes to bar", "Bauch", "bw", "dynamic", null],
    ["pistol", "Pistol Squat", "Pistol squat", "Beine", "bw", "dynamic", [["Assisted", "Assistiert"], ["To box", "Auf Box"], ["Full", "Voll"]]],
    ["one-arm-pull", "Einarmiger Klimmzug", "One-arm pull-up", "Rücken", "bw", "dynamic", [["Assisted", "Assistiert"], ["Negative", "Negativ"], ["Full", "Voll"]]],
    ["archer-pull", "Archer-Klimmzüge", "Archer pull-ups", "Rücken", "bw", "dynamic", null],
    ["pp-pushup", "Pseudo-Planche-Liegestütze", "Pseudo planche push-ups", "Brust", "bw", "dynamic", null],
    ["australian", "Australian Pull-ups", "Australian pull-ups", "Rücken", "bw", "basic", null],
    ["ring-dips", "Ring-Dips", "Ring dips", "Trizeps", "bw", "basic", null],
    ["ring-row", "Ring-Rudern", "Ring rows", "Rücken", "bw", "basic", null]
  ];
  const CALI_BASIC = ["pullup", "chinup", "dips", "pushup", "hang-leg"];

  /* ================= Helpers ================= */
  const $ = (id) => document.getElementById(id);
  const pad = (n) => String(n).padStart(2, "0");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const newId = () => "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const fold = (x) => String(x || "").toLowerCase().replace(/ß/g, "ss").normalize("NFD").replace(/[̀-ͯ]/g, "");
  const kg = (v) => `${nf.format(v)} kg`;
  const tons = (v) => (v >= 1000 ? `${nf1.format(v / 1000)} t` : `${nf0.format(v)} kg`);
  const parseNum = (raw) => { const s = String(raw ?? "").trim().replace(/\s/g, "").replace(",", "."); if (!s) return null; const v = Number(s); return Number.isFinite(v) ? v : null; };
  const fmtIn = (v) => (v == null || v === "" ? "" : LANG === "de" ? String(v).replace(".", ",") : String(v));
  const clock = (sec) => { sec = Math.max(0, Math.round(sec)); const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60; return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`; };
  const durTxt = (sec) => { const m = Math.round((sec || 0) / 60); return m < 60 ? `${m} min` : `${Math.floor(m / 60)}:${pad(m % 60)} h`; };
  const secTxt = (v) => (v >= 60 ? `${clock(v)} min` : `${nf0.format(v)} s`);
  const paceTxt = (spk) => `${clock(spk)} /km`;
  const isoDate = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
  const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayISO = () => isoOf(new Date());
  const addDays = (iso, k) => { const d = isoDate(iso); d.setDate(d.getDate() + k); return isoOf(d); };
  const addMonths = (iso, k) => { const d = isoDate(iso); d.setDate(1); d.setMonth(d.getMonth() + k); return isoOf(d); };
  const daysBetween = (a, b) => Math.round((isoDate(b) - isoDate(a)) / 864e5);
  const weekStart = (iso) => { const d = isoDate(iso); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return isoOf(d); };
  const kw = (iso) => { const d = isoDate(iso); d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7)); const w1 = new Date(d.getFullYear(), 0, 4); return 1 + Math.round(((d - w1) / 864e5 - 3 + ((w1.getDay() + 6) % 7)) / 7); };
  const nowTime = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const rel = (iso) => {
    const n = daysBetween(iso, todayISO());
    if (n <= 0) return T("today", "heute"); if (n === 1) return T("yesterday", "gestern"); if (n < 7) return T(`${n} days ago`, `vor ${n} Tagen`); if (n < 14) return T("1 week ago", "vor 1 Woche");
    if (n < 60) return T(`${Math.floor(n / 7)} weeks ago`, `vor ${Math.floor(n / 7)} Wochen`); if (n < 365) { const m = Math.round(n / 30.4); return T(`${m} months ago`, `vor ${m} Monaten`); }
    const y = Math.round(n / 365); return y === 1 ? T("1 year ago", "vor 1 Jahr") : T(`${y} years ago`, `vor ${y} Jahren`);
  };
  const dayTxt = (iso) => dFmt.format(isoDate(iso));
  const dayLabel = (iso) => { const n = daysBetween(iso, todayISO()); return n === 0 ? T("Today", "Heute") : n === 1 ? T("Yesterday", "Gestern") : dayTxt(iso); };
  const cmpAsc = (a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || ""));
  const wkLabel = (iso) => T(`Week ${kw(iso)}`, `KW ${kw(iso)}`);

  /* ================= Storage (only on this device) =================
     The data lives in IndexedDB – practically no size limit, unlike localStorage (about 5 MB in Safari).
     Older versions kept it in localStorage under pft.data.v1: it is moved over automatically on the first start.
     Meal items of built-in foods are saved as id + grams only; values come from the food list when loading. */
  const KEY = "pft.data.v1", DRAFT_KEY = "pft.draft.v1", REST_KEY = "pft.rest.v1", BACKUP_KEY = "pft.backup", OPEN_KEY = "pft.open";
  const IDB_NAME = "pft", IDB_STORE = "kv", IDB_KEY = "data";
  const blank = () => ({ sessions: [], templates: [], exercises: [], meals: [], mealTpls: [], foods: [], weights: [], settings: { rest: 90, sound: true, exOver: {}, goals: { kcal: 0, p: 0, pMode: "fixed", pPerKg: 1.8 }, hide: {} } });
  let db = blank(), draft = null, rest = null, ver = 0;
  let idb = null, storeMode = "ls", saveChain = Promise.resolve(), saveFails = 0;
  const readJSON = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
  const validSession = (s) => !!s && typeof s.id === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.date || "") && !!SPORTS[s.sport] && (!isLift(s) || Array.isArray(s.ex));
  const validWeight = (w) => !!w && /^\d{4}-\d{2}-\d{2}$/.test(w.date || "") && +w.kg > 20 && +w.kg < 400;
  function normDb(v) {
    const b = blank(), s = v && typeof v === "object" ? v : {}, st = s.settings && typeof s.settings === "object" ? s.settings : {};
    const byDay = new Map(); for (const w of Array.isArray(s.weights) ? s.weights.filter(validWeight) : []) byDay.set(w.date, { date: w.date, kg: Math.round(+w.kg * 10) / 10, ...(w.time ? { time: w.time } : {}) });
    return {
      sessions: Array.isArray(s.sessions) ? s.sessions.filter(validSession) : [],
      templates: Array.isArray(s.templates) ? s.templates.filter((t) => t && t.id && Array.isArray(t.items)) : [],
      exercises: Array.isArray(s.exercises) ? s.exercises.filter((e) => e && e.id && e.name) : [],
      meals: Array.isArray(s.meals) ? s.meals.filter((m) => m && m.id && /^\d{4}-\d{2}-\d{2}$/.test(m.date || "") && Array.isArray(m.items)).map((m) => ({ ...m, items: m.items.filter(Boolean).map(migItem) })) : [],
      mealTpls: Array.isArray(s.mealTpls) ? s.mealTpls.filter((t) => t && t.id && Array.isArray(t.items)).map((t) => ({ ...t, name: String(t.name || ""), items: t.items.filter(Boolean).map(migItem) })) : [],
      foods: Array.isArray(s.foods) ? s.foods.filter((f) => f && f.id && f.name) : [],
      weights: [...byDay.values()].sort((a, c) => a.date.localeCompare(c.date)),
      settings: { ...b.settings, ...st, exOver: { ...(st.exOver || {}) }, goals: { ...b.settings.goals, ...(st.goals || {}) }, hide: { ...(st.hide || {}) } }
    };
  }
  /* ---------- IndexedDB, wrapped in promises ---------- */
  function idbOpen() {
    return new Promise((res) => {
      let done = false; const fin = (v) => { if (!done) { done = true; res(v); } };
      try {
        if (typeof indexedDB === "undefined" || !indexedDB) return fin(null);
        const rq = indexedDB.open(IDB_NAME, 1);
        rq.onupgradeneeded = () => { try { rq.result.createObjectStore(IDB_STORE); } catch { /* exists */ } };
        rq.onsuccess = () => fin(rq.result);
        rq.onerror = () => fin(null);
        rq.onblocked = () => fin(null);
        setTimeout(() => fin(null), 5000);
      } catch { fin(null); }
    });
  }
  function idbDo(mode, fn) {
    return new Promise((res, rej) => {
      try {
        const tx = idb.transaction(IDB_STORE, mode), r = fn(tx.objectStore(IDB_STORE));
        tx.oncomplete = () => res(r ? r.result : undefined);
        tx.onerror = () => rej(tx.error || new Error("idb error"));
        tx.onabort = () => rej(tx.error || new Error("idb abort"));
      } catch (e) { rej(e); }
    });
  }
  const idbGet = (k) => idbDo("readonly", (st) => st.get(k));
  const idbPut = (k, v) => idbDo("readwrite", (st) => st.put(v, k));
  /* ---------- slim meal items ---------- */
  function packItem(it) {
    if (!it || it.i != null) return it;
    const f = FOOD_BY.get(it.id);
    if (!f || f.own || it.lost) return it;          // own foods keep their values (you may change or delete the food later)
    const o = { i: it.id, g: it.g };
    if (it.unit && it.unit !== "g") { o.q = it.qty; o.u = it.unit; }
    return o;
  }
  function unpackItem(o) {
    if (!o || o.i == null) return o;
    const f = FOOD_BY.get(o.i), g = +o.g || 0, unit = o.u || "g", qty = o.q != null ? +o.q : g;
    if (!f) return calcItem({ id: String(o.i), n: String(o.i), qty, unit, g, b: [0, 0, 0, 0], lost: 1 });
    return mkItem(f, qty, unit, g);
  }
  const packMeal = (m) => ({ ...m, items: m.items.map(packItem) });
  function packDb(d) { return { ...d, meals: d.meals.map(packMeal), mealTpls: d.mealTpls.map(packMeal) }; }
  function unpackDb(d) { for (const m of d.meals.concat(d.mealTpls)) if (m.items.some((it) => it && it.i != null)) m.items = m.items.map(unpackItem); }
  /* ---------- load + save ---------- */
  async function load() {
    idb = await idbOpen();
    let raw = null, fromLs = false;
    if (idb) { try { raw = await idbGet(IDB_KEY); storeMode = "idb"; } catch { idb = null; } }
    if (!raw) { const old = readJSON(KEY); if (old) { raw = old; fromLs = true; } }
    db = normDb(raw);
    const d = readJSON(DRAFT_KEY); if (d && Array.isArray(d.ex) && !d.editOf) { draft = d; if (!draft.sport) draft.sport = "gym"; }
    const r = readJSON(REST_KEY); if (r && r.end > Date.now() - 60000) rest = r;
    buildEx(); buildFoodIndex(); unpackDb(db); ver++;
    const upgraded = upgradeMeals();
    if (storeMode === "idb" && (fromLs || upgraded)) {
      // first start with IndexedDB: copy the data over, check it arrived, then free the old localStorage space
      try {
        await idbPut(IDB_KEY, packDb(db));
        const back = await idbGet(IDB_KEY);
        if (fromLs && back && Array.isArray(back.sessions) && back.sessions.length === db.sessions.length && back.meals.length === db.meals.length) { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
      } catch { storeMode = "ls"; }
    } else if (storeMode === "ls" && upgraded) { try { localStorage.setItem(KEY, JSON.stringify(packDb(db))); } catch { /* ignore */ } }
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch { /* not supported */ }
  }
  /* v1.1 meal items only had grams + totals → give them amount, unit and values per 100 g, so amounts can be changed later */
  function migItem(it) {
    if (it.i != null || (Array.isArray(it.b) && it.unit)) return it;   // slim item (unpacked after the food list is built) or current format
    const g = +it.g || 0, per = (v) => (g > 0 ? Math.round(((+v || 0) / g) * 1000) / 10 : 0);
    return { id: it.id, n: it.n, qty: g, unit: "g", g, b: [per(it.kcal), per(it.p), per(it.f), per(it.c)], kcal: +it.kcal || 0, p: +it.p || 0, f: +it.f || 0, c: +it.c || 0, mig: 1 };
  }
  function upgradeMeals() {
    let changed = false;
    for (const m of db.meals) {
      if (!m.items.some((it) => it.mig)) continue;
      changed = true;
      const parsed = m.text ? parseMeal(m.text, m.ov || {}).filter((r) => r.food) : [];
      const same = parsed.length === m.items.length && parsed.every((r, i) => r.food.id === m.items[i].id && Math.abs(r.g - m.items[i].g) < 0.6);
      m.items = m.items.map((it, i) => {
        if (!it.mig) return it;
        const f = FOOD_BY.get(it.id), r = same ? parsed[i] : null;
        const x = r ? itemFromParse(r) : { ...it };
        if (!r && f) x.b = [f.kcal, f.p, f.f, f.c];
        x.n = it.n || x.n; delete x.mig;
        return calcItem(x);
      });
    }
    return changed;
  }
  function saveFailed() {
    saveFails++;
    toast(T("Can't save – storage full or blocked? Make a backup in Settings.", "Speichern nicht möglich – Speicher voll oder blockiert? Bitte in „Mehr“ ein Backup sichern."));
  }
  /* writes run one after another; IndexedDB copies the data the moment it is handed over */
  function persist() {
    ver++; buildEx(); buildFoodIndex();
    const snap = packDb(db);
    if (storeMode === "idb" && idb) {
      saveChain = saveChain.then(() => idbPut(IDB_KEY, snap)).then(() => { saveFails = 0; }).catch(() => {
        try { localStorage.setItem(KEY, JSON.stringify(snap)); storeMode = "ls"; } catch { saveFailed(); }
      });
    } else {
      try { localStorage.setItem(KEY, JSON.stringify(snap)); } catch { saveFailed(); }
    }
    return saveChain;
  }
  const flushSave = () => saveChain;
  let draftTimer = 0;
  function saveDraft() { clearTimeout(draftTimer); try { if (draft && !draft.editOf) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); else if (!draft) localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ } }
  const queueDraftSave = () => { clearTimeout(draftTimer); draftTimer = setTimeout(saveDraft, 400); };
  let tplTimer = 0;
  const queuePersist = () => { clearTimeout(tplTimer); tplTimer = setTimeout(persist, 400); };
  const STANDALONE = (() => { try { return matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; } catch { return false; } })();
  const deviceName = /iPhone/.test(navigator.userAgent) ? "iPhone" : /iPad/.test(navigator.userAgent) ? "iPad" : T("device", "Gerät");

  /* ================= Exercises ================= */
  let EX = new Map();
  function buildEx() {
    EX = new Map();
    const over = db.settings.exOver || {};
    const add = (id, de, en, group, kind, extra) => { const o = over[id] || {}; EX.set(id, { id, de: o.name || de, en: o.name || en, group: GROUPS.includes(o.group) ? o.group : group, kind, base: true, ...extra }); };
    for (const [k, de, en, group, kind] of BASE_EX) add("x:" + k, de, en, group, kind, CALI_BASIC.includes(k) ? { cali: "basic" } : {});
    for (const [k, de, en, group, kind, ct, lv] of CALI_EX) add("c:" + k, de, en, group, kind, { cali: ct, lv: lv || null });
    for (const e of db.exercises) EX.set(e.id, { id: e.id, de: e.name, en: e.name, group: GROUPS.includes(e.group) ? e.group : "Ganzkörper", kind: ["kg", "bw", "time"].includes(e.kind) ? e.kind : "kg", base: false, hidden: !!e.hidden, cali: e.cali || null, lv: null });
  }
  const exOf = (id) => EX.get(id) || { id, de: "Gelöschte Übung", en: "Deleted exercise", group: "Ganzkörper", kind: "kg", missing: true };
  const exName = (x) => (LANG === "de" ? x.de : x.en);
  const lvName = (x, i) => (x.lv && x.lv[i] ? (LANG === "de" ? x.lv[i][1] : x.lv[i][0]) : "");
  const hasLv = (x) => !!(x.lv && x.lv.length);
  const lvKey = (x, lv) => (hasLv(x) ? (lv == null ? 0 : +lv) : null);
  const e1rmOf = (w, r) => (w <= 0 || r <= 0 ? 0 : r === 1 ? w : w * (1 + Math.min(r, 20) / 30));
  function exStats(e, kind) {
    let sets = 0, e1rm = 0, max = 0, vol = 0, reps = 0, total = 0, time = 0, best = null;
    for (const s of e.sets || []) {
      if (s.wu) continue;
      if (kind === "time") { const t = +s.t || 0; if (t <= 0) continue; if (s.drop) { total += t; continue; } sets++; total += t; if (t > time) { time = t; best = s; } continue; }
      const w = +s.w || 0, r = +s.r || 0;
      if (r <= 0) continue;
      total += r; vol += w * r;
      if (s.drop) continue;   // drop sets add volume, but no records and no extra set
      sets++;
      if (w > max) max = w;
      if (kind === "kg") { const est = e1rmOf(w, r); if (est > e1rm) { e1rm = est; best = s; } }
      else if (r > reps || (r === reps && best && w > +best.w)) best = s;
      if (r > reps) reps = r;
    }
    return { sets, e1rm, max, vol, reps, total, time, best };
  }
  const METRIC = {
    e1rm: { fmt: (v) => kg(Math.round(v * 2) / 2), step: 2.5 },
    max: { fmt: kg, step: 2.5 },
    vol: { fmt: tons, step: 100 },
    reps: { fmt: (v) => pl(v, "rep"), step: 1 },
    total: { fmt: (v) => pl(v, "rep"), step: 2 },
    time: { fmt: secTxt, step: 10 }
  };
  const metricsFor = (kind) => (kind === "kg" ? ["e1rm", "max", "vol"] : kind === "bw" ? ["reps", "total", "max"] : ["time"]);
  const metricLabel = (m, kind) => ({
    e1rm: "e1RM", max: kind === "bw" ? T("Added kg", "Zusatzgew.") : T("Weight", "Gewicht"), vol: T("Volume", "Volumen"), reps: T("Reps", "Wdh."), total: T("Total", "Gesamt"), time: T("Hold", "Haltezeit")
  }[m]);
  const metricLong = (m, kind) => ({
    e1rm: T("Estimated 1RM", "Geschätztes 1RM"), max: kind === "bw" ? T("Most added weight", "Höchstes Zusatzgewicht") : T("Heaviest weight", "Schwerstes Gewicht"),
    vol: T("Volume per workout", "Volumen pro Training"), reps: T("Most reps in a set", "Meiste Wdh. in einem Satz"), total: T("Reps per workout", "Wiederholungen pro Training"), time: T("Longest hold", "Längste Haltezeit")
  }[m]);
  const yfmtFor = (m) => (m === "vol" ? (v) => (v >= 1000 ? `${nf1.format(v / 1000)} t` : nf0.format(v)) : m === "time" ? (v) => (v >= 60 ? clock(v) : `${nf0.format(v)} s`) : (v) => nf.format(v));
  const setTxt = (s, kind) => (kind === "time" ? `${nf0.format(+s.t)} s` : kind === "bw" ? (+s.w ? `+${nf.format(+s.w)} kg × ${s.r}` : `${s.r} ${T("reps", "Wdh.")}`) : `${nf.format(+s.w || 0)} kg × ${s.r}`);
  function setsSummary(e, kind) {
    const w = (e.sets || []).filter((s) => !s.wu && !s.drop && (kind === "time" ? +s.t > 0 : +s.r > 0)), dr = (e.sets || []).filter((s) => s.drop && +s.r > 0);
    if (!w.length) return "–";
    if (dr.length && kind !== "time") return setsSummary({ sets: w }, kind) + ` + ${T("drop", "Drop")} ${dr.map((s) => `${nf.format(+s.w || 0)}×${s.r}`).join(", ")}`;
    if (kind === "time") return w.map((s) => nf0.format(+s.t)).join(", ") + " s";
    const ws = new Set(w.map((s) => +s.w || 0));
    if (ws.size === 1) { const x = [...ws][0]; return (kind === "bw" ? (x ? `+${nf.format(x)} kg × ` : "") : `${nf.format(x)} kg × `) + w.map((s) => s.r).join(", ") + (kind === "bw" && !x ? ` ${T("reps", "Wdh.")}` : ""); }
    return w.map((s) => (kind === "bw" ? (+s.w ? `+${nf.format(+s.w)}×${s.r}` : `${s.r}`) : `${nf.format(+s.w || 0)}×${s.r}`)).join(" · ");
  }
