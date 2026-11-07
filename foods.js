/* PFT 1.4.0 – Food parser and the built-in food list (values per 100 g). */
"use strict";
  /* ================= Foods =================
     Typical values per 100 g (liquids: per 100 ml), rounded averages from common German and US food tables.
     [id, category, German names, English names, kcal, protein, fat, carbs, unit weights in g, default unit] */
  const UNIT_ALIAS = {
    g: "g", gr: "g", gramm: "g", gram: "g", grams: "g", grm: "g", kg: "kg", kilo: "kg", ml: "ml", l: "l", liter: "l", litre: "l", liters: "l", litres: "l",
    stk: "pc", stuck: "pc", stucke: "pc", stueck: "pc", st: "pc", x: "pc", pc: "pc", pcs: "pc", piece: "pc", pieces: "pc",
    scheibe: "slice", scheiben: "slice", slice: "slice", slices: "slice",
    el: "tbsp", essloffel: "tbsp", tbsp: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp", tbs: "tbsp",
    tl: "tsp", teeloffel: "tsp", tsp: "tsp", teaspoon: "tsp", teaspoons: "tsp",
    handvoll: "hand", handful: "hand", handfuls: "hand", glas: "glass", glaser: "glass", glass: "glass", glasses: "glass",
    tasse: "cup", tassen: "cup", cup: "cup", cups: "cup", becher: "pot", pot: "pot", pots: "pot", tub: "pot", tubs: "pot",
    dose: "can", dosen: "can", can: "can", cans: "can", tin: "can", tins: "can", flasche: "bottle", flaschen: "bottle", bottle: "bottle", bottles: "bottle",
    portion: "portion", portionen: "portion", serving: "portion", servings: "portion", schale: "portion", schussel: "portion", bowl: "portion", bowls: "portion", teller: "portion", plate: "portion",
    packung: "pack", packungen: "pack", pack: "pack", packs: "pack", pck: "pack", pkg: "pack", packet: "pack", packets: "pack", paket: "pack",
    messloffel: "scoop", scoop: "scoop", scoops: "scoop", kugel: "ball", kugeln: "ball", ball: "ball", balls: "ball",
    riegel: "bar", bar: "bar", bars: "bar", tafel: "bar", tafeln: "bar"
  };
  const UNIT_TXT = {
    g: ["g", "g", "g", "g"], ml: ["ml", "ml", "ml", "ml"], pc: ["pc", "pcs", "Stk.", "Stk."], slice: ["slice", "slices", "Scheibe", "Scheiben"], tbsp: ["tbsp", "tbsp", "EL", "EL"], tsp: ["tsp", "tsp", "TL", "TL"],
    hand: ["handful", "handfuls", "Handvoll", "Handvoll"], glass: ["glass", "glasses", "Glas", "Gläser"], cup: ["cup", "cups", "Tasse", "Tassen"], pot: ["pot", "pots", "Becher", "Becher"],
    can: ["can", "cans", "Dose", "Dosen"], bottle: ["bottle", "bottles", "Flasche", "Flaschen"], portion: ["serving", "servings", "Portion", "Portionen"], pack: ["pack", "packs", "Packung", "Packungen"],
    scoop: ["scoop", "scoops", "Messlöffel", "Messlöffel"], ball: ["ball", "balls", "Kugel", "Kugeln"], bar: ["bar", "bars", "Riegel", "Riegel"]
  };
  const unitTxt = (u, n) => { const w = UNIT_TXT[u] || [u, u, u, u]; return LANG === "de" ? (n === 1 ? w[2] : w[3]) : n === 1 ? w[0] : w[1]; };
  const UNIT_FALLBACK = { pc: ["pc", "slice", "portion"], slice: ["slice", "pc"], tbsp: ["tbsp"], tsp: ["tsp"], hand: ["hand"], glass: ["glass", "cup"], cup: ["cup", "glass"], pot: ["pot", "portion"], can: ["can", "pack"], bottle: ["bottle", "can"], portion: ["portion", "pc", "pack"], pack: ["pack", "portion"], scoop: ["scoop", "ball"], ball: ["ball", "scoop", "pc"], bar: ["bar", "pc"] };
  const UNIT_GENERIC = { pc: 100, slice: 30, tbsp: 15, tsp: 5, hand: 30, glass: 200, cup: 150, pot: 150, can: 300, bottle: 500, portion: 150, pack: 200, scoop: 30, ball: 60, bar: 50 };
  const NUM_WORDS = { ein: 1, eine: 1, einen: 1, einem: 1, einer: 1, eins: 1, an: 1, one: 1, zwei: 2, two: 2, drei: 3, three: 3, vier: 4, four: 4, funf: 5, five: 5, sechs: 6, six: 6, sieben: 7, seven: 7, acht: 8, eight: 8, neun: 9, nine: 9, zehn: 10, ten: 10, zwolf: 12, twelve: 12, halb: 0.5, halbe: 0.5, halber: 0.5, halbes: 0.5, halben: 0.5, half: 0.5, viertel: 0.25, quarter: 0.25 };
  const FILLER = new Set(["mit", "with", "of", "von", "vom", "der", "die", "das", "den", "dem", "the", "ca", "etwa", "about", "approx", "circa", "some", "etwas"]);
  const stem = (w) => (w.length > 3 ? w.replace(/(en|er|e|n|s)$/, "") : w);
  const tokens = (s) => fold(s).replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w && !/^\d+$/.test(w)).map(stem);

  let FOODS = [], FOOD_BY = new Map();
  function buildFoodIndex() {
    FOODS = [];
    FOOD_DB.forEach(([id, cat, de, en, kcal, p, f, c, units, def], i) => {
      const u = {}; String(units).split(",").forEach((x) => { const [k, v] = x.split(":"); if (k) u[k] = +v; });
      const syn = de.split(",").concat(en.split(","));
      const st = syn.map((x) => tokens(x).filter((w) => !FILLER.has(w))).filter((t) => t.length);
      FOODS.push({ id, cat, de: de.split(",")[0], en: en.split(",")[0], kcal, p, f, c, u, def, rank: i, raw: st.some((t) => t.some((w) => RAW.has(w))), syn: st.map((t) => t.filter((w) => !RAW.has(w))).filter((t) => t.length) });
    });
    for (const x of db.foods) {
      const u = {}; if (x.pc > 0) u.pc = +x.pc; if (x.por > 0) u.portion = +x.por; if (x.pack > 0) u.pack = +x.pack;
      const names = [x.name].concat(x.brand ? [`${x.brand} ${x.name}`] : [], String(x.alias || "").split(",").filter((a) => a.trim()));
      const ex = ["sf", "su", "fi", "sa"].map((k) => (x[k] != null && x[k] !== "" ? +x[k] : null));
      FOODS.unshift({ id: x.id, cat: "own", de: x.name, en: x.name, brand: x.brand || "", kcal: +x.kcal || Math.round(4 * x.p + 4 * x.c + 9 * x.f), p: +x.p || 0, f: +x.f || 0, c: +x.c || 0, u, def: u.pc ? "pc" : u.portion ? "portion" : "g", rank: -1, own: true, liq: !!x.liq, code: String(x.code || x.off || ""), x: ex.some((v) => v != null) ? ex : null, syn: names.map(tokens).filter((t) => t.length) });
    }
    FOOD_BY = new Map(FOODS.map((x) => [x.id, x]));
  }
  const capFirst = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
  const foodName = (x) => capFirst(LANG === "de" ? x.de : x.en);
  const RAW = new Set(["roh", "raw", "ungekocht", "uncooked", "dry", "trock"]);
  function scoreFood(q, x) {
    let best = 0;
    const rawQ = q.some((w) => RAW.has(w));
    if (rawQ) q = q.filter((w) => !RAW.has(w));
    if (!q.length) return 0;
    const qs = q.join(" ");
    for (const s of x.syn) {
      const ss = s.join(" ");
      let sc = 0;
      if (qs === ss) sc = 100;
      else if (q.length === 1 && s.length === 1) {
        const a = q[0], b = s[0];
        if (a.startsWith(b) && b.length >= 3) sc = 82 - Math.min(26, (a.length - b.length) * 2);
        else if (b.startsWith(a) && a.length >= 3) sc = 74 - Math.min(20, (b.length - a.length) * 0.6);
        else if (a.endsWith(b) && b.length >= 4) sc = 62;
        else if (b.endsWith(a) && a.length >= 5) sc = 56;
      } else if (s.every((w) => q.some((v) => v === w || (w.length >= 3 && v.startsWith(w))))) sc = 72 + s.length * 3 - 6 * s.filter((w) => !q.includes(w)).length; // a word only matched as the start of a longer word counts less
      else if (q.every((v) => s.some((w) => w === v || (v.length >= 3 && w.startsWith(v))))) sc = x.own ? 85 : 66; // every typed word is in one of your own foods (e.g. brand + name)
      else {
        const hit = q.filter((v) => s.some((w) => w === v || (v.length >= 4 && (w.startsWith(v) || v.startsWith(w))) || (w.length >= 4 && v.endsWith(w)))).length;
        if (hit) sc = 40 + 20 * hit / Math.max(q.length, s.length);
      }
      if (sc > best) best = sc;
    }
    if (best && rawQ && x.raw) best += 25;
    return best ? best + (x.own ? 3 : 0) - x.rank * 0.001 : 0;
  }
  let lastScore = 0;
  /* "erdnuss butter", "protein riegel": also try the words written together */
  const joinedQ = (words) => (words && words.length >= 2 && words.length <= 3 ? [stem(words.join(""))] : null);
  function matchFood(q, words) {
    lastScore = 0;
    if (!q.length) return null;
    const qj = joinedQ(words);
    let best = null, bs = 0;
    for (const x of FOODS) { const s = Math.max(scoreFood(q, x), qj ? scoreFood(qj, x) : 0); if (s > bs) { bs = s; best = x; } }
    lastScore = bs;
    return bs >= 50 ? best : null;
  }
  function searchFoods(text, limit) {
    const bc = String(text || "").replace(/[\s-]/g, "");
    if (/^\d{8,14}$/.test(bc)) { const k = bc.replace(/^0+/, ""); return FOODS.filter((x) => x.own && x.code && x.code.replace(/^0+/, "") === k); } // a barcode number: only your foods with that code
    const q = tokens(text);
    if (!q.length) return FOODS.slice(0, limit || 400);
    const qj = joinedQ(fold(text).replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w && !/^\d+$/.test(w)));
    const res = FOODS.map((x) => ({ x, s: Math.max(scoreFood(q, x), qj ? scoreFood(qj, x) : 0) || (fold(foodName(x)).includes(fold(text)) ? 45 : 0) })).filter((r) => r.s > 0).sort((a, b) => b.s - a.s);
    const top = res.length ? res[0].s : 0, min = top >= 70 ? 55 : 0; // a good hit hides the loose "contains protein" matches
    return res.filter((r) => r.s >= min).slice(0, limit || 60).map((r) => r.x);
  }
  /* Split "5 eier, 2 scheiben brot\n200g hähnchen" into lines, read amount + unit + food from each */
  const chunkKey = (s) => fold(s).replace(/\s+/g, " ").trim();
  function splitMeal(text) { return String(text || "").replace(/(\d),(\d)/g, "$1.$2").split(/[\n,;]+|\s+\+\s+|\s+und\s+|\s+and\s+|\s+&\s+/i).map((s) => s.trim()).filter(Boolean); }
  function parseItem(raw, ov) {
    let s = " " + fold(raw).replace(/½/g, " 0.5 ").replace(/¼/g, " 0.25 ").replace(/¾/g, " 0.75 ") + " ";
    s = s.replace(/(\d+)\s*\/\s*(\d+)/g, (m, a, b) => ` ${(+a / +b).toFixed(3)} `);
    s = s.replace(/(\d)\s*,\s*(\d)/g, "$1.$2").replace(/(\d)([a-z])/g, "$1 $2").replace(/([a-z])(\d)/g, "$1 $2").replace(/%/g, " ");
    const toks = s.replace(/[^a-z0-9. ]+/g, " ").split(/\s+/).filter(Boolean);
    const nums = [], name = [];
    let unit = null, qty = null;
    toks.forEach((tk, i) => {
      if (/^\d+(\.\d+)?$/.test(tk)) { nums.push({ v: +tk, i }); return; }
      if (NUM_WORDS[tk] != null && (i < toks.length - 1)) { nums.push({ v: NUM_WORDS[tk], i, word: true }); return; }
      if (UNIT_ALIAS[tk] && (nums.length || i > 0) && !(tk === "x" && !nums.length)) { if (!unit) unit = { u: UNIT_ALIAS[tk], i }; return; }
      if (FILLER.has(tk)) return;
      name.push(tk);
    });
    if (!name.length && unit) { name.push(toks[unit.i]); unit = null; }
    // "protein riegel", "schoko riegel": the unit word is really the end of the food's name
    if (unit && name.length && name.length <= 2 && toks[unit.i - 1] === name[name.length - 1]) {
      const w = name.concat(toks[unit.i]); matchFood([stem(w.join(""))]);
      if (lastScore >= 99) { name.push(toks[unit.i]); unit = null; }
    }
    if (unit) { const near = nums.find((n) => n.i === unit.i - 1) || nums.find((n) => n.i < unit.i) || nums[0]; qty = near ? near.v : 1; }
    else if (nums.length) qty = nums[0].v;
    if (nums.length > 1 && !unit) qty = nums.reduce((a, n) => a * n.v, 1);
    const key = chunkKey(raw);
    const q = name.map(stem).filter((w) => w.length > 1 || name.length === 1);
    const fixed = ov && ov[key] && FOOD_BY.get(ov[key]);
    const food = fixed || matchFood(q, name.filter((w) => !FILLER.has(w)));
    const item = { raw, key, food, guess: !fixed && !!food && lastScore < 78, qtyIn: qty, unitIn: unit && unit.u, name: name.join(" ") };
    if (!food) return item;
    let u = unit ? unit.u : null, n = qty;
    if (!u) {
      if (n == null) { n = food.def === "g" ? 100 : 1; u = food.def; }
      else if (isLiq(food) && n % 1 && n < 3) u = "l";
      else if (food.def === "g") u = "g";
      else if ((food.def === "pc" || food.def === "slice") ? n <= 30 : n <= 10) u = food.def;
      else u = "g";
    }
    if (n == null) n = 1;
    let g, warn = false;
    if (u === "g" || u === "ml") g = n; else if (u === "kg" || u === "l") g = n * 1000;
    else { const ch = (UNIT_FALLBACK[u] || [u]).find((k) => food.u[k]); g = n * (ch ? food.u[ch] : UNIT_GENERIC[u] || 100); warn = !ch && !["tbsp", "tsp", "glass", "cup", "hand"].includes(u); }
    g = Math.round(g * 10) / 10;
    const k = g / 100;
    return Object.assign(item, { qty: n, unit: u, g, warn, kcal: food.kcal * k, p: food.p * k, f: food.f * k, c: food.c * k });
  }
  function parseMeal(text, ov) { return splitMeal(text).map((r) => parseItem(r, ov)); }
  const sumMacros = (list) => list.reduce((a, x) => (x.food || x.kcal != null ? { kcal: a.kcal + (x.kcal || 0), p: a.p + (x.p || 0), f: a.f + (x.f || 0), c: a.c + (x.c || 0) } : a), { kcal: 0, p: 0, f: 0, c: 0 });
  const mealsTot = (meals) => sumMacros(meals.flatMap((m) => m.items || []));
  const amountTxt = (it) => {
    if (it.g == null) return "";
    const u = it.unit;
    if (u === "g" || u === "kg") return `${nf.format(it.g)} g`;
    if (u === "ml" || u === "l") return `${nf.format(it.g)} ml`;
    return `${nf.format(it.qty)} ${unitTxt(u, it.qty)} · ${nf0.format(it.g)} g`;
  };

  /* ---------- Meal items: amount + unit you can change, macros follow proportionally ----------
     item = { id: food id, n: name, qty, unit, g: grams, w: grams per unit (pieces etc.), b: [kcal, P, F, C] per 100 g, kcal, p, f, c } */
  const r1 = (v) => Math.round(v * 10) / 10;
  const r2 = (v) => Math.round(v * 100) / 100;
  const isMass = (u) => u === "g" || u === "ml";
  const isLiq = (food) => !!food && (food.liq || food.cat === "drink" || !!(food.u.glass || food.u.bottle));
  function unitW(id, u) {
    if (isMass(u)) return 1;
    const food = FOOD_BY.get(id);
    if (food) { const ch = (UNIT_FALLBACK[u] || [u]).find((k) => food.u[k]); if (ch) return food.u[ch]; }
    return UNIT_GENERIC[u] || 100;
  }
  function calcItem(it) { const k = (+it.g || 0) / 100, b = it.b || [0, 0, 0, 0]; it.kcal = r1(b[0] * k); it.p = r1(b[1] * k); it.f = r1(b[2] * k); it.c = r1(b[3] * k); return it; }
  function mkItem(food, qty, unit, g) {
    if (unit === "kg" || unit === "l") { unit = unit === "kg" ? "g" : "ml"; qty = g; }
    const it = { id: food.id, n: foodName(food), qty: r2(qty), unit, g: r1(g), b: [food.kcal, food.p, food.f, food.c] };
    if (!isMass(unit)) it.w = qty > 0 ? g / qty : unitW(food.id, unit);
    if (food.x) it.x = food.x.slice();
    return calcItem(it);
  }
  const itemFromParse = (r) => mkItem(r.food, r.qty, r.unit, r.g);
  function setItemQty(it, q) {
    it.qty = r2(Math.max(0, q));
    it.g = r1(it.qty * (isMass(it.unit) ? 1 : it.w || unitW(it.id, it.unit)));
    return calcItem(it);
  }
  function setItemUnit(it, u) {
    if (u === it.unit) return it;
    const w = unitW(it.id, u);
    it.unit = u;
    if (isMass(u)) { delete it.w; it.qty = Math.round(it.g); }
    else { it.w = w; it.qty = r2(it.g / w); }
    return it;
  }
  /* swap the food but keep the amount: same unit if the new food has it, otherwise same grams */
  function swapItemFood(it, food) {
    const nu = isMass(it.unit) ? it.unit : (UNIT_FALLBACK[it.unit] || [it.unit]).some((k) => food.u[k]) ? it.unit : "g";
    const g = isMass(nu) ? it.g : it.qty * unitW(food.id, nu);
    return mkItem(food, isMass(nu) ? g : it.qty, nu, g);
  }
  function itemUnits(it) {
    const food = FOOD_BY.get(it.id), out = [["g", 1]];
    if (isLiq(food) || it.unit === "ml") out.push(["ml", 1]);
    if (food) Object.keys(food.u).forEach((k) => { if (UNIT_TXT[k]) out.push([k, food.u[k]]); });
    if (!out.some(([u]) => u === it.unit)) out.push([it.unit, it.w || UNIT_GENERIC[it.unit] || 100]);
    return out;
  }
  /* − / + steps: grams in sensible jumps, big pieces (apple, banana) in halves */
  function stepItem(it, dir) {
    const q = +it.qty || 0;
    let st;
    if (isMass(it.unit)) { const v = dir < 0 ? q - 0.001 : q; st = v >= 500 ? 50 : v >= 200 ? 25 : v >= 30 ? 10 : 5; }
    else st = (it.w || unitW(it.id, it.unit)) >= 80 || (q > 0 && q < 1) ? 0.5 : 1;
    let n = dir > 0 ? Math.floor(q / st + 1e-9) * st + st : Math.ceil(q / st - 1e-9) * st - st;
    if (n <= 0) n = isMass(it.unit) ? Math.min(q, 5) || 5 : st === 1 ? 0.5 : 0.25;
    return setItemQty(it, n);
  }
  const cloneItem = (it) => JSON.parse(JSON.stringify(it));
  /* sat. fat, sugar, fibre, salt – only known for own foods (from the pack) and Open Food Facts products */
  function extrasOf(items) {
    const t = [0, 0, 0, 0], have = [0, 0, 0, 0]; let n = 0;
    for (const it of items) { const x = it.x; if (!x) continue; n++; x.forEach((v, k) => { if (v != null) { t[k] += (v * (+it.g || 0)) / 100; have[k]++; } }); }
    return { n, t, have };
  }
  const extrasLine = (e) => [T("sat. fat", "ges. Fett"), T("sugar", "Zucker"), T("fibre", "Ballaststoffe"), T("salt", "Salz")].map((lab, k) => (e.have[k] ? `${lab} ${gfmt(e.t[k])}` : "")).filter(Boolean).join(" · ");

  const macroLine1 = (m) => `${T("P", "E")} ${nf1.format(m.p)} · ${T("F", "F")} ${nf1.format(m.f)} · ${T("C", "KH")} ${nf1.format(m.c)}`;
  const gfmt = (v) => `${nf.format(Math.round(v * 10) / 10)} g`;
  const macroLine = (m) => `${T("P", "E")} ${nf0.format(m.p)} · ${T("F", "F")} ${nf0.format(m.f)} · ${T("C", "KH")} ${nf0.format(m.c)}`;

  /* ================= Food database =================
     Typical values per 100 g (liquids: per 100 ml), rounded averages from common German (BLS-style) and US (USDA) food tables.
     Dishes are rough averages of typical recipes – for exact numbers add the product from its pack or search Open Food Facts.
     [id, category, German names, English names, kcal, protein, fat, carbs, unit weights in g, default unit] */
  const FOOD_CATS = [["dairy", "Eggs & dairy", "Eier & Milchprodukte"], ["bread", "Bread, cereals & baking", "Brot, Getreide & Backen"], ["sides", "Rice, pasta & potatoes", "Reis, Nudeln & Kartoffeln"],
    ["meat", "Meat & sausages", "Fleisch & Wurst"], ["fish", "Fish & seafood", "Fisch & Meeresfrüchte"], ["plant", "Plant protein", "Pflanzliches Eiweiß"], ["nuts", "Nuts, seeds & fats", "Nüsse, Samen & Fette"], ["fruit", "Fruit", "Obst"],
    ["veg", "Vegetables", "Gemüse"], ["sweet", "Sweets & snacks", "Süßes & Snacks"], ["sauce", "Spreads & sauces", "Aufstriche & Soßen"], ["drink", "Drinks", "Getränke"], ["dish", "Dishes", "Gerichte"], ["own", "My foods", "Eigene Lebensmittel"]];
  const FOOD_DB = [
    /* ---- eggs & dairy ---- */
    ["egg", "dairy", "Ei,Eier,Hühnerei,Rührei,Spiegelei,gekochtes Ei,Frühstücksei", "egg,eggs,boiled egg,scrambled eggs,fried egg", 143, 12.6, 9.5, 0.7, "pc:55", "pc"],
    ["eggwhite", "dairy", "Eiklar,Eiweiß,Eiweiß vom Ei,Flüssigei-Eiweiß", "egg white,egg whites,liquid egg white", 48, 10.5, 0.2, 0.7, "pc:33", "pc"],
    ["eggyolk", "dairy", "Eigelb,Eidotter", "egg yolk,egg yolks", 322, 16, 27, 0.6, "pc:18", "pc"],
    ["milk15", "dairy", "Milch,Milch 1.5,fettarme Milch,laktosefreie Milch,H-Milch", "milk,low-fat milk,semi-skimmed milk,lactose-free milk", 47, 3.4, 1.5, 4.8, "glass:200,cup:150", "glass"],
    ["milk35", "dairy", "Vollmilch,Frischmilch", "whole milk,full-fat milk", 64, 3.3, 3.5, 4.8, "glass:200,cup:150", "glass"],
    ["milk01", "dairy", "Magermilch,entrahmte Milch", "skimmed milk,skim milk,fat-free milk", 35, 3.4, 0.1, 4.9, "glass:200,cup:150", "glass"],
    ["buttermilk", "dairy", "Buttermilch", "buttermilk", 37, 3.5, 0.5, 4, "glass:200", "glass"],
    ["kefir", "dairy", "Kefir,Dickmilch", "kefir,sour milk", 60, 3.4, 3.5, 4, "glass:200,bottle:500", "glass"],
    ["ayran", "dairy", "Ayran,Joghurtdrink", "ayran,yogurt drink", 35, 1.7, 1.8, 2.6, "glass:250", "glass"],
    ["proteindrink", "dairy", "Proteindrink,Proteinshake fertig,Proteinmilch,Eiweißdrink", "protein drink,ready to drink protein shake,protein milk", 55, 7.6, 0.5, 4, "bottle:330,glass:250", "bottle"],
    ["skyr", "dairy", "Skyr,Skyr natur", "skyr,plain skyr", 63, 11, 0.2, 4, "pot:150,tbsp:30", "pot"],
    ["skyrflav", "dairy", "Skyr Vanille,Skyr Frucht,Skyr Erdbeere,Skyr Heidelbeere", "flavoured skyr,vanilla skyr,fruit skyr", 78, 9.5, 0.2, 9, "pot:150", "pot"],
    ["quark", "dairy", "Magerquark,Quark", "low-fat quark,quark", 67, 12, 0.3, 4, "pack:250,tbsp:30", "pack"],
    ["quark40", "dairy", "Sahnequark,Speisequark", "full-fat quark,cream quark", 145, 11, 10, 3.5, "pack:250,tbsp:30", "pack"],
    ["herbquark", "dairy", "Kräuterquark,Quarkdip", "herb quark,quark dip", 110, 9, 6, 3.5, "tbsp:30", "tbsp"],
    ["yogurt", "dairy", "Joghurt,Naturjoghurt", "yogurt,yoghurt,natural yogurt,plain yogurt", 66, 3.8, 3.5, 4.6, "pot:150,tbsp:20", "pot"],
    ["yogurt15", "dairy", "Joghurt fettarm,Magerjoghurt,Joghurt 1.5", "low-fat yogurt,skim yogurt", 48, 4.3, 1.5, 4.5, "pot:150,tbsp:20", "pot"],
    ["fruityogurt", "dairy", "Fruchtjoghurt,Erdbeerjoghurt,Vanillejoghurt", "fruit yogurt,flavoured yogurt,strawberry yogurt", 95, 3.5, 2.8, 14, "pot:150", "pot"],
    ["greek", "dairy", "Griechischer Joghurt", "greek yogurt,greek yoghurt", 122, 4.5, 10, 4, "pot:150,tbsp:20", "pot"],
    ["greek0", "dairy", "Griechischer Joghurt 0,Griechischer Joghurt fettarm,Proteinjoghurt", "greek yogurt 0,fat-free greek yogurt,protein yogurt", 57, 10, 0.2, 3.5, "pot:170", "pot"],
    ["soyyogurt", "dairy", "Sojajoghurt,veganer Joghurt,Haferjoghurt", "soy yogurt,soya yogurt,vegan yogurt,oat yogurt", 50, 4, 2.2, 2.5, "portion:150,tbsp:20", "portion"],
    ["proteinpudding", "dairy", "Proteinpudding,Eiweißpudding,High Protein Pudding", "protein pudding,high protein pudding", 77, 10, 1.5, 5.5, "pot:200", "pot"],
    ["pudding", "dairy", "Pudding,Schokopudding,Vanillepudding,Grießpudding", "pudding,chocolate pudding,vanilla pudding,custard", 105, 3.2, 3, 16, "pot:125", "pot"],
    ["ricepudding", "dairy", "Milchreis", "rice pudding", 110, 3.5, 2.5, 18, "pot:200,portion:250", "pot"],
    ["cottage", "dairy", "Hüttenkäse,Körniger Frischkäse", "cottage cheese", 98, 12, 4.3, 2.6, "pot:200,tbsp:30", "pot"],
    ["creamcheese", "dairy", "Frischkäse,Doppelrahmfrischkäse", "cream cheese", 245, 5.5, 23, 3, "tbsp:20", "tbsp"],
    ["creamcheeselight", "dairy", "Frischkäse leicht,Frischkäse light,Körniger Frischkäse light", "light cream cheese,low-fat cream cheese", 135, 9, 9, 4, "tbsp:20", "tbsp"],
    ["gouda", "dairy", "Gouda,Käse,Scheibenkäse,Hartkäse jung", "gouda,cheese,cheese slice", 356, 25, 27.4, 0, "slice:20", "slice"],
    ["gouda30", "dairy", "Käse light,fettreduzierter Käse,Käse 30", "light cheese,reduced-fat cheese", 270, 30, 16, 0, "slice:20", "slice"],
    ["emmental", "dairy", "Emmentaler,Bergkäse,Leerdammer,Appenzeller", "emmental,swiss cheese,mountain cheese", 380, 28, 30, 0, "slice:20", "slice"],
    ["edam", "dairy", "Edamer,Butterkäse,Tilsiter", "edam,butter cheese", 330, 25, 25, 0, "slice:20", "slice"],
    ["cheddar", "dairy", "Cheddar", "cheddar", 400, 25, 33, 1.3, "slice:20", "slice"],
    ["gratedcheese", "dairy", "Reibekäse,geriebener Käse,Pizzakäse,Streukäse", "grated cheese,shredded cheese,pizza cheese", 350, 26, 27, 0, "portion:30,hand:30,tbsp:8", "portion"],
    ["mozzarella", "dairy", "Mozzarella", "mozzarella", 250, 18, 19, 1, "pc:125,ball:125,slice:20", "pc"],
    ["mozzalight", "dairy", "Mozzarella light", "light mozzarella", 165, 19, 9.5, 1, "pc:125,ball:125", "pc"],
    ["feta", "dairy", "Feta,Schafskäse,Hirtenkäse", "feta", 264, 14, 21, 4, "pack:200,portion:50", "portion"],
    ["parmesan", "dairy", "Parmesan,Grana Padano", "parmesan,grana padano", 392, 35.8, 25.8, 0, "tbsp:7", "tbsp"],
    ["halloumi", "dairy", "Halloumi,Grillkäse", "halloumi,grilling cheese", 320, 22, 25, 2, "slice:30,pack:225", "slice"],
    ["camembert", "dairy", "Camembert,Brie", "camembert,brie", 300, 20, 24, 0.5, "slice:25,pc:125", "slice"],
    ["goatcheese", "dairy", "Ziegenkäse,Ziegenfrischkäse", "goat cheese,goat's cheese", 290, 19, 23, 1, "slice:25", "slice"],
    ["harzer", "dairy", "Harzer Käse,Harzer,Handkäse,Sauermilchkäse", "harzer cheese,sour milk cheese", 125, 28, 0.7, 0, "pc:25", "pc"],
    ["ricotta", "dairy", "Ricotta", "ricotta", 150, 9, 11, 3.5, "tbsp:25", "tbsp"],
    ["mascarpone", "dairy", "Mascarpone", "mascarpone", 450, 4.5, 47, 3.5, "tbsp:20", "tbsp"],
    ["cheesespread", "dairy", "Schmelzkäse,Streichkäse,Käsedreieck,Scheiblettenkäse", "processed cheese,cheese spread,cheese slices (processed)", 270, 13, 22, 5, "pc:17,slice:20,tbsp:20", "pc"],
    ["butter", "dairy", "Butter", "butter", 741, 0.7, 83, 0.6, "tbsp:12,tsp:5,portion:10", "portion"],
    ["margarine", "dairy", "Margarine,Pflanzenmargarine", "margarine,plant butter", 720, 0.2, 80, 0.4, "tbsp:12,tsp:5,portion:10", "portion"],
    ["ghee", "dairy", "Ghee,Butterschmalz", "ghee,clarified butter", 900, 0, 99.8, 0, "tbsp:12,tsp:4", "tbsp"],
    ["cream", "dairy", "Sahne,Schlagsahne", "cream,heavy cream,whipping cream", 292, 2.4, 30, 3.1, "tbsp:15", "tbsp"],
    ["cookingcream", "dairy", "Kochsahne,Cremefine,Cuisine", "cooking cream,light cream", 160, 3, 15, 4, "tbsp:15", "tbsp"],
    ["sourcream", "dairy", "Saure Sahne,Sauerrahm", "sour cream", 115, 3, 10, 3.5, "tbsp:15", "tbsp"],
    ["cremefraiche", "dairy", "Schmand,Crème fraîche,Creme fraiche", "creme fraiche,crème fraîche", 270, 2.5, 28, 3, "tbsp:15", "tbsp"],
    ["coffeecream", "dairy", "Kaffeesahne,Kondensmilch", "coffee creamer,evaporated milk,half and half", 125, 4, 9, 7, "portion:10,tbsp:15", "portion"],
    ["whey", "dairy", "Whey,Protein,Proteinpulver,Eiweißpulver,Proteinshake,Eiweißshake,Shake", "whey,protein,protein powder,protein shake,shake", 380, 75, 6, 7, "scoop:30,portion:30", "scoop"],
    ["casein", "dairy", "Casein,Caseinpulver,Mehrkomponentenprotein", "casein,casein powder,protein blend", 360, 78, 2, 5, "scoop:30,portion:30", "scoop"],
    ["veganprotein", "dairy", "Veganes Proteinpulver,Erbsenprotein,Reisprotein,Sojaprotein", "vegan protein powder,pea protein,rice protein,soy protein", 380, 75, 6, 5, "scoop:30,portion:30", "scoop"],
    /* ---- bread, cereals & baking ---- */
    ["toast", "bread", "Toast,Toastbrot,Weißbrot,Sandwichtoast", "toast,white bread,toast bread,sandwich bread", 265, 8, 3.5, 49, "slice:25", "slice"],
    ["wholetoast", "bread", "Vollkorntoast", "wholemeal toast,whole wheat toast", 245, 9, 4, 42, "slice:28", "slice"],
    ["wholebread", "bread", "Vollkornbrot,Schwarzbrot,Roggenbrot,Roggenvollkornbrot", "wholegrain bread,rye bread,whole grain bread,brown bread", 210, 7, 1.5, 39, "slice:50", "slice"],
    ["pumpernickel", "bread", "Pumpernickel", "pumpernickel", 190, 5.5, 1, 38, "slice:40", "slice"],
    ["bread", "bread", "Brot,Mischbrot,Graubrot,Bauernbrot,Sauerteigbrot,Landbrot", "bread,sourdough,sourdough bread,farmhouse bread", 230, 7, 1.3, 45, "slice:45", "slice"],
    ["speltbread", "bread", "Dinkelbrot,Dinkelvollkornbrot,Körnerbrot,Mehrkornbrot", "spelt bread,multigrain bread,seeded bread", 235, 8.5, 3.5, 40, "slice:45", "slice"],
    ["proteinbread", "bread", "Eiweißbrot,Proteinbrot,Low Carb Brot", "protein bread,low carb bread", 270, 24, 15, 7, "slice:40", "slice"],
    ["roll", "bread", "Brötchen,Semmel,Weizenbrötchen,Schrippe,Weckle", "roll,bread roll,bun,white roll", 270, 9, 1.5, 54, "pc:55", "pc"],
    ["wholeroll", "bread", "Vollkornbrötchen,Körnerbrötchen,Mehrkornbrötchen,Roggenbrötchen,Dinkelbrötchen", "wholegrain roll,seeded roll,multigrain roll,rye roll,spelt roll", 250, 10, 4.5, 41, "pc:65", "pc"],
    ["pretzel", "bread", "Brezel,Laugenbrezel,Breze", "pretzel,soft pretzel", 270, 8, 2.5, 52, "pc:80", "pc"],
    ["laugen", "bread", "Laugenbrötchen,Laugenstange,Laugenecke,Laugencroissant", "pretzel roll,pretzel bun,pretzel stick", 280, 9, 4, 52, "pc:75", "pc"],
    ["ciabatta", "bread", "Ciabatta,Focaccia", "ciabatta,focaccia", 260, 9, 3.5, 48, "slice:30,pc:80", "slice"],
    ["baguette", "bread", "Baguette,Stangenweißbrot", "baguette,french bread", 260, 8.5, 1.5, 51, "slice:30,pc:250", "slice"],
    ["flatbread", "bread", "Fladenbrot,Pita,Pitabrot,Naan,Lavash", "flatbread,pita,pita bread,naan", 275, 9, 1.5, 55, "pc:80,slice:60", "pc"],
    ["wrap", "bread", "Wrap,Tortilla,Weizentortilla", "wrap,tortilla,flour tortilla", 300, 8, 7, 50, "pc:60", "pc"],
    ["bagel", "bread", "Bagel", "bagel", 260, 10, 1.6, 50, "pc:85", "pc"],
    ["brioche", "bread", "Brioche,Milchbrötchen,Rosinenbrötchen,Hefezopf", "brioche,milk roll,raisin bun,sweet bread", 350, 8.5, 11, 53, "pc:45,slice:40", "pc"],
    ["croissant", "bread", "Croissant,Buttercroissant", "croissant", 410, 8, 22, 44, "pc:60", "pc"],
    ["crispbread", "bread", "Knäckebrot", "crispbread,rye crispbread", 350, 9, 1.5, 66, "slice:10,pc:10", "slice"],
    ["zwieback", "bread", "Zwieback", "rusk,zwieback", 400, 10, 5, 74, "pc:10", "pc"],
    ["ricecake", "bread", "Reiswaffel,Reiswaffeln", "rice cake,rice cakes", 390, 8, 3, 81, "pc:8", "pc"],
    ["corncake", "bread", "Maiswaffel,Maiswaffeln", "corn cake,corn cakes", 380, 8, 2.5, 80, "pc:7", "pc"],
    ["crackers", "bread", "Cracker,Kräcker,Butterkräcker", "crackers,cracker", 470, 9, 18, 66, "pc:5,hand:30", "pc"],
    ["oats", "bread", "Haferflocken,Hafer,Zarte Haferflocken,Kernige Haferflocken", "oats,rolled oats,oatmeal,porridge oats", 372, 13.5, 7, 58.7, "tbsp:10,cup:90,portion:50", "portion"],
    ["oatbran", "bread", "Haferkleie", "oat bran", 345, 17, 7, 48, "tbsp:8", "tbsp"],
    ["porridge", "bread", "Porridge,Haferbrei,Haferschleim", "porridge,cooked oatmeal", 100, 4.5, 2.5, 13.5, "portion:300", "portion"],
    ["muesli", "bread", "Müsli,Früchtemüsli,Bircher Müsli", "muesli,bircher muesli", 365, 10, 6.5, 60, "portion:50,cup:100", "portion"],
    ["granola", "bread", "Granola,Knuspermüsli,Crunchy Müsli", "granola,crunchy muesli", 450, 9, 17, 63, "portion:50", "portion"],
    ["cornflakes", "bread", "Cornflakes", "cornflakes,corn flakes", 375, 7, 0.9, 84, "portion:30,cup:30", "portion"],
    ["chococereal", "bread", "Schoko-Cerealien,Schokomüsli,Frühstücksflocken,Cerealien,Smacks", "chocolate cereal,cereal,breakfast cereal,cocoa puffs", 390, 8, 4, 80, "portion:30", "portion"],
    ["puffedrice", "bread", "Puffreis,gepuffter Amaranth", "puffed rice,puffed amaranth", 380, 7, 2, 84, "portion:30,cup:15", "portion"],
    ["pancakes", "bread", "Pfannkuchen,Eierkuchen,Pancakes,Crêpes,Palatschinken", "pancakes,pancake,crepe,crepes", 220, 7, 9, 27, "pc:60", "pc"],
    ["waffle", "bread", "Waffel,Waffeln,Herzwaffel", "waffle,waffles", 320, 7, 15, 38, "pc:60", "pc"],
    ["flour", "bread", "Mehl,Weizenmehl,Mehl 405", "flour,wheat flour,all-purpose flour,plain flour", 340, 10, 1, 71, "tbsp:10,cup:120", "tbsp"],
    ["wholeflour", "bread", "Vollkornmehl,Dinkelmehl,Roggenmehl", "wholemeal flour,whole wheat flour,spelt flour,rye flour", 330, 12, 2.4, 60, "tbsp:10,cup:120", "tbsp"],
    ["cornstarch", "bread", "Speisestärke,Maisstärke", "cornstarch,corn starch,cornflour", 350, 0.3, 0.1, 86, "tbsp:10,tsp:3", "tbsp"],
    ["breadcrumbs", "bread", "Paniermehl,Semmelbrösel", "breadcrumbs", 360, 11, 2, 73, "tbsp:10", "tbsp"],
    ["semolina", "bread", "Grieß,Hartweizengrieß,Weichweizengrieß", "semolina", 340, 11, 1, 70, "tbsp:12", "tbsp"],
    ["cocoapowder", "bread", "Kakaopulver,Backkakao,Kakao entölt", "cocoa powder,baking cocoa", 360, 20, 21, 11, "tbsp:6,tsp:3", "tbsp"],
    ["yeast", "bread", "Hefe,Trockenhefe", "yeast,dry yeast", 330, 40, 7, 25, "tsp:3,pack:7", "pack"],
    /* ---- rice, pasta & potatoes ---- */
    ["rice", "sides", "Reis,Reis gekocht,Basmatireis,Jasminreis,Langkornreis,Sushireis", "rice,cooked rice,basmati rice,jasmine rice,white rice,sushi rice", 130, 2.7, 0.3, 28, "portion:200,cup:160", "portion"],
    ["riceraw", "sides", "Reis roh,Reis ungekocht,Basmatireis roh", "rice raw,uncooked rice,dry rice,dry basmati", 350, 7, 0.6, 78, "portion:75,cup:185", "portion"],
    ["brownrice", "sides", "Vollkornreis,Naturreis,brauner Reis", "brown rice,wholegrain rice", 123, 2.7, 1, 25, "portion:200", "portion"],
    ["brownriceraw", "sides", "Vollkornreis roh,Naturreis roh", "brown rice dry,uncooked brown rice", 350, 7.5, 2.5, 72, "portion:75", "portion"],
    ["pasta", "sides", "Nudeln,Pasta,Spaghetti,Penne,Fusilli,Tagliatelle,Makkaroni,Nudeln gekocht", "pasta,spaghetti,penne,fusilli,noodles,macaroni,cooked pasta", 155, 5.8, 0.9, 30, "portion:250", "portion"],
    ["pastaraw", "sides", "Nudeln roh,Nudeln ungekocht,Pasta roh,Spaghetti roh,Penne roh", "pasta dry,dry pasta,uncooked pasta,dry spaghetti,dry penne", 355, 12.5, 1.5, 71, "portion:100", "portion"],
    ["wholepasta", "sides", "Vollkornnudeln,Vollkornpasta,Vollkornspaghetti", "wholewheat pasta,whole grain pasta,wholemeal pasta", 145, 6, 1.1, 27, "portion:250", "portion"],
    ["wholepastaraw", "sides", "Vollkornnudeln roh,Vollkornpasta roh", "wholewheat pasta dry,dry whole grain pasta", 350, 14, 2.5, 64, "portion:100", "portion"],
    ["proteinpasta", "sides", "Proteinnudeln,Linsennudeln,Kichererbsennudeln", "protein pasta,lentil pasta,chickpea pasta", 345, 22, 3, 52, "portion:80", "portion"],
    ["ricenoodles", "sides", "Reisnudeln,Glasnudeln", "rice noodles,glass noodles,vermicelli", 110, 1.8, 0.2, 25, "portion:200", "portion"],
    ["eggnoodles", "sides", "Mie-Nudeln,Eiernudeln,Asianudeln,Ramen-Nudeln,Udon", "egg noodles,ramen noodles,chinese noodles,udon", 140, 4.5, 1.5, 27, "portion:200", "portion"],
    ["spaetzle", "sides", "Spätzle,Knöpfle", "spaetzle,egg dumplings", 160, 5.5, 2, 30, "portion:250", "portion"],
    ["tortellini", "sides", "Tortellini,Ravioli,gefüllte Nudeln", "tortellini,ravioli,filled pasta", 200, 8, 5, 30, "portion:250", "portion"],
    ["gnocchi", "sides", "Gnocchi,Schupfnudeln", "gnocchi,potato noodles", 150, 4, 0.5, 32, "portion:250", "portion"],
    ["couscous", "sides", "Couscous", "couscous", 112, 3.8, 0.2, 23, "portion:200", "portion"],
    ["couscousraw", "sides", "Couscous roh,Couscous trocken", "couscous dry,dry couscous", 360, 12.8, 1.9, 72, "portion:70", "portion"],
    ["bulgur", "sides", "Bulgur", "bulgur", 83, 3.1, 0.2, 17, "portion:200", "portion"],
    ["bulgurraw", "sides", "Bulgur roh,Bulgur trocken", "bulgur dry", 345, 12, 1.5, 68, "portion:70", "portion"],
    ["quinoa", "sides", "Quinoa", "quinoa", 120, 4.4, 1.9, 19, "portion:185", "portion"],
    ["quinoaraw", "sides", "Quinoa roh,Quinoa trocken", "quinoa dry,dry quinoa", 368, 14, 6, 58, "portion:70", "portion"],
    ["millet", "sides", "Hirse", "millet", 119, 3.5, 1, 23, "portion:200", "portion"],
    ["milletraw", "sides", "Hirse roh,Hirseflocken", "millet dry,millet flakes", 360, 11, 4, 69, "portion:60", "portion"],
    ["polenta", "sides", "Polenta", "polenta", 70, 1.6, 0.3, 15, "portion:250", "portion"],
    ["polentaraw", "sides", "Polenta roh,Maisgrieß", "polenta dry,cornmeal", 350, 8.5, 1.5, 74, "portion:60", "portion"],
    ["buckwheat", "sides", "Buchweizen", "buckwheat", 92, 3.4, 0.6, 19.9, "portion:200", "portion"],
    ["potato", "sides", "Kartoffel,Kartoffeln,Salzkartoffeln,Pellkartoffeln,Ofenkartoffel", "potato,potatoes,boiled potatoes,baked potato,jacket potato", 72, 2, 0.1, 15.6, "pc:120,portion:250", "pc"],
    ["sweetpotato", "sides", "Süßkartoffel,Süßkartoffeln", "sweet potato,sweet potatoes,yam", 86, 1.6, 0.1, 20, "pc:200", "pc"],
    ["mashed", "sides", "Kartoffelpüree,Kartoffelbrei,Stampf", "mashed potatoes,mash,potato puree", 90, 2, 3.5, 13, "portion:200", "portion"],
    ["friedpotatoes", "sides", "Bratkartoffeln", "fried potatoes,home fries,sauteed potatoes", 150, 2.5, 7, 18, "portion:200", "portion"],
    ["fries", "sides", "Pommes,Pommes frites,Fritten", "fries,french fries", 290, 3.4, 15, 35, "portion:150", "portion"],
    ["ovenfries", "sides", "Ofenpommes,Backofen-Pommes", "oven fries,oven chips", 170, 2.8, 5, 27, "portion:150", "portion"],
    ["sweetfries", "sides", "Süßkartoffelpommes", "sweet potato fries", 200, 2, 9, 27, "portion:150", "portion"],
    ["wedges", "sides", "Kartoffelspalten,Wedges,Potato Wedges", "potato wedges,wedges", 160, 2.5, 6, 23, "portion:150", "portion"],
    ["croquettes", "sides", "Kroketten", "croquettes,potato croquettes", 190, 3, 8, 26, "pc:25,portion:150", "portion"],
    ["roesti", "sides", "Rösti,Kartoffelpuffer,Reibekuchen", "hash browns,rosti,potato pancakes,latkes", 200, 2.8, 10, 24, "pc:70", "pc"],
    ["dumplings", "sides", "Knödel,Kartoffelknödel,Kloß,Klöße,Semmelknödel", "dumplings,potato dumplings,bread dumplings", 140, 3.5, 2, 26, "pc:90", "pc"],
    /* ---- meat & sausages ---- */
    ["chicken", "meat", "Hähnchenbrust,Hähnchen,Hühnchen,Hähnchenbrustfilet,Hühnerbrust,Chicken,Hähnchenfilet,Hähnchengeschnetzeltes", "chicken breast,chicken,chicken fillet", 110, 23, 1.5, 0, "pc:150,portion:150", "pc"],
    ["chickencooked", "meat", "Hähnchenbrust gebraten,Hähnchen gebraten,Hähnchen gegrillt,Grillhähnchen,Brathähnchen", "cooked chicken breast,grilled chicken,roast chicken,rotisserie chicken", 165, 31, 3.6, 0, "pc:120,portion:150", "pc"],
    ["chickenthigh", "meat", "Hähnchenschenkel,Hähnchenkeule,Hühnerschenkel,Chicken Drumsticks", "chicken thigh,chicken leg,drumstick,drumsticks", 200, 18, 14, 0, "pc:150", "pc"],
    ["chickenwings", "meat", "Chicken Wings,Hähnchenflügel", "chicken wings,wings", 230, 19, 17, 0, "pc:35", "pc"],
    ["nuggets", "meat", "Chicken Nuggets,Nuggets,Hähnchennuggets,Chicken Crossies", "chicken nuggets,nuggets,chicken tenders", 270, 15, 16, 17, "pc:18", "pc"],
    ["turkey", "meat", "Putenbrust,Pute,Putenschnitzel,Putenfilet,Putengeschnetzeltes", "turkey breast,turkey,turkey fillet", 105, 24, 1, 0, "pc:150", "pc"],
    ["turkeymince", "meat", "Putenhack,Hähnchenhack,Geflügelhack", "turkey mince,ground turkey,ground chicken,chicken mince", 150, 20, 8, 0, "portion:125", "portion"],
    ["beefmince", "meat", "Rinderhack,Hackfleisch,Hack,Rinderhackfleisch", "ground beef,beef mince,minced beef,mince", 211, 19, 15, 0, "portion:125,pack:500", "portion"],
    ["leanmince", "meat", "Rinderhack mager,Tatar,Beefsteakhack,Rindertatar", "lean ground beef,lean mince,steak tartare", 125, 21, 4.5, 0, "portion:125", "portion"],
    ["mixmince", "meat", "Gemischtes Hack,Gemischtes Hackfleisch,Halb und Halb", "mixed mince,beef and pork mince", 260, 17, 21, 0, "portion:125", "portion"],
    ["porkmince", "meat", "Schweinehack,Mett,Schweinemett", "pork mince,ground pork", 260, 17, 21, 0, "portion:125", "portion"],
    ["steak", "meat", "Steak,Rindersteak,Rumpsteak,Hüftsteak,Rindfleisch,Entrecote,Ribeye", "steak,beef steak,rump steak,beef,sirloin,ribeye", 135, 22, 5, 0, "pc:200", "pc"],
    ["beeffilet", "meat", "Rinderfilet,Rinderlende,Filetsteak", "beef fillet,tenderloin,filet mignon", 120, 21, 4, 0, "pc:200", "pc"],
    ["goulashmeat", "meat", "Gulaschfleisch,Rindergulasch roh,Schmorfleisch", "stewing beef,beef stew meat,braising steak", 130, 20, 5.5, 0, "portion:150", "portion"],
    ["roastbeef", "meat", "Roastbeef,Rinderbraten", "roast beef,pot roast", 130, 22, 4.5, 0.5, "slice:25,portion:150", "slice"],
    ["pork", "meat", "Schweineschnitzel,Schweinefleisch,Schweinelende,Schweinefilet", "pork,pork loin,pork tenderloin,pork cutlet", 120, 22, 3.5, 0, "pc:150", "pc"],
    ["porkchop", "meat", "Kotelett,Schweinekotelett,Schweinenacken,Nackensteak,Schweinebraten", "pork chop,pork neck,pork steak,roast pork", 200, 19, 14, 0, "pc:180", "pc"],
    ["porkbelly", "meat", "Schweinebauch,Bauchfleisch,Krustenbraten", "pork belly,crackling roast", 330, 16, 30, 0, "slice:100", "slice"],
    ["schnitzel", "meat", "Schnitzel,Wiener Schnitzel,Schnitzel paniert,paniertes Schnitzel", "schnitzel,breaded schnitzel,breaded cutlet,wiener schnitzel", 230, 17, 12, 13, "pc:150", "pc"],
    ["cordonbleu", "meat", "Cordon bleu", "cordon bleu", 250, 18, 14, 12, "pc:180", "pc"],
    ["frikadelle", "meat", "Frikadelle,Bulette,Fleischpflanzerl,Hackbällchen,Fleischbällchen", "meatball,meatballs,burger patty,beef patty", 240, 15, 17, 7, "pc:80", "pc"],
    ["gyros", "meat", "Gyros,Gyrosfleisch,Kebabfleisch,Dönerfleisch", "gyros,kebab meat,doner meat", 220, 20, 15, 2, "portion:150", "portion"],
    ["lamb", "meat", "Lamm,Lammfleisch,Lammkotelett,Lammkeule", "lamb,lamb chop,leg of lamb", 230, 18, 17, 0, "portion:150", "portion"],
    ["duck", "meat", "Ente,Entenbrust", "duck,duck breast", 200, 19, 13, 0, "pc:200", "pc"],
    ["liver", "meat", "Leber,Rinderleber,Hühnerleber", "liver,beef liver,chicken liver", 130, 20, 4, 4, "portion:125", "portion"],
    ["ham", "meat", "Kochschinken,Schinken,Putenaufschnitt,Aufschnitt,Hähnchenbrustaufschnitt,Putenbrustaufschnitt", "ham,cooked ham,turkey slices,cold cuts,chicken slices", 110, 20, 3, 1, "slice:20", "slice"],
    ["rawham", "meat", "roher Schinken,Schwarzwälder Schinken,Serrano,Parmaschinken,Prosciutto,Rohschinken,Bündnerfleisch", "cured ham,serrano ham,prosciutto,parma ham,air-dried beef", 250, 27, 16, 0.5, "slice:15", "slice"],
    ["bacon", "meat", "Bacon,Speck,Frühstücksspeck,Schinkenspeck", "bacon,bacon rashers,streaky bacon", 330, 16, 30, 0.5, "slice:12", "slice"],
    ["lardons", "meat", "Speckwürfel,Schinkenwürfel,Pancetta", "diced bacon,lardons,pancetta", 300, 17, 26, 0.5, "portion:50,pack:125", "portion"],
    ["salami", "meat", "Salami,Cervelatwurst,Kaminwurz", "salami,cervelat", 380, 22, 32, 1, "slice:10", "slice"],
    ["chorizo", "meat", "Chorizo,Peperoniwurst,Pfefferbeißer,Landjäger,Kabanos", "chorizo,pepperoni,beef jerky stick", 455, 24, 38, 2, "slice:8,pc:50", "slice"],
    ["lyoner", "meat", "Fleischwurst,Lyoner,Mortadella,Bierschinken,Jagdwurst", "bologna,mortadella,lyoner,luncheon meat", 280, 13, 25, 0.5, "slice:15", "slice"],
    ["leberkaese", "meat", "Leberkäse,Fleischkäse", "leberkaese,bavarian meat loaf", 300, 12, 28, 0.5, "slice:100", "slice"],
    ["liverwurst", "meat", "Leberwurst,Teewurst,Mettwurst,Streichwurst", "liver sausage,liverwurst,spreadable sausage", 320, 14, 29, 1, "portion:25,tbsp:20", "portion"],
    ["sausage", "meat", "Wiener,Würstchen,Wiener Würstchen,Bockwurst,Frankfurter,Wurst,Geflügelwürstchen", "sausage,frankfurter,hot dog sausage,wiener", 270, 13, 24, 0.5, "pc:50", "pc"],
    ["bratwurst", "meat", "Bratwurst,Rostbratwurst,Nürnberger,Grillwurst", "bratwurst,grilled sausage,bbq sausage", 300, 14, 27, 0.5, "pc:100", "pc"],
    ["weisswurst", "meat", "Weißwurst,Weisswurst", "weisswurst,white sausage", 270, 11, 25, 0.5, "pc:80", "pc"],
    ["jerky", "meat", "Beef Jerky,Trockenfleisch", "beef jerky,jerky", 290, 45, 6, 12, "pack:50,portion:25", "portion"],
    /* ---- fish & seafood ---- */
    ["salmon", "fish", "Lachs,Lachsfilet,Lachsforelle", "salmon,salmon fillet", 208, 20, 13, 0, "pc:125", "pc"],
    ["smokedsalmon", "fish", "Räucherlachs,Graved Lachs,Stremellachs", "smoked salmon,gravlax", 160, 21, 8.5, 0, "slice:20,pack:100", "slice"],
    ["tuna", "fish", "Thunfisch,Thunfisch Dose,Thunfisch im eigenen Saft", "tuna,canned tuna,tuna can,tuna in water", 116, 26, 1, 0, "can:140", "can"],
    ["tunaoil", "fish", "Thunfisch in Öl", "tuna in oil", 200, 25, 11, 0, "can:140", "can"],
    ["tunasteak", "fish", "Thunfischsteak", "tuna steak", 110, 24, 1, 0, "pc:150", "pc"],
    ["whitefish", "fish", "Kabeljau,Seelachs,Fischfilet,Alaska-Seelachs,Dorsch,Schellfisch", "cod,pollock,white fish,fish fillet,haddock", 80, 18, 0.7, 0, "pc:125", "pc"],
    ["pangasius", "fish", "Pangasius,Tilapia,Seehecht,Zander,Rotbarsch,Scholle", "pangasius,tilapia,hake,pike-perch,plaice", 85, 17, 1.5, 0, "pc:125", "pc"],
    ["trout", "fish", "Forelle,Forellenfilet,Saibling", "trout,char", 110, 20, 3, 0, "pc:125", "pc"],
    ["seabream", "fish", "Dorade,Wolfsbarsch,Branzino", "sea bream,sea bass,dorade", 120, 20, 4.5, 0, "pc:200", "pc"],
    ["mackerel", "fish", "Makrele,Räuchermakrele", "mackerel,smoked mackerel", 220, 19, 16, 0, "pc:150,portion:100", "portion"],
    ["herring", "fish", "Hering,Matjes,Bismarckhering,Brathering,Rollmops", "herring,pickled herring,matjes", 210, 17, 15, 2, "pc:60,portion:100", "pc"],
    ["sardines", "fish", "Sardinen,Ölsardinen", "sardines", 210, 24, 12, 0, "can:90", "can"],
    ["shrimp", "fish", "Garnelen,Shrimps,Krabben,Scampi,Gambas,Nordseekrabben", "shrimp,prawns,king prawns", 99, 24, 0.3, 0.2, "portion:100,pc:12", "portion"],
    ["squid", "fish", "Tintenfisch,Calamari,Oktopus,Pulpo", "squid,calamari,octopus", 92, 16, 1.4, 3, "portion:150", "portion"],
    ["friedcalamari", "fish", "Calamari fritti,frittierte Calamari,Tintenfischringe paniert", "fried calamari,breaded squid rings", 200, 12, 9, 17, "portion:150", "portion"],
    ["mussels", "fish", "Muscheln,Miesmuscheln,Venusmuscheln", "mussels,clams", 86, 12, 2.2, 3.7, "portion:150", "portion"],
    ["surimi", "fish", "Surimi,Krebsfleisch-Imitat", "surimi,crab sticks,imitation crab", 95, 7.5, 0.5, 15, "pc:17", "pc"],
    ["fishsticks", "fish", "Fischstäbchen", "fish sticks,fish fingers", 200, 12, 9, 17, "pc:30", "pc"],
    ["battered", "fish", "Backfisch,Fisch paniert,Schlemmerfilet,Bordelaise", "battered fish,breaded fish,fish fillet bordelaise", 220, 13, 12, 16, "pc:150", "pc"],
    /* ---- plant protein ---- */
    ["tofu", "plant", "Tofu,Räuchertofu,Naturtofu", "tofu,smoked tofu,firm tofu", 125, 13.5, 7.5, 1.5, "pack:200", "pack"],
    ["silkentofu", "plant", "Seidentofu", "silken tofu", 55, 5, 2.7, 1.5, "portion:150", "portion"],
    ["tempeh", "plant", "Tempeh", "tempeh", 190, 19, 11, 6, "portion:100", "portion"],
    ["seitan", "plant", "Seitan", "seitan,wheat gluten", 140, 25, 2, 5, "portion:100", "portion"],
    ["tvp", "plant", "Sojaschnetzel,Sojagranulat,Sojahack trocken", "textured soy protein,tvp,soy chunks,soy mince dry", 340, 50, 1.5, 20, "portion:50", "portion"],
    ["veggiemince", "plant", "veganes Hack,Veggie-Hack,pflanzliches Hack,Sojahack", "plant-based mince,vegan mince,meatless crumbles", 200, 18, 11, 5, "portion:125", "portion"],
    ["veggieburger", "plant", "Veggie-Burger,Gemüsebratling,vegetarisches Patty,veganer Burger", "veggie burger,plant-based burger,meatless patty,vegan burger patty", 230, 17, 15, 6, "pc:110", "pc"],
    ["veggienuggets", "plant", "vegane Nuggets,Veggie Nuggets,vegetarische Schnitzel", "vegan nuggets,veggie nuggets,vegetarian schnitzel", 230, 14, 11, 17, "pc:20,portion:150", "pc"],
    ["falafel", "plant", "Falafel", "falafel", 330, 13, 18, 28, "pc:20", "pc"],
    ["edamame", "plant", "Edamame,Sojabohnen", "edamame,soybeans", 125, 12, 5.2, 4.5, "portion:100,hand:50", "portion"],
    ["lentils", "plant", "Linsen,Linsen gekocht,Tellerlinsen", "lentils,cooked lentils", 100, 7.5, 0.5, 13, "can:265,portion:150", "portion"],
    ["lentilsraw", "plant", "Linsen roh,Linsen trocken,rote Linsen,Berglinsen,Belugalinsen", "lentils dry,dry lentils,red lentils,beluga lentils", 340, 24, 1.5, 50, "portion:60", "portion"],
    ["chickpeas", "plant", "Kichererbsen", "chickpeas,garbanzo beans", 120, 7, 2.5, 15, "can:265,portion:150", "portion"],
    ["chickpeasraw", "plant", "Kichererbsen roh,Kichererbsen getrocknet", "chickpeas dry,dried chickpeas", 330, 19, 6, 44, "portion:60", "portion"],
    ["beans", "plant", "Kidneybohnen,Bohnen,weiße Bohnen,Cannellini,Baked Beans", "kidney beans,beans,white beans,cannellini,baked beans", 100, 7, 0.5, 13, "can:250,portion:150", "portion"],
    ["blackbeans", "plant", "Schwarze Bohnen", "black beans", 95, 6.5, 0.4, 13, "can:240,portion:150", "portion"],
    ["hummus", "plant", "Hummus,Humus", "hummus", 260, 7, 20, 11, "tbsp:20", "tbsp"],
    /* ---- nuts, seeds & fats ---- */
    ["almonds", "nuts", "Mandeln", "almonds", 580, 21, 50, 6, "hand:30,pc:1.2", "hand"],
    ["walnuts", "nuts", "Walnüsse,Walnuss", "walnuts", 654, 15, 65, 7, "hand:30", "hand"],
    ["hazelnuts", "nuts", "Haselnüsse,Haselnuss", "hazelnuts,hazelnut", 645, 15, 61, 6, "hand:30", "hand"],
    ["peanuts", "nuts", "Erdnüsse,Erdnusskerne", "peanuts", 590, 26, 49, 9, "hand:30", "hand"],
    ["cashews", "nuts", "Cashews,Cashewkerne", "cashews,cashew nuts", 570, 18, 44, 27, "hand:30", "hand"],
    ["pistachios", "nuts", "Pistazien", "pistachios", 590, 20, 46, 18, "hand:30", "hand"],
    ["macadamia", "nuts", "Macadamia,Macadamianüsse", "macadamia nuts,macadamias", 720, 8, 76, 5, "hand:30", "hand"],
    ["brazilnuts", "nuts", "Paranüsse,Paranuss", "brazil nuts", 680, 14, 67, 4, "hand:30,pc:4", "hand"],
    ["pecans", "nuts", "Pekannüsse", "pecans,pecan nuts", 700, 9, 72, 4, "hand:30", "hand"],
    ["pinenuts", "nuts", "Pinienkerne", "pine nuts", 670, 14, 68, 4, "tbsp:10", "tbsp"],
    ["nuts", "nuts", "Nüsse,Nussmischung,Nusskernmischung", "nuts,mixed nuts", 620, 18, 56, 9, "hand:30", "hand"],
    ["trailmix", "nuts", "Studentenfutter", "trail mix", 480, 13, 30, 38, "hand:30", "hand"],
    ["peanutbutter", "nuts", "Erdnussbutter,Erdnussmus", "peanut butter", 600, 25, 50, 12, "tbsp:15,tsp:5", "tbsp"],
    ["nutbutter", "nuts", "Mandelmus,Mandelbutter,Nussmus,Cashewmus,Haselnussmus", "almond butter,nut butter,cashew butter,hazelnut butter", 620, 22, 53, 9, "tbsp:15,tsp:5", "tbsp"],
    ["tahini", "nuts", "Tahini,Tahin,Sesampaste,Sesammus", "tahini,sesame paste", 600, 18, 54, 10, "tbsp:15", "tbsp"],
    ["chia", "nuts", "Chiasamen,Chia", "chia seeds,chia", 490, 21, 31, 2, "tbsp:12", "tbsp"],
    ["flax", "nuts", "Leinsamen,Leinsamen geschrotet", "flaxseed,linseed,ground flaxseed", 510, 24, 31, 2, "tbsp:10", "tbsp"],
    ["pumpkinseeds", "nuts", "Kürbiskerne", "pumpkin seeds,pepitas", 560, 30, 49, 5, "tbsp:10,hand:30", "tbsp"],
    ["sunflowerseeds", "nuts", "Sonnenblumenkerne", "sunflower seeds", 580, 21, 49, 12, "tbsp:10", "tbsp"],
    ["sesame", "nuts", "Sesam,Sesamsamen", "sesame,sesame seeds", 570, 18, 50, 10, "tbsp:9,tsp:3", "tbsp"],
    ["hempseeds", "nuts", "Hanfsamen,Hanfsamen geschält", "hemp seeds,hemp hearts", 570, 31, 49, 4, "tbsp:10", "tbsp"],
    ["coconutflakes", "nuts", "Kokosraspeln,Kokosflocken,Kokoschips", "desiccated coconut,coconut flakes,coconut chips", 660, 6.5, 64, 7, "tbsp:6", "tbsp"],
    ["oil", "nuts", "Olivenöl,Öl,Rapsöl,Sonnenblumenöl,Leinöl,Walnussöl,Sesamöl,Bratöl", "olive oil,oil,rapeseed oil,canola oil,sunflower oil,linseed oil,sesame oil", 884, 0, 100, 0, "tbsp:10,tsp:4", "tbsp"],
    ["coconutoil", "nuts", "Kokosöl,Kokosfett", "coconut oil", 900, 0, 100, 0, "tbsp:12,tsp:4", "tbsp"],
    ["avocado", "nuts", "Avocado,Avocados", "avocado,avocados", 160, 2, 15, 1.9, "pc:140", "pc"],
    /* ---- fruit ---- */
    ["banana", "fruit", "Banane,Bananen", "banana,bananas", 93, 1.1, 0.3, 20, "pc:120", "pc"],
    ["apple", "fruit", "Apfel,Äpfel", "apple,apples", 54, 0.3, 0.2, 11.4, "pc:150", "pc"],
    ["pear", "fruit", "Birne,Birnen", "pear,pears", 55, 0.4, 0.3, 12.4, "pc:170", "pc"],
    ["orange", "fruit", "Orange,Orangen,Apfelsine,Blutorange", "orange,oranges,blood orange", 47, 1, 0.2, 9.4, "pc:150", "pc"],
    ["mandarin", "fruit", "Mandarine,Mandarinen,Clementine,Clementinen", "mandarin,tangerine,clementine,clementines", 50, 0.8, 0.3, 10, "pc:70", "pc"],
    ["grapefruit", "fruit", "Grapefruit,Pampelmuse", "grapefruit", 38, 0.8, 0.1, 8, "pc:300", "pc"],
    ["lemon", "fruit", "Zitrone,Limette,Zitronensaft,Limettensaft", "lemon,lime,lemon juice,lime juice", 30, 0.7, 0.3, 3, "pc:60,tbsp:15", "pc"],
    ["berries", "fruit", "Beeren,Beerenmix,TK-Beeren,Waldbeeren", "berries,mixed berries,frozen berries,forest fruits", 50, 0.8, 0.4, 9.5, "hand:80,portion:125,cup:140", "hand"],
    ["blueberries", "fruit", "Heidelbeeren,Blaubeeren", "blueberries", 57, 0.7, 0.3, 12, "hand:80,portion:125", "hand"],
    ["raspberries", "fruit", "Himbeeren", "raspberries", 43, 1.3, 0.3, 4.8, "hand:80,portion:125", "hand"],
    ["blackberries", "fruit", "Brombeeren", "blackberries", 43, 1.4, 0.5, 5, "hand:80", "hand"],
    ["currants", "fruit", "Johannisbeeren,Stachelbeeren", "currants,redcurrants,gooseberries", 45, 1.1, 0.2, 7, "hand:80", "hand"],
    ["strawberries", "fruit", "Erdbeeren,Erdbeere", "strawberries,strawberry", 32, 0.7, 0.3, 5.5, "pc:15,hand:80,portion:150", "portion"],
    ["cherries", "fruit", "Kirschen,Kirsche,Sauerkirschen", "cherries,cherry,sour cherries", 63, 1, 0.3, 14, "hand:100,pc:6", "hand"],
    ["grapes", "fruit", "Weintrauben,Trauben", "grapes", 69, 0.7, 0.2, 16, "hand:80", "hand"],
    ["kiwi", "fruit", "Kiwi,Kiwis", "kiwi,kiwis,kiwifruit", 51, 1, 0.6, 10, "pc:75", "pc"],
    ["mango", "fruit", "Mango", "mango", 60, 0.8, 0.4, 13, "pc:250", "pc"],
    ["pineapple", "fruit", "Ananas", "pineapple", 55, 0.5, 0.1, 12, "slice:80", "slice"],
    ["papaya", "fruit", "Papaya", "papaya", 40, 0.5, 0.1, 9, "portion:150", "portion"],
    ["apricot", "fruit", "Aprikose,Aprikosen,Marille", "apricot,apricots", 48, 1, 0.4, 9, "pc:45", "pc"],
    ["peach", "fruit", "Pfirsich,Pfirsiche,Nektarine,Nektarinen", "peach,peaches,nectarine", 41, 0.9, 0.2, 8.9, "pc:130", "pc"],
    ["plum", "fruit", "Pflaume,Pflaumen,Zwetschge,Zwetschgen", "plum,plums", 47, 0.7, 0.2, 10, "pc:40", "pc"],
    ["watermelon", "fruit", "Wassermelone", "watermelon", 30, 0.6, 0.2, 7.5, "slice:250", "slice"],
    ["melon", "fruit", "Honigmelone,Melone,Cantaloupe,Galiamelone", "melon,honeydew,cantaloupe", 36, 0.7, 0.1, 8.5, "slice:200", "slice"],
    ["pomegranate", "fruit", "Granatapfel,Granatapfelkerne", "pomegranate,pomegranate seeds", 80, 1.7, 1.2, 15, "portion:100", "portion"],
    ["fig", "fruit", "Feige,Feigen", "fig,figs", 70, 1.3, 0.4, 15, "pc:50", "pc"],
    ["passionfruit", "fruit", "Maracuja,Passionsfrucht", "passion fruit", 75, 2.4, 0.4, 13, "pc:20", "pc"],
    ["lychee", "fruit", "Litschi,Litschis", "lychee,lychees", 66, 0.8, 0.4, 15, "pc:10", "pc"],
    ["dates", "fruit", "Datteln,Dattel,Medjool", "dates,date,medjool", 285, 2.5, 0.4, 67, "pc:8", "pc"],
    ["raisins", "fruit", "Rosinen,Sultaninen", "raisins,sultanas", 300, 2.5, 0.5, 68, "tbsp:12,hand:30", "tbsp"],
    ["driedfruit", "fruit", "Trockenobst,Trockenfrüchte,getrocknete Aprikosen,getrocknete Feigen,Softaprikosen", "dried fruit,dried apricots,dried figs", 260, 3, 0.5, 58, "hand:30,pc:8", "hand"],
    ["cranberries", "fruit", "Cranberries,getrocknete Cranberries", "dried cranberries,cranberries,craisins", 330, 0.1, 1.4, 80, "tbsp:12,hand:30", "tbsp"],
    ["applesauce", "fruit", "Apfelmus,Apfelmark", "applesauce,apple sauce,apple puree", 75, 0.2, 0.1, 18, "portion:100,tbsp:20", "portion"],
    ["fruitsalad", "fruit", "Obstsalat", "fruit salad", 55, 0.7, 0.2, 12, "portion:200", "portion"],
    /* ---- vegetables ---- */
    ["broccoli", "veg", "Brokkoli,Broccoli", "broccoli", 34, 2.8, 0.4, 4, "portion:200", "portion"],
    ["cauliflower", "veg", "Blumenkohl,Karfiol", "cauliflower", 25, 2, 0.3, 2.8, "portion:200", "portion"],
    ["brussels", "veg", "Rosenkohl", "brussels sprouts", 43, 3.4, 0.3, 5, "portion:200", "portion"],
    ["kale", "veg", "Grünkohl", "kale", 45, 4.3, 0.9, 2.5, "portion:200", "portion"],
    ["cabbage", "veg", "Weißkohl,Kohl,Spitzkohl,Rotkohl,Blaukraut,Wirsing", "cabbage,white cabbage,red cabbage,savoy cabbage", 27, 1.3, 0.2, 4.3, "portion:150", "portion"],
    ["sauerkraut", "veg", "Sauerkraut", "sauerkraut", 20, 1.5, 0.3, 0.8, "portion:150", "portion"],
    ["chinesecabbage", "veg", "Chinakohl,Pak Choi,Mangold", "chinese cabbage,napa cabbage,bok choy,chard", 13, 1.2, 0.2, 1.3, "portion:150", "portion"],
    ["kohlrabi", "veg", "Kohlrabi", "kohlrabi", 27, 1.9, 0.1, 3.7, "pc:250", "pc"],
    ["spinach", "veg", "Spinat,Blattspinat,Babyspinat", "spinach,baby spinach", 23, 2.9, 0.4, 1.4, "portion:150,hand:30", "portion"],
    ["salad", "veg", "Salat,Blattsalat,Kopfsalat,Rucola,Eisbergsalat,Feldsalat,Römersalat,Salatmix", "salad,lettuce,rocket,arugula,mixed salad,lambs lettuce,romaine", 15, 1.3, 0.2, 1.5, "portion:80,hand:30", "portion"],
    ["tomato", "veg", "Tomate,Tomaten,Rispentomaten", "tomato,tomatoes,vine tomatoes", 18, 0.9, 0.2, 2.6, "pc:100", "pc"],
    ["cherrytomato", "veg", "Cherrytomaten,Kirschtomaten,Cherrytomate,Cocktailtomaten", "cherry tomatoes,cherry tomato,cocktail tomatoes", 18, 0.9, 0.2, 2.6, "pc:15,hand:80", "pc"],
    ["cannedtomatoes", "veg", "gehackte Tomaten,Dosentomaten,Pizzatomaten,Tomaten Dose,stückige Tomaten", "canned tomatoes,chopped tomatoes,diced tomatoes,tinned tomatoes", 22, 1.2, 0.2, 3.5, "can:400", "can"],
    ["tomatopaste", "veg", "Tomatenmark", "tomato paste,tomato puree concentrate", 80, 4.5, 0.5, 13, "tbsp:15", "tbsp"],
    ["sundried", "veg", "getrocknete Tomaten", "sun-dried tomatoes,sundried tomatoes", 210, 5, 14, 12, "tbsp:15,pc:6", "tbsp"],
    ["cucumber", "veg", "Gurke,Salatgurke,Minigurke", "cucumber,mini cucumber", 12, 0.6, 0.1, 2, "pc:400", "pc"],
    ["pickles", "veg", "Gewürzgurken,Essiggurken,Cornichons", "pickles,gherkins,cornichons", 20, 0.5, 0.2, 4, "pc:30", "pc"],
    ["pepper", "veg", "Paprika,Spitzpaprika", "bell pepper,pepper,peppers,capsicum", 31, 1, 0.3, 4.5, "pc:150", "pc"],
    ["chili", "veg", "Chili,Chilischote,Peperoni,Jalapeño,Jalapenos", "chili,chili pepper,jalapeno,jalapenos", 40, 1.9, 0.4, 7, "pc:15", "pc"],
    ["onion", "veg", "Zwiebel,Zwiebeln,rote Zwiebel,Schalotte", "onion,onions,red onion,shallot", 40, 1.1, 0.1, 7.6, "pc:80", "pc"],
    ["springonion", "veg", "Frühlingszwiebel,Frühlingszwiebeln,Lauchzwiebel", "spring onion,spring onions,scallion,green onion", 32, 1.8, 0.2, 5, "pc:15", "pc"],
    ["leek", "veg", "Lauch,Porree", "leek,leeks", 31, 1.5, 0.3, 5, "portion:100,pc:200", "portion"],
    ["garlic", "veg", "Knoblauch,Knoblauchzehe,Knoblauchzehen", "garlic,garlic clove,garlic cloves", 150, 6.4, 0.5, 30, "pc:4", "pc"],
    ["ginger", "veg", "Ingwer", "ginger", 80, 1.8, 0.8, 16, "pc:10,tsp:3", "pc"],
    ["carrot", "veg", "Karotte,Karotten,Möhre,Möhren,Rüebli", "carrot,carrots", 36, 0.9, 0.2, 7, "pc:80", "pc"],
    ["parsnip", "veg", "Pastinake,Pastinaken,Petersilienwurzel", "parsnip,parsnips,parsley root", 75, 1.2, 0.3, 13, "pc:150", "pc"],
    ["beetroot", "veg", "Rote Bete,Rote Beete,Rote Rüben", "beetroot,beets", 43, 1.6, 0.2, 8.5, "portion:150,pc:100", "portion"],
    ["celery", "veg", "Sellerie,Knollensellerie,Staudensellerie,Stangensellerie", "celery,celeriac", 18, 1, 0.2, 2.5, "portion:100,pc:40", "portion"],
    ["fennel", "veg", "Fenchel", "fennel", 31, 1.2, 0.2, 3, "pc:250", "pc"],
    ["radish", "veg", "Radieschen,Rettich", "radishes,radish,daikon", 16, 0.7, 0.1, 2, "hand:60,pc:10", "hand"],
    ["zucchini", "veg", "Zucchini", "zucchini,courgette", 17, 1.2, 0.3, 2.2, "pc:200", "pc"],
    ["eggplant", "veg", "Aubergine,Auberginen", "eggplant,aubergine", 24, 1.2, 0.2, 2.5, "pc:300", "pc"],
    ["pumpkin", "veg", "Kürbis,Hokkaido,Butternut,Butternusskürbis", "pumpkin,squash,butternut squash,hokkaido", 45, 1.4, 0.3, 9, "portion:200", "portion"],
    ["asparagus", "veg", "Spargel,grüner Spargel", "asparagus,green asparagus", 20, 2.2, 0.1, 2, "portion:250,pc:20", "portion"],
    ["greenbeans", "veg", "Grüne Bohnen,Brechbohnen,Prinzessbohnen,Stangenbohnen", "green beans,string beans,french beans", 32, 2, 0.2, 5, "portion:150", "portion"],
    ["snowpeas", "veg", "Zuckerschoten,Kaiserschoten", "snow peas,sugar snap peas,mangetout", 42, 2.8, 0.2, 4.5, "portion:100", "portion"],
    ["peas", "veg", "Erbsen,TK-Erbsen", "peas,green peas,frozen peas", 81, 5.4, 0.4, 9, "portion:100", "portion"],
    ["corn", "veg", "Mais,Zuckermais,Maiskolben", "corn,sweetcorn,corn on the cob", 80, 2.5, 1.2, 14, "can:140,portion:70,pc:150", "portion"],
    ["mushrooms", "veg", "Champignons,Pilze,Kräuterseitlinge,Pfifferlinge,Shiitake", "mushrooms,button mushrooms,oyster mushrooms,chanterelles,shiitake", 22, 3.1, 0.3, 0.6, "portion:150,pc:20", "portion"],
    ["olives", "veg", "Oliven,grüne Oliven,schwarze Oliven,Kalamata", "olives,green olives,black olives,kalamata", 145, 1, 15, 1, "pc:4,hand:40", "pc"],
    ["veggies", "veg", "Gemüse,Gemüsemischung,Pfannengemüse,Wokgemüse,Grillgemüse,Ofengemüse", "vegetables,veggies,mixed vegetables,stir-fry vegetables,roasted vegetables", 35, 2, 0.3, 5, "portion:200", "portion"],
    /* ---- sweets & snacks ---- */
    ["sugar", "sweet", "Zucker,Rohrzucker,brauner Zucker", "sugar,brown sugar,cane sugar", 400, 0, 0, 100, "tsp:4,tbsp:12", "tsp"],
    ["darkchoc", "sweet", "Zartbitterschokolade,Bitterschokolade,Zartbitter,Edelbitter", "dark chocolate,bittersweet chocolate", 580, 8, 42, 34, "pc:5,bar:100", "pc"],
    ["milkchoc", "sweet", "Schokolade,Vollmilchschokolade,Milchschokolade,Nussschokolade", "chocolate,milk chocolate,nut chocolate", 535, 7.5, 30, 57, "pc:5,bar:100", "pc"],
    ["chocobar", "sweet", "Schokoriegel,Erdnussriegel,Snickers,Mars,Twix,Bounty,Milky Way", "chocolate bar,candy bar,snickers,mars bar,twix,bounty", 480, 7, 23, 60, "bar:50", "bar"],
    ["waferbar", "sweet", "Waffelriegel,KitKat,Knoppers,Duplo,Hanuta", "wafer bar,kitkat,wafer", 520, 7, 28, 58, "bar:40", "bar"],
    ["proteinbar", "sweet", "Proteinriegel,Eiweißriegel", "protein bar", 360, 33, 13, 28, "bar:60,pc:60", "bar"],
    ["muesbar", "sweet", "Müsliriegel,Haferriegel,Energieriegel,Fruchtschnitte", "granola bar,cereal bar,oat bar,energy bar,flapjack", 420, 7, 15, 62, "bar:25", "bar"],
    ["gummies", "sweet", "Gummibärchen,Fruchtgummi,Gummibären,Haribo,Weingummi", "gummy bears,gummies,gummy candy,wine gums", 340, 6.5, 0.2, 77, "hand:30,pc:2.3", "hand"],
    ["licorice", "sweet", "Lakritz,Lakritze,Lakritzschnecken", "licorice,liquorice", 360, 4, 0.5, 82, "hand:30,pc:5", "hand"],
    ["marshmallows", "sweet", "Marshmallows,Schaumzucker", "marshmallows", 320, 2, 0.2, 80, "pc:7", "pc"],
    ["candy", "sweet", "Bonbons,Süßigkeiten,Kaubonbons", "candy,sweets,hard candy", 390, 0.5, 2, 93, "pc:5", "pc"],
    ["cookie", "sweet", "Keks,Kekse,Cookies,Haferkekse", "cookie,cookies,biscuit,biscuits,oat cookies", 480, 6, 20, 68, "pc:10", "pc"],
    ["butterbiscuit", "sweet", "Butterkeks,Butterkekse,Löffelbiskuit", "butter biscuit,shortbread,butter cookies,ladyfingers", 450, 7, 13, 73, "pc:8", "pc"],
    ["chocbiscuit", "sweet", "Schokokeks,Schokokekse,Oreo,Doppelkekse,Schokoladenkekse", "chocolate cookie,chocolate biscuit,oreo,sandwich cookie", 480, 5, 20, 68, "pc:11", "pc"],
    ["chocricecake", "sweet", "Schoko-Reiswaffel,Reiswaffel Schoko,Schokoreiswaffel", "chocolate rice cake", 480, 6, 22, 64, "pc:16", "pc"],
    ["crisps", "sweet", "Chips,Kartoffelchips,Paprikachips", "crisps,potato chips,chips (snack)", 540, 6, 34, 50, "hand:25,pack:175", "hand"],
    ["tortillachips", "sweet", "Tortilla Chips,Nachos,Tortillachips,Maischips", "tortilla chips,nachos,corn chips", 490, 7, 24, 60, "hand:30,pack:200", "hand"],
    ["pretzelsticks", "sweet", "Salzstangen,Salzbrezeln,Laugengebäck,Snackbrezeln", "pretzel sticks,salted pretzels,mini pretzels", 380, 10, 4, 74, "hand:30", "hand"],
    ["peanutflips", "sweet", "Erdnussflips,Flips", "peanut puffs,peanut flips", 530, 13, 32, 46, "hand:25", "hand"],
    ["popcorn", "sweet", "Popcorn", "popcorn", 470, 8, 20, 60, "portion:30,hand:15", "portion"],
    ["icecream", "sweet", "Eis,Speiseeis,Eiscreme,Softeis", "ice cream,soft serve", 210, 3.5, 11, 24, "ball:60,scoop:60", "ball"],
    ["proteinicecream", "sweet", "Proteineis,Eiweißeis", "protein ice cream,high protein ice cream", 85, 8, 2, 9, "portion:250,ball:60", "portion"],
    ["frozenyogurt", "sweet", "Frozen Yogurt,Joghurteis,Wassereis,Sorbet", "frozen yogurt,froyo,sorbet,ice lolly", 130, 3, 2.5, 24, "ball:60,portion:150", "ball"],
    ["cake", "sweet", "Kuchen,Rührkuchen,Marmorkuchen,Sandkuchen", "cake,pound cake,sponge cake,marble cake", 380, 5.5, 18, 48, "slice:80,pc:80", "slice"],
    ["fruitcake", "sweet", "Obstkuchen,Apfelkuchen,Pflaumenkuchen,Streuselkuchen", "fruit cake,apple cake,crumble cake,fruit tart", 250, 3.5, 10, 36, "slice:120", "slice"],
    ["cheesecake", "sweet", "Käsekuchen,Cheesecake", "cheesecake", 250, 7, 13, 26, "slice:120", "slice"],
    ["creamcake", "sweet", "Torte,Sahnetorte,Schwarzwälder Kirschtorte,Tortenstück", "cream cake,gateau,black forest cake", 300, 4.5, 18, 30, "slice:130", "slice"],
    ["strudel", "sweet", "Apfelstrudel,Strudel,Apfeltasche", "apple strudel,strudel,apple turnover", 250, 3, 11, 34, "pc:150", "pc"],
    ["donut", "sweet", "Donut,Berliner,Krapfen", "donut,doughnut,jam doughnut", 400, 6, 22, 45, "pc:65", "pc"],
    ["muffin", "sweet", "Muffin,Muffins,Cupcake", "muffin,muffins,cupcake", 400, 5.5, 20, 48, "pc:90", "pc"],
    ["brownie", "sweet", "Brownie,Brownies", "brownie,brownies", 430, 5, 22, 54, "pc:60", "pc"],
    ["pastry", "sweet", "Zimtschnecke,Franzbrötchen,Plunder,Schokocroissant,Nussschnecke,Teilchen", "cinnamon roll,danish pastry,pain au chocolat,pastry", 380, 6, 17, 50, "pc:90", "pc"],
    ["tiramisu", "sweet", "Tiramisu,Mousse au Chocolat,Dessert", "tiramisu,chocolate mousse,dessert", 280, 5, 17, 27, "portion:150", "portion"],
    ["jelly", "sweet", "Götterspeise,Wackelpudding", "jelly,jello", 65, 1.5, 0, 15, "portion:125", "portion"],
    /* ---- spreads & sauces ---- */
    ["honey", "sauce", "Honig", "honey", 304, 0.3, 0, 80, "tsp:8,tbsp:20", "tsp"],
    ["syrup", "sauce", "Ahornsirup,Agavendicksaft,Sirup,Dattelsirup,Reissirup", "maple syrup,agave syrup,syrup,date syrup", 270, 0, 0, 67, "tbsp:20,tsp:7", "tbsp"],
    ["jam", "sauce", "Marmelade,Konfitüre,Fruchtaufstrich,Gelee", "jam,marmalade,fruit spread", 250, 0.4, 0.1, 60, "tsp:10,tbsp:20", "tsp"],
    ["chocspread", "sauce", "Nuss-Nougat-Creme,Nutella,Nougatcreme,Schokocreme", "chocolate spread,hazelnut spread,nutella", 540, 6, 31, 57, "tsp:10,tbsp:20", "tsp"],
    ["proteinspread", "sauce", "Protein-Creme,Proteincreme,Protein Schokocreme", "protein spread,protein chocolate spread", 450, 25, 32, 14, "tsp:10,tbsp:20", "tsp"],
    ["ketchup", "sauce", "Ketchup,Tomatenketchup", "ketchup,tomato ketchup", 100, 1.2, 0.1, 24, "tbsp:15", "tbsp"],
    ["currysauce", "sauce", "Currysoße,Curryketchup,Currysauce", "curry sauce,curry ketchup", 120, 1.5, 1, 26, "tbsp:15", "tbsp"],
    ["mayo", "sauce", "Mayonnaise,Mayo", "mayonnaise,mayo", 700, 1, 77, 1, "tbsp:15", "tbsp"],
    ["mayolight", "sauce", "Salatcreme,Mayo light,Mayonnaise light", "light mayonnaise,salad cream", 280, 1, 27, 9, "tbsp:15", "tbsp"],
    ["remoulade", "sauce", "Remoulade,Tartarsoße,Burgersoße,Cocktailsoße", "remoulade,tartar sauce,burger sauce,cocktail sauce", 450, 1, 47, 6, "tbsp:15", "tbsp"],
    ["aioli", "sauce", "Aioli,Knoblauchsoße,Knoblauchsauce,Knoblauchdip", "aioli,garlic sauce,garlic mayo,garlic dip", 400, 1.5, 41, 6, "tbsp:15", "tbsp"],
    ["tzatziki", "sauce", "Tzatziki,Zaziki,Joghurtsoße,Kräuterdip,Joghurtdip", "tzatziki,yogurt sauce,yogurt dip,herb dip", 120, 3.5, 10, 4, "tbsp:20", "tbsp"],
    ["guacamole", "sauce", "Guacamole,Avocadocreme", "guacamole,avocado dip", 160, 2, 14, 4, "tbsp:20", "tbsp"],
    ["salsa", "sauce", "Salsa,Salsasoße,Tomatensalsa", "salsa,tomato salsa", 35, 1.5, 0.2, 6, "tbsp:20", "tbsp"],
    ["mustard", "sauce", "Senf,Dijonsenf,süßer Senf", "mustard,dijon mustard,sweet mustard", 90, 6, 5, 5, "tsp:5,tbsp:15", "tsp"],
    ["bbq", "sauce", "BBQ-Soße,Barbecuesoße,Grillsoße,BBQ Sauce", "bbq sauce,barbecue sauce", 160, 1, 0.5, 37, "tbsp:15", "tbsp"],
    ["soysauce", "sauce", "Sojasoße,Sojasauce,Tamari", "soy sauce,tamari", 60, 8, 0.1, 6, "tbsp:15,tsp:5", "tbsp"],
    ["teriyaki", "sauce", "Teriyaki,Teriyakisoße,Hoisinsoße,Austernsoße", "teriyaki sauce,hoisin sauce,oyster sauce", 120, 3, 0.5, 26, "tbsp:15", "tbsp"],
    ["sweetchili", "sauce", "Sweet-Chili-Soße,Süß-sauer-Soße,Chilisoße", "sweet chili sauce,sweet and sour sauce,chili sauce", 200, 0.5, 0.5, 48, "tbsp:15", "tbsp"],
    ["hollandaise", "sauce", "Hollandaise,Sauce Hollandaise,Béarnaise", "hollandaise,bearnaise", 450, 1.5, 48, 4, "tbsp:15,portion:60", "tbsp"],
    ["gravy", "sauce", "Bratensoße,Soße,Rahmsoße,Sahnesoße,Jägersoße,Pilzsoße", "gravy,cream sauce,brown sauce,mushroom sauce", 90, 1.5, 7, 5, "portion:60,tbsp:20", "portion"],
    ["dressing", "sauce", "Salatdressing,Dressing,Joghurtdressing,Caesar Dressing,Vinaigrette,French Dressing", "salad dressing,dressing,vinaigrette,caesar dressing,ranch", 300, 1, 30, 6, "tbsp:15", "tbsp"],
    ["vinegar", "sauce", "Balsamico,Essig,Balsamicoessig,Apfelessig,Balsamicocreme", "balsamic vinegar,vinegar,balsamic,apple cider vinegar,balsamic glaze", 90, 0.5, 0, 17, "tbsp:15", "tbsp"],
    ["pesto", "sauce", "Pesto,Pesto Genovese,Basilikumpesto", "pesto,basil pesto,green pesto", 470, 5, 46, 5, "tbsp:15", "tbsp"],
    ["pestorosso", "sauce", "Pesto Rosso,rotes Pesto", "red pesto,sundried tomato pesto", 400, 5, 38, 9, "tbsp:15", "tbsp"],
    ["tomatosauce", "sauce", "Tomatensoße,Tomatensauce,Passata,passierte Tomaten,Pastasoße,Arrabiata", "tomato sauce,passata,marinara,pasta sauce,arrabbiata", 40, 1.5, 0.8, 6, "portion:125", "portion"],
    ["coconutmilk", "sauce", "Kokosmilch,Kokosnussmilch", "coconut milk", 180, 1.6, 18, 2.8, "can:400,tbsp:15", "can"],
    ["coconutmilklight", "sauce", "Kokosmilch light", "light coconut milk", 75, 0.8, 7, 2, "can:400,tbsp:15", "can"],
    ["ajvar", "sauce", "Ajvar,Paprikacreme", "ajvar,red pepper relish,pepper spread", 90, 1.5, 6, 7, "tbsp:20", "tbsp"],
    ["veganspread", "sauce", "Brotaufstrich,veganer Aufstrich,Linsenaufstrich", "vegan spread,sandwich spread,lentil spread", 200, 5, 16, 8, "tbsp:20", "tbsp"],
    /* ---- drinks ---- */
    ["water", "drink", "Wasser,Mineralwasser,Sprudel,Leitungswasser,stilles Wasser", "water,sparkling water,mineral water,still water", 0, 0, 0, 0, "glass:250,bottle:500", "glass"],
    ["coffee", "drink", "Kaffee,Espresso,Americano,Filterkaffee", "coffee,espresso,americano,black coffee", 2, 0.1, 0, 0.3, "cup:150", "cup"],
    ["tea", "drink", "Tee,Grüner Tee,Früchtetee,Kräutertee,Schwarztee", "tea,green tea,herbal tea,black tea", 1, 0, 0, 0.2, "cup:250", "cup"],
    ["cappuccino", "drink", "Cappuccino,Latte Macchiato,Milchkaffee,Kaffee mit Milch,Flat White,Latte", "cappuccino,latte,flat white,cafe au lait,coffee with milk", 40, 2.2, 2, 3.2, "cup:200", "cup"],
    ["icedcoffee", "drink", "Eiskaffee,Iced Latte,Kaffeegetränk", "iced coffee,iced latte,coffee drink", 70, 1.8, 3, 9, "glass:300", "glass"],
    ["cocoa", "drink", "Kakao,Schokomilch,Kakaogetränk,heiße Schokolade", "chocolate milk,hot chocolate,cocoa drink", 75, 3.3, 2, 11, "glass:250,cup:250", "glass"],
    ["cocoapowderdrink", "drink", "Kakaopulver Getränk,Kaba,Nesquik,Instant-Kakao", "drinking chocolate powder,cocoa mix,nesquik", 390, 4, 3, 85, "tbsp:12,tsp:5", "tbsp"],
    ["milkshake", "drink", "Milchshake,Shake mit Eis", "milkshake", 110, 3.5, 3.5, 17, "glass:300", "glass"],
    ["oatmilk", "drink", "Hafermilch,Haferdrink,Hafer Barista", "oat milk,oat drink,barista oat", 46, 1, 1.5, 6.7, "glass:200,cup:150", "glass"],
    ["soymilk", "drink", "Sojamilch,Sojadrink", "soy milk,soya milk,soy drink", 39, 3.3, 1.8, 2.5, "glass:200,cup:150", "glass"],
    ["almondmilk", "drink", "Mandelmilch,Mandeldrink,Reismilch,Kokosdrink", "almond milk,almond drink,rice milk,coconut drink", 18, 0.5, 1.2, 1.5, "glass:200,cup:150", "glass"],
    ["juice", "drink", "Orangensaft,Saft,Apfelsaft,O-Saft,Multivitaminsaft,Traubensaft", "orange juice,juice,apple juice,multivitamin juice,grape juice", 45, 0.7, 0.2, 10, "glass:200", "glass"],
    ["smoothie", "drink", "Smoothie,Fruchtsmoothie", "smoothie,fruit smoothie", 55, 0.6, 0.2, 12, "glass:250,bottle:250", "glass"],
    ["tomatojuice", "drink", "Tomatensaft,Gemüsesaft,Karottensaft", "tomato juice,vegetable juice,carrot juice", 20, 0.8, 0.1, 3.5, "glass:200", "glass"],
    ["schorle", "drink", "Apfelschorle,Saftschorle,Schorle,Johannisbeerschorle", "apple spritzer,juice spritzer,spritzer", 24, 0.1, 0, 5.5, "glass:250,bottle:500", "glass"],
    ["coke", "drink", "Cola,Limo,Limonade,Softdrink,Fanta,Sprite,Spezi", "cola,coke,soda,soft drink,lemonade,fanta,sprite", 42, 0, 0, 10.6, "glass:250,can:330,bottle:500", "glass"],
    ["colazero", "drink", "Cola Zero,Cola Light,Pepsi Max,Light-Getränk,zuckerfreie Limo", "diet coke,coke zero,cola zero,diet soda,pepsi max,sugar-free soda", 0.3, 0, 0, 0, "glass:250,can:330,bottle:500", "glass"],
    ["icetea", "drink", "Eistee,Pfirsich-Eistee", "iced tea,ice tea,peach iced tea", 30, 0, 0, 7, "glass:250,bottle:500", "glass"],
    ["energy", "drink", "Energy Drink,Red Bull,Monster,Energydrink", "energy drink,red bull,monster", 45, 0, 0, 11, "can:250,bottle:500", "can"],
    ["energyzero", "drink", "Energy Drink zero,zuckerfreier Energy Drink,Red Bull Sugarfree,Monster Ultra", "sugar-free energy drink,energy drink zero,red bull sugarfree,monster ultra", 3, 0, 0, 0.5, "can:250,bottle:500", "can"],
    ["isotonic", "drink", "Iso-Getränk,isotonisches Getränk,Sportgetränk,Elektrolytgetränk", "sports drink,isotonic drink,electrolyte drink", 25, 0, 0, 6, "bottle:500,glass:250", "bottle"],
    ["coconutwater", "drink", "Kokoswasser", "coconut water", 19, 0.7, 0.2, 3.7, "glass:250", "glass"],
    ["beer", "drink", "Bier,Pils,Weizen,Helles,Weißbier,Kölsch", "beer,lager,wheat beer,pilsner", 43, 0.5, 0, 3.6, "bottle:500,glass:300,can:500", "bottle"],
    ["nabeer", "drink", "Alkoholfreies Bier,alkoholfrei,Weizen alkoholfrei", "alcohol-free beer,non-alcoholic beer,na beer", 26, 0.4, 0, 5.5, "bottle:500,glass:300", "bottle"],
    ["radler", "drink", "Radler,Alster,Biermischgetränk", "shandy,radler", 40, 0.3, 0, 7, "bottle:500,glass:300", "bottle"],
    ["wine", "drink", "Wein,Rotwein,Weißwein,Rosé,Rosewein", "wine,red wine,white wine,rose wine", 83, 0.1, 0, 2.6, "glass:200,bottle:750", "glass"],
    ["sparkling", "drink", "Sekt,Prosecco,Champagner,Hugo,Aperol Spritz", "sparkling wine,prosecco,champagne,aperol spritz", 80, 0.2, 0, 3, "glass:150", "glass"],
    ["spirits", "drink", "Schnaps,Wodka,Gin,Whisky,Rum,Spirituosen,Tequila,Shot", "vodka,gin,whisky,rum,spirits,tequila,shot", 230, 0, 0, 0, "pc:20,glass:40", "pc"],
    ["cocktail", "drink", "Cocktail,Longdrink,Gin Tonic,Cuba Libre,Mojito,Caipirinha,Wodka Bull", "cocktail,long drink,gin and tonic,cuba libre,mojito,caipirinha", 100, 0, 0, 10, "glass:250", "glass"],
    /* ---- dishes (typical recipes, per 100 g) ---- */
    ["pizza", "dish", "Pizza,Pizza Margherita,Pizza Funghi", "pizza,margherita,cheese pizza", 240, 9.5, 8, 31, "pc:350,slice:120", "pc"],
    ["pizzasalami", "dish", "Pizza Salami,Salamipizza,Pizza Tonno,Pizza Hawaii,Pizza Prosciutto", "pepperoni pizza,salami pizza,tuna pizza,hawaiian pizza,ham pizza", 260, 11, 11, 29, "pc:350,slice:120", "pc"],
    ["doner", "dish", "Döner,Döner Kebab,Dönertasche,Kebab", "doner,kebab,doner kebab", 215, 11, 10, 20, "pc:350", "pc"],
    ["durum", "dish", "Dürüm,Dürüm Döner,Yufka", "durum,doner wrap,kebab wrap", 200, 11, 9, 19, "pc:400", "pc"],
    ["donerbox", "dish", "Dönerbox,Döner Teller,Pommes Döner,Dönerteller", "doner box,kebab box,kebab plate", 220, 11, 12, 18, "portion:400", "portion"],
    ["gyrosplate", "dish", "Gyrosteller,Gyros mit Pommes,Gyros Pita", "gyros plate,gyros with fries,gyros pita", 220, 12, 12, 16, "portion:450", "portion"],
    ["burger", "dish", "Burger,Hamburger,Cheeseburger,Big Mac,Whopper", "burger,hamburger,cheeseburger,big mac,whopper", 250, 13, 11, 24, "pc:220", "pc"],
    ["chickenburger", "dish", "Chickenburger,Chicken Burger,McChicken", "chicken burger,chicken sandwich,mcchicken", 245, 12, 11, 25, "pc:200", "pc"],
    ["hotdog", "dish", "Hot Dog,Hotdog", "hot dog", 260, 10, 15, 22, "pc:150", "pc"],
    ["currywurst", "dish", "Currywurst", "currywurst", 220, 10, 17, 8, "portion:200", "portion"],
    ["schnitzelfries", "dish", "Schnitzel mit Pommes,Schnitzelteller", "schnitzel and fries,schnitzel plate", 240, 12, 13, 19, "portion:400", "portion"],
    ["bolognese", "dish", "Spaghetti Bolognese,Bolognese,Nudeln Bolognese,Nudeln mit Hackfleischsoße", "spaghetti bolognese,bolognese,pasta bolognese", 140, 7, 5, 17, "portion:400", "portion"],
    ["carbonara", "dish", "Spaghetti Carbonara,Carbonara,Nudeln Carbonara", "carbonara,spaghetti carbonara,pasta carbonara", 200, 8, 9, 21, "portion:350", "portion"],
    ["pastatomato", "dish", "Nudeln mit Tomatensoße,Pasta Pomodoro,Spaghetti Napoli,Penne Arrabiata", "pasta with tomato sauce,pasta pomodoro,spaghetti napoli,penne arrabbiata", 125, 4, 2.5, 22, "portion:400", "portion"],
    ["pastacream", "dish", "Nudeln mit Sahnesoße,Nudeln mit Lachs,Pasta Alfredo,Tagliatelle mit Sahnesoße", "creamy pasta,pasta alfredo,salmon pasta", 190, 7, 9, 20, "portion:350", "portion"],
    ["lasagne", "dish", "Lasagne,Lasagne Bolognese", "lasagna,lasagne", 150, 8, 7, 14, "portion:350", "portion"],
    ["kaesespaetzle", "dish", "Käsespätzle,Kässpatzen", "cheese spaetzle,kasespatzle", 230, 10, 11, 22, "portion:350", "portion"],
    ["maultaschen", "dish", "Maultaschen", "maultaschen,swabian ravioli", 190, 8, 7, 24, "portion:250,pc:60", "portion"],
    ["chiliconcarne", "dish", "Chili con Carne,Chili sin Carne", "chili con carne,chili sin carne", 110, 8, 4.5, 9, "portion:400", "portion"],
    ["goulash", "dish", "Gulasch,Gulaschsuppe,Rindergulasch mit Soße", "goulash,goulash soup,beef goulash", 115, 10, 6, 5, "portion:300", "portion"],
    ["curry", "dish", "Hähnchen-Curry,Curry,Chicken Curry,Butter Chicken,Thai Curry,Rotes Curry", "chicken curry,curry,butter chicken,thai curry,red curry", 140, 10, 8, 7, "portion:350", "portion"],
    ["currywithrice", "dish", "Curry mit Reis,Reis mit Curry", "curry with rice,curry and rice", 140, 6.5, 4.5, 18, "portion:450", "portion"],
    ["friedrice", "dish", "Gebratener Reis,Bratreis,Nasi Goreng", "fried rice,egg fried rice,nasi goreng", 165, 5, 6, 23, "portion:350", "portion"],
    ["friednoodles", "dish", "Gebratene Nudeln,Bami Goreng,Chow Mein,Pad Thai,Mie Goreng", "fried noodles,chow mein,pad thai,bami goreng", 170, 6, 6, 23, "portion:350", "portion"],
    ["sushi", "dish", "Sushi,Maki,Sushi-Rolle,California Roll,Inside Out", "sushi,maki,sushi roll,california roll", 150, 5, 2.5, 26, "pc:25", "pc"],
    ["nigiri", "dish", "Nigiri,Lachs-Nigiri", "nigiri,salmon nigiri", 140, 7, 1.5, 24, "pc:35", "pc"],
    ["ramen", "dish", "Ramen,Nudelsuppe,Pho,Udon-Suppe", "ramen,noodle soup,pho,udon soup", 70, 4, 2.5, 8, "portion:500", "portion"],
    ["pokebowl", "dish", "Poke Bowl,Bowl,Buddha Bowl,Reisbowl", "poke bowl,bowl,buddha bowl,rice bowl", 140, 8, 5, 16, "portion:450", "portion"],
    ["burrito", "dish", "Burrito,Burrito Bowl", "burrito,burrito bowl", 200, 9, 7, 25, "pc:300", "pc"],
    ["tacos", "dish", "Taco,Tacos", "taco,tacos", 220, 10, 11, 20, "pc:90", "pc"],
    ["quesadilla", "dish", "Quesadilla,Enchilada", "quesadilla,enchilada", 290, 13, 15, 26, "pc:180", "pc"],
    ["wrapfilled", "dish", "Wrap belegt,Chicken Wrap,Falafel Wrap,Hähnchen Wrap", "chicken wrap,filled wrap,falafel wrap", 200, 10, 8, 22, "pc:250", "pc"],
    ["sandwich", "dish", "Sandwich,belegtes Brötchen,belegtes Brot,Käsebrötchen,Schinkenbrötchen,Panini,Toast Hawaii", "sandwich,filled roll,cheese sandwich,ham sandwich,panini,toastie", 240, 11, 9, 28, "pc:150", "pc"],
    ["fishroll", "dish", "Fischbrötchen,Lachsbrötchen,Matjesbrötchen,Backfischbrötchen", "fish sandwich,fish roll", 230, 12, 10, 23, "pc:150", "pc"],
    ["leberkaesroll", "dish", "Leberkässemmel,Leberkäse Semmel,Leberkäsesemmel,Leberkäsbrötchen,Leberkäse Brötchen,Fleischkäsweckle", "leberkaese roll", 290, 11, 18, 22, "pc:180", "pc"],
    ["flammkuchen", "dish", "Flammkuchen,Tarte flambée", "tarte flambee,flammkuchen", 250, 7, 13, 26, "pc:350", "pc"],
    ["quiche", "dish", "Quiche,Quiche Lorraine,Gemüsequiche", "quiche,quiche lorraine", 260, 8, 18, 16, "slice:150", "slice"],
    ["omelette", "dish", "Omelett,Omelette,Bauernfrühstück", "omelette,omelet,frittata", 155, 10.5, 12, 1.2, "pc:150", "pc"],
    ["shakshuka", "dish", "Shakshuka,Eier in Tomatensoße", "shakshuka,eggs in tomato sauce", 110, 6, 7, 6, "portion:350", "portion"],
    ["risotto", "dish", "Risotto,Pilzrisotto", "risotto,mushroom risotto", 140, 3.5, 5, 20, "portion:350", "portion"],
    ["paella", "dish", "Paella,Jambalaya", "paella,jambalaya", 150, 8, 5, 18, "portion:400", "portion"],
    ["potatosalad", "dish", "Kartoffelsalat", "potato salad", 130, 2, 7, 15, "portion:250", "portion"],
    ["pastasalad", "dish", "Nudelsalat", "pasta salad", 200, 5, 11, 20, "portion:250", "portion"],
    ["caesarsalad", "dish", "Caesar Salad,Cäsarsalat,Salat mit Hähnchen", "caesar salad,chicken salad", 150, 8, 11, 5, "portion:300", "portion"],
    ["greeksalad", "dish", "Griechischer Salat,Bauernsalat,Hirtensalat", "greek salad,feta salad", 110, 3.5, 9, 4, "portion:300", "portion"],
    ["soup", "dish", "Gemüsesuppe,Suppe,Brühe,Hühnersuppe,Minestrone", "vegetable soup,soup,broth,chicken soup,minestrone", 35, 1.8, 1.2, 4.5, "portion:400", "portion"],
    ["stew", "dish", "Linsensuppe,Linseneintopf,Eintopf,Erbseneintopf,Bohneneintopf,Kartoffelsuppe", "lentil soup,stew,pea soup,bean stew,potato soup", 85, 5, 2.5, 10, "portion:400", "portion"],
    ["creamsoup", "dish", "Tomatensuppe,Kürbissuppe,Cremesuppe,Brokkolisuppe", "tomato soup,pumpkin soup,cream soup,broccoli soup", 55, 1.2, 3, 6, "portion:350", "portion"],
    ["ratatouille", "dish", "Ratatouille,Gemüsepfanne,Gemüsecurry", "ratatouille,vegetable stir-fry,vegetable curry", 60, 1.5, 3, 6, "portion:350", "portion"],
    ["chickenrice", "dish", "Hähnchen mit Reis,Reis mit Hähnchen,Chicken Rice", "chicken and rice,chicken rice", 145, 12, 3, 18, "portion:400", "portion"]
  ];
