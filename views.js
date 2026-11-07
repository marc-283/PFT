/* PFT 1.4.0 – Charts and all screens. */
"use strict";
  /* ================= Derived data (rebuilt when data changes) ================= */
  let memo = { ver: -1 };
  function derived() {
    if (memo.ver === ver) return memo;
    const asc = db.sessions.slice().sort(cmpAsc);
    const byEx = new Map(), prs = new Map(), tot = new Map();
    for (const s of asc) {
      if (!isLift(s)) continue;
      let vol = 0, sets = 0;
      for (const e of s.ex || []) {
        const x = exOf(e.id), st = exStats(e, x.kind);
        sets += st.sets; if (x.kind === "kg") vol += st.vol;
        if (!st.sets) continue;
        if (!byEx.has(e.id)) byEx.set(e.id, []);
        byEx.get(e.id).push({ s, e, st, lv: lvKey(x, e.lv) });
      }
      tot.set(s.id, { vol, sets });
    }
    for (const [id, list] of byEx) {
      const x = exOf(id), kind = x.kind, types = kind === "kg" ? ["e1rm", "max"] : kind === "bw" ? ["reps", "max"] : ["time"], best = {};
      list.forEach((h) => {
        h.pr = []; let first = null;
        const bk = best[h.lv] || (best[h.lv] = {});
        for (const t of types) {
          const v = h.st[t] || 0, b = bk[t] || 0;
          if (v > b + 1e-9) { if (b > 0) { h.pr.push(t); if (!first) first = { ex: id, type: t, value: v, prev: b, kind, lv: h.lv }; } bk[t] = v; }
        }
        if (first) { if (!prs.has(h.s.id)) prs.set(h.s.id, []); prs.get(h.s.id).push(first); }
      });
    }
    memo = { ver, asc, desc: asc.slice().reverse(), byEx, prs, tot };
    return memo;
  }
  const sessionTot = (s) => derived().tot.get(s.id) || { vol: 0, sets: 0 };
  const sessionById = (id) => db.sessions.find((s) => s.id === id);
  const tplById = (id) => db.templates.find((t) => t.id === id);
  const histOf = (id, lv) => { const x = exOf(id), l = derived().byEx.get(id) || []; return hasLv(x) && lv != null ? l.filter((h) => h.lv === +lv) : l; };
  function lastFor(exId, d, lv) {
    const x = exOf(exId), list = derived().byEx.get(exId) || [];
    for (let k = list.length - 1; k >= 0; k--) {
      const h = list[k];
      if (d && (h.s.id === d.editOf || h.s.date > d.date)) continue;
      if (hasLv(x) && h.lv !== lvKey(x, lv)) continue;
      return h;
    }
    return null;
  }
  function bestBefore(exId, kind, d, lv) {
    const x = exOf(exId), t = kind === "kg" ? "e1rm" : kind === "bw" ? "reps" : "time";
    let b = 0;
    for (const h of derived().byEx.get(exId) || []) if ((!d || h.s.id !== d.editOf) && (!hasLv(x) || h.lv === lvKey(x, lv))) b = Math.max(b, h.st[t] || 0);
    return { t, b };
  }
  const topLevel = (id) => { const l = derived().byEx.get(id) || []; return l.reduce((a, h) => (h.lv != null && h.lv > a ? h.lv : a), -1); };
  function autoName(ex, sport) {
    if (sport === "cali") return "Calisthenics";
    const c = {}; for (const e of ex) { const g = exOf(e.id).group; c[g] = (c[g] || 0) + e.sets.length; }
    const top = Object.keys(c).sort((a, b) => c[b] - c[a]).slice(0, 2).map(groupName);
    return top.length ? top.join(" & ") : T("Workout", "Training");
  }
  function weekBuckets(n) { const ws = weekStart(todayISO()); return Array.from({ length: n }, (_, k) => { const from = addDays(ws, -7 * (n - 1 - k)); return { from, to: addDays(from, 6) }; }); }
  function monthBuckets(n) { const m0 = todayISO().slice(0, 8) + "01"; return Array.from({ length: n }, (_, k) => { const from = addMonths(m0, k - (n - 1)); return { from, to: addDays(addMonths(from, 1), -1) }; }); }
  function bucketsFor(rg) { return rg === "1y" ? { list: monthBuckets(12), unit: "m" } : rg === "6m" ? { list: weekBuckets(26), unit: "w" } : { list: weekBuckets(12), unit: "w" }; }
  const bucketLabel = (b, unit) => (unit === "m" ? monthFmt.format(isoDate(b.from)) : `${wkLabel(b.from)} · ${dayMonth.format(isoDate(b.from))} – ${dayMonth.format(isoDate(b.to))}`);
  const bucketTicks = (list, unit) => list.map((b, i) => ({ i, text: unit === "m" ? monShort.format(isoDate(b.from)).replace(".", "") : LANG === "de" ? `${isoDate(b.from).getDate()}.${isoDate(b.from).getMonth() + 1}.` : `${isoDate(b.from).getDate()}/${isoDate(b.from).getMonth() + 1}` }));
  const perUnit = (unit) => (unit === "m" ? T("per month", "pro Monat") : T("per week", "pro Woche"));
  const curUnit = (unit) => (unit === "m" ? T("This month", "Dieser Monat") : T("This week", "Diese Woche"));
  function sumIn(list, b, fn) { let v = 0; for (const s of list) if (s.date >= b.from && s.date <= b.to) v += fn(s); return v; }
  function streakWeeks() {
    const days = new Set(db.sessions.map((s) => weekStart(s.date)));
    let ws = weekStart(todayISO()), n = 0;
    if (!days.has(ws)) ws = addDays(ws, -7);
    while (days.has(ws)) { n++; ws = addDays(ws, -7); }
    return n;
  }
  const RANGES = { "3m": 3, "6m": 6, "1y": 12, all: 0 };
  const rangePills = (action, cur, opts) => pills(action, cur, opts.map((k) => [k, { "12w": T("12 W", "12 W"), "3m": T("3 M", "3 M"), "6m": T("6 M", "6 M"), "1y": T("1 Y", "1 J"), all: T("All", "Alle"), "14d": T("14 D", "14 T"), "30d": T("30 D", "30 T"), "90d": T("90 D", "90 T") }[k]]), T("Period", "Zeitraum"));
  function monthTicks(from, to) {
    const out = [], span = daysBetween(from, to) || 1;
    let m = addMonths(from, 1);
    if (from.slice(8) === "01") m = from;
    while (m <= to) { const d = isoDate(m); out.push({ x: daysBetween(from, m) / span, text: d.getMonth() === 0 ? String(d.getFullYear()) : monShort.format(d).replace(".", "") }); m = addMonths(m, 1); }
    return span > 500 ? out.filter((t, k) => k % 3 === 0) : out;
  }

  /* ================= State ================= */
  const state = {
    stack: null, tab: "today", stacks: null, progSeg: "strength", wRange: "90d", wAll: false, enter: false, armed: null, histFilter: "all", histN: 60,
    pRange: "12w", pMetric: "vol", gWin: "week", exRange: "all", exMetric: {}, exLv: {}, spRange: "12w", spMetric: {}, exAll: false,
    pick: null, full: null, foodDay: null, fRange: "14d", fMetric: "kcal", exQ: "", foodQ: "", repType: "m", repCmp: "prev", repMetric: "dur", xm: null
  };
  state.stacks = { today: [{ v: "hub" }], train: [{ v: "train" }], food: [{ v: "food" }], prog: [{ v: "prog" }], more: [{ v: "settings" }] };
  state.stack = state.stacks.today;
  let charts = [];

  /* ================= Chart (from PFM: SVG, touch to read values, full screen replay) ================= */
  function niceStep(range, minStep, steps) {
    const raw = range / 4; if (!(raw > 0)) return minStep || (steps && steps[0]) || 1;
    if (steps) return steps.find((x) => x >= raw) || steps[steps.length - 1];
    const p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
    return Math.max(minStep || 0, (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p);
  }
  let gradCount = 0;
  function drawChart(host, cfg) {
    if (!host) return;
    const all = cfg.points, n = all.length;
    if (!n) { host.innerHTML = ""; return; }
    const W = Math.max(260, Math.round(host.clientWidth || 320)), Hh = cfg.height || 220, L = cfg.left || 50, R = 14, Tp = 18, B = 26;
    const pw = W - L - R, ph = Hh - Tp - B;
    const frOf = (p, i) => (cfg.bars ? (i + 0.5) / n : p.x != null ? p.x : n <= 1 ? 0.5 : i / (n - 1));
    const X = (fr) => L + fr * pw;
    const vals = all.map((p) => p.value).concat(cfg.limit ? [cfg.limit] : []);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (cfg.bars || cfg.zero) lo = Math.min(0, lo);
    else { const padv = (hi - lo) * 0.15 || Math.abs(hi) * 0.1 || 1; const allPos = lo >= 0; lo -= padv; hi += padv; if (allPos) lo = Math.max(0, lo); }
    if (hi <= lo) hi = lo + (cfg.minStep || 1);
    const step = niceStep(hi - lo, cfg.minStep, cfg.steps);
    const yMin = Math.floor(lo / step + 1e-9) * step, yMax = Math.max(yMin + step, Math.ceil(hi / step - 1e-9) * step);
    const Y = (v) => Tp + ph - ((v - yMin) / (yMax - yMin)) * ph, f = (v) => v.toFixed(1);
    let pts = all.map((p, i) => ({ ...p, fr: frOf(p, i) }));
    if (cfg.reveal != null) {
      const k = clamp(cfg.reveal, 0, n - 1), ki = Math.floor(k), fr = k - ki, nx = pts[ki + 1];
      const cut = pts.slice(0, ki + 1);
      if (fr > 0.001 && nx) cut.push(cfg.bars ? { ...nx, value: nx.value * fr, ghost: true } : { value: pts[ki].value + (nx.value - pts[ki].value) * fr, fr: pts[ki].fr + (nx.fr - pts[ki].fr) * fr, ghost: true });
      pts = cut;
    }
    const yf = cfg.yfmt || ((v) => nf.format(v));
    let s = "";
    for (let v = yMin, g = 0; v <= yMax + step / 2 && g < 24; v += step, g++) {
      s += `<line class="grid${Math.abs(v) < 1e-9 ? " base" : ""}" x1="${L}" x2="${W - R}" y1="${f(Y(v))}" y2="${f(Y(v))}"/><text class="ylab" x="${L - 8}" y="${f(Y(v) + 4)}" text-anchor="end">${esc(yf(v))}</text>`;
    }
    let lastX = -1e9;
    for (const t of cfg.ticks || []) {
      const fr = t.i != null ? (cfg.bars ? (t.i + 0.5) / n : n <= 1 ? 0.5 : t.i / (n - 1)) : t.x;
      const x = X(fr); if (x - lastX < (cfg.tickGap || 46)) continue; lastX = x;
      const anchor = !cfg.bars && fr < 0.04 ? "start" : !cfg.bars && fr > 0.96 ? "end" : "middle";
      s += `<text class="xlab" x="${f(x)}" y="${Hh - 6}" text-anchor="${anchor}">${esc(t.text)}</text>`;
    }
    if (cfg.limit) { const y = Y(cfg.limit); s += `<line class="lim" x1="${L}" x2="${W - R}" y1="${f(y)}" y2="${f(y)}"/><text class="limlab" x="${W - R}" y="${f(y - 6)}" text-anchor="end">${esc(cfg.limitLabel || T("Record", "Rekord"))} ${esc(cfg.limitFmt ? cfg.limitFmt(cfg.limit) : yf(cfg.limit))}</text>`; }
    if (cfg.bars) {
      const bw = clamp((pw / n) * 0.62, 3, 26), y0 = Y(Math.max(0, yMin));
      pts.forEach((p, i) => { const y1 = Y(p.value); s += `<rect x="${f(X(p.fr) - bw / 2)}" y="${f(Math.min(y0, y1))}" width="${f(bw)}" height="${f(Math.max(p.value ? 2 : 0, Math.abs(y1 - y0)))}" rx="2" style="fill:${cfg.color};opacity:${cfg.partialLast && i === n - 1 ? 0.5 : 1}"/>`; });
    } else {
      const d = pts.map((p, i) => `${i ? "L" : "M"}${f(X(p.fr))},${f(Y(p.value))}`).join("");
      if (pts.length > 1) {
        const gid = "grad" + (++gradCount);
        s += `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:${cfg.color};stop-opacity:0.3"/><stop offset="1" style="stop-color:${cfg.color};stop-opacity:0"/></linearGradient></defs>`;
        s += `<path d="${d}L${f(X(pts[pts.length - 1].fr))},${f(Tp + ph)}L${f(X(pts[0].fr))},${f(Tp + ph)}Z" style="fill:url(#${gid})"/><path class="line" d="${d}" style="stroke:${cfg.color}"/>`;
      }
      if (n <= 80) pts.forEach((p) => { if (!p.ghost) s += p.pr ? `<circle class="pr" cx="${f(X(p.fr))}" cy="${f(Y(p.value))}" r="4.5"/>` : `<circle cx="${f(X(p.fr))}" cy="${f(Y(p.value))}" r="3" style="fill:${cfg.color}"/>`; });
      const lp = pts[pts.length - 1];
      s += `<circle class="ring" cx="${f(X(lp.fr))}" cy="${f(Y(lp.value))}" r="5" style="fill:${cfg.color}"/>`;
    }
    s += `<g class="cur" visibility="hidden"><line class="cursor" x1="0" x2="0" y1="${Tp}" y2="${Tp + ph}"/><circle class="ring" r="6" style="fill:${cfg.color}"/></g>`;
    host.innerHTML = `<svg viewBox="0 0 ${W} ${Hh}" style="height:${Hh}px" role="img" aria-label="${esc(cfg.aria || "Chart")}">${s}</svg>`;
    const svg = host.firstElementChild, cur = svg.querySelector(".cur"), li = pts.filter((p) => !p.ghost).length - 1;
    if (li < 0) return;
    const hide = () => { cur.setAttribute("visibility", "hidden"); cfg.onScrub && cfg.onScrub(null); };
    const at = (ev) => {
      const r = svg.getBoundingClientRect(), x = (ev.clientX - r.left) * (W / r.width);
      let i = 0;
      if (cfg.bars) i = Math.floor(((x - L) / pw) * n);
      else { let bd = 1e9; for (let k = 0; k <= li; k++) { const dd = Math.abs(X(pts[k].fr) - x); if (dd < bd) { bd = dd; i = k; } } }
      i = clamp(i, 0, li);
      const cx = f(X(pts[i].fr)), cy = f(Y(pts[i].value));
      cur.firstElementChild.setAttribute("x1", cx); cur.firstElementChild.setAttribute("x2", cx);
      cur.lastElementChild.setAttribute("cx", cx); cur.lastElementChild.setAttribute("cy", cy);
      cur.setAttribute("visibility", "visible");
      cfg.onScrub && cfg.onScrub(i);
    };
    svg.addEventListener("pointerdown", at); svg.addEventListener("pointermove", at);
    svg.addEventListener("pointerleave", hide); svg.addEventListener("pointercancel", hide);
    svg.addEventListener("pointerup", (e) => { if (e.pointerType !== "mouse") hide(); });
  }
  function heroHTML(text) { const m = String(text).match(/^([−+-]?[\d.:,]*\d)(.*)$/); if (!m) return esc(text); const big = m[1].replace(/[,.](\d{1,2})$/, ""), dec = m[1].slice(big.length) + m[2]; return `${esc(big)}<span class="dec">${esc(dec)}</span>`; }
  const expandBtn = (id) => `<button class="expbtn" data-action="chart-full" data-arg="${id}" aria-label="${esc(T("Show chart full screen", "Chart im Vollbild"))}">⤢ ${esc(T("Full screen", "Vollbild"))}</button>`;
  function chartBlock(id, cfg, hero, legend) {
    charts.push({ id, cfg, hero });
    return `
      <section class="hero">
        <span class="label">${esc(hero.label)}</span>
        <div class="heroval" id="${id}Val">${heroHTML(hero.base.v)}</div>
        <div class="herosub" id="${id}Sub">${hero.base.sub}</div>
      </section>
      <section class="chartblock" aria-label="Chart">
        <div class="chart" id="${id}"></div>
        <div class="cfoot"><div class="legend">${legend || ""}</div>${expandBtn(id)}</div>
      </section>`;
  }
  const scrubTo = (c, i, vEl, sEl) => { const h = i == null ? c.hero.base : c.hero.at(i); if (vEl) vEl.innerHTML = heroHTML(h.v); if (sEl) sEl.innerHTML = h.sub; };
  function spark(vals, color, w) {
    if (vals.length < 2 || vals.every((v) => v === 0)) return "";
    const max = Math.max(...vals), min = Math.min(...vals), W = w || 84, Hs = 30, n = vals.length;
    const pts = vals.map((v, i) => `${((i * W) / (n - 1)).toFixed(1)},${(Hs - 3 - ((v - min) / (max - min || 1)) * (Hs - 6)).toFixed(1)}`).join(" ");
    return `<svg class="spark" viewBox="0 0 ${W} ${Hs}" style="width:${W}px" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" style="fill:none;stroke:${color};stroke-width:2;stroke-linejoin:round;stroke-linecap:round"/></svg>`;
  }
  const pills = (action, cur, opts, label) => `<div class="pills" role="group" aria-label="${esc(label)}">${opts.map(([k, t]) => `<button data-action="${action}" data-arg="${k}" aria-pressed="${k === cur}">${esc(t)}</button>`).join("")}</div>`;

  /* ================= Building blocks ================= */
  const badge = (text, color) => `<span class="badge" style="color:${color};background:${color}24" aria-hidden="true">${esc(String(text || "?").slice(0, 2))}</span>`;
  const badgeEx = (x) => badge(exName(x).replace(/[^A-Za-zÄÖÜäöü]+/g, ""), GROUP_COLORS[x.group] || "#D4D4D8");
  const badgeSport = (sp) => badge(sportAb(sp), SPORTS[sp].color);
  const viewLabel = (e) => ({
    hub: T("Today", "Heute"), train: "Training", prog: T("Progress", "Fortschritt"), body: T("Body", "Körper"), live: T("Workout", "Training"), session: T("Workout", "Training"), history: T("History", "Verlauf"), progress: T("Progress", "Fortschritt"),
    exercise: T("Exercise", "Übung"), workouts: "Workouts", tpl: "Workout", settings: T("More", "Mehr"), exlist: T("Exercises", "Übungen"),
    sport: e && SPORTS[e.p] ? sportName(e.p) : "", cali: "Calisthenics", food: T("Nutrition", "Ernährung"), meal: T("Meal", "Mahlzeit"), foods: T("Foods", "Lebensmittel"), mymeals: T("My meals", "Meine Mahlzeiten"), reports: T("Reports", "Berichte"), report: T("Report", "Bericht")
  }[e && e.v] || T("Back", "Zurück"));
  const backBar = (label) => { if (state.stack.length < 2 && !label) return ""; const prev = state.stack[state.stack.length - 2]; const t = label || (prev ? viewLabel(prev) : T("Menu", "Menü")); return `<button class="backbtn" data-action="back"><span aria-hidden="true">‹</span>${esc(t)}</button>`; };
  function navRow(action, arg, title, sub, val, b) {
    return `<button class="row${b ? "" : " nobadge"}" data-action="${action}" data-arg="${esc(arg)}">${b || ""}<span class="main"><span class="t1">${title}</span>${sub ? `<span class="t2">${sub}</span>` : ""}</span><span class="val">${val || ""}</span><span class="chev" aria-hidden="true">›</span></button>`;
  }
  function sessionLine(s) {
    if (isLift(s)) { const t = sessionTot(s); return { t1: esc(s.name || T("Workout", "Training")), t2: `${durTxt(s.dur)} · ${pl((s.ex || []).length, "exercise")}${t.vol ? ` · ${tons(t.vol)}` : ` · ${pl(t.sets, "set")}`}` }; }
    const bits = [];
    if (s.sport === "run") { bits.push(clock(s.dur)); if (s.dist) bits.push(paceTxt(s.dur / s.dist)); return { t1: `${esc(s.kind ? typeName(s.kind) : T("Run", "Lauf"))} · ${nf.format(s.dist || 0)} km`, t2: bits.join(" · ") }; }
    bits.push(durTxt(s.dur)); if (s.dist) bits.push(`${nf.format(s.dist)} km`);
    if (s.sport === "fb" && (s.goals || s.assists)) bits.push([s.goals ? pl(s.goals, "goal") : "", s.assists ? pl(s.assists, "assist") : ""].filter(Boolean).join(", "));
    if (s.rpe) bits.push(`RPE ${s.rpe}`);
    return { t1: s.sport === "other" ? esc(s.name || sportName("other")) : `${esc(sportName(s.sport))}${s.kind ? ` · ${esc(typeName(s.kind))}` : ""}`, t2: bits.join(" · ") };
  }
  function sessionRow(s, withDate) {
    const l = sessionLine(s), prs = isLift(s) ? (derived().prs.get(s.id) || []).length : 0;
    const action = isLift(s) ? "session" : "act";
    return `<button class="row" data-action="${action}" data-arg="${esc(s.id)}">${badgeSport(s.sport)}<span class="main"><span class="t1">${l.t1}${prs ? `<span class="tag attn">${prs} PR</span>` : ""}${s.example ? `<span class="tag">${esc(T("Sample", "Beispiel"))}</span>` : ""}</span><span class="t2">${withDate ? `${esc(dayTxt(s.date))} · ` : ""}${l.t2}</span></span><span class="val"></span><span class="chev" aria-hidden="true">›</span></button>`;
  }
  function monthGroups(list, max) {
    let out = "", cur = "", shown = 0;
    const byMonth = new Map(); for (const s of list) { const m = s.date.slice(0, 7); if (!byMonth.has(m)) byMonth.set(m, []); byMonth.get(m).push(s); }
    for (const s of list) {
      if (shown >= max) break;
      const m = s.date.slice(0, 7);
      if (m !== cur) { cur = m; const g = byMonth.get(m), t = g.reduce((a, x) => a + (x.dur || 0), 0); out += `<div class="dayhead"><span>${esc(monthFmt.format(isoDate(m + "-01")))}</span><span>${pl(g.length, "session")} · ${durTxt(t)}</span></div>`; }
      out += sessionRow(s, true); shown++;
    }
    return out;
  }
  const ICON_GEAR = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="7.6" fill="none" stroke="currentColor" stroke-width="3.4" stroke-dasharray="2.9 3.07"/><circle cx="12" cy="12" r="5.4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>';
  const ICON_SEARCH = '<svg class="ic" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M15.5 15.5L20.5 20.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  const emptyBox = (title, text, btns) => `<div class="empty"><strong>${esc(title)}</strong><p>${text}</p>${btns ? `<div class="btnrow">${btns}</div>` : ""}</div>`;
  const st3 = (...a) => `<div class="stats">${a.map(([l, v, cls]) => `<div class="stat"><span class="label">${esc(l)}</span><span class="v"${cls ? ` style="color:${cls}"` : ""}>${esc(v)}</span></div>`).join("")}</div>`;
  const recLine = (l, v, d) => `<div><span>${esc(l)}</span><b>${esc(v)}<small>${esc(dateFmt.format(isoDate(d)))}</small></b></div>`;
  const ladder = (x, top) => (hasLv(x) ? `<span class="ladder" aria-hidden="true">${x.lv.map((_, i) => `<i class="${i <= top ? "on" : ""}"></i>`).join("")}</span>` : "");

  /* ================= Views ================= */
  /* ---------- Live workout ---------- */
  const blankSet = (wu) => ({ w: "", r: "", t: "", done: false, wu: !!wu });
  /* rest after a set: the exercise's own → the one you last chose for this exercise → the default */
  const restFor = (e) => (e && e.rest != null ? +e.rest : e && db.settings.restEx && db.settings.restEx[e.id] != null ? +db.settings.restEx[e.id] : +db.settings.rest || 0);
  const restTxt = (sec) => (sec ? clock(sec) : T("off", "aus"));
  /* supersets: neighbours with the same ss belong together; letters A, B, C … in order */
  function ssInfo(list, i) {
    const g = list[i] && list[i].ss; if (!g) return null;
    const ids = []; list.forEach((e) => { if (e.ss && !ids.includes(e.ss)) ids.push(e.ss); });
    let a = i, b = i; while (a > 0 && list[a - 1].ss === g) a--; while (b < list.length - 1 && list[b + 1].ss === g) b++;
    return { letter: String.fromCharCode(65 + ids.indexOf(g)), pos: i - a + 1, len: b - a + 1, first: i === a, last: i === b, next: i < b ? i + 1 : null, start: a };
  }
  function fixSS(list) { list.forEach((e, i) => { if (e.ss && !(list[i - 1] && list[i - 1].ss === e.ss) && !(list[i + 1] && list[i + 1].ss === e.ss)) delete e.ss; }); }
  function placeholders(e, x, last) {
    const out = [], tr = String(e.tr || "").match(/\d+/);
    const lastW = last ? last.e.sets.filter((q) => !q.wu && !q.drop) : [], lastA = last ? last.e.sets.filter((q) => q.wu) : [], lastD = last ? last.e.sets.filter((q) => q.drop) : [];
    let pw = "", pr = "", pt = "", nw = 0, na = 0, nd = 0;
    e.sets.forEach((s, j) => {
      if (s.drop) {   // drop set: what you did last time as drop, otherwise about 20 % less than the set before
        const ld = lastD[nd++], before = e.sets[j - 1], bw = before ? parseNum(before.w !== "" ? before.w : out[j - 1] ? out[j - 1].w : "") : null;
        out.push({ w: ld ? fmtIn(ld.w) : bw ? fmtIn(Math.max(0, Math.floor((bw * 0.8) / 2.5) * 2.5)) : "", r: ld ? fmtIn(ld.r) : "", t: "", prev: ld ? setTxt(ld, x.kind) : "–" });
        return;
      }
      const ls = s.wu ? lastA[na++] : lastW[nw++], match = !!ls;
      let w = match ? fmtIn(ls.w) : pw, r = match ? fmtIn(ls.r) : pr || (tr && !s.wu && x.kind !== "time" ? tr[0] : ""), t = match ? fmtIn(ls.t) : pt || (tr && x.kind === "time" ? tr[0] : "");
      if (x.kind === "bw" && (w === "0" || w === "")) w = "";
      out.push({ w, r, t, prev: ls ? setTxt(ls, x.kind) : "–" });
      if (!s.wu) { pw = s.w !== "" ? s.w : w; pr = s.r !== "" ? s.r : r; pt = s.t !== "" ? s.t : t; }
    });
    return out;
  }
  function exCard(e, i, d) {
    const x = exOf(e.id), last = lastFor(e.id, d, e.lv), tm = x.kind === "time", ph = placeholders(e, x, last);
    let n = 0;
    const lastWork = (() => { let k = -1; e.sets.forEach((s, j) => { if (s.done && !s.wu && !s.drop) k = j; }); return k; })();
    const rows = e.sets.map((s, j) => {
      const label = s.wu ? T("W", "A") : s.drop ? "D" : String(++n), p = ph[j], id = `s-${i}-${j}`;
      const dropBtn = x.kind === "kg" && j === lastWork && !(e.sets[j + 1] && e.sets[j + 1].drop) ? `<button type="button" class="dropadd" data-action="set-drop" data-arg="${i}:${j}">+ ${esc(T("Drop set", "Dropsatz"))} <span>${esc(T("less weight, right away", "weniger Gewicht, direkt danach"))}</span></button>` : "";
      return `<div class="setgrid setrow${s.done ? " done" : ""}${tm ? " tm" : ""}${s.drop ? " drop" : ""}">
        <button type="button" class="setno${s.wu ? " wu" : ""}${s.drop ? " dr" : ""}" data-action="set-wu" data-arg="${i}:${j}" aria-label="${esc(T(`Set ${label} – tap: warm-up / drop set / normal`, `Satz ${label} – antippen: Aufwärmsatz / Dropsatz / normal`))}">${label}</button>
        <span class="prev">${esc(p.prev)}</span>
        ${tm ? `<input class="sin" id="${id}-t" data-i="${i}" data-j="${j}" data-f="t" inputmode="numeric" autocomplete="off" placeholder="${esc(p.t)}" value="${esc(s.t)}" aria-label="${esc(T("Seconds", "Sekunden"))}">`
          : `<input class="sin" id="${id}-w" data-i="${i}" data-j="${j}" data-f="w" inputmode="decimal" autocomplete="off" placeholder="${esc(p.w || (x.kind === "bw" ? "0" : ""))}" value="${esc(s.w)}" aria-label="${esc(x.kind === "bw" ? T("Added weight in kg", "Zusatzgewicht in kg") : T("Weight in kg", "Gewicht in kg"))}"><input class="sin" id="${id}-r" data-i="${i}" data-j="${j}" data-f="r" inputmode="numeric" autocomplete="off" placeholder="${esc(p.r)}" value="${esc(s.r)}" aria-label="${esc(T("Reps", "Wiederholungen"))}">`}
        <button type="button" class="setchk" data-action="set-done" data-arg="${i}:${j}" aria-pressed="${s.done}" aria-label="${esc(T(`Tick off set ${label}`, `Satz ${label} abhaken`))}">✓</button>
      </div>${dropBtn}`;
    }).join("");
    const goal = todayGoal(e, x, last), ss = ssInfo(d.ex, i), rs = restFor(e);
    const lastTxt = last ? `${esc(T("Last time", "Letztes Mal"))} (${esc(dayMonth.format(isoDate(last.s.date)))}): <b>${esc(setsSummary(last.e, x.kind))}</b>` : esc(T("First time – good luck!", "Zum ersten Mal dabei – viel Erfolg!"));
    const armed = state.armed === `ex-del:${i}`;
    const lvSel = hasLv(x) ? `<label class="lvrow"><span class="label">${esc(T("Level", "Stufe"))}</span><select class="psel lvsel" data-i="${i}" aria-label="${esc(T("Level", "Stufe"))}">${x.lv.map((_, k) => `<option value="${k}"${lvKey(x, e.lv) === k ? " selected" : ""}>${k + 1}. ${esc(lvName(x, k))}</option>`).join("")}</select></label>` : "";
    return `<section class="card excard${ss ? ` ss${ss.first ? " ssfirst" : ""}${ss.last ? " sslast" : ""}` : ""}" data-ex="${i}">
      ${ss ? `<span class="sstag">${esc(T("Superset", "Supersatz"))} ${ss.letter}${ss.pos} <small>${esc(ss.last ? T("rest after this one", "danach Pause") : T("straight to the next, no rest", "direkt weiter, ohne Pause"))}</small></span>` : ""}
      <div class="exhead">${badgeEx(x)}<button type="button" class="exname" data-action="xm" data-arg="d:${i}" aria-label="${esc(T(`${exName(x)} – options: swap, edit, move, remove`, `${exName(x)} – Optionen: tauschen, bearbeiten, verschieben, entfernen`))}"><b>${esc(exName(x))}</b><span class="exmeta"><i style="background:${GROUP_COLORS[x.group] || "#D4D4D8"}"></i>${esc(groupName(x.group))} · ${esc(kindShort(x.kind))}${e.tr ? ` · ${esc(T("Target", "Ziel"))} ${esc(e.tr)} ${tm ? "s" : T("reps", "Wdh.")}` : ""}</span></button>
        <span class="exbtns">${armed ? `<button type="button" class="btn sm danger armed" data-action="ex-del" data-arg="${i}">${esc(T("Remove?", "Weg?"))}</button>` : `<button type="button" class="mbtn sm xmbtn" data-action="xm" data-arg="d:${i}" aria-label="${esc(T("Exercise options", "Optionen zur Übung"))}">⋯</button>`}</span></div>
      ${lvSel}
      <p class="lasttime">${lastTxt}</p>
      ${goal ? `<p class="todaygoal"><span class="label">${esc(T("Today", "Heute"))}</span><span>${goal}</span></p>` : ""}
      <div class="sets">
        <div class="setgrid sethead${tm ? " tm" : ""}" aria-hidden="true"><span>${esc(T("Set", "Satz"))}</span><span>${esc(T("Previous", "Vorher"))}</span>${tm ? `<span>${esc(T("Sec", "Sek."))}</span>` : `<span>${x.kind === "bw" ? "+kg" : "kg"}</span><span>${esc(T("Reps", "Wdh."))}</span>`}<span>✓</span></div>
        ${rows}
      </div>
      <div class="btnrow"><button type="button" class="btn sm" data-action="set-add" data-arg="${i}">+ ${esc(T("Set", "Satz"))}</button>${e.sets.length ? `<button type="button" class="btn sm" data-action="set-del" data-arg="${i}">− ${esc(T("Set", "Satz"))}</button>` : ""}<button type="button" class="btn sm restchip" data-action="rest-ex" data-arg="d:${i}" aria-label="${esc(T("Rest for this exercise", "Pause für diese Übung"))}">⏱ ${esc(ss && !ss.last ? T("no rest", "ohne Pause") : restTxt(rs))}</button></div>
    </section>`;
  }
  /* "Today: 82.5 kg × 8" – the progression tip from the exercise screen, right where you need it */
  function todayGoal(e, x, last) {
    if (!last) return "";
    const work = last.e.sets.filter((q) => !q.wu && !q.drop && (x.kind === "time" ? +q.t > 0 : +q.r > 0)); if (!work.length) return "";
    const lv = hasLv(x) ? lvKey(x, e.lv) : null, sameLv = !hasLv(x) || last.e.lv == null || lvKey(x, last.e.lv) === lv;
    if (x.kind === "time") {
      const best = Math.max(...work.map((q) => +q.t));
      if (!sameLv) return esc(T("New level – start with short holds.", "Neue Stufe – mit kurzen Haltezeiten starten."));
      return hasLv(x) && lv < x.lv.length - 1 && best >= 30 ? T(`<b>${best + 5} s</b> – or try <b>${esc(lvName(x, lv + 1))}</b>`, `<b>${best + 5} s</b> – oder <b>${esc(lvName(x, lv + 1))}</b> probieren`) : T(`<b>${best + 5} s</b> in your best set`, `<b>${best + 5} s</b> im besten Satz`);
    }
    if (x.kind === "bw") {
      const best = Math.max(...work.map((q) => +q.r)), add = Math.max(...work.map((q) => +q.w || 0));
      if (!sameLv) return esc(T("New level – find your rep count.", "Neue Stufe – erst mal Wiederholungen finden."));
      return hasLv(x) && lv < x.lv.length - 1 && best >= 8 ? T(`<b>${best + 1} reps</b> – or try <b>${esc(lvName(x, lv + 1))}</b>`, `<b>${best + 1} Wdh.</b> – oder <b>${esc(lvName(x, lv + 1))}</b> probieren`) : T(`<b>${add ? `+${nf.format(add)} kg × ` : ""}${best + 1} reps</b> in your best set`, `<b>${add ? `+${nf.format(add)} kg × ` : ""}${best + 1} Wdh.</b> im besten Satz`);
    }
    const w = Math.max(...work.map((q) => +q.w || 0)), top = work.filter((q) => (+q.w || 0) === w);
    const nums = String(e.tr || last.e.tr || "").match(/\d+/g), hiR = nums ? +nums[nums.length - 1] : 12, loR = nums ? +nums[0] : null;
    const inc = /Beine|Rücken|Po/.test(x.group) && w >= 40 ? 5 : 2.5;
    if (Math.min(...top.map((q) => +q.r)) >= hiR) return T(`<b>${esc(kg(w + inc))}${loR ? ` × ${loR}–${hiR}` : ""}</b> – last time all sets at ${hiR} reps`, `<b>${esc(kg(w + inc))}${loR ? ` × ${loR}–${hiR}` : ""}</b> – letztes Mal alle Sätze mit ${hiR} Wdh.`);
    return T(`<b>${esc(kg(w))} × ${top.map((q) => Math.min(hiR, +q.r + 1)).join(" · ")}</b> – one more rep per set`, `<b>${esc(kg(w))} × ${top.map((q) => Math.min(hiR, +q.r + 1)).join(" · ")}</b> – eine Wdh. mehr pro Satz`);
  }
  function draftTotals(d) {
    let done = 0, vol = 0;
    for (const e of d.ex) { const k = exOf(e.id).kind; for (const s of e.sets) if (s.done && !s.wu) { if (!s.drop) done++; if (k === "kg") vol += (parseNum(s.w) || 0) * (parseNum(s.r) || 0); } }
    return { done, vol };
  }
  function viewLive() {
    const d = draft;
    if (!d) return `${backBar()}${emptyBox(T("No workout running", "Kein Training aktiv"), esc(T("Start a new one from the menu.", "Starte ein neues Training im Menü.")), `<button class="btn primary" data-action="start">${esc(T("Start workout", "Training starten"))}</button>`)}`;
    const edit = !!d.editOf, t = draftTotals(d), armed = state.armed === "discard";
    const ph = autoName(d.ex, d.sport);
    return `
      ${backBar(edit ? T("Cancel", "Abbrechen") : "")}
      <header class="livehead">
        <span class="label">${esc(edit ? T("Edit workout", "Training bearbeiten") : d.sport === "cali" ? T("Calisthenics session", "Calisthenics-Einheit") : T("Workout running", "Training läuft"))}</span>
        <input class="titlein" id="liveName" value="${esc(d.name)}" placeholder="${esc(ph === T("Workout", "Training") ? T("Name, e.g. Push", "Name, z. B. Push") : ph)}" maxlength="40" autocomplete="off" aria-label="${esc(T("Workout name", "Name des Trainings"))}">
        <div class="livemeta">${edit ? `<span>${esc(dayTxt(d.date))}</span>` : `<span>${esc(T("Time", "Zeit"))} <b class="clock" id="liveClock">${clock((Date.now() - d.start) / 1000)}</b></span>`}<span>${esc(T("Sets", "Sätze"))} <b id="liveSets">${t.done}</b></span><span>${esc(T("Volume", "Volumen"))} <b id="liveVol">${tons(t.vol)}</b></span></div>
      </header>
      ${d.ex.length ? d.ex.map((e, i) => exCard(e, i, d)).join("") : emptyBox(T("No exercise yet", "Noch keine Übung"), esc(T("Add exercises – or start a saved workout next time.", "Füge Übungen hinzu – oder starte beim nächsten Mal direkt ein gespeichertes Workout.")))}
      <button class="addex" data-action="pick-open" data-arg="draft">+ ${esc(T("Add exercise", "Übung hinzufügen"))}</button>
      ${d.ex.length ? `<p class="hint">${esc(T("Wrong exercise or muscle group? Tap the exercise name or ⋯ to swap, edit, move or remove it.", "Falsche Übung oder Muskelgruppe? Tippe auf den Übungsnamen oder ⋯, um sie zu tauschen, zu bearbeiten, zu verschieben oder zu entfernen."))}</p>` : ""}
      <details class="more" id="liveMore"${d.moreOpen ? " open" : ""}><summary>${esc(T("Date, duration & note", "Datum, Dauer & Notiz"))}</summary><div class="morebody">
        <div class="two"><div class="field"><label class="label" for="liveDate">${esc(T("Date", "Datum"))}</label><input type="date" id="liveDate" value="${esc(d.date)}" max="${todayISO()}"></div><div class="field"><label class="label" for="liveTime">${esc(T("Start", "Beginn"))}</label><input type="time" id="liveTime" value="${esc(d.time)}"></div></div>
        <div class="field"><label class="label" for="liveDur">${esc(T("Duration in minutes", "Dauer in Minuten"))}</label><input id="liveDur" inputmode="numeric" autocomplete="off" placeholder="${edit ? "" : esc(T("automatic from the timer", "automatisch aus der Zeit"))}" value="${esc(d.dur)}"></div>
        <div class="field"><label class="label" for="liveNote">${esc(T("Note", "Notiz"))}</label><textarea id="liveNote" maxlength="400" placeholder="${esc(T("How did it go? Sleep, form, pain …", "Wie lief's? Schlaf, Form, Schmerzen …"))}">${esc(d.note)}</textarea></div>
        <p class="hint">${esc(T("Tip: tap a set number for a warm-up set (W) – no records, no volume – or a drop set (D) – counts for volume, not for records.", "Tipp: Tippe auf die Satznummer: Aufwärmsatz (A) – zählt nicht für Rekorde und Volumen – oder Dropsatz (D) – zählt fürs Volumen, nicht für Rekorde."))}</p>
      </div></details>
      <div class="btnrow">
        <button class="btn primary grow1" data-action="finish">${esc(edit ? T("Save changes", "Änderungen speichern") : T("Finish workout", "Training beenden"))}</button>
        <button class="btn danger${armed ? " armed" : ""}" data-action="discard">${esc(armed ? (edit ? T("Really delete?", "Wirklich löschen?") : T("Really discard?", "Wirklich verwerfen?")) : edit ? T("Delete", "Löschen") : T("Discard", "Verwerfen"))}</button>
      </div>`;
  }
  function updateLiveMeta() { if (!draft) return; const t = draftTotals(draft); const a = $("liveSets"), b = $("liveVol"); if (a) a.textContent = t.done; if (b) b.textContent = tons(t.vol); }
  function rerenderCard(i) { const card = document.querySelector(`.excard[data-ex="${i}"]`); if (!card || !draft || !draft.ex[i]) { render(); return; } const tmp = document.createElement("div"); tmp.innerHTML = exCard(draft.ex[i], i, draft); card.replaceWith(tmp.firstElementChild); updateLiveMeta(); }

  /* ---------- Session detail ---------- */
  function viewSession(v) {
    const s = sessionById(v.p);
    if (!s) return `${backBar()}${emptyBox(T("Not found", "Nicht gefunden"), esc(T("This workout no longer exists.", "Dieses Training gibt es nicht mehr.")))}`;
    const D = derived(), t = sessionTot(s), prs = D.prs.get(s.id) || [];
    const blocks = (s.ex || []).map((e) => {
      const x = exOf(e.id), st = exStats(e, x.kind); let n = 0;
      const lines = e.sets.map((q) => {
        const lab = q.wu ? T("W", "A") : q.drop ? "D" : String(++n), best = q === st.best;
        const extra = x.kind === "kg" && !q.wu && !q.drop && +q.r > 0 ? `e1RM ${nf1.format(e1rmOf(+q.w, +q.r))}` : q.drop ? T("drop set", "Dropsatz") : "";
        return `<div class="sline${best ? " best" : ""}"><span class="n${q.wu ? " wu" : ""}${q.drop ? " dr" : ""}">${lab}</span><span class="w">${esc(setTxt(q, x.kind))}</span><span class="e">${extra}</span></div>`;
      }).join("");
      const key = x.kind === "kg" ? `e1RM ${nf1.format(st.e1rm)} kg` : x.kind === "bw" ? pl(st.total, "rep") : st.time ? secTxt(st.time) : "";
      return `<section class="sec"><div class="sechead"><button class="more" style="color:var(--ink);text-align:left" data-action="ex" data-arg="${esc(e.id)}"><span class="sectitle" style="font-size:20px">${esc(exName(x))} ›</span></button><span class="label">${esc(key)}</span></div>${hasLv(x) ? `<p class="hint" style="margin:-2px 0 4px">${esc(T("Level", "Stufe"))}: ${esc(lvName(x, lvKey(x, e.lv)))}</p>` : ""}<div class="setlines">${lines}</div></section>`;
    }).join("");
    const prHTML = prs.length ? `<section class="card prcard"><span class="label">${esc(prs.length === 1 ? T("New record", "Neuer Rekord") : T(`${prs.length} new records`, `${prs.length} neue Rekorde`))}</span><div class="prlist">${prs.map((p) => {
      const m = METRIC[p.type], x = exOf(p.ex); return `<div><span>${esc(exName(x))}${hasLv(x) ? ` (${esc(lvName(x, p.lv))})` : ""} · ${esc(metricLabel(p.type, p.kind))}</span><b>${esc(m.fmt(p.value))} <span class="pos">+${esc(m.fmt(p.value - p.prev).replace(/^\+/, ""))}</span></b></div>`;
    }).join("")}</div></section>` : "";
    return `
      ${backBar()}
      <h1 class="vtitle">${esc(s.name || T("Workout", "Training"))}</h1>
      <p class="meta">${esc(dayTxt(s.date))}${s.time ? ` · ${esc(s.time)}${LANG === "de" ? " Uhr" : ""}` : ""} · ${esc(sportName(s.sport))}${s.example ? ` · ${esc(T("Sample", "Beispiel"))}` : ""}</p>
      ${v.fresh ? `<div class="notice" style="border-style:solid">${esc(T("Workout saved. Strong – keep it up!", "Training gespeichert. Stark – weiter so!"))}</div>` : ""}
      ${st3([T("Duration", "Dauer"), durTxt(s.dur)], [T("Volume", "Volumen"), tons(t.vol)], [T("Sets", "Sätze"), String(t.sets)])}
      ${prHTML}
      ${blocks}
      ${s.note ? `<section class="card"><span class="label">${esc(T("Note", "Notiz"))}</span><p style="white-space:pre-wrap">${esc(s.note)}</p></section>` : ""}
      <div class="btnrow"><button class="btn primary grow1" data-action="repeat" data-arg="${esc(s.id)}">${esc(T("Train this again", "Nochmal trainieren"))}</button><button class="btn" data-action="edit-session" data-arg="${esc(s.id)}">${esc(T("Edit", "Bearbeiten"))}</button></div>
      <div class="btnrow"><button class="btn" data-action="tpl-from" data-arg="${esc(s.id)}">${esc(T("Save as workout", "Als Workout speichern"))}</button></div>`;
  }

  /* ---------- History ---------- */
  function viewHistory(v, emb) {
    const D = derived(), f = state.histFilter;
    const list = D.desc.filter((s) => f === "all" || s.sport === f);
    const chips = [["all", T("All", "Alle"), ""]].concat(Object.keys(SPORTS).map((k) => [k, sportName(k), SPORTS[k].color]))
      .map(([k, t, c]) => `<button class="fchip" data-action="hist-filter" data-arg="${k}" aria-pressed="${f === k}">${c ? `<i style="background:${c}"></i>` : ""}${esc(t)}</button>`).join("");
    return `
      ${emb ? "" : `${backBar()}<h1 class="vtitle">${esc(T("History", "Verlauf"))}</h1>`}
      <p class="meta">${pl(list.length, "session")}${list.length ? ` · ${esc(T("total", "insgesamt"))} ${durTxt(list.reduce((a, s) => a + (s.dur || 0), 0))}` : ""}</p>
      <div class="chiprow" role="group" aria-label="${esc(T("Sport", "Sportart"))}">${chips}</div>
      <section class="sec">${list.length ? monthGroups(list, state.histN) : emptyBox(T("Nothing here yet", "Noch nichts hier"), esc(T("As soon as you finish a workout or log a run, it shows up here.", "Sobald du ein Training beendest oder einen Lauf einträgst, erscheint es hier.")), `<button class="btn primary" data-action="start">${esc(T("Start workout", "Training starten"))}</button>`)}
        ${list.length > state.histN ? `<button class="more" data-action="hist-more">${esc(T("Show more", "Weitere anzeigen"))} (${list.length - state.histN})</button>` : ""}</section>`;
  }

  /* ---------- Gym progress ---------- */
  function viewProgress(v, emb) {
    const D = derived(), gym = D.desc.filter((s) => s.sport === "gym"), head = emb ? "" : `${backBar()}<h1 class="vtitle">${esc(T("Gym progress", "Gym-Fortschritt"))}</h1>`;
    if (!gym.length) return `${head}${emptyBox(T("No workouts yet", "Noch keine Trainings"), esc(T("Start your first workout – then you'll see volume, records and the history of every exercise as charts here.", "Starte dein erstes Training – danach siehst du hier Volumen, Rekorde und den Verlauf jeder Übung als Grafik.")), `<button class="btn primary" data-action="start">${esc(T("Start workout", "Training starten"))}</button><button class="btn" data-action="examples">${esc(T("Load sample data", "Beispieldaten laden"))}</button>`)}`;
    const rg = state.pRange, m = state.pMetric, { list: bk, unit } = bucketsFor(rg);
    const fn = m === "vol" ? (s) => sessionTot(s).vol : m === "sets" ? (s) => sessionTot(s).sets : () => 1;
    const vals = bk.map((b) => sumIn(gym, b, fn));
    const fmt = m === "vol" ? tons : m === "sets" ? (v) => pl(v, "set") : (v) => pl(v, "workout");
    const full = vals.slice(0, -1), avg = full.length ? full.reduce((a, b) => a + b, 0) / full.length : vals[0];
    const avgTxt = m === "vol" ? tons(avg) : m === "sets" ? `${nf0.format(avg)} ${nounOnly(2, "set")}` : `${nf1.format(avg)} ${nounOnly(2, "workout")}`;
    const mName = { vol: T("Volume", "Volumen"), count: T("Workouts", "Trainings"), sets: T("Sets", "Sätze") }[m];
    const chart = chartBlock("chProg", {
      bars: true, points: vals.map((v) => ({ value: v })), ticks: bucketTicks(bk, unit), color: "var(--accent)", partialLast: true, minStep: m === "vol" ? 500 : 1,
      yfmt: m === "vol" ? (v) => (v >= 1000 ? `${nf1.format(v / 1000)} t` : nf0.format(v)) : (v) => nf0.format(v), aria: `${mName} ${perUnit(unit)}`
    }, {
      label: `${mName} ${perUnit(unit)} · Ø`, base: { v: avgTxt, sub: `${esc(curUnit(unit))}: ${esc(fmt(vals[vals.length - 1]))}` },
      at: (i) => ({ v: fmt(vals[i]), sub: esc(bucketLabel(bk[i], unit)) + (i === vals.length - 1 ? ` · ${esc(T("in progress", "läuft noch"))}` : "") })
    }, `<span><i style="border-color:var(--accent);border-top-width:6px"></i>${esc(mName)} ${esc(perUnit(unit))}</span>`);
    const from = bk[0].from, inR = gym.filter((s) => s.date >= from);
    let prN = 0; for (const s of inR) prN += (D.prs.get(s.id) || []).length;
    const win = state.gWin, gFrom = win === "week" ? weekStart(todayISO()) : addDays(weekStart(todayISO()), -28), gTo = win === "week" ? todayISO() : addDays(weekStart(todayISO()), -1);
    const gc = {}; for (const s of D.desc) { if (!isLift(s) || s.date < gFrom || s.date > gTo) continue; for (const e of s.ex) { const x = exOf(e.id), st = exStats(e, x.kind); gc[x.group] = (gc[x.group] || 0) + st.sets; } }
    const div = win === "week" ? 1 : 4, gmax = Math.max(20, ...Object.values(gc).map((v) => v / div));
    const groups = GROUPS.filter((g) => gc[g]).sort((a, b) => gc[b] - gc[a]).map((g) => {
      const v = gc[g] / div;
      return `<div class="grow">${badge(groupName(g), GROUP_COLORS[g])}<div class="main"><div class="split"><b>${esc(groupName(g))}</b><span class="val">${win === "week" ? pl(v, "set") : `Ø ${nf1.format(v)} ${nounOnly(2, "set")}`}</span></div><div class="bar"><span style="width:${((v / gmax) * 100).toFixed(1)}%;background:${GROUP_COLORS[g]}"></span><i style="left:${((10 / gmax) * 100).toFixed(1)}%"></i></div></div><span></span></div>`;
    }).join("");
    const exRows = [...D.byEx.entries()].filter(([id]) => !exOf(id).cali || exOf(id).cali === "basic").map(([exId, hist]) => ({ exId, hist, last: hist[hist.length - 1].s.date })).sort((a, b) => b.last.localeCompare(a.last));
    const shown = state.exAll ? exRows : exRows.slice(0, 10);
    const exHTML = shown.map(({ exId, hist }) => exProgressRow(exId, hist)).join("");
    return `
      ${head}
      <div class="ctlrow">${pills("p-metric", m, [["vol", T("Volume", "Volumen")], ["count", T("Workouts", "Trainings")], ["sets", T("Sets", "Sätze")]], T("Metric", "Kennzahl"))}${rangePills("p-range", rg, ["12w", "6m", "1y"])}</div>
      ${chart}
      ${st3([T("Workouts", "Trainings"), String(inR.length)], [T("Sets", "Sätze"), nf0.format(inR.reduce((a, s) => a + sessionTot(s).sets, 0))], [T("Records", "Rekorde"), String(prN), "var(--accent)"])}
      <section class="sec"><div class="sechead"><h2 class="sectitle">${esc(T("Exercises", "Übungen"))}</h2><span class="label">${esc(T("Latest best", "Bester Wert zuletzt"))}</span></div>${exHTML}
        ${exRows.length > 10 && !state.exAll ? `<button class="more" data-action="ex-all">${esc(T(`Show all ${exRows.length} exercises`, `Alle ${exRows.length} Übungen anzeigen`))}</button>` : ""}</section>
      <section class="sec"><div class="sechead"><h2 class="sectitle">${esc(T("Muscle groups", "Muskelgruppen"))}</h2><span class="label">${esc(T("Sets", "Sätze"))}</span></div>${pills("g-win", win, [["week", T("This week", "Diese Woche")], ["4w", T("Avg. 4 weeks", "Ø 4 Wochen")]], T("Period", "Zeitraum"))}
        ${groups || `<p class="hint" style="padding:10px 0">${esc(win === "week" ? T("No sets this week yet.", "Diese Woche noch keine Sätze.") : T("No sets in the last 4 weeks.", "Keine Sätze in den letzten 4 Wochen."))}</p>`}
        <p class="hint" style="margin-top:10px">${esc(T("Counts hard sets without warm-ups, gym and calisthenics. The mark shows 10 sets a week – a common guideline for muscle growth is about 10–20.", "Gezählt werden harte Sätze ohne Aufwärmsätze, Gym und Calisthenics. Der Strich markiert 10 Sätze pro Woche – ein gängiger Richtwert für Muskelaufbau liegt bei etwa 10–20."))}</p></section>`;
  }
  function exProgressRow(exId, hist) {
    const x = exOf(exId), mm = metricsFor(x.kind)[0], top = hasLv(x) ? hist.reduce((a, h) => Math.max(a, h.lv), 0) : null;
    const H = hasLv(x) ? hist.filter((h) => h.lv === top) : hist, series = H.map((h) => h.st[mm]);
    const lastV = series[series.length - 1], cut = addDays(todayISO(), -84), base = H.find((h) => h.s.date >= cut);
    const delta = base && base !== H[H.length - 1] && base.st[mm] ? (lastV - base.st[mm]) / base.st[mm] : null;
    const dTxt = delta == null ? `<small>${esc(rel(H[H.length - 1].s.date))}</small>` : `<small class="${delta >= 0 ? "pos" : "neg"}">${delta >= 0 ? "+" : "−"}${nf0.format(Math.abs(delta * 100))} % ${esc(T("in 12 W", "in 12 W"))}</small>`;
    const sub = hasLv(x) ? `${ladder(x, top)} ${esc(lvName(x, top))}` : `${pl(hist.length, "workout")} · ${esc(metricLabel(mm, x.kind))}`;
    return `<button class="row" data-action="ex" data-arg="${esc(exId)}" style="grid-template-columns:auto minmax(0,1fr) auto auto auto;gap:10px">${badgeEx(x)}<span class="main"><span class="t1">${esc(exName(x))}</span><span class="t2">${sub}</span></span><span>${spark(series.slice(-10), GROUP_COLORS[x.group], 54)}</span><span class="val">${esc(METRIC[mm].fmt(lastV))}${dTxt}</span><span class="chev" aria-hidden="true">›</span></button>`;
  }

  /* ---------- One exercise ---------- */
  function viewExercise(v) {
    const x = exOf(v.p), all = derived().byEx.get(x.id) || [];
    const lvOn = hasLv(x), lv = lvOn ? (state.exLv[x.id] != null ? state.exLv[x.id] : Math.max(0, topLevel(x.id))) : null;
    const hist = lvOn ? all.filter((h) => h.lv === lv) : all;
    const ms = metricsFor(x.kind), m = ms.includes(state.exMetric[x.kind]) ? state.exMetric[x.kind] : ms[0], M = METRIC[m];
    const rg = state.exRange, months = RANGES[rg], today = todayISO();
    const from = months ? addMonths(today.slice(0, 8) + "01", -(months - 1)) : hist.length ? hist[0].s.date : today;
    const H = hist.filter((h) => h.s.date >= from && h.st[m] > 0);
    const span = Math.max(1, daysBetween(from, today));
    const allBest = hist.reduce((a, h) => Math.max(a, h.st[m] || 0), 0);
    const head = `${backBar()}<h1 class="vtitle">${esc(exName(x))}</h1><p class="meta">${esc(groupName(x.group))} · ${esc(kindText(x.kind))}${x.cali ? " · Calisthenics" : ""}${x.base ? "" : ` · ${esc(T("own exercise", "eigene Übung"))}`}</p>`;
    const editBtn = `<div class="btnrow"><button class="btn" data-action="ex-edit" data-arg="${esc(x.id)}">${esc(T("Edit exercise", "Übung bearbeiten"))}</button></div>`;
    const lvPills = lvOn ? `<div class="chiprow" role="group" aria-label="${esc(T("Level", "Stufe"))}">${x.lv.map((_, k) => { const has = all.some((h) => h.lv === k); return `<button class="fchip" data-action="ex-lv" data-arg="${k}" aria-pressed="${k === lv}">${has ? `<i style="background:${GROUP_COLORS[x.group]}"></i>` : ""}${k + 1}. ${esc(lvName(x, k))}</button>`; }).join("")}</div>` : "";
    const ladderCard = lvOn ? `<section class="card"><span class="label">${esc(T("Progression", "Progression"))}</span><div class="prlist">${x.lv.map((_, k) => {
      const hk = all.filter((h) => h.lv === k), b = hk.reduce((a, h) => (!a || h.st[ms[0]] > a.st[ms[0]] ? h : a), null);
      return `<div><span>${k + 1}. ${esc(lvName(x, k))}</span><b>${b ? `${esc(METRIC[ms[0]].fmt(b.st[ms[0]]))}<small>${esc(dateFmt.format(isoDate(b.s.date)))}</small>` : `<span class="hint">–</span>`}</b></div>`;
    }).join("")}</div></section>` : "";
    if (!all.length) return `${head}${lvOn ? ladderCard : ""}${emptyBox(T("No data yet", "Noch keine Daten"), esc(T("As soon as you log this exercise in a workout, your progress shows up here as a chart.", "Sobald du diese Übung in einem Training einträgst, siehst du hier deinen Fortschritt als Grafik.")))}${editBtn}`;
    const ctl = `<div class="ctlrow">${ms.length > 1 ? pills("ex-metric", m, ms.map((k) => [k, metricLabel(k, x.kind)]), T("Metric", "Kennzahl")) : `<span class="label">${esc(metricLong(m, x.kind))}</span>`}${rangePills("ex-range", rg, ["3m", "6m", "1y", "all"])}</div>`;
    let chart;
    if (!H.length) chart = `<div class="chart-empty">${esc(lvOn ? T("No sessions at this level in this period.", "Keine Einheit auf dieser Stufe im Zeitraum.") : T("No workout in this period.", "Kein Training in diesem Zeitraum."))}</div>`;
    else {
      const first = H[0], lastH = H[H.length - 1], d0 = lastH.st[m] - first.st[m];
      const deltaTxt = H.length > 1 ? `<span class="${d0 >= 0 ? "pos" : "neg"}">${d0 >= 0 ? "+" : "−"}${esc(M.fmt(Math.abs(d0)))}</span> ${esc(T("since", "seit"))} ${esc(dateFmt.format(isoDate(first.s.date)))}` : esc(T("First entry in this period", "Erster Eintrag im Zeitraum"));
      const subOf = (h) => `${esc(dateFmt.format(isoDate(h.s.date)))} · ${esc(setsSummary(h.e, x.kind))}`;
      chart = chartBlock("chEx", {
        points: H.map((h) => ({ value: h.st[m], x: clamp(daysBetween(from, h.s.date) / span, 0, 1), pr: (h.pr || []).includes(m) })),
        ticks: monthTicks(from, today), color: GROUP_COLORS[x.group] || "var(--accent)", minStep: M.step, steps: m === "time" ? [5, 10, 15, 30, 60, 120] : null,
        limit: allBest, limitLabel: T("Record", "Rekord"), limitFmt: M.fmt, yfmt: yfmtFor(m), aria: `${metricLong(m, x.kind)} ${exName(x)}`
      }, {
        label: `${metricLong(m, x.kind)}${lvOn ? ` · ${lvName(x, lv)}` : ""} · ${T("latest", "zuletzt")}`, base: { v: M.fmt(lastH.st[m]), sub: deltaTxt },
        at: (i) => ({ v: M.fmt(H[i].st[m]), sub: subOf(H[i]) })
      }, `<span><i style="border-color:${GROUP_COLORS[x.group]}"></i>${esc(metricLabel(m, x.kind))} ${esc(T("per workout", "je Training"))}</span><span><i style="border-color:var(--accent);border-top-style:dashed"></i>${esc(T("Record", "Rekord"))}</span>`);
    }
    const rec = (t) => { let best = null; for (const h of hist) if (!best || (h.st[t] || 0) > (best.st[t] || 0)) best = h; return best && best.st[t] ? best : null; };
    const recRow = (lab, h, val) => (h ? `<div><span>${esc(lab)}</span><b>${esc(val)}<small>${esc(dateFmt.format(isoDate(h.s.date)))}</small></b></div>` : "");
    let recs = "";
    if (x.kind === "kg") {
      const a = rec("e1rm"), b = rec("max"), c = rec("vol");
      let bs = null; for (const h of hist) for (const q of h.e.sets) if (!q.wu && +q.r > 0 && (!bs || +q.w * +q.r > +bs.q.w * +bs.q.r)) bs = { h, q };
      recs = recRow(T("Estimated 1RM", "Geschätztes 1RM"), a, a && `${kg(Math.round(a.st.e1rm * 2) / 2)} (${setTxt(a.st.best, "kg")})`) + recRow(T("Heaviest weight", "Schwerstes Gewicht"), b, b && kg(b.st.max)) + (bs ? recRow(T("Best set (kg × reps)", "Bester Satz (kg × Wdh.)"), bs.h, setTxt(bs.q, "kg")) : "") + recRow(T("Most volume", "Meistes Volumen"), c, c && tons(c.st.vol));
    } else if (x.kind === "bw") {
      const a = rec("reps"), b = rec("total"), c = rec("max");
      recs = recRow(T("Most reps in a set", "Meiste Wdh. in einem Satz"), a, a && pl(a.st.reps, "rep")) + recRow(T("Most reps per workout", "Meiste Wdh. pro Training"), b, b && pl(b.st.total, "rep")) + recRow(T("Most added weight", "Höchstes Zusatzgewicht"), c, c && `+${kg(c.st.max)}`);
    } else { const a = rec("time"), b = rec("total"); recs = recRow(T("Longest hold", "Längste Haltezeit"), a, a && secTxt(a.st.time)) + recRow(T("Total hold per workout", "Haltezeit pro Training"), b, b && secTxt(b.st.total)); }
    const lastH = hist.length ? hist[hist.length - 1] : all[all.length - 1];
    const tip = progressTip(lastH, x, hist.length ? lv : null);
    const rows = hist.slice().reverse().slice(0, 30).map((h) => `<button class="row" data-action="session" data-arg="${esc(h.s.id)}">${badgeSport(h.s.sport)}<span class="main"><span class="t1">${esc(setsSummary(h.e, x.kind))}${(h.pr || []).length ? `<span class="tag attn">PR</span>` : ""}</span><span class="t2">${esc(dayTxt(h.s.date))} · ${esc(h.s.name || T("Workout", "Training"))}</span></span><span class="val">${esc(METRIC[ms[0]].fmt(h.st[ms[0]]))}</span><span class="chev" aria-hidden="true">›</span></button>`).join("");
    return `
      ${head}
      ${lvPills}
      ${ctl}
      ${chart}
      ${st3([T("Workouts", "Trainings"), String(hist.length)], [T("Record", "Rekord"), allBest ? M.fmt(allBest) : "–", "var(--accent)"], [T("Last", "Zuletzt"), rel(lastH.s.date)])}
      ${tip}
      ${ladderCard}
      ${recs ? `<section class="card"><span class="label">${esc(T("Personal bests", "Bestwerte"))}${lvOn ? ` · ${esc(lvName(x, lv))}` : ""}</span><div class="prlist">${recs}</div></section>` : ""}
      ${rows ? `<section class="sec"><div class="sechead"><h2 class="sectitle">${esc(T("History", "Verlauf"))}</h2><span class="label">${esc(metricLabel(ms[0], x.kind))}</span></div>${rows}</section>` : ""}
      ${editBtn}`;
  }
  /* Double progression: all work sets at the top of the rep range → more weight, otherwise one more rep. Holds: +5 s; at 30 s+ try the next level. */
  function progressTip(h, x, lv) {
    if (!h) return "";
    const work = h.e.sets.filter((q) => !q.wu && (x.kind === "time" ? +q.t > 0 : +q.r > 0)); if (!work.length) return "";
    let text = "";
    if (x.kind === "time") {
      const best = Math.max(...work.map((q) => +q.t));
      const next = hasLv(x) && lv != null && lv < x.lv.length - 1 && best >= 30;
      text = next ? T(`You held ${best} s at <b>${esc(lvName(x, lv))}</b>. Time to try <b>${esc(lvName(x, lv + 1))}</b> – a few seconds count.`, `Du hältst ${best} s auf <b>${esc(lvName(x, lv))}</b>. Zeit für <b>${esc(lvName(x, lv + 1))}</b> – schon ein paar Sekunden zählen.`)
        : T(`Best hold last time: ${best} s. Next goal: <b>${best + 5} s</b>.`, `Beste Haltezeit letztes Mal: ${best} s. Nächstes Ziel: <b>${best + 5} s</b>.`);
    } else if (x.kind === "bw") {
      const best = Math.max(...work.map((q) => +q.r));
      const next = hasLv(x) && lv != null && lv < x.lv.length - 1 && best >= 8;
      text = next ? T(`${best} reps at <b>${esc(lvName(x, lv))}</b> – ready for <b>${esc(lvName(x, lv + 1))}</b>.`, `${best} Wdh. auf <b>${esc(lvName(x, lv))}</b> – bereit für <b>${esc(lvName(x, lv + 1))}</b>.`)
        : T(`Best set last time: ${best} reps. Next goal: <b>${best + 1}</b> in your best set.`, `Bester Satz letztes Mal: ${best} Wdh. Nächstes Ziel: <b>${best + 1}</b> im besten Satz.`);
    } else {
      const w = Math.max(...work.map((q) => +q.w || 0)), top = work.filter((q) => (+q.w || 0) === w);
      const nums = String(h.e.tr || "").match(/\d+/g), hiR = nums ? +nums[nums.length - 1] : null;
      const minR = Math.min(...top.map((q) => +q.r)), inc = /Beine|Rücken|Po/.test(x.group) && w >= 40 ? 5 : 2.5;
      const up = hiR ? minR >= hiR : minR >= 12, reps = top.map((q) => q.r).join(", ");
      text = up ? T(`All sets with ${kg(w)} done (${reps} reps). Next time: try <b>${esc(kg(w + inc))}</b>.`, `Alle Sätze mit ${kg(w)} geschafft (${reps} Wdh.). Nächstes Mal: <b>${esc(kg(w + inc))}</b> versuchen.`)
        : T(`Last time ${esc(kg(w))} × ${reps}. Next time: same weight, <b>one more rep</b> per set${hiR ? ` – up to ${hiR}, then more weight` : ""}.`, `Letztes Mal ${esc(kg(w))} × ${reps}. Nächstes Mal: gleiches Gewicht, <b>eine Wiederholung mehr</b> pro Satz${hiR ? ` – bis ${hiR} Wdh., dann mehr Gewicht` : ""}.`);
    }
    return `<section class="card"><span class="label">${esc(T("Next goal", "Nächstes Ziel"))}</span><p style="color:var(--ink)">${text}</p></section>`;
  }

  /* ---------- Calisthenics ---------- */
  function viewCali() {
    const D = derived(), cali = D.desc.filter((s) => s.sport === "cali"), d30 = addDays(todayISO(), -30);
    const in30 = cali.filter((s) => s.date >= d30);
    let pr30 = 0; for (const s of D.desc) { if (s.date < d30) break; for (const p of D.prs.get(s.id) || []) if (exOf(p.ex).cali) pr30++; }
    const lvls = CALI_EX.filter((c) => c[6]).reduce((a, c) => a + Math.max(0, topLevel("c:" + c[0]) + 1), 0);
    const bk = weekBuckets(12), vals = bk.map((b) => sumIn(cali, b, () => 1));
    const chart = cali.length ? chartBlock("chCali", { bars: true, points: vals.map((v) => ({ value: v })), ticks: bucketTicks(bk, "w"), color: SPORTS.cali.color, partialLast: true, minStep: 1, yfmt: (v) => nf0.format(v), aria: T("Sessions per week", "Einheiten pro Woche") }, {
      label: T("Sessions per week · last 12 weeks", "Einheiten pro Woche · letzte 12 Wochen"), base: { v: pl(in30.length, "session"), sub: esc(T("in the last 30 days", "in den letzten 30 Tagen")) },
      at: (i) => ({ v: pl(vals[i], "session"), sub: esc(bucketLabel(bk[i], "w")) })
    }, `<span><i style="border-color:${SPORTS.cali.color};border-top-width:6px"></i>${esc(T("Sessions per week", "Einheiten pro Woche"))}</span>`) : "";
    const sec = (ct) => {
      const xs = [...EX.values()].filter((x) => x.cali === ct && !x.hidden);
      const rows = xs.map((x) => {
        const hist = D.byEx.get(x.id) || [], top = hasLv(x) ? topLevel(x.id) : null;
        const H = hasLv(x) ? hist.filter((h) => h.lv === top) : hist, mm = metricsFor(x.kind)[0];
        const best = H.reduce((a, h) => Math.max(a, h.st[mm] || 0), 0);
        const sub = hasLv(x) ? (top >= 0 ? `${ladder(x, top)} ${esc(lvName(x, top))}` : `${ladder(x, -1)} ${esc(T("not started", "noch nicht begonnen"))}`) : hist.length ? `${pl(hist.length, "session")} · ${esc(rel(hist[hist.length - 1].s.date))}` : esc(T("not started", "noch nicht begonnen"));
        return `<button class="row" data-action="ex" data-arg="${esc(x.id)}">${badgeEx(x)}<span class="main"><span class="t1">${esc(exName(x))}</span><span class="t2">${sub}</span></span><span class="val">${best ? esc(METRIC[mm].fmt(best)) : ""}</span><span class="chev" aria-hidden="true">›</span></button>`;
      }).join("");
      const [, en, de] = CTYPES.find((c) => c[0] === ct);
      return `<section class="sec"><div class="sechead"><h2 class="sectitle">${esc(T(en, de))}</h2><span class="label">${esc(ct === "static" ? T("Best hold", "Beste Haltezeit") : T("Best set", "Bester Satz"))}</span></div>${rows}</section>`;
    };
    return `
      ${backBar()}
      <h1 class="vtitle">Calisthenics</h1>
      <p class="meta">${esc(T("Skills with progression levels – log holds in seconds and reps per set. Tap a skill for its chart and levels.", "Skills mit Progressionsstufen – Haltezeiten in Sekunden und Wiederholungen pro Satz. Tippe auf einen Skill für Verlauf und Stufen."))}</p>
      <button class="addbig" data-action="start-cali"><span aria-hidden="true">+</span>${esc(draft && !draft.editOf ? T("Resume workout", "Weiter trainieren") : T("Start session", "Einheit starten"))}</button>
      ${chart}
      ${st3([T("30 days", "30 Tage"), pl(in30.length, "session")], [T("Levels reached", "Stufen erreicht"), String(lvls)], [T("Records", "Rekorde"), String(pr30), "var(--accent)"])}
      ${sec("static")}${sec("dynamic")}${sec("basic")}
      <p class="hint">${esc(T("Own calisthenics exercises: Settings → Exercises → + Exercise, tick “Calisthenics”.", "Eigene Calisthenics-Übungen: Einstellungen → Übungen → + Übung, „Calisthenics\" anhaken."))}</p>`;
  }

  /* ---------- Workouts (templates) ---------- */
  function viewWorkouts() {
    const D = derived();
    const lastUse = (t) => { const s = D.desc.find((q) => q.tpl === t.id); return s ? rel(s.date) : null; };
    const rows = db.templates.map((t) => {
      const sets = t.items.reduce((a, it) => a + (it.sets || 0), 0), lu = lastUse(t), cali = t.items.length && t.items.every((it) => exOf(it.ex).cali);
      return navRow("tpl", t.id, `${esc(t.name || T("Untitled", "Ohne Namen"))}${t.example ? `<span class="tag">${esc(T("Sample", "Beispiel"))}</span>` : ""}`, `${pl(t.items.length, "exercise")} · ${pl(sets, "set")}${lu ? ` · ${esc(T("last", "zuletzt"))} ${esc(lu)}` : ""}`, "", badge(t.name || "W", cali ? SPORTS.cali.color : "#FFE83A"));
    }).join("");
    return `
      ${backBar()}
      <h1 class="vtitle">Workouts</h1>
      <p class="meta">${esc(T("Your plans. When you start one, exercises and sets are already there – you only enter weight and reps.", "Deine Trainingspläne. Beim Start sind Übungen und Sätze schon da – du trägst nur noch Gewicht und Wiederholungen ein."))}</p>
      <section class="sec">${rows || emptyBox(T("No workouts yet", "Noch keine Workouts"), esc(T("Build e.g. Push, Pull and Legs – or load ready-made templates and adjust them.", "Bau dir z. B. Push, Pull und Beine – oder lade fertige Vorlagen und pass sie an.")), `<button class="btn primary" data-action="tpl-new">${esc(T("New workout", "Neues Workout"))}</button><button class="btn" data-action="tpl-samples">${esc(T("Load templates", "Vorlagen laden"))}</button>`)}</section>`;
  }
  function viewTpl(v) {
    const t = tplById(v.p);
    if (!t) return `${backBar()}${emptyBox(T("Not found", "Nicht gefunden"), esc(T("This workout no longer exists.", "Dieses Workout gibt es nicht mehr.")))}`;
    const sets = t.items.reduce((a, it) => a + (it.sets || 0), 0);
    const rows = t.items.map((it, i) => {
      const x = exOf(it.ex), last = lastFor(it.ex, null, it.lv), armed = state.armed === `tpl-ex:${i}`, ss = ssInfo(t.items, i);
      return `<div class="tplrow${ss ? ` ss${ss.first ? " ssfirst" : ""}${ss.last ? " sslast" : ""}` : ""}">${ss ? `<span class="sstag">${esc(T("Superset", "Supersatz"))} ${ss.letter}${ss.pos}</span>` : ""}
        <div class="top">${badgeEx(x)}<button type="button" class="tplname" data-action="xm" data-arg="t:${i}"><span class="t1">${esc(exName(x))}${hasLv(x) ? ` <span class="tag">${esc(lvName(x, lvKey(x, it.lv)))}</span>` : ""}</span><span class="t2 exmeta"><i style="background:${GROUP_COLORS[x.group] || "#D4D4D8"}"></i>${esc(groupName(x.group))} · ${esc(kindShort(x.kind))}${last ? ` · ${esc(T("last", "zuletzt"))} ${esc(setsSummary(last.e, x.kind))}` : ""}</span></button>
          <span class="exbtns">${armed ? `<button class="btn sm danger armed" data-action="tpl-ex-del" data-arg="${i}">${esc(T("Remove?", "Weg?"))}</button>` : `<button class="mbtn sm xmbtn" data-action="xm" data-arg="t:${i}" aria-label="${esc(T("Exercise options", "Optionen zur Übung"))}">⋯</button>`}</span></div>
        <div class="ctl"><span class="stepper"><span class="label">${esc(T("Sets", "Sätze"))}</span><button class="mbtn sm" data-action="tpl-sets" data-arg="${i}:-1" aria-label="${esc(T("One set less", "Ein Satz weniger"))}"${it.sets <= 1 ? " disabled" : ""}>−</button><b>${it.sets}</b><button class="mbtn sm" data-action="tpl-sets" data-arg="${i}:1" aria-label="${esc(T("One set more", "Ein Satz mehr"))}">+</button></span>
          <span class="stepper"><label class="label" for="rep-${i}">${esc(x.kind === "time" ? T("Sec", "Sek.") : T("Reps", "Wdh."))}</label><input class="repin" id="rep-${i}" data-i="${i}" value="${esc(it.reps || "")}" placeholder="${x.kind === "time" ? "20–30" : "8–12"}" maxlength="9" autocomplete="off"></span>
          ${hasLv(x) ? `<select class="psel tpllv" data-i="${i}" aria-label="${esc(T("Level", "Stufe"))}">${x.lv.map((_, k) => `<option value="${k}"${lvKey(x, it.lv) === k ? " selected" : ""}>${k + 1}. ${esc(lvName(x, k))}</option>`).join("")}</select>` : ""}
          <button type="button" class="btn sm restchip" data-action="rest-ex" data-arg="t:${i}">⏱ ${esc(ss && !ss.last ? T("no rest", "ohne Pause") : it.rest != null ? restTxt(+it.rest) : `${T("Default", "Standard")} ${restTxt(+db.settings.rest || 0)}`)}</button></div>
      </div>`;
    }).join("");
    const armed = state.armed === "tpl-del";
    return `
      ${backBar()}
      <input class="titlein" id="tplName" value="${esc(t.name)}" placeholder="${esc(T("Name, e.g. Push", "Name, z. B. Push"))}" maxlength="40" autocomplete="off" aria-label="${esc(T("Workout name", "Name des Workouts"))}">
      <p class="meta" style="margin:0">${pl(t.items.length, "exercise")} · ${pl(sets, "set")} · ${esc(T("approx.", "ca."))} ${Math.max(10, Math.round((sets * 2.6) / 5) * 5)} min</p>
      <button class="addbig sm" data-action="tpl-start" data-arg="${esc(t.id)}"${t.items.length ? "" : ' disabled style="opacity:.4"'}><span aria-hidden="true">▶</span>${esc(T("Start workout", "Training starten"))}</button>
      <section class="sec">${rows || `<p class="hint">${esc(T("Still empty. Add exercises in the order you train them.", "Noch leer. Füge die Übungen in der Reihenfolge hinzu, in der du sie trainierst."))}</p>`}</section>
      <button class="addex" data-action="pick-open" data-arg="tpl:${esc(t.id)}">+ ${esc(T("Add exercise", "Übung hinzufügen"))}</button>
      <p class="hint">${esc(T("A rep range (e.g. 8–12) enables the “Next goal” tip: once you hit the top of the range in all sets, PFT suggests more weight.", "Wdh. als Spanne (z. B. 8–12) aktiviert den Tipp „Nächstes Ziel\": Schaffst du in allen Sätzen die obere Grenze, schlägt PFT mehr Gewicht vor."))}</p>
      <div class="btnrow"><button class="btn" data-action="tpl-dup" data-arg="${esc(t.id)}">${esc(T("Duplicate", "Duplizieren"))}</button><button class="btn danger${armed ? " armed" : ""}" data-action="tpl-del" data-arg="${esc(t.id)}">${esc(armed ? T("Really delete?", "Wirklich löschen?") : T("Delete workout", "Workout löschen"))}</button></div>`;
  }

  /* ---------- Other sports ---------- */
  function viewSport(v) {
    const sp = v.p, S = SPORTS[sp], D = derived();
    const list = D.desc.filter((s) => s.sport === sp);
    const ms = sp === "run" ? [["dist", T("Distance", "Distanz")], ["pace", "Pace"], ["time", T("Time", "Zeit")]] : [["time", T("Time", "Zeit")], ["count", T("Sessions", "Einheiten")]];
    const m = ms.some(([k]) => k === state.spMetric[sp]) ? state.spMetric[sp] : ms[0][0];
    const rg = state.spRange, { list: bk, unit } = bucketsFor(rg), from = bk[0].from;
    const inR = list.filter((s) => s.date >= from);
    let chart = "";
    if (!list.length) chart = emptyBox(T("No session yet", "Noch keine Einheit"), esc(sp === "run" ? T("Log your first run – distance and time are enough, PFT works out the pace.", "Trag deinen ersten Lauf ein – Distanz und Zeit reichen, die Pace rechnet PFT aus.") : T("Log your first session – the duration is enough, everything else is optional.", "Trag deine erste Einheit ein – Dauer reicht, alles andere ist optional.")), `<button class="btn primary" data-action="act-new" data-arg="${sp}">${esc(T("Log", "Eintragen"))}</button>`);
    else if (m === "pace") {
      const runs = inR.filter((s) => s.dist > 0 && s.dur > 0).slice().reverse(), span = Math.max(1, daysBetween(from, todayISO()));
      if (!runs.length) chart = `<div class="chart-empty">${esc(T("No runs in this period.", "Keine Läufe in diesem Zeitraum."))}</div>`;
      else {
        const paces = runs.map((s) => s.dur / s.dist), best = Math.min(...paces), avgP = runs.reduce((a, s) => a + s.dur, 0) / runs.reduce((a, s) => a + s.dist, 0);
        chart = chartBlock("chSport", {
          points: runs.map((s, i) => ({ value: paces[i], x: clamp(daysBetween(from, s.date) / span, 0, 1) })), ticks: monthTicks(from, todayISO()), color: S.color, steps: [5, 10, 15, 20, 30, 60, 120, 300],
          yfmt: (vv) => clock(vv), aria: T("Pace per run", "Pace pro Lauf")
        }, {
          label: T("Average pace in period", "Ø Pace im Zeitraum"), base: { v: paceTxt(avgP), sub: `${esc(T("Fastest run", "Schnellster Lauf"))}: ${esc(paceTxt(best))}` },
          at: (i) => ({ v: paceTxt(paces[i]), sub: `${esc(dateFmt.format(isoDate(runs[i].date)))} · ${nf.format(runs[i].dist)} km ${esc(T("in", "in"))} ${clock(runs[i].dur)}` })
        }, `<span><i style="border-color:${S.color}"></i>${esc(T("Pace per run (min/km) – lower is faster", "Pace je Lauf (min/km) – niedriger ist schneller"))}</span>`);
      }
    } else {
      const fn = m === "dist" ? (s) => s.dist || 0 : m === "time" ? (s) => s.dur || 0 : () => 1;
      const vals = bk.map((b) => sumIn(list, b, fn)), full = vals.slice(0, -1), avg = full.length ? full.reduce((a, b) => a + b, 0) / full.length : vals[0];
      const fmt = m === "dist" ? (x) => `${nf1.format(x)} km` : m === "time" ? (x) => durTxt(x) : (x) => pl(x, "session");
      const avgFmt = m === "count" ? (x) => `${nf1.format(x)} ${nounOnly(2, "session")}` : fmt, mName = ms.find(([k]) => k === m)[1];
      chart = chartBlock("chSport", {
        bars: true, points: vals.map((x) => ({ value: m === "time" ? x / 60 : x })), ticks: bucketTicks(bk, unit), color: S.color, partialLast: true, minStep: 1,
        steps: m === "time" ? [15, 30, 60, 90, 120, 180, 240, 360, 480, 600, 900] : null,
        yfmt: m === "time" ? (x) => (x >= 60 ? `${Math.floor(x / 60)}:${pad(Math.round(x % 60))} h` : `${nf0.format(x)} min`) : (x) => nf.format(x), aria: `${sportName(sp)} ${perUnit(unit)}`
      }, {
        label: `${mName} ${perUnit(unit)} · Ø`, base: { v: avgFmt(avg), sub: `${esc(curUnit(unit))}: ${esc(fmt(vals[vals.length - 1]))}` },
        at: (i) => ({ v: fmt(vals[i]), sub: esc(bucketLabel(bk[i], unit)) + (i === vals.length - 1 ? ` · ${esc(T("in progress", "läuft noch"))}` : "") })
      }, `<span><i style="border-color:${S.color};border-top-width:6px"></i>${esc(mName)} ${esc(perUnit(unit))}</span>`);
    }
    let stats = "", recs = "";
    if (sp === "run") {
      const km = inR.reduce((a, s) => a + (s.dist || 0), 0), t = inR.reduce((a, s) => a + (s.dur || 0), 0);
      stats = st3([T("Runs", "Läufe"), String(inR.length)], [T("Kilometres", "Kilometer"), nf1.format(km)], [T("Avg. pace", "Ø Pace"), km ? paceTxt(t / km).replace(" /km", "") : "–"]);
      const longest = list.reduce((a, s) => (!a || (s.dist || 0) > (a.dist || 0) ? s : a), null);
      const fast = list.filter((s) => s.dist >= 3 && s.dur).reduce((a, s) => (!a || s.dur / s.dist < a.dur / a.dist ? s : a), null);
      const wk = {}; for (const s of list) { const w = weekStart(s.date); wk[w] = (wk[w] || 0) + (s.dist || 0); }
      const bestW = Object.entries(wk).sort((a, b) => b[1] - a[1])[0];
      const pb = (k, lab) => { const c = list.filter((s) => s.dist >= k * 0.98 && s.dist <= k * 1.05 && s.dur).reduce((a, s) => (!a || s.dur / s.dist < a.dur / a.dist ? s : a), null); return c ? recLine(lab, `${clock((c.dur / c.dist) * k)}`, c.date) : ""; };
      recs = (longest ? recLine(T("Longest run", "Längster Lauf"), `${nf.format(longest.dist)} km`, longest.date) : "") + (fast ? recLine(T("Fastest pace (3 km+)", "Schnellste Pace (ab 3 km)"), paceTxt(fast.dur / fast.dist), fast.date) : "") + pb(5, T("Best 5 km", "Bestzeit 5 km")) + pb(10, T("Best 10 km", "Bestzeit 10 km")) + pb(21.0975, T("Best half marathon", "Bestzeit Halbmarathon")) + (bestW ? recLine(T("Most km in a week", "Meiste km in einer Woche"), `${nf1.format(bestW[1])} km`, bestW[0]) : "");
    } else if (sp === "hyrox") {
      const races = list.filter((s) => s.kind === "Wettkampf" || s.kind === "Simulation"), best = races.reduce((a, s) => (!a || s.dur < a.dur ? s : a), null);
      stats = st3([T("Sessions", "Einheiten"), String(inR.length)], [T("Time", "Zeit"), durTxt(inR.reduce((a, s) => a + s.dur, 0))], [T("Races/sims", "Rennen/Sim."), String(inR.filter((s) => races.includes(s)).length)]);
      recs = best ? recLine(`${T("Best time", "Beste Zeit")} (${typeName(best.kind)})`, clock(best.dur), best.date) : "";
    } else if (sp === "fb") {
      const games = inR.filter((s) => s.kind === "Spiel");
      stats = st3([T("Sessions", "Einheiten"), String(inR.length)], [T("Matches", "Spiele"), String(games.length)], [T("Goals / assists", "Tore / Vorl."), `${inR.reduce((a, s) => a + (s.goals || 0), 0)} / ${inR.reduce((a, s) => a + (s.assists || 0), 0)}`]);
    } else {
      stats = st3([T("Sessions", "Einheiten"), String(inR.length)], [T("Time", "Zeit"), durTxt(inR.reduce((a, s) => a + s.dur, 0))], [T("Avg. duration", "Ø Dauer"), inR.length ? durTxt(inR.reduce((a, s) => a + s.dur, 0) / inR.length) : "–"]);
    }
    return `
      ${backBar()}
      <h1 class="vtitle">${esc(sportName(sp))}</h1>
      ${list.length ? `<div class="ctlrow">${pills("sp-metric", m, ms, T("Metric", "Kennzahl"))}${rangePills("sp-range", rg, ["12w", "6m", "1y"])}</div>` : ""}
      ${chart}
      ${list.length ? stats : ""}
      ${recs ? `<section class="card"><span class="label">${esc(T("Personal bests", "Bestwerte"))}</span><div class="prlist">${recs}</div></section>` : ""}
      ${list.length ? `<section class="sec"><div class="sechead"><h2 class="sectitle">${esc(T("Sessions", "Einheiten"))}</h2><span class="label">${pl(list.length, "entry")}</span></div>${monthGroups(list, state.histN)}</section>` : ""}`;
  }

  /* ---------- Settings ---------- */
  function viewSettings() {
    const nEx = [...EX.values()].filter((x) => !x.hidden).length, hasEx = db.sessions.some((s) => s.example) || db.templates.some((t) => t.example) || db.meals.some((m) => m.example);
    const restOpts = [[0, T("Off", "Aus")], [30, "0:30"], [45, "0:45"], [60, "1:00"], [90, "1:30"], [120, "2:00"], [150, "2:30"], [180, "3:00"], [240, "4:00"], [300, "5:00"]];
    const g = db.settings.goals;
    return `
      <h1 class="vtitle">${esc(T("More", "Mehr"))}</h1>
      <section class="card">
        <span class="label">${esc(T("Language", "Sprache"))}</span>
        <div class="seg" role="group" aria-label="${esc(T("Language", "Sprache"))}"><button data-action="lang" data-arg="en" aria-pressed="${LANG === "en"}">English</button><button data-action="lang" data-arg="de" aria-pressed="${LANG === "de"}">Deutsch</button></div>
        <p>${esc(T("Food and exercise names work in both languages when typing – e.g. “5 eggs” or “5 Eier”.", "Lebensmittel und Übungen verstehen beim Eintippen beide Sprachen – z. B. „5 Eier\" oder „5 eggs\"."))}</p>
      </section>
      <section class="card">
        <span class="label">${esc(T("Sports in the app", "Sportarten in der App"))}</span>
        ${OPT_SPORTS.map((k) => `<label class="check sportrow"><input type="checkbox" class="sportchk" data-sp="${k}"${sportOn(k) ? " checked" : ""}><span>${badgeSport(k)} ${esc(sportName(k))}</span></label>`).join("")}
        <p>${esc(T("Switched-off sports disappear from Training and the start sheet. Your entries stay and still count in History and Reports.", "Ausgeschaltete Sportarten verschwinden aus Training und dem Start-Menü. Deine Einträge bleiben und zählen weiter in Verlauf und Berichten."))}</p>
      </section>
      <section class="card">
        <span class="label">${esc(T("Rest timer", "Pausen-Timer"))}</span>
        <label class="field"><span class="hint">${esc(T("Default after each set – each exercise can have its own (tap ⏱ on the exercise)", "Standard nach jedem Satz – jede Übung kann eine eigene haben (⏱ an der Übung antippen)"))}</span><select class="psel" id="restSel">${restOpts.map(([k, t]) => `<option value="${k}"${+db.settings.rest === k ? " selected" : ""}>${esc(t)}${k ? " min" : ""}</option>`).join("")}</select></label>
        <label class="check"><input type="checkbox" id="soundChk"${db.settings.sound ? " checked" : ""}><span>${esc(T("Sound when the rest is over", "Ton am Ende der Pause"))}<br><span class="hint">${esc(T("On iPhone only audible with the silent switch off and PFT open.", "Auf dem iPhone nur hörbar, wenn der Stummschalter aus ist und PFT offen ist."))}</span></span></label>
      </section>
      <section class="card">
        <span class="label">${esc(T("Daily nutrition goals (optional)", "Tagesziele Ernährung (optional)"))}</span>
        <label class="field"><span class="hint">kcal</span><input id="goalKcal" inputmode="numeric" autocomplete="off" placeholder="${esc(T("e.g. 2600", "z. B. 2600"))}" value="${g.kcal || ""}"></label>
        <span class="hint">${esc(T("Protein", "Eiweiß"))}</span>
        <div class="seg" role="group" aria-label="${esc(T("Protein goal", "Eiweißziel"))}"><button data-action="p-mode" data-arg="fixed" aria-pressed="${g.pMode !== "auto"}">${esc(T("Fixed (g)", "Fester Wert (g)"))}</button><button data-action="p-mode" data-arg="auto" aria-pressed="${g.pMode === "auto"}">${esc(T("From body weight", "Aus Körpergewicht"))}</button></div>
        ${g.pMode === "auto" ? `<label class="field"><span class="hint">${esc(T("Grams of protein per kg body weight", "Gramm Eiweiß pro kg Körpergewicht"))}</span><input id="goalPkg" inputmode="decimal" autocomplete="off" value="${esc(fmtIn(+g.pPerKg || 1.8))}"></label><p>${esc(curWeight() ? T(`= ${proteinGoal()} g a day at ${nf1.format(curWeight())} kg (7-day average).`, `= ${proteinGoal()} g pro Tag bei ${nf1.format(curWeight())} kg (Ø 7 Tage).`) : T("Log your weight under Progress → Body, then the goal is calculated.", "Trag dein Gewicht unter Fortschritt → Körper ein, dann wird das Ziel berechnet."))}</p>`
          : `<label class="field"><span class="hint">${esc(T("Protein (g)", "Eiweiß (g)"))}</span><input id="goalP" inputmode="numeric" autocomplete="off" placeholder="${esc(T("e.g. 150", "z. B. 150"))}" value="${g.p || ""}"></label>`}
        <p>${esc(T("Shown as bars in Food and on Today. Leave empty for no goal.", "Werden unter Essen und Heute als Balken angezeigt. Leer lassen für kein Ziel."))}</p>
      </section>
      <section class="card">
        <span class="label">${esc(T("Your data", "Deine Daten"))}</span>
        <p>${esc(STANDALONE ? T(`Everything is stored only on this ${deviceName}, inside PFT. Nothing is sent anywhere and it works offline. If you remove PFT from your Home Screen, its data is deleted too – so save a backup now and then, e.g. to iCloud Drive.`, `Alles liegt nur auf diesem ${deviceName}, direkt in PFT. Nichts wird irgendwohin geschickt, und es funktioniert ohne Internet. Wenn du PFT vom Home-Bildschirm löschst, sind auch die Daten weg – sichere also regelmäßig ein Backup, z. B. in iCloud Drive.`) : T("In this view the data lives only in this browser. Add PFT to your Home Screen and save backups regularly.", "In dieser Ansicht liegen die Daten nur in diesem Browser. Füge PFT zum Home-Bildschirm hinzu und sichere regelmäßig ein Backup."))}</p>
        <p>${esc(T("Last backup", "Letztes Backup"))}: ${esc(lastBackupText())} · ${pl(db.sessions.length, "session")}, ${pl(db.meals.length, "meal")}${db.weights.length ? `, ${pl(db.weights.length, "entry")} ${T("weight", "Gewicht")}` : ""}.</p>
        <p class="hint">${esc(storeMode === "idb" ? T("Storage: IndexedDB – room for many years of data.", "Speicher: IndexedDB – Platz für viele Jahre Daten.") : T("Storage: browser storage (limited). Make backups regularly.", "Speicher: Browser-Speicher (begrenzt). Bitte regelmäßig Backups sichern."))}</p>
        <div class="btnrow">
          <button class="btn primary" data-action="export-json">${esc(T("Save backup", "Backup sichern"))}</button>
          <label class="btn filebtn">${esc(T("Load backup", "Backup laden"))}<input type="file" id="importFile" accept=".json,application/json"></label>
          <button class="btn" data-action="export-csv">${esc(T("Export CSV", "CSV exportieren"))}</button>
        </div>
        <p>${esc(T("The CSV opens in Excel or Numbers (one set per row, meals included). A backup contains everything and can be loaded here again – also on a new phone.", "Die CSV öffnet sich direkt in Excel oder Numbers (ein Satz pro Zeile, Mahlzeiten inklusive). Ein Backup enthält alles und kann hier wieder geladen werden – auch auf einem neuen Handy."))}</p>
      </section>
      <section class="card">
        <label class="field"><span class="label">${esc(T("When PFT opens", "Wenn PFT öffnet"))}</span><select class="psel" id="openModeSel">
          ${[["splash", T("Start screen, then Today", "Startbildschirm, dann Heute")], ["menu", T("Today", "Heute")], ["start", T("Start a workout right away", "Direkt Training starten")]].map(([k, t]) => `<option value="${k}"${openMode() === k ? " selected" : ""}>${esc(t)}</option>`).join("")}
        </select></label>
        <p>${esc(T("Tap or swipe up to leave the start screen. Pull down on Today to bring it back.", "Den Startbildschirm antippen oder nach oben wischen. Unter „Heute“ holst du ihn mit einem Zug nach unten zurück."))}</p>
      </section>
      <section class="card">
        <span class="label">${esc(T("Sample data", "Beispieldaten"))}</span>
        <p>${esc(hasEx ? T("Sample entries are tagged. Remove them before you start for real.", "Beispiel-Einträge sind markiert. Entferne sie, bevor du richtig loslegst.") : T("Loads 12 weeks of push/pull/legs with rising weights, calisthenics with levels, runs, Hyrox, football and a week of meals – to try the charts.", "Lädt 12 Wochen Push/Pull/Beine mit steigenden Gewichten, Calisthenics mit Stufen, Läufe, Hyrox, Fußball und eine Woche Mahlzeiten – zum Ausprobieren."))}</p>
        <div class="btnrow">${hasEx ? `<button class="btn danger${state.armed === "clear-ex" ? " armed" : ""}" data-action="clear-examples">${esc(state.armed === "clear-ex" ? T("Really remove?", "Wirklich entfernen?") : T("Remove sample data", "Beispieldaten entfernen"))}</button>` : `<button class="btn" data-action="examples">${esc(T("Load sample data", "Beispieldaten laden"))}</button>`}</div>
      </section>
      <footer class="motto"><span>${esc(T("A little more every week.", "Jede Woche ein bisschen mehr."))}</span><span>${esc(T("That's the whole secret.", "Das ist das ganze Geheimnis."))}</span></footer>
      <p class="hint">PFT ${esc(VERSION)}</p>`;
  }
  function viewExlist() {
    const D = derived(), q = state.exQ || "";
    const match = (x) => !q || fold(exName(x)).includes(fold(q)) || fold(x.de).includes(fold(q)) || fold(x.en).includes(fold(q));
    const row = (x) => { const h = D.byEx.get(x.id) || []; return navRow("ex", x.id, `${esc(exName(x))}${x.base ? "" : `<span class="tag">${esc(T("Own", "Eigene"))}</span>`}`, `${esc(kindText(x.kind))}${hasLv(x) ? ` · ${pl(x.lv.length, "level")}` : ""}${h.length ? ` · ${pl(h.length, "workout")}` : ""}`, "", badgeEx(x)); };
    const caliXs = [...EX.values()].filter((x) => x.cali && !x.hidden && match(x));
    const secs = GROUPS.map((g) => {
      const xs = [...EX.values()].filter((x) => x.group === g && !x.hidden && !(x.cali && x.cali !== "basic") && match(x)).sort((a, b) => exName(a).localeCompare(exName(b), LANG));
      return xs.length ? `<section class="sec"><div class="sechead"><h2 class="sectitle">${esc(groupName(g))}</h2><span class="label">${xs.length}</span></div>${xs.map(row).join("")}</section>` : "";
    }).join("") + (caliXs.length ? `<section class="sec"><div class="sechead"><h2 class="sectitle">Calisthenics</h2><span class="label">${caliXs.length}</span></div>${caliXs.map(row).join("")}</section>` : "");
    return `
      ${backBar()}
      <h1 class="vtitle">${esc(T("Exercises", "Übungen"))}</h1>
      <label class="searchbar">${ICON_SEARCH}<input type="search" id="exQ" placeholder="${esc(T("Search exercise", "Übung suchen"))}" autocomplete="off" value="${esc(q)}" aria-label="${esc(T("Search exercise", "Übung suchen"))}"></label>
      ${secs || `<p class="hint">${esc(T("No exercise found. Add it with “+ Exercise”.", "Keine Übung gefunden. Leg sie mit „+ Übung\" an."))}</p>`}`;
  }

  /* ================= Tabs: Heute · Training · Essen · Fortschritt · Mehr ================= */
  const TABS = [
    ["today", "hub", "Today", "Heute", '<path d="M4 11.2 12 4l8 7.2V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>'],
    ["train", "train", "Training", "Training", '<path d="M3 9.5v5M6 7v10M18 7v10M21 9.5v5M6 12h12"/>'],
    ["food", "food", "Food", "Essen", '<path d="M7 3v8a2 2 0 0 0 2 2v8M5 3v5M9 3v5M16.5 21V3c-2 1.2-3 3.6-3 6.5 0 2 1 3.5 3 3.5"/>'],
    ["prog", "prog", "Progress", "Fortschritt", '<path d="M4 19h16M5.5 15.5l4.2-4.4 3.3 3 5.5-6.6"/><path d="M15 7.5h3.5V11"/>'],
    ["more", "settings", "More", "Mehr", '<circle cx="5.5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18.5" cy="12" r="1.6"/>']
  ];
  const TAB_ROOT = Object.fromEntries(TABS.map((t) => [t[0], t[1]]));
  /* where a view lives when it is opened from somewhere else */
  const TAB_OF = { hub: "today", train: "train", workouts: "train", food: "food", settings: "more", prog: "prog", progress: "prog", history: "prog", reports: "prog", body: "prog" };
  const PROG_SEG = { progress: "strength", history: "history", reports: "reports", body: "body" };
  const OPT_SPORTS = ["run", "hyrox", "fb", "other"];
  const sportOn = (k) => !OPT_SPORTS.includes(k) || !db.settings.hide[k];
  /* the plan that is up next: the one used longest ago */
  function nextTemplate() {
    const D = derived(), tpls = db.templates.filter((t) => t.items.length);
    if (!tpls.length) return null;
    const lastUse = (t) => { const s = D.desc.find((q) => q.tpl === t.id); return s ? s.date + (s.time || "") : ""; };
    return tpls.slice().sort((a, b) => lastUse(a).localeCompare(lastUse(b)))[0];
  }

  /* ---------- Heute ---------- */
  function viewHub() {
    const D = derived(), today = todayISO(), ws = weekStart(today), we = addDays(ws, 6);
    const week = D.desc.filter((s) => s.date >= ws && s.date <= we);
    const gymW = week.filter((s) => s.sport === "gym"), caliW = week.filter((s) => s.sport === "cali"), runW = week.filter((s) => s.sport === "run");
    const volW = gymW.reduce((a, s) => a + sessionTot(s).vol, 0), kmW = runW.reduce((a, s) => a + (s.dist || 0), 0), minW = week.reduce((a, s) => a + (s.dur || 0), 0);
    const streak = streakWeeks();
    const wd = Array.from({ length: 7 }, (_, k) => wdShort.format(isoDate(addDays(ws, k))).replace(".", "").slice(0, 2));
    const days = wd.map((t, k) => { const d = addDays(ws, k), on = week.some((s) => s.date === d); return `<span class="${d === today ? "today" : ""}"><i class="${on ? "on" : ""}"></i>${esc(t)}</span>`; }).join("");
    const live = draft && !draft.editOf, bk = lastBackupDays(), nr = newReports("repNoted");
    const fd = mealsTot(db.meals.filter((m) => m.date === today)), g = goalsNow(), wt = weightOn(today), cw = curWeight();
    const nt = !live && nextTemplate(), lastS = D.desc[0];
    let prs7 = []; const d7 = addDays(today, -6); for (const s of D.desc) { if (s.date < d7) break; for (const p of D.prs.get(s.id) || []) prs7.push(p); }
    const bar = (v, goal, color) => (goal ? `<div class="bar"><span style="width:${Math.min(100, (v / goal) * 100).toFixed(1)}%;background:${color}"></span></div>` : "");
    const third = sportOn("run") ? `<button class="acc" data-action="sport" data-arg="run"><span class="label">${esc(sportName("run"))}</span><b>${nf1.format(kmW)} km</b></button>` : `<button class="acc" data-action="nav" data-arg="history"><span class="label">${esc(T("Time", "Zeit"))}</span><b>${durTxt(minW)}</b></button>`;
    return `
      <header class="hubhead">
        <div class="brand"><h1 class="wordmark">P<b>F</b>T</h1><span class="label">Personal Fitness Tracker</span></div>
        <div class="hubright"><span class="sync" data-mode="${STANDALONE ? "device" : "local"}">${STANDALONE ? esc(T(`On this ${deviceName}`, `Auf diesem ${deviceName}`)) : esc(T("Browser only", "Nur im Browser"))}</span></div>
      </header>
      ${live ? `<button class="notice live" data-action="resume"><span><span class="dot" aria-hidden="true"></span>${esc(T("Workout running", "Training läuft"))} · ${esc(draft.name || (draft.sport === "cali" ? "Calisthenics" : T("Free workout", "Freies Training")))} · <span data-clock>${clock((Date.now() - draft.start) / 1000)}</span></span><span>${esc(T("Resume", "Weiter"))} ›</span></button>` : ""}
      <div class="mainbtns">
        <button class="addbig" data-action="start"><span aria-hidden="true">${live ? "▶" : "+"}</span>${esc(live ? T("Workout", "Training") : T("Workout", "Training"))}</button>
        <button class="addbig alt" data-action="meal-quick"><span aria-hidden="true">+</span>${esc(T("Meal", "Mahlzeit"))}</button>
      </div>
      ${db.sessions.length >= 5 && (bk == null || bk > 14) ? `<button class="notice" data-action="export-json">${esc(T("Last backup", "Letztes Backup"))}: ${esc(lastBackupText())} · ${esc(T("Save one now", "Jetzt sichern"))} ›</button>` : ""}
      ${nr.length ? `<button class="notice live report" data-action="rep-new"><span><span class="dot" aria-hidden="true"></span>${esc(nr.length === 1 ? T("New report", "Neuer Bericht") : T("New reports", "Neue Berichte"))}: <b>${esc(`${repKindName(nr[nr.length - 1].type)} ${periodName(nr[nr.length - 1])}`)}</b>${nr.length > 1 ? ` ${esc(T(`+ ${nr.length - 1} more`, `+ ${nr.length - 1} weitere`))}` : ""}</span><span>${esc(T("Open", "Ansehen"))} ›</span></button>` : ""}
      ${nt ? `<div class="nextrow"><span class="main"><span class="label">${esc(T("Up next", "Als Nächstes"))}</span><b>${esc(nt.name || T("Untitled", "Ohne Namen"))}</b><span class="t2">${esc(nt.items.slice(0, 4).map((it) => exName(exOf(it.ex))).join(", "))}${nt.items.length > 4 ? " …" : ""}</span></span><button class="btn primary" data-action="start-tpl" data-arg="${esc(nt.id)}">▶ ${esc(T("Start", "Starten"))}</button></div>` : ""}
      <section class="todaycard">
        <button class="tc-food" data-action="nav" data-arg="food">
          <span class="label">${esc(T("Eaten today", "Heute gegessen"))}</span>
          <b>${nf0.format(fd.kcal)} <small>${g.kcal ? `/ ${nf0.format(g.kcal)} kcal` : "kcal"}</small></b>${bar(fd.kcal, g.kcal, "var(--pos)")}
          <span class="tc-sub">${esc(T("Protein", "Eiweiß"))} <b>${nf0.format(fd.p)}${g.p ? ` / ${g.p}` : ""} g</b></span>${bar(fd.p, g.p, "#3FA9FF")}
        </button>
        <button class="tc-w" data-action="${wt ? "nav" : "w-new"}" data-arg="${wt ? "body" : ""}">
          <span class="label">${esc(T("Weight", "Gewicht"))}</span>
          ${wt ? `<b>${esc(nf1.format(wt.kg))} <small>kg</small></b><span class="tc-sub">Ø 7 ${esc(T("days", "Tage"))} ${esc(kg1(cw))}</span>` : `<b class="tc-add">+</b><span class="tc-sub">${esc(cw ? T(`Log today · last ${nf1.format(lastWeight().kg)} kg`, `Heute eintragen · zuletzt ${nf1.format(lastWeight().kg)} kg`) : T("Log today", "Heute eintragen"))}</span>`}
        </button>
      </section>
      ${prs7.length ? `<button class="notice prnote" data-action="nav" data-arg="progress"><span>🏆 ${esc(T(`${prs7.length} new records this week`, `${prs7.length} neue Rekorde in den letzten 7 Tagen`))} – ${esc(exName(exOf(prs7[0].ex)))}${prs7.length > 1 ? " …" : ""}</span><span>›</span></button>` : ""}
      ${lastS ? `<section class="sec"><div class="sechead"><h2 class="sectitle">${esc(T("Last workout", "Zuletzt"))}</h2><button class="more" data-action="nav" data-arg="history">${esc(T("History", "Verlauf"))} ›</button></div>${sessionRow(lastS)}</section>` : ""}
      <section class="accounts" aria-label="${esc(T("This week", "Diese Woche"))}">
        <span class="label">${esc(T("This week", "Diese Woche"))} · ${esc(wkLabel(today))}</span>
        <div class="acc-total">${heroHTML(`${week.length} ${nounOnly(week.length, "session")}`)}</div>
        <div class="week" aria-hidden="true">${days}</div>
        <div class="acc-split">
          <button class="acc" data-action="nav" data-arg="progress"><span class="label">Gym</span><b>${gymW.length}× · ${tons(volW)}</b></button>
          <button class="acc" data-action="nav" data-arg="cali"><span class="label">Cali</span><b>${caliW.length}×</b></button>
          ${third}
        </div>
        <div class="ytd"><span class="label">${esc(T("Time", "Zeit"))}</span><b>${durTxt(minW)}</b><span class="label">${esc(T("Streak", "Serie"))}</span><b class="${streak ? "pos" : ""}">${streak ? pl(streak, "week") : "–"}</b></div>
        ${D.desc.length ? "" : `<p class="hint">${esc(T("Tip: load sample data under More to try everything out.", "Tipp: Unter „Mehr“ kannst du Beispieldaten laden, um alles auszuprobieren."))}</p>`}
      </section>`;
  }

  /* ---------- Training ---------- */
  function viewTrain() {
    const D = derived(), live = draft && !draft.editOf, m0 = todayISO().slice(0, 8) + "01", mName = monthLong.format(new Date());
    const lastUse = (t) => { const s = D.desc.find((q) => q.tpl === t.id); return s ? rel(s.date) : null; };
    const nt = nextTemplate();
    const rows = db.templates.map((t) => {
      const sets = t.items.reduce((a, it) => a + (it.sets || 0), 0), lu = lastUse(t), cali = t.items.length && t.items.every((it) => exOf(it.ex).cali);
      return `<div class="tplline"><button class="row" data-action="tpl" data-arg="${esc(t.id)}">${badge(t.name || "W", cali ? SPORTS.cali.color : "#FFE83A")}<span class="main"><span class="t1">${esc(t.name || T("Untitled", "Ohne Namen"))}${t.example ? `<span class="tag">${esc(T("Sample", "Beispiel"))}</span>` : ""}${t === nt && db.templates.length > 1 ? `<span class="tag attn">${esc(T("Up next", "Als Nächstes"))}</span>` : ""}</span><span class="t2">${pl(t.items.length, "exercise")} · ${pl(sets, "set")}${lu ? ` · ${esc(T("last", "zuletzt"))} ${esc(lu)}` : ""}</span></span><span class="chev" aria-hidden="true">›</span></button>${t.items.length ? `<button class="mbtn playbtn" data-action="start-tpl" data-arg="${esc(t.id)}" aria-label="${esc(T(`Start ${t.name}`, `${t.name} starten`))}">▶</button>` : ""}</div>`;
    }).join("");
    const skills = CALI_EX.filter((c) => c[6]).map((c) => ({ x: exOf("c:" + c[0]), top: topLevel("c:" + c[0]) })).filter((r) => r.top >= 0).sort((a, b) => b.top / b.x.lv.length - a.top / a.x.lv.length).slice(0, 2);
    const month = (sp) => D.desc.filter((s) => s.sport === sp && s.date >= m0);
    const sub = { run: () => { const l = month("run"); return l.length ? `${nf1.format(l.reduce((a, s) => a + (s.dist || 0), 0))} km ${T("in", "im")} ${mName}` : T("Pace & distance", "Pace & Distanz"); }, hyrox: () => { const l = month("hyrox"); return l.length ? `${pl(l.length, "session")} ${T("in", "im")} ${mName}` : T("Training & races", "Training & Rennen"); }, fb: () => { const l = month("fb"); return l.length ? `${pl(l.length, "session")} ${T("in", "im")} ${mName}` : T("Training & matches", "Training & Spiele"); }, other: () => { const l = month("other"); return l.length ? `${pl(l.length, "session")} ${T("in", "im")} ${mName}` : T("Bike, tennis …", "Rad, Tennis …"); } };
    const sports = OPT_SPORTS.filter(sportOn).map((k) => navRow("sport", k, esc(sportName(k)), esc(sub[k]()), "", badgeSport(k))).join("");
    return `
      <h1 class="vtitle">Training</h1>
      ${live ? `<button class="notice live" data-action="resume"><span><span class="dot" aria-hidden="true"></span>${esc(T("Workout running", "Training läuft"))} · <span data-clock>${clock((Date.now() - draft.start) / 1000)}</span></span><span>${esc(T("Resume", "Weiter"))} ›</span></button>`
        : `<button class="addbig" data-action="start"><span aria-hidden="true">+</span>${esc(T("Start workout", "Training starten"))}</button>`}
      <section class="sec"><div class="sechead"><h2 class="sectitle">${esc(T("My workouts", "Meine Workouts"))}</h2><span class="label">${esc(T("Plans", "Pläne"))}</span></div>
        ${rows || `<p class="hint" style="padding:6px 0">${esc(T("Build plans like Push, Pull and Legs – when you start one, exercises and sets are already there.", "Bau dir Pläne wie Push, Pull und Beine – beim Start sind Übungen und Sätze schon da."))}</p><div class="btnrow"><button class="btn" data-action="tpl-samples">${esc(T("Load templates", "Vorlagen laden"))}</button></div>`}
        <button class="addex" data-action="tpl-new">+ ${esc(T("New workout", "Neues Workout"))}</button></section>
      <section class="sec"><div class="sechead"><h2 class="sectitle">${esc(T("Skills & sports", "Skills & Sportarten"))}</h2></div>
        ${navRow("nav", "cali", "Calisthenics", skills.length ? `${esc(exName(skills[0].x))}: ${esc(lvName(skills[0].x, skills[0].top))}` : esc(T("Handstand, muscle-up, front lever … with levels", "Handstand, Muscle-up, Front Lever … mit Stufen")), "", badgeSport("cali"))}
        ${sports}
      </section>
      <section class="sec">${navRow("nav", "exlist", esc(T("Exercises", "Übungen")), esc(T("All exercises – add your own, rename, change muscle group", "Alle Übungen – eigene anlegen, umbenennen, Muskelgruppe ändern")), "")}</section>
      ${OPT_SPORTS.some((k) => !sportOn(k)) ? `<p class="hint">${esc(T("Hidden sports can be switched back on under More.", "Ausgeblendete Sportarten kannst du unter „Mehr“ wieder einschalten."))}</p>` : ""}`;
  }

  /* ---------- Fortschritt: strength · body · history · reports in one place ---------- */
  function viewProg() {
    const seg = state.progSeg || "strength";
    const segs = [["strength", T("Strength", "Kraft")], ["body", T("Body", "Körper")], ["history", T("History", "Verlauf")], ["reports", T("Reports", "Berichte")]];
    const nr = newReports("repNoted").length;
    const body = seg === "body" ? viewBody(null, true) : seg === "history" ? viewHistory(null, true) : seg === "reports" ? viewReports(null, true) : viewProgress(null, true);
    return `
      <h1 class="vtitle">${esc(T("Progress", "Fortschritt"))}</h1>
      <div class="seg four progseg" role="tablist" aria-label="${esc(T("Progress", "Fortschritt"))}">${segs.map(([k, t]) => `<button role="tab" data-action="prog-seg" data-arg="${k}" aria-pressed="${seg === k}" aria-selected="${seg === k}">${esc(t)}${k === "reports" && nr ? `<i class="ndot" aria-label="${esc(T("new", "neu"))}"></i>` : ""}</button>`).join("")}</div>
      ${body}`;
  }

  /* ================= Nutrition ================= */
  const MEAL_TYPES = [["breakfast", "Breakfast", "Frühstück", "Br", "Fr"], ["lunch", "Lunch", "Mittag", "Lu", "Mi"], ["dinner", "Dinner", "Abend", "Di", "Ab"], ["snack", "Snack", "Snack", "Sn", "Sn"]];
  const MEAL_COLORS = { breakfast: "#FFD18C", lunch: "#7CF2C9", dinner: "#9AD0FF", snack: "#F7A3FF" };
  const mealTypeName = (k) => { const m = MEAL_TYPES.find((x) => x[0] === k) || MEAL_TYPES[3]; return T(m[1], m[2]); };
  const mealBadge = (k) => { const m = MEAL_TYPES.find((x) => x[0] === k) || MEAL_TYPES[3]; return badge(T(m[3], m[4]), MEAL_COLORS[m[0]]); };
  const guessMealType = () => { const h = new Date().getHours(); return h < 11 ? "breakfast" : h < 15 ? "lunch" : h >= 17 && h < 22 ? "dinner" : "snack"; };
  const foodDay = () => state.foodDay || todayISO();
  const dayMeals = (d) => db.meals.filter((m) => m.date === d).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  const itemName = (it) => { const f = FOOD_BY.get(it.id); return f ? foodName(f) : it.n || ""; };
  const mealSummary = (m) => (m.items || []).map(itemName).filter(Boolean).join(", ") || m.text || "";
  const mealSig = (m) => (m.items || []).map((it) => `${it.id}:${Math.round(it.g)}`).join("|");
  const tplById2 = (id) => db.mealTpls.find((t) => t.id === id) || null;
  const tplsSorted = () => db.mealTpls.slice().sort((a, b) => (b.last || "").localeCompare(a.last || "") || (b.used || 0) - (a.used || 0) || a.name.localeCompare(b.name));
  const pctKcal = (g, k, kcal) => (kcal > 0 ? Math.round((g * k / kcal) * 100) : 0);
  function macroBoxes(t, goals) {
    const box = (lab, g, color, goal, factor) => `<div class="mbox"><span class="label">${esc(lab)}</span><b>${nf0.format(g)} g</b><small>${pctKcal(g, factor, t.kcal)} % kcal${goal ? ` · ${esc(T("goal", "Ziel"))} ${goal} g` : ""}</small>${goal ? `<div class="bar"><span style="width:${Math.min(100, (g / goal) * 100).toFixed(1)}%;background:${color}"></span></div>` : `<div class="mbar"><span style="width:${Math.min(100, pctKcal(g, factor, t.kcal))}%;background:${color}"></span></div>`}</div>`;
    return `<div class="macros">${box(T("Protein", "Eiweiß"), t.p, "#3FA9FF", goals.p, 4)}${box(T("Fat", "Fett"), t.f, "#FFB4A2", 0, 9)}${box(T("Carbs", "Kohlenhydrate"), t.c, "#F5C04A", 0, 4)}</div>`;
  }
  /* one "My meal" line: tap the name to open it, the button logs it in one tap */
  function tplRowHTML(t, mainAction, d) {
    const s = sumMacros(t.items);
    return `<div class="againrow"><button class="main linkish" data-action="${mainAction}" data-arg="${esc(t.id)}"><span class="t1">${esc(t.name || T("Untitled", "Ohne Namen"))}</span><span class="t2">${nf0.format(s.kcal)} kcal · ${esc(macroLine(s))} g · ${esc(pl(t.items.length, "item"))}</span></button><button class="btn sm" data-action="mt-add" data-arg="${esc(t.id)}">+ ${esc(dayLabel(d))}</button></div>`;
  }
  function viewFood() {
    const d = foodDay(), meals = dayMeals(d), t = mealsTot(meals), g = goalsNow();
    const n = state.fRange === "30d" ? 30 : 14, days = Array.from({ length: n }, (_, k) => addDays(todayISO(), k - (n - 1)));
    const m = state.fMetric, vals = days.map((x) => mealsTot(dayMeals(x))[m === "kcal" ? "kcal" : "p"]);
    const logged = vals.filter((v) => v > 0), avg = logged.length ? logged.reduce((a, b) => a + b, 0) / logged.length : 0;
    const fmt = (v) => (m === "kcal" ? `${nf0.format(v)} kcal` : `${nf0.format(v)} g`);
    const goal = m === "kcal" ? +g.kcal || 0 : +g.p || 0;
    const chart = db.meals.length ? chartBlock("chFood", {
      bars: true, points: vals.map((v) => ({ value: v })), ticks: days.map((x, i) => ({ i, text: LANG === "de" ? `${isoDate(x).getDate()}.${isoDate(x).getMonth() + 1}.` : `${isoDate(x).getDate()}/${isoDate(x).getMonth() + 1}` })),
      color: m === "kcal" ? "var(--pos)" : "#3FA9FF", minStep: m === "kcal" ? 250 : 10, limit: goal || 0, limitLabel: T("Goal", "Ziel"), limitFmt: fmt, yfmt: (v) => nf0.format(v), aria: T("Per day", "Pro Tag")
    }, {
      label: `${m === "kcal" ? T("Calories", "Kalorien") : T("Protein", "Eiweiß")} ${T("per day", "pro Tag")} · Ø`, base: { v: fmt(avg), sub: esc(T(`average of ${logged.length} logged days`, `Schnitt aus ${logged.length} erfassten Tagen`)) },
      at: (i) => ({ v: fmt(vals[i]), sub: esc(dateFmt.format(isoDate(days[i]))) })
    }, `<span><i style="border-color:${m === "kcal" ? "var(--pos)" : "#3FA9FF"};border-top-width:6px"></i>${esc(m === "kcal" ? "kcal" : T("Protein (g)", "Eiweiß (g)"))} ${esc(T("per day", "pro Tag"))}</span>${goal ? `<span><i style="border-color:var(--accent);border-top-style:dashed"></i>${esc(T("Goal", "Ziel"))}</span>` : ""}`) : "";
    const rows = MEAL_TYPES.map(([k]) => meals.filter((x) => x.type === k)).flat().map((x) => {
      const s = sumMacros(x.items);
      return `<button class="row" data-action="meal" data-arg="${esc(x.id)}">${mealBadge(x.type)}<span class="main"><span class="t1">${esc(x.name || mealSummary(x))}${x.example ? `<span class="tag">${esc(T("Sample", "Beispiel"))}</span>` : ""}</span><span class="t2">${esc(mealTypeName(x.type))}${x.time ? ` · ${esc(x.time)}` : ""} · ${esc(macroLine(s))} g</span></span><span class="val">${nf0.format(s.kcal)}<small>kcal</small></span><span class="chev" aria-hidden="true">›</span></button>`;
    }).join("");
    // My meals: saved combinations, one tap to log
    const tpls = tplsSorted(), tplRows = tpls.slice(0, 5).map((x) => tplRowHTML(x, "mt-use", d)).join("");
    const myMeals = `<section class="sec"><div class="sechead"><h2 class="sectitle">${esc(T("My meals", "Meine Mahlzeiten"))}</h2><span class="label">${esc(tpls.length ? T("One tap to add", "Ein Tipp zum Eintragen") : T("Saved meals", "Gespeicherte Mahlzeiten"))}</span></div>
      ${tplRows || `<p class="hint" style="padding:4px 0 8px">${esc(T("Save meals you eat often – e.g. your porridge – and add them on any day with one tap. In the meal editor: “★ Save as My meal”.", "Speichere Mahlzeiten, die du oft isst – z. B. dein Porridge – und trage sie an jedem Tag mit einem Tipp ein. Im Mahlzeit-Editor: „★ Als meine Mahlzeit speichern“."))}</p>`}
      ${navRow("nav", "mymeals", esc(tpls.length > 5 ? T(`All my meals (${tpls.length})`, `Alle meine Mahlzeiten (${tpls.length})`) : tpls.length ? T("Manage my meals", "Meine Mahlzeiten verwalten") : T("Create a My meal", "Meine Mahlzeit anlegen")), esc(T("Create, change amounts, delete", "Anlegen, Mengen ändern, löschen")))}</section>`;
    // recent distinct meals (not already a My meal) to log again with one tap
    const seen = new Set(), recent = [];
    for (const x of db.meals.slice().sort((a, b) => (b.date + (b.time || "")).localeCompare(a.date + (a.time || "")))) {
      if (x.tpl && tplById2(x.tpl)) continue;
      const k = mealSig(x); if (!k || seen.has(k)) continue; seen.add(k); recent.push(x); if (recent.length >= 5) break;
    }
    const again = recent.map((x) => `<div class="againrow"><span class="main"><span class="t1">${esc(x.name || mealSummary(x))}</span><span class="t2">${nf0.format(sumMacros(x.items).kcal)} kcal · ${esc(macroLine(sumMacros(x.items)))} g</span></span><button class="btn sm" data-action="meal-again" data-arg="${esc(x.id)}">+ ${esc(dayLabel(d))}</button></div>`).join("");
    const isToday = d === todayISO();
    return `
      ${backBar()}
      <h1 class="vtitle">${esc(T("Nutrition", "Ernährung"))}</h1>
      <div class="daynav"><button class="mbtn" data-action="food-day" data-arg="-1" aria-label="${esc(T("Previous day", "Vorheriger Tag"))}">‹</button><b>${esc(dayLabel(d))}${isToday ? "" : ` · ${esc(dateFmt.format(isoDate(d)))}`}</b><button class="mbtn" data-action="food-day" data-arg="1"${isToday ? " disabled" : ""} aria-label="${esc(T("Next day", "Nächster Tag"))}">›</button></div>
      <section class="hero">
        <span class="label">${esc(T("Calories", "Kalorien"))} · ${esc(dayLabel(d))}</span>
        <div class="heroval">${heroHTML(`${nf0.format(t.kcal)} kcal`)}</div>
        <div class="herosub">${g.kcal ? esc(T(`of ${nf0.format(g.kcal)} kcal goal · ${nf0.format(Math.max(0, g.kcal - t.kcal))} left`, `von ${nf0.format(g.kcal)} kcal Ziel · noch ${nf0.format(Math.max(0, g.kcal - t.kcal))}`)) : esc(pl(meals.length, "meal"))}</div>
        ${g.kcal ? `<div class="bar"><span style="width:${Math.min(100, (t.kcal / g.kcal) * 100).toFixed(1)}%;background:var(--pos)"></span></div>` : ""}
      </section>
      ${macroBoxes(t, g)}
      ${(() => { const ex = extrasOf(meals.flatMap((x) => x.items)); return ex.n ? `<p class="hint xline">${esc(extrasLine(ex))} <span>· ${esc(T("only foods with these values", "nur Lebensmittel mit Angaben"))}</span></p>` : ""; })()}
      <div class="addrow"><button class="addbig" data-action="meal-new"><span aria-hidden="true">+</span>${esc(T("Add meal", "Mahlzeit eintragen"))}</button><button class="addbig alt scanbig" data-action="scan-meal" aria-label="${esc(T("Scan a barcode into a new meal", "Barcode in eine neue Mahlzeit scannen"))}">${ICON_SCAN}<b>${esc(T("Scan", "Scannen"))}</b></button></div>
      <section class="sec">${rows || `<p class="hint" style="padding:6px 0">${esc(T("Nothing logged for this day yet.", "Für diesen Tag ist noch nichts eingetragen."))}</p>`}</section>
      ${myMeals}
      ${again ? `<section class="sec"><div class="sechead"><h2 class="sectitle">${esc(T("Again?", "Nochmal?"))}</h2><span class="label">${esc(T("Recent meals", "Letzte Mahlzeiten"))}</span></div>${again}</section>` : ""}
      ${chart ? `<div class="ctlrow">${pills("f-metric", m, [["kcal", "kcal"], ["p", T("Protein", "Eiweiß")]], T("Metric", "Kennzahl"))}${rangePills("f-range", state.fRange, ["14d", "30d"])}</div>${chart}` : ""}
      <section class="sec">${navRow("food-new", "", esc(T("Add your own food", "Eigenes Lebensmittel anlegen")), esc(T(`Calories, protein, fat, carbs, sugar … from the pack${db.foods.length ? ` · ${db.foods.length} saved` : ""}`, `Kalorien, Eiweiß, Fett, KH, Zucker … von der Packung${db.foods.length ? ` · ${db.foods.length} gespeichert` : ""}`)))}${navRow("nav", "foods", esc(T("Foods", "Lebensmittel")), esc(T(`${FOODS.length} foods built in + search Open Food Facts`, `${FOODS.length} Lebensmittel eingebaut + Suche in Open Food Facts`)))}${navRow("nav", "settings", esc(T("Daily goals", "Tagesziele")), g.kcal || g.p ? esc(`${g.kcal ? `${nf0.format(g.kcal)} kcal` : ""}${g.kcal && g.p ? " · " : ""}${g.p ? `${g.p} g ${T("protein", "Eiweiß")}` : ""}`) : esc(T("Not set – in Settings", "Nicht gesetzt – in den Einstellungen")))}</section>
      <p class="hint">${esc(T("Values are typical averages per 100 g. For exact numbers, add the product from its pack or from Open Food Facts under Foods.", "Die Werte sind typische Durchschnittswerte pro 100 g. Für exakte Zahlen das Produkt von der Packung oder aus Open Food Facts unter Lebensmittel anlegen."))}</p>`;
  }

  /* ---------- My meals (saved meals to log again) ---------- */
  function viewMyMeals() {
    const d = foodDay(), list = db.mealTpls.slice().sort((a, b) => a.name.localeCompare(b.name, LANG));
    return `
      ${backBar()}
      <h1 class="vtitle">${esc(T("My meals", "Meine Mahlzeiten"))}</h1>
      <p class="meta">${esc(T("Meals you eat often. Add them to any day with one tap – or open one to change the amounts first.", "Mahlzeiten, die du oft isst. Mit einem Tipp an jedem Tag eintragen – oder öffnen und vorher die Mengen anpassen."))}</p>
      <button class="addbig sm" data-action="mt-new"><span aria-hidden="true">+</span>${esc(T("New my meal", "Neue Mahlzeit anlegen"))}</button>
      ${list.length ? `<section class="sec"><div class="sechead"><h2 class="sectitle">${esc(pl(list.length, "meal"))}</h2><span class="label">${esc(T("Tap to edit", "Antippen zum Bearbeiten"))}</span></div>${list.map((t) => tplRowHTML(t, "mt-edit", d)).join("")}</section>`
        : emptyBox(T("No saved meals yet", "Noch keine gespeicherten Mahlzeiten"), esc(T("Create one here, or save a logged meal with “★ Save as My meal”.", "Lege hier eine an oder speichere eine eingetragene Mahlzeit mit „★ Als meine Mahlzeit speichern“.")))}`;
  }

  /* ---------- Meal editor ----------
     mealDraft.items = foods already in the list (amount + unit adjustable, q0 = amount at portion ×1),
     mealDraft.text  = what's still in the text box – parsed live and shown below the list, taken over on the first change or on save. */
  let mealDraft = null;
  /* what a meal looks like when it's opened – to notice unsaved changes */
  const mealSigOf = (d) => JSON.stringify([d.type, d.name, d.date, d.time, d.fx, d.items.map((it) => [it.id, it.g, it.unit, it.qty])]);
  const markMeal = () => { if (mealDraft) mealDraft.sig = mealSigOf(mealDraft); };
  const mealChanged = () => !!mealDraft && (mealDraft.text.trim() !== "" || mealSigOf(mealDraft) !== mealDraft.sig);
  const FX = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];
  const dItem = (it) => { const c = calcItem(cloneItem(it)); c.q0 = c.qty; return c; };
  function blankDraft(mode, extra) { return { mode, id: newId(), edit: false, date: foodDay(), time: nowTime(), type: guessMealType(), name: "", tpl: null, items: [], fx: 1, text: "", ov: {}, ...(extra || {}) }; }
  function openMeal(id) {
    const m = id && db.meals.find((x) => x.id === id);
    mealDraft = m ? { mode: "meal", id: m.id, edit: true, date: m.date, time: m.time || "", type: m.type, name: m.name || "", tpl: m.tpl || null, items: m.items.map(dItem), fx: 1, text: "", ov: {}, example: !!m.example }
      : blankDraft("meal");
    markMeal();
    go("meal");
    if (!m) setTimeout(() => { const ta = $("mealText"); if (ta && !scanOpen()) ta.focus(); }, 80);
  }
  function openTplMeal(id, asLog) {
    const t = tplById2(id); if (!t) return;
    mealDraft = asLog ? blankDraft("meal", { type: t.type || guessMealType(), name: t.name, tpl: t.id, items: t.items.map(dItem) })
      : { ...blankDraft("tpl"), id: t.id, edit: true, type: t.type || "snack", name: t.name, items: t.items.map(dItem) };
    markMeal();
    go("meal");
  }
  function newTplMeal() { mealDraft = blankDraft("tpl"); markMeal(); go("meal"); setTimeout(() => { const n = $("mealName"); if (n) n.focus(); }, 80); }
  let pendCache = { k: "", v: [] };
  function pendParse() {
    const d = mealDraft; if (!d || !d.text.trim()) return [];
    const k = `${ver}|${d.text}|${JSON.stringify(d.ov)}`;
    if (pendCache.k !== k) pendCache = { k, v: parseMeal(d.text, d.ov).map((r) => (r.food ? Object.assign(r, { item: Object.assign(itemFromParse(r), r.guess ? { gs: 1 } : {}, r.warn ? { wn: 1 } : {}) }) : r)) };
    return pendCache.v;
  }
  /* move recognised lines from the text box into the list; returns pending index → list index */
  function commitPending() {
    const d = mealDraft, map = {}; if (!d) return map;
    const pend = pendParse(); if (!pend.length) return map;
    const keep = [];
    pend.forEach((r, i) => { if (r.food) { const it = cloneItem(r.item); it.q0 = it.qty / d.fx; map[i] = d.items.length; d.items.push(it); } else keep.push(r.raw); });
    d.text = keep.join("\n");
    return map;
  }
  /* "c3" = list item 3, "p1" = pending line 1 (taken over first) → list index or null */
  function itemIdx(key) {
    const d = mealDraft; if (!d || !key) return null;
    const i = +key.slice(1);
    if (key[0] === "c") return d.items[i] ? i : null;
    const r = pendParse()[i]; if (!r || !r.food) return null;
    const map = commitPending(); return map[i] != null ? map[i] : null;
  }
  const allItems = () => (mealDraft ? mealDraft.items.concat(pendParse().filter((r) => r.food).map((r) => r.item)) : []);
  const unitLabel = (u, w) => (isMass(u) ? u : `${unitTxt(u, 1)} (${nf0.format(w)} g)`);
  const itemSub = (it) => `${isMass(it.unit) ? "" : `${nf0.format(it.g)} g · `}${macroLine1(it)} g`;
  function itemRowHTML(it, key) {
    const tags = `${it.gs ? `<span class="tag attn">?</span>` : ""}${it.wn ? `<span class="tag attn">≈</span>` : ""}`;
    return `<div class="irow">
      <button class="iname" data-action="mi-pick" data-arg="${key}"><span class="t1">${esc(itemName(it))}${tags}</span><span class="t2" id="im-${key}">${esc(itemSub(it))}</span></button>
      <span class="ival" id="ik-${key}">${nf0.format(it.kcal)}<small>kcal</small></span>
      <div class="iamt"><button class="mbtn" data-action="mi-step" data-arg="${key}:-1" aria-label="${esc(T("Less", "Weniger"))}">−</button><input class="iqty" id="iq-${key}" data-k="${key}" inputmode="decimal" autocomplete="off" enterkeyhint="done" value="${esc(fmtIn(it.qty))}" aria-label="${esc(T("Amount", "Menge"))}"><select class="iunit" data-k="${key}" aria-label="${esc(T("Unit", "Einheit"))}">${itemUnits(it).map(([u, w]) => `<option value="${u}"${u === it.unit ? " selected" : ""}>${esc(unitLabel(u, w))}</option>`).join("")}</select><button class="mbtn" data-action="mi-step" data-arg="${key}:1" aria-label="${esc(T("More", "Mehr"))}">+</button></div>
      <button class="ix" data-action="mi-del" data-arg="${key}" aria-label="${esc(T("Remove", "Entfernen"))}">×</button>
    </div>`;
  }
  function mealListHTML() {
    const d = mealDraft, pend = pendParse();
    const rows = d.items.map((it, i) => itemRowHTML(it, "c" + i)).concat(pend.map((r, i) => (r.food ? itemRowHTML(r.item, "p" + i)
      : `<div class="row mrow nf"><span class="main"><span class="t1">„${esc(r.raw)}"</span><span class="t2">${esc(T("Not found – pick a food or add your own", "Nicht gefunden – Lebensmittel wählen oder eigenes anlegen"))}</span></span><span class="btnrow" style="flex-wrap:nowrap"><button class="btn sm" data-action="mi-pick" data-arg="p${i}">${esc(T("Pick", "Wählen"))}</button><button class="btn sm" data-action="mi-new" data-arg="p${i}">${esc(T("New", "Neu"))}</button></span></div>`)));
    return rows.join("") || `<p class="hint" style="padding:8px 0">${esc(T("Your ingredients appear here with grams, protein, fat and carbs as you type – then change any amount with − / +.", "Hier erscheinen beim Tippen deine Zutaten mit Gramm, Eiweiß, Fett und Kohlenhydraten – danach jede Menge mit − / + anpassen."))}</p>`;
  }
  function portionHTML() {
    const d = mealDraft; if (!d || !allItems().length) return "";
    const i = FX.indexOf(d.fx);
    return `<div class="portion"><span class="main"><span class="label">${esc(T("Portion", "Portion"))}</span><span class="hint">${esc(T("scales all amounts at once", "ändert alle Mengen auf einmal"))}</span></span><span class="pv"><button class="mbtn" data-action="m-fx" data-arg="-1"${i <= 0 ? " disabled" : ""} aria-label="${esc(T("Smaller portion", "Kleinere Portion"))}">−</button><b id="mFx">× ${esc(nf.format(d.fx))}</b><button class="mbtn" data-action="m-fx" data-arg="1"${i >= FX.length - 1 ? " disabled" : ""} aria-label="${esc(T("Bigger portion", "Größere Portion"))}">+</button></span></div>`;
  }
  function mealTotalsHTML() {
    const all = allItems(), t = sumMacros(all), miss = pendParse().filter((x) => !x.food).length, ex = extrasOf(all);
    return `<div class="mtotal"><div><span class="label">${esc(T("Total", "Gesamt"))}</span><b>${nf0.format(t.kcal)} <small>kcal</small></b></div>${macroBoxes(t, { p: 0 })}${ex.n ? `<p class="hint xline">${esc(extrasLine(ex))} <span>· ${esc(T(`from ${ex.n} of ${all.length} foods with these values`, `aus ${ex.n} von ${all.length} Zutaten mit Angaben`))}</span></p>` : ""}${miss ? `<p class="err" style="margin:0">${esc(T(`${miss} not recognised – not counted`, `${miss} nicht erkannt – nicht mitgezählt`))}</p>` : ""}</div>`;
  }
  const textLabel = () => (mealDraft && mealDraft.items.length ? T("Add more", "Weitere Zutaten") : T("What did you eat?", "Was hast du gegessen?"));
  function refreshMeal() {
    const d = mealDraft; if (!d) return;
    const L = $("mealList"), P = $("mealPortion"), S = $("mealTotals"), ta = $("mealText"), lab = $("mealTextLab");
    if (L) L.innerHTML = mealListHTML();
    if (P) P.innerHTML = portionHTML();
    if (S) S.innerHTML = mealTotalsHTML();
    if (ta && ta.value !== d.text) { ta.value = d.text; ta.classList.toggle("sm", d.items.length > 0); ta.rows = d.items.length ? 2 : 4; if (d.items.length) ta.placeholder = T("e.g. 1 tsp honey, 10 g chia seeds", "z. B. 1 TL Honig, 10 g Chiasamen"); }
    if (lab) lab.textContent = textLabel();
  }
  /* only the numbers of one row + the totals – keeps the keyboard open while typing an amount */
  function refreshItemRow(key, it) {
    const a = $("im-" + key), b = $("ik-" + key), S = $("mealTotals");
    if (a) a.textContent = itemSub(it);
    if (b) b.innerHTML = `${nf0.format(it.kcal)}<small>kcal</small>`;
    if (S) S.innerHTML = mealTotalsHTML();
  }
  function setFx(dir) {
    const d = mealDraft; if (!d) return;
    commitPending();
    const i = FX.indexOf(d.fx), k = clamp((i < 0 ? 3 : i) + dir, 0, FX.length - 1);
    d.fx = FX[k];
    d.items.forEach((it) => setItemQty(it, it.q0 * d.fx));
    refreshMeal();
  }
  const touchItem = (it) => { it.q0 = it.qty / mealDraft.fx; delete it.wn; return it; };
  function viewMeal() {
    const d = mealDraft;
    if (!d) return `${backBar()}${emptyBox(T("No meal open", "Keine Mahlzeit offen"), "")}`;
    const tpl = d.mode === "tpl", armed = state.armed === "meal-del", linked = !tpl && d.tpl ? tplById2(d.tpl) : null;
    const title = tpl ? (d.edit ? T("Edit my meal", "Meine Mahlzeit bearbeiten") : T("New my meal", "Neue Mahlzeit anlegen")) : d.edit ? T("Edit meal", "Mahlzeit bearbeiten") : T("Add meal", "Mahlzeit eintragen");
    const nameField = `<div class="field"><label class="label" for="mealName">${esc(tpl ? T("Name", "Name") : T("Name (optional)", "Name (optional)"))}</label><input id="mealName" maxlength="40" autocomplete="off" value="${esc(d.name)}" placeholder="${esc(T("e.g. Porridge, Post-workout shake", "z. B. Porridge, Shake nach dem Training"))}"></div>`;
    return `
      ${backBar()}
      <h1 class="vtitle">${esc(title)}</h1>
      ${tpl ? `<p class="meta">${esc(T("Saved under My meals – add it to any day with one tap.", "Wird unter Meine Mahlzeiten gespeichert – mit einem Tipp an jedem Tag eintragen."))}</p>${nameField}` : ""}
      <div class="seg four" role="group" aria-label="${esc(T("Meal", "Mahlzeit"))}">${MEAL_TYPES.map(([k]) => `<button data-action="meal-type" data-arg="${k}" aria-pressed="${d.type === k}">${esc(mealTypeName(k))}</button>`).join("")}</div>
      <div class="field"><label class="label" for="mealText" id="mealTextLab">${esc(textLabel())}</label>
        <textarea id="mealText" class="mealtext${d.items.length ? " sm" : ""}" rows="${d.items.length ? 2 : 4}" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="${esc(d.items.length ? T("e.g. 1 tsp honey, 10 g chia seeds", "z. B. 1 TL Honig, 10 g Chiasamen") : T("80 g oats, 30 g almonds, 150 ml milk, 1 banana\n2 slices of bread, 1 tbsp butter", "80 g Haferflocken, 30 g Mandeln, 150 ml Milch, 1 Banane\n2 Scheiben Brot, 1 EL Butter"))}">${esc(d.text)}</textarea>
        <span class="hint">${esc(T("One per line or separated by commas. Amounts: g, ml, pcs, slices, tbsp, tsp, glass, cup, handful, can, serving, half … – also in German.", "Eins pro Zeile oder mit Komma getrennt. Mengen: g, ml, Stk, Scheiben, EL, TL, Glas, Tasse, Handvoll, Dose, Portion, halbe … – auch auf Englisch."))}</span></div>
      <section class="sec ilist" id="mealList">${mealListHTML()}</section>
      <div class="linkrow"><button class="linkbtn" data-action="food-new-meal">+ ${esc(T("Add your own food (from the pack)", "Eigenes Lebensmittel anlegen (von der Packung)"))}</button><button class="linkbtn scanlink" data-action="scan" data-arg="meal">${ICON_SCAN}${esc(T("Scan barcode", "Barcode scannen"))}</button></div>
      <div id="mealPortion">${portionHTML()}</div>
      <section id="mealTotals">${mealTotalsHTML()}</section>
      ${tpl ? "" : `${nameField}<div class="two"><div class="field"><label class="label" for="mealDate">${esc(T("Date", "Datum"))}</label><input type="date" id="mealDate" value="${esc(d.date)}" max="${todayISO()}"></div><div class="field"><label class="label" for="mealTime">${esc(T("Time", "Uhrzeit"))}</label><input type="time" id="mealTime" value="${esc(d.time)}"></div></div>`}
      <div class="btnrow"><button class="btn primary grow1" data-action="meal-save">${esc(tpl ? T("Save my meal", "Mahlzeit speichern") : T("Save meal", "Mahlzeit speichern"))}</button>${d.edit ? `<button class="btn danger${armed ? " armed" : ""}" data-action="meal-del">${esc(armed ? T("Really delete?", "Wirklich löschen?") : T("Delete", "Löschen"))}</button>` : ""}</div>
      ${tpl ? "" : `<button class="btn star" data-action="meal-tpl">★ ${esc(linked ? T(`Update “${linked.name}” in My meals`, `„${linked.name}“ in Meine Mahlzeiten aktualisieren`) : T("Save as My meal", "Als meine Mahlzeit speichern"))}</button>`}
      <p class="hint">${esc(T("Change amounts with − / + or type them in, switch between grams and pieces, slices, tbsp … with the unit. Tap a food to swap it. “?” = best guess, please check. “≈” = weight per piece estimated.", "Mengen mit − / + ändern oder eintippen, über die Einheit zwischen Gramm und Stück, Scheiben, EL … wechseln. Tippe auf ein Lebensmittel, um es zu tauschen. „?\" = beste Vermutung, bitte prüfen. „≈\" = Stückgewicht geschätzt."))}</p>`;
  }
  const cleanItem = (it) => { const c = { ...it }; delete c.q0; delete c.gs; delete c.wn; return calcItem(c); };
  function saveMeal() {
    const d = mealDraft; if (!d) return;
    commitPending();
    const items = d.items.filter((it) => it.g > 0).map(cleanItem);
    if (!items.length) { refreshMeal(); toast(T("Add at least one food", "Mindestens ein Lebensmittel eintragen")); return; }
    const kc = nf0.format(sumMacros(items).kcal), name = d.name.trim().replace(/\s+/g, " ");
    if (d.mode === "tpl") {
      if (!name) { refreshMeal(); toast(T("Give it a name", "Gib ihr einen Namen")); const n = $("mealName"); if (n) n.focus(); return; }
      const t = tplById2(d.id), rec = { ...(t || { id: d.id, created: todayISO(), used: 0 }), name, type: d.type, items };
      db.mealTpls = db.mealTpls.filter((x) => x.id !== rec.id).concat(rec);
      persist(); mealDraft = null; state.stack.pop(); render(); window.scrollTo(0, 0);
      toast(T(`“${name}” saved · ${kc} kcal`, `„${name}“ gespeichert · ${kc} kcal`));
      return;
    }
    const meal = { id: d.id, date: d.date || todayISO(), time: d.time || "", type: d.type, ...(name ? { name } : {}), ...(d.tpl && tplById2(d.tpl) ? { tpl: d.tpl } : {}), items, ...(d.example ? { example: true } : {}) };
    if (!d.edit && meal.tpl) { const t = tplById2(meal.tpl); t.used = (t.used || 0) + 1; if ((t.last || "") < meal.date) t.last = meal.date; }
    db.meals = db.meals.filter((x) => x.id !== meal.id).concat(meal);
    state.foodDay = meal.date === todayISO() ? null : meal.date;
    persist(); mealDraft = null; state.stack.pop(); render(); window.scrollTo(0, 0);
    toast(T(`Saved · ${kc} kcal`, `Gespeichert · ${kc} kcal`));
  }
  /* "★ Save as My meal" from the meal editor (same name → that one gets updated) */
  function saveDraftAsTpl() {
    const d = mealDraft; if (!d) return;
    commitPending();
    const items = d.items.filter((it) => it.g > 0).map(cleanItem), name = d.name.trim().replace(/\s+/g, " ");
    if (!items.length) { refreshMeal(); toast(T("Add at least one food", "Mindestens ein Lebensmittel eintragen")); return; }
    if (!name) { refreshMeal(); toast(T("Give the meal a name first", "Gib der Mahlzeit zuerst einen Namen")); const n = $("mealName"); if (n) { n.focus(); n.scrollIntoView({ block: "center", behavior: "smooth" }); } return; }
    let t = (d.tpl && tplById2(d.tpl)) || db.mealTpls.find((x) => fold(x.name) === fold(name));
    const upd = !!t;
    if (t) Object.assign(t, { name, type: d.type, items }); else { t = { id: newId(), name, type: d.type, items, created: todayISO(), used: 0 }; db.mealTpls.push(t); }
    d.tpl = t.id; d.name = name;
    persist(); render();
    toast(upd ? T(`“${name}” updated in My meals`, `„${name}“ in Meine Mahlzeiten aktualisiert`) : T(`“${name}” saved to My meals`, `„${name}“ in Meine Mahlzeiten gespeichert`));
  }
  function logTpl(id) {
    const t = tplById2(id); if (!t) return;
    const date = foodDay(), prev = { used: t.used, last: t.last };
    const m = { id: newId(), date, time: date === todayISO() ? nowTime() : "", type: t.type || guessMealType(), name: t.name, tpl: t.id, items: t.items.map((it) => calcItem({ ...it })) };
    db.meals.push(m); t.used = (t.used || 0) + 1; if ((t.last || "") < date) t.last = date;
    persist(); render();
    toast(T(`${t.name} added · ${nf0.format(sumMacros(m.items).kcal)} kcal`, `${t.name} eingetragen · ${nf0.format(sumMacros(m.items).kcal)} kcal`), { label: T("Undo", "Rückgängig"), fn: () => { db.meals = db.meals.filter((x) => x.id !== m.id); Object.assign(t, prev); persist(); render(); } });
  }

  /* ---------- Open Food Facts: millions of packed products, searched only when you tap the button ---------- */
  const OFF_FIELDS = "code,product_name,product_name_de,product_name_en,brands,quantity,serving_quantity,nutriments";
  let offState = null, offLast = 0;
  const offCache = new Map();
  function offFood(p) {
    const n = (p && p.nutriments) || {}, num = (k) => { const v = parseFloat(n[k]); return Number.isFinite(v) && v >= 0 ? v : null; };
    const pr = num("proteins_100g"), f = num("fat_100g"), c = num("carbohydrates_100g");
    let kcal = num("energy-kcal_100g");
    if (kcal == null) { const kj = num("energy-kj_100g") ?? num("energy_100g"); if (kj != null) kcal = kj / 4.184; }
    if (pr == null || f == null || c == null || pr + f + c > 101) return null;
    const nm = String((LANG === "de" ? p.product_name_de || p.product_name : p.product_name_en || p.product_name) || p.product_name_de || p.product_name_en || "").replace(/\s+/g, " ").trim();
    if (!nm) return null;
    const sq = parseFloat(p.serving_quantity), qty = String(p.quantity || "").trim(), pk = /^(\d+(?:[.,]\d+)?)\s*(g|ml)$/i.exec(qty);
    const opt = (k) => { const v = num(k); return v != null && v <= 100 ? r1(v) : null; };
    return { code: String(p.code || ""), name: nm, brand: String(p.brands || "").split(",")[0].trim(), qty, kcal: kcal != null ? Math.round(kcal) : 0, p: r1(pr), f: r1(f), c: r1(c), pc: sq > 0 && sq < 2000 ? r1(sq) : 0,
      pack: pk ? parseFloat(pk[1].replace(",", ".")) : 0, liq: pk ? pk[2].toLowerCase() === "ml" : false, sf: opt("saturated-fat_100g"), su: opt("sugars_100g"), fi: opt("fiber_100g"), sa: opt("salt_100g") };
  }
  async function offSearch(q) {
    const key = fold(q); if (offCache.has(key)) return offCache.get(key);
    const wait = offLast + 3000 - Date.now(); if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    offLast = Date.now();
    const code = q.replace(/[\s-]/g, ""), bar = /^\d{8,14}$/.test(code);
    const url = bar ? `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${OFF_FIELDS}`
      : `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&sort_by=unique_scans_n&page_size=30&fields=${OFF_FIELDS}`;
    const ctl = typeof AbortController === "function" ? new AbortController() : null, tm = setTimeout(() => ctl && ctl.abort(), 15000);
    try {
      const res = await fetch(url, ctl ? { signal: ctl.signal } : {});
      if (bar && res.status === 404) { offCache.set(key, []); return []; }
      if (!res.ok) throw new Error("HTTP " + res.status);
      const j = await res.json();
      const raw = bar ? (j && j.product && j.status !== 0 ? [{ code, ...j.product }] : []) : (j && j.products) || [];
      const seen = new Set(), list = [];
      for (const x of raw.map(offFood)) { if (!x) continue; const k = fold(`${x.brand} ${x.name} ${x.kcal}`); if (seen.has(k)) continue; seen.add(k); list.push(x); }
      offCache.set(key, list);
      return list;
    } finally { clearTimeout(tm); }
  }
  function offBlockHTML(ctx, q) {
    q = (q || "").trim();
    if (!q) return "";
    const st = offState && offState.ctx === ctx && offState.q === q ? offState : null;
    const credit = `<p class="hint offnote">${esc(T("Data from Open Food Facts (ODbL) – check the values against your pack.", "Daten von Open Food Facts (ODbL) – Werte bitte mit der Packung vergleichen."))}</p>`;
    if (!st) return `<button type="button" class="btn offbtn" data-action="off-search" data-arg="${ctx}"><span>${esc(/^\d[\d\s-]{6,}$/.test(q) ? T("Look up barcode", "Barcode nachschlagen") : T("Search Open Food Facts", "In Open Food Facts suchen"))}</span><small>„${esc(q)}" · ${esc(T("packed products from the internet", "Produkte aus dem Internet"))}</small></button>`;
    if (st.loading) return `<p class="hint offwait" role="status">${esc(T("Searching Open Food Facts …", "Suche in Open Food Facts …"))}</p>`;
    if (st.err) return `<div class="offerr"><p class="err" style="margin:0">${esc(T("Open Food Facts couldn't be reached – are you online? Try again in a moment.", "Open Food Facts war nicht erreichbar – bist du online? Gleich nochmal versuchen."))}</p><button type="button" class="btn sm" data-action="off-search" data-arg="${ctx}">${esc(T("Try again", "Nochmal"))}</button></div>`;
    if (!st.list.length) return `<p class="hint">${esc(T("Nothing found on Open Food Facts. Try fewer or other words – or the barcode number.", "Nichts in Open Food Facts gefunden. Weniger oder andere Wörter versuchen – oder die Barcode-Nummer."))}</p>`;
    return `<div class="sechead offhead"><h2 class="sectitle">Open Food Facts</h2><span class="label">${esc(T("per 100 g", "pro 100 g"))}</span></div>${st.list.map((x, i) => `<button type="button" class="pickrow offrow" data-action="off-pick" data-arg="${i}"><span class="main"><span class="t1">${esc(x.name)}</span><span class="t2">${esc([x.brand, x.qty].filter(Boolean).join(" · "))}${x.brand || x.qty ? " · " : ""}${nf0.format(x.kcal)} kcal · ${esc(macroLine1(x))} g</span></span><span class="chev" aria-hidden="true">›</span></button>`).join("")}${credit}`;
  }
  function renderOff() {
    if (!offState) return;
    const el = offState.ctx === "pick" ? $("fpickOff") : $("foodsOff");
    if (el) el.innerHTML = offBlockHTML(offState.ctx, offState.q);
  }
  function runOff(ctx) {
    const q = (ctx === "pick" ? ($("fpickQ") || {}).value : state.foodQ) || "";
    if (!q.trim()) return;
    const st = offState = { ctx, q: q.trim(), loading: true, list: [] };
    renderOff();
    offSearch(st.q).then((list) => { st.list = list; }).catch(() => { st.err = true; }).finally(() => { st.loading = false; if (offState === st) renderOff(); });
  }

  /* ---------- Foods list ---------- */
  function viewFoods() {
    const q = state.foodQ || "";
    const list = q ? searchFoods(q, 30) : FOODS;
    const row = (x) => `<button class="row" data-action="food-open" data-arg="${esc(x.id)}">${badge(foodName(x), x.own ? "#FFE83A" : "#7CF2C9")}<span class="main"><span class="t1">${esc(foodName(x))}${x.own ? `<span class="tag">${esc(T("Own", "Eigene"))}</span>` : ""}</span><span class="t2">${x.brand ? `${esc(x.brand)} · ` : ""}${nf0.format(x.kcal)} kcal · ${esc(macroLine1(x))} g${x.u.pc ? ` · 1 ${esc(unitTxt("pc", 1))} = ${nf.format(x.u.pc)} g` : x.u.slice ? ` · 1 ${esc(unitTxt("slice", 1))} = ${nf.format(x.u.slice)} g` : ""}</span></span><span class="val"></span><span class="chev" aria-hidden="true">›</span></button>`;
    let body;
    if (q) body = `<section class="sec">${list.map(row).join("") || `<p class="hint">${esc(T("Nothing found in the app.", "In der App nichts gefunden."))}</p>`}</section><section class="sec offsec" id="foodsOff">${offBlockHTML("foods", q)}</section>`;
    else body = `<section class="sec"><div class="sechead"><h2 class="sectitle">${esc(T("My foods", "Meine Lebensmittel"))}</h2><span class="label">${esc(pl(db.foods.length, "food"))}</span></div>
        <button class="addbig sm" data-action="food-new"><span aria-hidden="true">+</span>${esc(T("Add your own food", "Eigenes Lebensmittel anlegen"))}</button>
        ${list.filter((x) => x.own).map(row).join("") || `<p class="hint" style="padding:8px 0">${esc(T("Your products with the values from the pack – calories, protein, fat, carbs, sugar, fibre, salt. Then just type their name in a meal.", "Deine Produkte mit den Werten von der Packung – Kalorien, Eiweiß, Fett, Kohlenhydrate, Zucker, Ballaststoffe, Salz. Danach in einer Mahlzeit einfach den Namen eintippen."))}</p>`}</section>`
      + FOOD_CATS.filter(([k]) => k !== "own").map(([k, en, de]) => { const xs = list.filter((x) => x.cat === k); return xs.length ? `<section class="sec"><div class="sechead"><h2 class="sectitle">${esc(T(en, de))}</h2><span class="label">${esc(pl(xs.length, "food"))}</span></div>${xs.map(row).join("")}</section>` : ""; }).join("");
    return `
      ${backBar()}
      <h1 class="vtitle">${esc(T("Foods", "Lebensmittel"))}</h1>
      <p class="meta">${esc(T(`${FOODS.length} foods with typical values per 100 g. Search a product, type its barcode number or scan it to find it on Open Food Facts. Tap a food to save your own version.`, `${FOODS.length} Lebensmittel mit typischen Werten pro 100 g. Ein Produkt suchen, die Barcode-Nummer eintippen oder scannen, um es in Open Food Facts zu finden. Tippe auf ein Lebensmittel, um eine eigene Version zu speichern.`))}</p>
      <div class="searchrow"><label class="searchbar">${ICON_SEARCH}<input type="search" id="foodQ" placeholder="${esc(T("Search food or barcode", "Lebensmittel oder Barcode suchen"))}" autocomplete="off" value="${esc(q)}" aria-label="${esc(T("Search food", "Lebensmittel suchen"))}"></label>${scanBtnHTML("foods")}</div>
      ${body}`;
  }

  /* ================= Reports: month, quarter, half-year, year – compared with the period before or the same period last year =================
     A report "appears" as soon as its period is over (and has entries). The running period can be opened any time ("so far"),
     then it is compared with the same number of days of the comparison period. */
  const REP_TYPES = [["m", "Month", "Monat", "Monthly report", "Monatsbericht"], ["q", "Quarter", "Quartal", "Quarterly report", "Quartalsbericht"], ["h", "Half-year", "Halbjahr", "Half-year report", "Halbjahresbericht"], ["y", "Year", "Jahr", "Annual report", "Jahresbericht"]];
  const REP_N = { m: 1, q: 3, h: 6, y: 12 };
  function mkPeriod(type, y, m0) {
    const n = REP_N[type], from = `${y}-${pad(m0 + 1)}-01`, to = addDays(addMonths(from, n), -1), k = m0 / n + 1;
    const key = type === "m" ? from.slice(0, 7) : type === "q" ? `${y}-Q${k}` : type === "h" ? `${y}-H${k}` : String(y);
    return { type, y, m0, k, from, to, key, id: `${type}:${key}` };
  }
  const periodOf = (type, iso) => { const n = REP_N[type], m = +iso.slice(5, 7) - 1; return mkPeriod(type, +iso.slice(0, 4), Math.floor(m / n) * n); };
  const periodShift = (p, k) => { const t = p.y * 12 + p.m0 + k * REP_N[p.type]; return mkPeriod(p.type, Math.floor(t / 12), ((t % 12) + 12) % 12); };
  function periodFromId(id) {
    const m = /^([mqhy]):(\d{4})(?:-(\d{2})|-Q([1-4])|-H([12]))?$/.exec(id || ""); if (!m) return null;
    const t = m[1], y = +m[2];
    if (t === "m" && m[3] && +m[3] >= 1 && +m[3] <= 12) return mkPeriod("m", y, +m[3] - 1);
    if (t === "q" && m[4]) return mkPeriod("q", y, (+m[4] - 1) * 3);
    if (t === "h" && m[5]) return mkPeriod("h", y, (+m[5] - 1) * 6);
    if (t === "y" && !m[3] && !m[4] && !m[5]) return mkPeriod("y", y, 0);
    return null;
  }
  const capF = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const monAb = (iso) => monShort.format(isoDate(iso)).replace(".", "");
  function periodName(p) {
    if (p.type === "m") return capF(monthFmt.format(isoDate(p.from)));
    if (p.type === "q") return `Q${p.k} ${p.y}`;
    if (p.type === "h") return T(`H${p.k} ${p.y}`, `${p.k}. Halbjahr ${p.y}`);
    return String(p.y);
  }
  const periodShort = (p) => (p.type === "m" ? `${capF(monAb(p.from))} ${p.y}` : p.type === "h" ? T(`H${p.k} ${p.y}`, `${p.k}. Hj. ${p.y}`) : periodName(p));
  const repRow = (t) => REP_TYPES.find((x) => x[0] === t) || REP_TYPES[0];
  const repTypeName = (t) => T(repRow(t)[1], repRow(t)[2]);
  const repKindName = (t) => T(repRow(t)[3], repRow(t)[4]);
  const isRunning = (p) => p.to >= todayISO() && p.from <= todayISO();
  const periodEnd = (p) => (isRunning(p) ? todayISO() : p.to);
  const periodLen = (p) => daysBetween(p.from, p.to) + 1;
  const minIso = (a, b) => (a < b ? a : b);
  function cmpName(type, mode) {
    if (mode === "yoy" && type !== "y") return { m: T("Same month last year", "Vorjahresmonat"), q: T("Same quarter last year", "Vorjahresquartal"), h: T("Same half last year", "Vorjahreshalbjahr") }[type];
    return { m: T("Previous month", "Vormonat"), q: T("Previous quarter", "Vorquartal"), h: T("Previous half-year", "Vorheriges Halbjahr"), y: T("Previous year", "Vorjahr") }[type];
  }

  /* ---------- What happened in a date range ---------- */
  const repMemo = new Map();
  function repStats(from, to) {
    const key = `${ver}|${from}|${to}`;
    if (repMemo.has(key)) return repMemo.get(key);
    if (repMemo.size > 400) repMemo.clear();
    const D = derived(), r = {
      from, to, n: 0, dur: 0, dayN: 0, weekN: 0, sp: {}, grp: {}, vol: 0, sets: 0, reps: 0, hold: 0, prs: [], best: new Map(), lvTop: new Map(), lvUp: [], newEx: [], daily: new Map(),
      run: { n: 0, km: 0, dur: 0, longest: null, fastest: null }, hyrox: { n: 0, dur: 0, best: null }, fb: { n: 0, games: 0, goals: 0, assists: 0, dur: 0 }, other: { n: 0, dur: 0 }, food: null, has: false
    };
    const days = new Set(), weeks = new Set();
    const day = (d) => { let x = r.daily.get(d); if (!x) { x = { dur: 0, n: 0, vol: 0, km: 0, sets: 0 }; r.daily.set(d, x); } return x; };
    for (const s of D.asc) {
      if (s.date < from) continue;
      if (s.date > to) break;
      const dur = s.dur || 0, dd = day(s.date);
      r.n++; r.dur += dur; days.add(s.date); weeks.add(weekStart(s.date)); dd.n++; dd.dur += dur;
      const sp = r.sp[s.sport] || (r.sp[s.sport] = { n: 0, dur: 0 }); sp.n++; sp.dur += dur;
      if (isLift(s)) {
        for (const e of s.ex || []) {
          const x = exOf(e.id), st = exStats(e, x.kind); if (!st.sets) continue;
          r.sets += st.sets; dd.sets += st.sets; r.grp[x.group] = (r.grp[x.group] || 0) + st.sets;
          if (x.kind === "kg") { r.vol += st.vol; dd.vol += st.vol; r.reps += st.total; } else if (x.kind === "bw") r.reps += st.total; else r.hold += st.total;
          const lv = lvKey(x, e.lv), v = x.kind === "kg" ? st.e1rm : x.kind === "bw" ? st.reps : st.time, k = `${e.id}|${lv == null ? "" : lv}`, b = r.best.get(k);
          if (v > 0 && (!b || v > b.v)) r.best.set(k, { id: e.id, lv, kind: x.kind, v, date: s.date, sid: s.id });
          if (lv != null) r.lvTop.set(e.id, Math.max(r.lvTop.has(e.id) ? r.lvTop.get(e.id) : -1, lv));
        }
        for (const p of D.prs.get(s.id) || []) r.prs.push({ ...p, date: s.date, sid: s.id });
      } else if (s.sport === "run") {
        const R = r.run; R.n++;
        if (s.dist > 0) { R.km += s.dist; dd.km += s.dist; if (dur) R.dur += dur; if (!R.longest || s.dist > R.longest.dist) R.longest = s; if (s.dist >= 3 && dur && (!R.fastest || dur / s.dist < R.fastest.dur / R.fastest.dist)) R.fastest = s; }
      } else if (s.sport === "hyrox") { r.hyrox.n++; r.hyrox.dur += dur; if ((s.kind === "Wettkampf" || s.kind === "Simulation") && dur && (!r.hyrox.best || dur < r.hyrox.best.dur)) r.hyrox.best = s; }
      else if (s.sport === "fb") { const F = r.fb; F.n++; F.dur += dur; if (s.kind === "Spiel") F.games++; F.goals += s.goals || 0; F.assists += s.assists || 0; }
      else { r.other.n++; r.other.dur += dur; }
    }
    r.dayN = days.size; r.weekN = weeks.size;
    // new calisthenics levels: highest level in the range above the highest level before it
    for (const [id, top] of r.lvTop) {
      let before = -1;
      for (const h of D.byEx.get(id) || []) { if (h.s.date >= from) break; if (h.lv != null && h.lv > before) before = h.lv; }
      if (before >= 0 && top > before) r.lvUp.push({ id, from: before, to: top });
    }
    // exercises done for the very first time
    const ids = new Set([...r.best.values()].map((b) => b.id));
    for (const id of ids) { const l = D.byEx.get(id); if (l && l.length && l[0].s.date >= from) r.newEx.push(id); }
    // nutrition: averages over the days with entries
    const md = new Map();
    for (const m of db.meals) {
      if (m.date < from || m.date > to) continue;
      const t = sumMacros(m.items), a = md.get(m.date) || { kcal: 0, p: 0, f: 0, c: 0 };
      a.kcal += t.kcal; a.p += t.p; a.f += t.f; a.c += t.c; md.set(m.date, a);
    }
    const fd = md.size, g = goalsNow(), vals = [...md.values()], avg = (k) => (fd ? vals.reduce((s, x) => s + x[k], 0) / fd : 0);
    r.food = { days: fd, kcal: avg("kcal"), p: avg("p"), f: avg("f"), c: avg("c"), pGoal: g.p ? vals.filter((x) => x.p >= g.p).length : 0, kGoal: g.kcal ? vals.filter((x) => Math.abs(x.kcal - g.kcal) <= g.kcal * 0.1).length : 0 };
    // body weight: average of the entries; change = last week vs. first week of entries (single days jump around too much)
    const ws = db.weights.filter((w) => w.date >= from && w.date <= to), wav = (l) => l.reduce((x, w) => x + w.kg, 0) / l.length;
    r.body = { n: ws.length, avg: ws.length ? wav(ws) : 0, ch: null };
    if (ws.length >= 2 && daysBetween(ws[0].date, ws[ws.length - 1].date) >= 7) {
      const a = ws.filter((w) => w.date <= addDays(ws[0].date, 6)), b = ws.filter((w) => w.date >= addDays(ws[ws.length - 1].date, -6));
      r.body.ch = wav(b) - wav(a);
    }
    r.has = r.n > 0 || fd > 0 || ws.length > 0;
    repMemo.set(key, r);
    return r;
  }
  function buildReport(p, mode) {
    const running = isRunning(p), end = periodEnd(p), elapsed = daysBetween(p.from, end);
    const c = mode === "yoy" && p.type !== "y" ? periodShift(p, -12 / REP_N[p.type]) : periodShift(p, -1);
    const cEnd = running ? minIso(addDays(c.from, elapsed), c.to) : c.to;
    return { p, c, mode, running, end, cEnd, cur: repStats(p.from, end), cmp: repStats(c.from, cEnd), cmpFull: repStats(c.from, c.to) };
  }
  function firstDataDate() {
    const D = derived(); let f = D.asc.length ? D.asc[0].date : "";
    for (const m of db.meals) if (!f || m.date < f) f = m.date;
    if (db.weights.length && (!f || db.weights[0].date < f)) f = db.weights[0].date;
    return f;
  }
  /* periods newest first, from the running one back to the first entry */
  function periodList(type) {
    const first = firstDataDate(); if (!first) return [];
    const out = []; for (let p = periodOf(type, todayISO()); p.to >= first && out.length < 120; p = periodShift(p, -1)) out.push(p);
    return out;
  }
  /* "new" = the last finished period has entries and wasn't opened yet */
  const lastDone = (type) => { const p = periodShift(periodOf(type, todayISO()), -1); return repStats(p.from, p.to).has ? p : null; };
  const newReports = (field) => { const st = db.settings[field] || {}; return REP_TYPES.map(([t]) => lastDone(t)).filter((p) => p && (st[p.type] || "") < p.key); };
  const isNewRep = (p) => { const st = db.settings.repSeen || {}, l = lastDone(p.type); return !!l && l.id === p.id && (st[p.type] || "") < p.key; };
  function markRep(field, list) {
    const st = db.settings[field] = { ...(db.settings[field] || {}) }; let ch = false;
    for (const p of list) if ((st[p.type] || "") < p.key) { st[p.type] = p.key; ch = true; }
    if (ch) persist();
  }

  /* ---------- Small building blocks ---------- */
  function dlt(cur, prev, opt) {
    const o = opt || {};
    if (!(prev > 0)) return cur > 0 ? `<span class="dl new">${esc(T("new", "neu"))}</span>` : `<span class="dl">–</span>`;
    const d = (cur - prev) / prev;
    if (Math.abs(d) < 0.005) return `<span class="dl">±0 %</span>`;
    const cls = o.neutral ? "" : (o.lower ? d < 0 : d > 0) ? "up" : "down";
    return `<span class="dl ${cls}">${d > 0 ? "▲ +" : "▼ −"}${nf0.format(Math.min(999, Math.abs(d * 100)))} %</span>`;
  }
  const repDur = (v) => (v >= 100 * 3600 ? `${nf0.format(v / 3600)} h` : durTxt(v));
  const onDays = (n) => (LANG === "de" ? `${nf.format(n)} ${n === 1 ? "Tag" : "Tagen"}` : pl(n, "day"));
  const endDot = (t) => (/[.!?]$/.test(t) ? t : t + ".");
  const paceOf = (r) => (r.run.km > 0 && r.run.dur > 0 ? r.run.dur / r.run.km : 0);
  const n0 = (v) => nf0.format(v);
  const bestFmt = (kind, v) => (kind === "kg" ? kg(Math.round(v * 2) / 2) : kind === "bw" ? pl(v, "rep") : secTxt(v));
  const bestLab = (kind) => (kind === "kg" ? "e1RM" : kind === "bw" ? T("best set", "bester Satz") : T("longest hold", "längste Haltezeit"));
  function kpiRows(list, cs) {
    return list.filter((r) => r[1] > 0 || r[2] > 0).map(([lab, a, b, fmt, opt]) => `<div class="kpirow"><span class="k">${esc(lab)}</span><span class="v"><b>${esc(a > 0 ? fmt(a) : "–")}</b><small>${esc(cs)}: ${esc(b > 0 ? fmt(b) : "–")}</small></span>${dlt(a, b, opt)}</div>`).join("");
  }
  /* two bars per row: this period (colour) and the comparison (grey) */
  function cmpRows(items, fmt, cs) {
    const max = Math.max(1e-9, ...items.map((x) => Math.max(x.a, x.b)));
    return items.map((x) => `<div class="cmprow">
      <div class="cmptop"><span class="cmpname"><i style="background:${x.color}"></i>${esc(x.name)}</span><span class="cmpval"><b>${esc(x.a ? fmt(x.a) : "–")}</b><small>${esc(cs)}: ${esc(x.b ? fmt(x.b) : "–")}</small></span>${dlt(x.a, x.b)}</div>
      <div class="cmpbars" aria-hidden="true"><span class="cur" style="width:${((x.a / max) * 100).toFixed(1)}%;background:${x.color}"></span><span class="old" style="width:${((x.b / max) * 100).toFixed(1)}%"></span></div>
    </div>`).join("");
  }

  /* ---------- Comparison chart: cumulative lines or grouped bars, touch to read ---------- */
  let cmpCharts = [];
  function cmpBlock(id, cfg, legend) {
    cmpCharts.push({ id, cfg });
    return `<div class="cmpread" id="${id}R" aria-live="polite">${cfg.read(null)}</div><div class="chart cmpchart" id="${id}"></div><div class="legend">${legend}</div>`;
  }
  function drawCmp(host, cfg) {
    if (!host) return;
    if (cfg.kind === "body") { drawBody(host, cfg); return; }
    const W = Math.max(260, Math.round(host.clientWidth || 320)), Hh = 200, L = 46, R = 12, Tp = 14, B = 26, pw = W - L - R, ph = Hh - Tp - B;
    const A = cfg.a, Bv = cfg.b, n = cfg.n, f = (v) => v.toFixed(1);
    const hi = Math.max(0, ...A, ...Bv);
    const step = niceStep(hi || cfg.minStep || 1, cfg.minStep || 1, cfg.steps), yMax = Math.max(step, Math.ceil(hi / step - 1e-9) * step);
    const Y = (v) => Tp + ph - (v / yMax) * ph;
    let s = "";
    for (let v = 0, g = 0; v <= yMax + step / 2 && g < 12; v += step, g++) s += `<line class="grid${v === 0 ? " base" : ""}" x1="${L}" x2="${W - R}" y1="${f(Y(v))}" y2="${f(Y(v))}"/><text class="ylab" x="${L - 8}" y="${f(Y(v) + 4)}" text-anchor="end">${esc(cfg.yfmt(v))}</text>`;
    const gw = pw / n, X = cfg.bars ? (i) => L + gw * (i + 0.5) : (i) => L + (n <= 1 ? 0.5 : i / (n - 1)) * pw;
    let lastX = -1e9;
    for (const t of cfg.ticks) { const x = X(t.i); if (x - lastX < 34) continue; lastX = x; const anchor = !cfg.bars && t.i === 0 ? "start" : !cfg.bars && t.i >= n - 1 ? "end" : "middle"; s += `<text class="xlab" x="${f(x)}" y="${Hh - 6}" text-anchor="${anchor}">${esc(t.text)}</text>`; }
    if (cfg.bars) {
      const bw = clamp(gw * 0.3, 3, 18), y0 = Y(0);
      for (let i = 0; i < n; i++) {
        const cx = X(i), vb = Bv[i] || 0, va = A[i] || 0;
        if (vb > 0) s += `<rect class="oldbar" x="${f(cx - bw * 1.08)}" y="${f(Y(vb))}" width="${f(bw)}" height="${f(Math.max(2, y0 - Y(vb)))}" rx="2"/>`;
        if (va > 0) s += `<rect x="${f(cx + bw * 0.08)}" y="${f(Y(va))}" width="${f(bw)}" height="${f(Math.max(2, y0 - Y(va)))}" rx="2" style="fill:${cfg.color};opacity:${cfg.partial === i ? 0.55 : 1}"/>`;
      }
    } else {
      const path = (vals) => vals.map((v, i) => `${i ? "L" : "M"}${f(X(i))},${f(Y(v))}`).join("");
      if (Bv.length > 1) s += `<path class="line oldline" d="${path(Bv)}"/>`;
      if (A.length > 1) {
        const gid = "cgrad" + (++gradCount), d = path(A);
        s += `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:${cfg.color};stop-opacity:0.28"/><stop offset="1" style="stop-color:${cfg.color};stop-opacity:0"/></linearGradient></defs>`;
        s += `<path d="${d}L${f(X(A.length - 1))},${f(Tp + ph)}L${f(X(0))},${f(Tp + ph)}Z" style="fill:url(#${gid})"/><path class="line" d="${d}" style="stroke:${cfg.color}"/>`;
      }
      if (A.length) s += `<circle class="ring" cx="${f(X(A.length - 1))}" cy="${f(Y(A[A.length - 1]))}" r="5" style="fill:${cfg.color}"/>`;
    }
    s += `<g class="cur" visibility="hidden"><line class="cursor" x1="0" x2="0" y1="${Tp}" y2="${Tp + ph}"/></g>`;
    host.innerHTML = `<svg viewBox="0 0 ${W} ${Hh}" style="height:${Hh}px" role="img" aria-label="${esc(cfg.aria || "Chart")}">${s}</svg>`;
    const svg = host.firstElementChild, cur = svg.querySelector(".cur"), out = $(host.id + "R");
    const hide = () => { cur.setAttribute("visibility", "hidden"); if (out) out.innerHTML = cfg.read(null); };
    const at = (ev) => {
      const r = svg.getBoundingClientRect(), x = (ev.clientX - r.left) * (W / r.width);
      const i = clamp(cfg.bars ? Math.floor((x - L) / gw) : Math.round(((x - L) / pw) * (n - 1)), 0, n - 1), cx = f(X(i));
      cur.firstElementChild.setAttribute("x1", cx); cur.firstElementChild.setAttribute("x2", cx); cur.setAttribute("visibility", "visible");
      if (out) out.innerHTML = cfg.read(i);
    };
    svg.addEventListener("pointerdown", at); svg.addEventListener("pointermove", at);
    svg.addEventListener("pointerleave", hide); svg.addEventListener("pointercancel", hide);
    svg.addEventListener("pointerup", (e) => { if (e.pointerType !== "mouse") hide(); });
  }
  const REP_METRICS = {
    dur: { name: () => T("Time", "Zeit"), fmt: (v) => repDur(v), y: (v) => `${nf0.format(v / 3600)} h`, step: 1800, steps: [1800, 3600, 7200, 3 * 3600, 5 * 3600, 10 * 3600, 20 * 3600, 25 * 3600, 50 * 3600, 100 * 3600] },
    n: { name: () => T("Sessions", "Einheiten"), fmt: (v) => pl(v, "session"), y: (v) => nf0.format(v), step: 1 },
    vol: { name: () => T("Volume", "Volumen"), fmt: tons, y: (v) => (v >= 1000 ? `${nf0.format(v / 1000)} t` : nf0.format(v)), step: 500 },
    sets: { name: () => T("Sets", "Sätze"), fmt: (v) => pl(v, "set"), y: (v) => nf0.format(v), step: 5 },
    km: { name: () => "km", fmt: (v) => `${nf1.format(v)} km`, y: (v) => nf0.format(v), step: 5 }
  };
  const metricVal = (r, k) => (k === "dur" ? r.dur : k === "n" ? r.n : k === "vol" ? r.vol : k === "sets" ? r.sets : r.run.km);
  /* sub-periods: weeks of the month (1–7, 8–14 …) or months of the quarter / half-year / year */
  function subBuckets(p) {
    if (p.type === "m") { const len = periodLen(p), out = []; for (let a = 0; a < len; a += 7) { const b = Math.min(len, a + 7) - 1; out.push({ a, b, text: `${a + 1}.–${b + 1}.`, long: T(`Days ${a + 1}–${b + 1}`, `${a + 1}. bis ${b + 1}.`) }); } return out; }
    return Array.from({ length: REP_N[p.type] }, (_, i) => { const m = addMonths(p.from, i); return { m: i, text: capF(monAb(m)), long: capF(monthLong.format(isoDate(m))) }; });
  }
  function subVals(r, q, bks, k) {
    return bks.map((bk) => {
      let from, to;
      if (bk.m != null) { from = addMonths(q.from, bk.m); to = addDays(addMonths(from, 1), -1); } else { from = addDays(q.from, bk.a); to = addDays(q.from, bk.b); }
      let v = 0; for (const [d, x] of r.daily) if (d >= from && d <= to) v += x[k];
      return v;
    });
  }
  function cumVals(r, from, len, k, upto) {
    const out = []; let acc = 0;
    for (let i = 0; i < len; i++) { const d = addDays(from, i); if (upto && d > upto) break; const x = r.daily.get(d); if (x) acc += x[k]; out.push(acc); }
    return out;
  }

  /* ---------- Highlights in plain words ---------- */
  function repHighlights(R) {
    const a = R.cur, b = R.cmp, cs = periodShort(R.c), out = [], unit = repTypeName(R.p.type);
    if (a.n) {
      if (b.dur > 0) {
        const d = a.dur - b.dur, pc = nf0.format(Math.abs((d / b.dur) * 100));
        out.push(Math.abs(d) < 60 ? T(`As much training as in ${cs}: <b>${repDur(a.dur)}</b>.`, `Genauso viel trainiert wie ${cs}: <b>${repDur(a.dur)}</b>.`)
          : d > 0 ? T(`<b>${repDur(d)} more training</b> than in ${cs} (+${pc} %) – ${pl(a.n, "session")} on ${pl(a.dayN, "day")}.`, `<b>${repDur(d)} mehr Training</b> als ${cs} (+${pc} %) – ${pl(a.n, "session")} an ${onDays(a.dayN)}.`)
            : T(`${repDur(-d)} less training than in ${cs} (−${pc} %) – ${pl(a.n, "session")} on ${pl(a.dayN, "day")}.`, `${repDur(-d)} weniger Training als ${cs} (−${pc} %) – ${pl(a.n, "session")} an ${onDays(a.dayN)}.`));
      } else out.push(T(`<b>${pl(a.n, "session")}</b> with ${repDur(a.dur)} of training on ${pl(a.dayN, "day")}.`, `<b>${pl(a.n, "session")}</b> mit ${repDur(a.dur)} Training an ${onDays(a.dayN)}.`));
      if (!R.running) {
        let earlier = 0, beat = null;
        for (let q = periodShift(R.p, -1), k = 0; k < 120; q = periodShift(q, -1), k++) {
          if (q.to < firstDataDate()) break;
          const rq = repStats(q.from, q.to); if (!rq.n) continue;
          earlier++; if (rq.dur > a.dur) { beat = q; break; }
        }
        const unitL = LANG === "de" ? { m: "Monat", q: "Quartal", h: "Halbjahr", y: "Jahr" }[R.p.type] : unit.toLowerCase();
        const adj = LANG === "de" ? (R.p.type === "m" || R.p.type === "y" ? "aktivster" : "aktivstes") : "most active";
        if (!beat && earlier >= 2) out.push(T(`Your <b>${adj} ${unitL} so far</b>.`, `Dein <b>${adj} ${unitL}</b> bisher.`));
        else if (beat && daysBetween(beat.to, R.p.from) > 60 * REP_N[R.p.type]) out.push(T(`Most active ${unitL} since <b>${periodName(beat)}</b>.`, `${capF(adj)} ${unitL} seit <b>${periodName(beat)}</b>.`));
      }
      if (a.prs.length) {
        const byGain = (l) => l.slice().sort((x, y) => (y.value / y.prev) - (x.value / x.prev))[0];
        const top = byGain(a.prs.filter((q) => q.type === "e1rm")) || byGain(a.prs), x = exOf(top.ex), m = METRIC[top.type];
        const what = `${esc(exName(x))}${top.type === "e1rm" ? " e1RM" : top.type === "time" ? "" : ` (${esc(metricLabel(top.type, top.kind))})`} +${esc(m.fmt(top.value - top.prev))}`;
        out.push(endDot(T(`<b>${pl(a.prs.length, "record")}</b> – biggest jump: ${what}`, `<b>${pl(a.prs.length, "record")}</b> – größter Sprung: ${what}`)));
      }
      if (a.lvUp.length) { const u = a.lvUp[0], x = exOf(u.id); out.push(T(`New level: <b>${esc(exName(x))} – ${esc(lvName(x, u.to))}</b>${a.lvUp.length > 1 ? ` and ${a.lvUp.length - 1} more` : ""}.`, `Neue Stufe: <b>${esc(exName(x))} – ${esc(lvName(x, u.to))}</b>${a.lvUp.length > 1 ? ` und ${a.lvUp.length - 1} weitere` : ""}.`)); }
      if (a.run.km) {
        const pa = paceOf(a), pb = paceOf(b), dp = pb && pa ? Math.round(pb - pa) : 0;
        out.push(T(`<b>${nf1.format(a.run.km)} km</b> run${dp > 2 ? ` – average pace ${dp} s/km faster` : dp < -2 ? ` – average pace ${-dp} s/km slower` : ""}.`, `<b>${nf1.format(a.run.km)} km</b> gelaufen${dp > 2 ? ` – Ø Pace ${dp} s/km schneller` : dp < -2 ? ` – Ø Pace ${-dp} s/km langsamer` : ""}.`));
      }
      if (a.fb.goals || a.fb.assists) out.push(T(`Football: ${pl(a.fb.goals, "goal")}, ${pl(a.fb.assists, "assist")}.`, `Fußball: ${pl(a.fb.goals, "goal")}, ${pl(a.fb.assists, "assist")}.`));
      if (a.newEx.length) out.push(T(`New: ${esc(a.newEx.slice(0, 3).map((id) => exName(exOf(id))).join(", "))}${a.newEx.length > 3 ? ` +${a.newEx.length - 3}` : ""}.`, `Neu dabei: ${esc(a.newEx.slice(0, 3).map((id) => exName(exOf(id))).join(", "))}${a.newEx.length > 3 ? ` +${a.newEx.length - 3}` : ""}.`));
      const wk = Math.floor(daysBetween(weekStart(R.p.from), weekStart(R.end)) / 7) + 1;
      if (wk >= 3) out.push(T(`Trained in <b>${a.weekN} of ${wk} weeks</b>.`, `In <b>${a.weekN} von ${wk} Wochen</b> trainiert.`));
    } else if (a.has) out.push(T("No training logged in this period.", "In diesem Zeitraum kein Training eingetragen."));
    if (a.food.days) {
      const g = goalsNow();
      out.push(T(`Nutrition logged on ${pl(a.food.days, "day")} – Ø ${n0(a.food.kcal)} kcal and ${n0(a.food.p)} g protein${g.p ? `, protein goal on ${a.food.pGoal} days` : ""}.`, `Ernährung an ${onDays(a.food.days)} erfasst – Ø ${n0(a.food.kcal)} kcal und ${n0(a.food.p)} g Eiweiß${g.p ? `, Eiweißziel an ${a.food.pGoal} Tagen` : ""}.`));
    }
    if (a.body.n) {
      const c = a.body.ch, cTxt = c == null ? "" : Math.abs(c) < 0.15 ? T(" – about the same from start to end", " – von Anfang bis Ende etwa gleich") : T(` – ${c > 0 ? "+" : "−"}${nf1.format(Math.abs(c))} kg from the first to the last week`, ` – ${c > 0 ? "+" : "−"}${nf1.format(Math.abs(c))} kg von der ersten bis zur letzten Woche`);
      out.push(T(`Body weight Ø <b>${nf1.format(a.body.avg)} kg</b>${cTxt}.`, `Körpergewicht Ø <b>${nf1.format(a.body.avg)} kg</b>${cTxt}.`));
    }
    return out;
  }

  /* ---------- Reports list ---------- */
  function viewReports(v, emb) {
    const type = state.repType, list = periodList(type);
    const pills2 = pills("rep-type", type, REP_TYPES.map(([k]) => [k, repTypeName(k)]), T("Period", "Zeitraum"));
    const head = `${emb ? "" : `${backBar()}<h1 class="vtitle">${esc(T("Reports", "Berichte"))}</h1>`}<p class="meta">${esc(T("Created automatically when a month, quarter, half-year or year is over – what you did, in which sports and muscle groups, and how much you improved. Compared with the period before or the same period last year.", "Werden automatisch erstellt, sobald ein Monat, Quartal, Halbjahr oder Jahr vorbei ist – was du geleistet hast, in welchen Sportarten und Muskelgruppen und wie stark du dich gesteigert hast. Im Vergleich zum Vorzeitraum oder zum Vorjahr."))}</p>${pills2}`;
    if (!list.length) return `${head}${emptyBox(T("No reports yet", "Noch keine Berichte"), esc(T("As soon as you log workouts, runs or meals, your first report builds up here.", "Sobald du Trainings, Läufe oder Mahlzeiten einträgst, entsteht hier dein erster Bericht.")))}`;
    // chart: training time per period, oldest → newest
    const ch = list.slice(0, 12).reverse(), vals = ch.map((p) => repStats(p.from, periodEnd(p)).dur);
    const chart = chartBlock("chRep", {
      bars: true, points: vals.map((v) => ({ value: v / 3600 })), ticks: ch.map((p, i) => ({ i, text: type === "m" ? capF(monAb(p.from)) : type === "y" ? String(p.y) : type === "q" ? `Q${p.k}${p.k === 1 ? ` ’${String(p.y).slice(2)}` : ""}` : `${p.k === 1 ? "H1" : "H2"} ’${String(p.y).slice(2)}` })),
      color: "var(--accent)", partialLast: isRunning(ch[ch.length - 1]), minStep: 1, yfmt: (v) => `${nf0.format(v)} h`, aria: T("Training time per period", "Trainingszeit pro Zeitraum")
    }, {
      label: `${T("Training time", "Trainingszeit")} · ${periodName(ch[ch.length - 1])}`, base: { v: repDur(vals[vals.length - 1]), sub: esc(isRunning(ch[ch.length - 1]) ? T("so far – tap the bars", "bisher – Balken antippen") : T("tap the bars", "Balken antippen")) },
      at: (i) => ({ v: repDur(vals[i]), sub: esc(periodName(ch[i])) + (isRunning(ch[i]) ? ` · ${esc(T("in progress", "läuft noch"))}` : "") })
    }, `<span><i style="border-color:var(--accent);border-top-width:6px"></i>${esc(T("Training time", "Trainingszeit"))} ${esc(T("per", "pro"))} ${esc(repTypeName(type))}</span>`);
    const rows = list.map((p) => {
      const run = isRunning(p), r = repStats(p.from, periodEnd(p));
      if (!r.has && !run) return "";
      const pr = periodShift(p, -1), rp = repStats(pr.from, run ? minIso(addDays(pr.from, daysBetween(p.from, todayISO())), pr.to) : pr.to);
      const sub = r.n ? `${pl(r.n, "session")} · ${repDur(r.dur)}${r.prs.length ? ` · ${pl(r.prs.length, "record")}` : ""}${r.run.km ? ` · ${nf1.format(r.run.km)} km` : ""}` : r.food.days ? T(`Nutrition only · ${pl(r.food.days, "day")}`, `Nur Ernährung · ${pl(r.food.days, "day")}`) : r.body.n ? T(`Body weight only · Ø ${nf1.format(r.body.avg)} kg`, `Nur Körpergewicht · Ø ${nf1.format(r.body.avg)} kg`) : T("Nothing logged yet", "Noch nichts eingetragen");
      const tag = run ? `<span class="tag">${esc(T("so far", "läuft"))}</span>` : isNewRep(p) ? `<span class="tag attn">${esc(T("New", "Neu"))}</span>` : "";
      return `<button class="row nobadge" data-action="rep-open" data-arg="${esc(p.id)}"><span class="main"><span class="t1">${esc(periodName(p))}${tag}</span><span class="t2">${esc(sub)}</span></span><span class="val">${r.n || rp.n ? dlt(r.dur, rp.dur) : ""}<small>${esc(T("time", "Zeit"))}</small></span><span class="chev" aria-hidden="true">›</span></button>`;
    }).join("");
    return `${head}${chart}<section class="sec"><div class="sechead"><h2 class="sectitle">${esc({ m: T("All months", "Alle Monate"), q: T("All quarters", "Alle Quartale"), h: T("All half-years", "Alle Halbjahre"), y: T("All years", "Alle Jahre") }[type])}</h2><span class="label">${esc(T("vs. period before", "vs. Vorzeitraum"))}</span></div>${rows}</section>
      <p class="hint">${esc(T("Reports always show your current data – if you edit an old workout, its report updates too.", "Berichte zeigen immer deine aktuellen Daten – änderst du ein altes Training, passt sich auch der Bericht an."))}</p>`;
  }

  /* ---------- One report ---------- */
  function viewReport(v) {
    const p = periodFromId(v.p);
    if (!p) return `${backBar()}${emptyBox(T("Not found", "Nicht gefunden"), "")}`;
    const mode = p.type === "y" ? "prev" : state.repCmp, R = buildReport(p, mode), a = R.cur, b = R.cmp, cs = periodShort(R.c);
    const next = periodShift(p, 1), canNext = next.from <= todayISO(), prev = periodShift(p, -1), canPrev = prev.to >= (firstDataDate() || p.from);
    const nav = `<div class="daynav repnav"><button class="mbtn" data-action="rep-step" data-arg="-1"${canPrev ? "" : " disabled"} aria-label="${esc(T("Earlier", "Früher"))}">‹</button><b>${esc(repKindName(p.type))}</b><button class="mbtn" data-action="rep-step" data-arg="1"${canNext ? "" : " disabled"} aria-label="${esc(T("Later", "Später"))}">›</button></div>`;
    const head = `${backBar()}${nav}<h1 class="vtitle">${esc(periodName(p))}</h1><p class="meta">${esc(`${dayMonth.format(isoDate(p.from))} – ${dateFmt.format(isoDate(p.to))}`)}${R.running ? ` · <b class="pos">${esc(T(`so far, as of today`, `läuft noch – Stand heute`))}</b>` : ""}</p>`;
    const cmpPills = p.type === "y" ? "" : pills("rep-cmp", mode, [["prev", cmpName(p.type, "prev")], ["yoy", cmpName(p.type, "yoy")]], T("Compare with", "Vergleichen mit"));
    if (!a.has) return `${head}${cmpPills}${emptyBox(T("Nothing logged in this period", "In diesem Zeitraum nichts eingetragen"), esc(T("Workouts, runs, meals and body weight from this period show up here.", "Trainings, Läufe, Mahlzeiten und Körpergewicht aus diesem Zeitraum erscheinen hier.")))}`;
    const runNote = R.running ? `<p class="hint">${esc(T(`Compared with ${periodName(R.c)} up to the same day (${dayMonth.format(isoDate(R.cEnd))}).`, `Verglichen mit ${periodName(R.c)} bis zum gleichen Tag (${dayMonth.format(isoDate(R.cEnd))}).`))}</p>` : "";
    const hero = `<section class="hero"><span class="label">${esc(T("Training time", "Trainingszeit"))} · ${esc(T("vs.", "vs."))} ${esc(periodName(R.c))}</span><div class="heroval">${heroHTML(repDur(a.dur))}</div><div class="herosub">${dlt(a.dur, b.dur)} <span>${esc(cs)}: ${esc(b.dur ? repDur(b.dur) : "–")} · ${esc(pl(a.n, "session"))}</span></div></section>`;
    const hl = repHighlights(R);
    const hlCard = hl.length ? `<section class="card hlcard"><span class="label">${esc(T("What you achieved", "Das hast du geleistet"))}</span><ul class="hl">${hl.map((x) => `<li>${x}</li>`).join("")}</ul></section>` : "";
    const lift = a.sets || b.sets, hasRun = a.run.n || b.run.n;
    const kpis = kpiRows([
      [T("Sessions", "Einheiten"), a.n, b.n, n0], [T("Training time", "Trainingszeit"), a.dur, b.dur, repDur], [T("Active days", "Aktive Tage"), a.dayN, b.dayN, n0], [T("Records", "Rekorde"), a.prs.length, b.prs.length, n0],
      [T("Gym volume", "Gym-Volumen"), a.vol, b.vol, tons], [T("Hard sets", "Harte Sätze"), a.sets, b.sets, n0], [T("Reps", "Wiederholungen"), a.reps, b.reps, n0], [T("Hold time", "Haltezeit"), a.hold, b.hold, secTxt],
      [T("Runs", "Läufe"), a.run.n, b.run.n, n0], [T("Running distance", "Laufdistanz"), a.run.km, b.run.km, (x) => `${nf1.format(x)} km`], [T("Avg. pace", "Ø Pace"), paceOf(a), paceOf(b), paceTxt, { lower: true }],
      ["Hyrox", a.hyrox.n, b.hyrox.n, (x) => pl(x, "session")], [T("Football", "Fußball"), a.fb.n, b.fb.n, (x) => pl(x, "session")], [T("Goals + assists", "Tore + Vorlagen"), a.fb.goals + a.fb.assists, b.fb.goals + b.fb.assists, n0],
      [sportName("other"), a.other.n, b.other.n, (x) => pl(x, "session")]
    ], cs);
    // charts
    const ms = Object.keys(REP_METRICS).filter((k) => metricVal(a, k) > 0 || metricVal(R.cmpFull, k) > 0);
    const mk = ms.includes(state.repMetric) ? state.repMetric : ms[0] || "dur", M = REP_METRICS[mk], len = Math.max(periodLen(p), periodLen(R.c));
    const cA = cumVals(a, p.from, periodLen(p), mk, R.end), cB = cumVals(R.cmpFull, R.c.from, periodLen(R.c), mk);
    const ticksL = p.type === "m" ? [0, 7, 14, 21, 28].filter((i) => i < len).map((i) => ({ i, text: `${i + 1}.` })) : Array.from({ length: REP_N[p.type] }, (_, i) => ({ i: daysBetween(p.from, addMonths(p.from, i)), text: capF(monAb(addMonths(p.from, i))) }));
    const curName = periodShort(p);
    const lineChart = ms.length ? cmpBlock("rcLine", {
      a: cA, b: cB, n: len, ticks: ticksL, color: "var(--accent)", yfmt: M.y, minStep: M.step, steps: M.steps, aria: T("Cumulative comparison", "Kumulierter Vergleich"),
      read: (i) => i == null ? `<b>${esc(curName)}: ${esc(M.fmt(cA[cA.length - 1] || 0))}</b><span>${esc(periodShort(R.c))}: ${esc(M.fmt(R.running ? cB[Math.min(cB.length - 1, cA.length - 1)] || 0 : cB[cB.length - 1] || 0))}${R.running ? ` ${esc(T("by the same day", "bis zum gleichen Tag"))}` : ""}</span>`
        : `<b>${esc(T("By", "Bis"))} ${esc(dayMonth.format(isoDate(addDays(p.from, i))))}: ${esc(i < cA.length ? M.fmt(cA[i]) : "–")}</b><span>${esc(periodShort(R.c))}: ${esc(i < cB.length ? M.fmt(cB[i]) : "–")}</span>`
    }, `<span><i style="border-color:var(--accent)"></i>${esc(curName)}</span><span><i class="dash" style="border-color:var(--faint)"></i>${esc(periodShort(R.c))}</span>`) : "";
    const bks = subBuckets(p), sA = subVals(a, p, bks, mk), sB = subVals(R.cmpFull, R.c, bks, mk);
    const partial = R.running ? (p.type === "m" ? Math.floor(daysBetween(p.from, R.end) / 7) : +R.end.slice(5, 7) - 1 - p.m0) : -1;
    const barChart = ms.length ? cmpBlock("rcBars", {
      bars: true, a: sA, b: sB, n: bks.length, partial, ticks: bks.map((x, i) => ({ i, text: x.text })), color: "var(--accent)", yfmt: M.y, minStep: M.step, steps: M.steps, aria: T("Per sub-period", "Pro Abschnitt"),
      read: (i) => i == null ? `<b>${esc(p.type === "m" ? T("Per week of the month", "Pro Monatswoche") : T("Per month", "Pro Monat"))}</b><span>${esc(T("tap a bar", "Balken antippen"))}</span>` : `<b>${esc(bks[i].long)}: ${esc(M.fmt(sA[i]))}</b><span>${esc(periodShort(R.c))}: ${esc(M.fmt(sB[i]))}</span>`
    }, `<span><i style="border-color:var(--accent);border-top-width:6px"></i>${esc(curName)}</span><span><i style="border-color:var(--faint);border-top-width:6px"></i>${esc(periodShort(R.c))}</span>`) : "";
    const chartSec = ms.length ? `<section class="sec"><div class="sechead"><h2 class="sectitle">${esc(T("In comparison", "Im Vergleich"))}</h2><span class="label">${esc(T("cumulative", "kumuliert"))}</span></div>${ms.length > 1 ? pills("rep-metric", mk, ms.map((k) => [k, REP_METRICS[k].name()]), T("Metric", "Kennzahl")) : ""}${lineChart}<div style="height:18px"></div>${barChart}</section>` : "";
    // categories
    const sports = Object.keys(SPORTS).map((k) => ({ name: sportName(k), color: SPORTS[k].color, a: (a.sp[k] || {}).dur || 0, b: (b.sp[k] || {}).dur || 0 })).filter((x) => x.a || x.b).sort((x, y) => y.a - x.a || y.b - x.b);
    const groups = GROUPS.map((g) => ({ name: groupName(g), color: GROUP_COLORS[g], a: a.grp[g] || 0, b: b.grp[g] || 0 })).filter((x) => x.a || x.b).sort((x, y) => y.a - x.a || y.b - x.b);
    const sportSec = sports.length ? `<section class="sec"><div class="sechead"><h2 class="sectitle">${esc(T("Sports", "Sportarten"))}</h2><span class="label">${esc(T("Training time", "Trainingszeit"))}</span></div>${cmpRows(sports, repDur, cs)}</section>` : "";
    const groupSec = groups.length ? `<section class="sec"><div class="sechead"><h2 class="sectitle">${esc(T("Muscle groups", "Muskelgruppen"))}</h2><span class="label">${esc(T("Hard sets", "Harte Sätze"))}</span></div>${cmpRows(groups, n0, cs)}</section>` : "";
    // improvements per exercise (same level for skills)
    const all = [];
    for (const [k, cb] of a.best) { const pb = b.best.get(k); if (pb && pb.v > 0) all.push({ ...cb, pv: pb.v, d: cb.v - pb.v, pct: (cb.v - pb.v) / pb.v }); }
    all.sort((x, y) => y.pct - x.pct);
    const upRow = (u) => { const x = exOf(u.id), pos = u.d > 1e-9, eq = Math.abs(u.d) <= 1e-9; return `<button class="row" data-action="ex" data-arg="${esc(u.id)}">${badgeEx(x)}<span class="main"><span class="t1">${esc(exName(x))}${u.lv != null && hasLv(x) ? ` <span class="tag">${esc(lvName(x, u.lv))}</span>` : ""}</span><span class="t2">${esc(bestFmt(u.kind, u.pv))} → ${esc(bestFmt(u.kind, u.v))} · ${esc(bestLab(u.kind))}</span></span><span class="val"><span class="${eq ? "" : pos ? "pos" : "neg"}">${eq ? "±0" : `${pos ? "+" : "−"}${esc(bestFmt(u.kind, Math.abs(u.d)).replace(/ (Wdh\.|reps?)$/, ""))}`}</span><small>${eq ? "" : `${pos ? "+" : "−"}${nf0.format(Math.abs(u.pct * 100))} %`}</small></span><span class="chev" aria-hidden="true">›</span></button>`; };
    const ups = all.filter((u) => u.d > 1e-9), rest = all.filter((u) => !(u.d > 1e-9));
    const lvRows = a.lvUp.map((u) => { const x = exOf(u.id); return `<button class="row" data-action="ex" data-arg="${esc(u.id)}">${badgeEx(x)}<span class="main"><span class="t1">${esc(exName(x))}</span><span class="t2">${esc(lvName(x, u.from))} → ${esc(lvName(x, u.to))}</span></span><span class="val"><span class="pos">${esc(T("Level", "Stufe"))} ${u.to + 1}</span><small>${ladder(x, u.to)}</small></span><span class="chev" aria-hidden="true">›</span></button>`; }).join("");
    const upSec = ups.length || lvRows || rest.length ? `<section class="sec"><div class="sechead"><h2 class="sectitle">${esc(T("Improvements", "Steigerungen"))}</h2><span class="label">${esc(T("best value vs.", "Bestwert vs."))} ${esc(cs)}</span></div>
      ${lvRows}${ups.slice(0, 8).map(upRow).join("") || (lvRows ? "" : `<p class="hint" style="padding:6px 0">${esc(T("No exercise beat its best value from the comparison period this time.", "Diesmal hat keine Übung ihren Bestwert aus dem Vergleichszeitraum übertroffen."))}</p>`)}
      ${all.length > Math.min(8, ups.length) ? `<details class="more allex"><summary>${esc(T(`All exercises in comparison (${all.length})`, `Alle Übungen im Vergleich (${all.length})`))}</summary>${ups.slice(8).concat(rest).map(upRow).join("")}</details>` : ""}</section>` : "";
    const prs = a.prs.slice().sort((x, y) => y.date.localeCompare(x.date));
    const prSec = prs.length ? `<section class="sec"><div class="sechead"><h2 class="sectitle">${esc(T("New records", "Neue Rekorde"))}</h2><span class="label">${esc(pl(prs.length, "record"))}</span></div>${prs.slice(0, 6).map((q) => { const x = exOf(q.ex), m = METRIC[q.type]; return `<button class="row" data-action="session" data-arg="${esc(q.sid)}">${badgeEx(x)}<span class="main"><span class="t1">${esc(exName(x))}${hasLv(x) && q.lv != null ? ` <span class="tag">${esc(lvName(x, q.lv))}</span>` : ""}</span><span class="t2">${esc(metricLabel(q.type, q.kind))} · ${esc(dayTxt(q.date))}</span></span><span class="val">${esc(m.fmt(q.value))}<small class="pos">+${esc(m.fmt(q.value - q.prev))}</small></span><span class="chev" aria-hidden="true">›</span></button>`; }).join("")}
      ${prs.length > 6 ? `<details class="more allex"><summary>${esc(T(`Show all ${prs.length}`, `Alle ${prs.length} anzeigen`))}</summary>${prs.slice(6).map((q) => { const x = exOf(q.ex), m = METRIC[q.type]; return `<div class="kpirow"><span class="k">${esc(exName(x))} · ${esc(metricLabel(q.type, q.kind))}</span><span class="v"><b>${esc(m.fmt(q.value))}</b><small>${esc(dayTxt(q.date))}</small></span><span class="dl up">+${esc(m.fmt(q.value - q.prev))}</span></div>`; }).join("")}</details>` : ""}</section>` : "";
    const runBest = hasRun && (a.run.longest || a.run.fastest || a.hyrox.best) ? `<section class="card"><span class="label">${esc(T("Best in this period", "Bestwerte im Zeitraum"))}</span><div class="prlist">${a.run.longest ? recLine(T("Longest run", "Längster Lauf"), `${nf.format(a.run.longest.dist)} km`, a.run.longest.date) : ""}${a.run.fastest ? recLine(T("Fastest pace (3 km+)", "Schnellste Pace (ab 3 km)"), paceTxt(a.run.fastest.dur / a.run.fastest.dist), a.run.fastest.date) : ""}${a.hyrox.best ? recLine(`Hyrox (${typeName(a.hyrox.best.kind)})`, clock(a.hyrox.best.dur), a.hyrox.best.date) : ""}</div></section>` : "";
    const fA = a.food, fB = b.food;
    const foodSec = fA.days || fB.days ? `<section class="sec"><div class="sechead"><h2 class="sectitle">${esc(T("Nutrition", "Ernährung"))}</h2><span class="label">${esc(T("per logged day", "pro erfasstem Tag"))}</span></div>${kpiRows([
      [T("Days logged", "Erfasste Tage"), fA.days, fB.days, n0], [T("Ø calories", "Ø Kalorien"), fA.kcal, fB.kcal, (x) => `${n0(x)} kcal`, { neutral: true }], [T("Ø protein", "Ø Eiweiß"), fA.p, fB.p, (x) => `${n0(x)} g`],
      [T("Ø fat", "Ø Fett"), fA.f, fB.f, (x) => `${n0(x)} g`, { neutral: true }], [T("Ø carbs", "Ø Kohlenhydrate"), fA.c, fB.c, (x) => `${n0(x)} g`, { neutral: true }],
      [T("Protein goal reached", "Eiweißziel erreicht"), fA.pGoal, fB.pGoal, (x) => pl(x, "day")], [T("Calorie goal ±10 %", "Kalorienziel ±10 %"), fA.kGoal, fB.kGoal, (x) => pl(x, "day")]
    ], cs)}</section>` : "";
    const wA = a.body, wB = b.body, chFmt = (x) => `${Math.abs(x) < 0.05 ? "±" : x > 0 ? "+" : "−"}${nf1.format(Math.abs(x))} kg`;
    const bodySec = wA.n || wB.n ? `<section class="sec"><div class="sechead"><h2 class="sectitle">${esc(T("Body weight", "Körpergewicht"))}</h2><span class="label">${esc(T("vs.", "vs."))} ${esc(cs)}</span></div>${kpiRows([
      [T("Ø body weight", "Ø Körpergewicht"), wA.avg, wB.avg, kg1, { neutral: true }], [T("Weigh-ins", "Messungen"), wA.n, wB.n, n0, { neutral: true }]
    ], cs)}${wA.ch != null ? `<div class="kpirow"><span class="k">${esc(T("First → last week", "Erste → letzte Woche"))}</span><span class="v"><b>${esc(chFmt(wA.ch))}</b><small>${esc(cs)}: ${esc(wB.ch != null ? chFmt(wB.ch) : "–")}</small></span><span class="dl"></span></div>` : ""}</section>` : "";
    return `
      ${head}
      ${cmpPills}
      ${hero}
      ${runNote}
      ${hlCard}
      ${a.n || b.n ? `<section class="sec"><div class="sechead"><h2 class="sectitle">${esc(T("Overview", "Überblick"))}</h2><span class="label">${esc(T("vs.", "vs."))} ${esc(cs)}</span></div>${kpis}</section>` : ""}
      ${chartSec}
      ${sportSec}
      ${groupSec}
      ${upSec}
      ${prSec}
      ${runBest}
      ${foodSec}
      ${bodySec}
      <p class="hint">${esc(T("Records count new all-time bests. Improvements compare each exercise's best value (e1RM, best set or longest hold – same level for skills) with the comparison period.", "Rekorde zählen neue Bestwerte aller Zeiten. Steigerungen vergleichen den Bestwert jeder Übung (e1RM, bester Satz oder längste Haltezeit – bei Skills auf derselben Stufe) mit dem Vergleichszeitraum."))}</p>`;
  }

  /* ================= Body weight: daily entries, 7-day average, protein goal from g per kg ================= */
  const kg1 = (v) => `${nf1.format(v)} kg`;
  const wSorted = () => db.weights;
  function wAvgAt(date, days) {
    const from = addDays(date, -((days || 7) - 1)); let s = 0, n = 0;
    for (const w of db.weights) { if (w.date < from) continue; if (w.date > date) break; s += w.kg; n++; }
    return n ? s / n : null;
  }
  /* current weight: 7-day average if there are entries in the last 7 days, otherwise the last entry */
  function curWeight() {
    const L = db.weights; if (!L.length) return null;
    return wAvgAt(todayISO(), 7) || L[L.length - 1].kg;
  }
  const lastWeight = () => (db.weights.length ? db.weights[db.weights.length - 1] : null);
  const weightOn = (d) => db.weights.find((w) => w.date === d) || null;
  function proteinGoal() {
    const g = db.settings.goals, w = curWeight();
    if (g.pMode === "auto" && w) return Math.round((+g.pPerKg || 1.8) * w);
    return +g.p || 0;
  }
  const goalsNow = () => ({ kcal: +db.settings.goals.kcal || 0, p: proteinGoal() });
  function saveWeight(date, kgv) {
    const v = Math.round(kgv * 10) / 10;
    db.weights = db.weights.filter((w) => w.date !== date).concat({ date, kg: v }).sort((a, b) => a.date.localeCompare(b.date));
    persist();
  }
  /* rough maintenance estimate from 4 weeks of eating + the weight trend (7 700 kcal ≈ 1 kg) */
  function energyEstimate() {
    const end = todayISO(), start = addDays(end, -27), a = wAvgAt(addDays(start, 6), 7), b = wAvgAt(end, 7);
    const ws = db.weights.filter((w) => w.date >= start), early = ws.filter((w) => w.date <= addDays(start, 6)).length, late = ws.filter((w) => w.date > addDays(end, -7)).length;
    const days = new Map(); for (const m of db.meals) if (m.date >= start && m.date <= end) days.set(m.date, (days.get(m.date) || 0) + sumMacros(m.items).kcal);
    if (a == null || b == null || early < 2 || late < 2 || days.size < 14) return null;
    const kcal = [...days.values()].reduce((x, y) => x + y, 0) / days.size, perWeek = ((b - a) / 21) * 7;
    return { kcal, perWeek, tdee: kcal - (perWeek * 7700) / 7, days: days.size };
  }

  /* ---------- weight chart: daily entries as dots, 7-day average as line ---------- */
  function drawBody(host, cfg) {
    const W = Math.max(260, Math.round(host.clientWidth || 320)), Hh = 210, L = 46, R = 12, Tp = 14, B = 26, pw = W - L - R, ph = Hh - Tp - B, f = (v) => v.toFixed(1);
    const vals = cfg.pts.map((p) => p.kg).concat(cfg.avg.filter((p) => p.v != null).map((p) => p.v));
    let lo = Math.min(...vals), hi = Math.max(...vals); if (hi - lo < 2) { const m = (hi + lo) / 2; lo = m - 1; hi = m + 1; }
    const step = niceStep(hi - lo, 0.5), y0 = Math.floor((lo - step * 0.3) / step) * step, y1 = Math.ceil((hi + step * 0.3) / step) * step;
    const X = (i) => L + (cfg.n <= 1 ? 0.5 : i / (cfg.n - 1)) * pw, Y = (v) => Tp + ph - ((v - y0) / (y1 - y0)) * ph;
    let s = "";
    for (let v = y0, g = 0; v <= y1 + step / 2 && g < 12; v += step, g++) s += `<line class="grid" x1="${L}" x2="${W - R}" y1="${f(Y(v))}" y2="${f(Y(v))}"/><text class="ylab" x="${L - 8}" y="${f(Y(v) + 4)}" text-anchor="end">${esc(nf1.format(v))}</text>`;
    let lastX = -1e9;
    for (const t of cfg.ticks) { const x = X(t.i); if (x - lastX < 40) continue; lastX = x; s += `<text class="xlab" x="${f(x)}" y="${Hh - 6}" text-anchor="${t.i === 0 ? "start" : "middle"}">${esc(t.text)}</text>`; }
    for (const p of cfg.pts) s += `<circle class="wdot" cx="${f(X(p.i))}" cy="${f(Y(p.kg))}" r="3.2"/>`;
    const seg = []; let cur = [];
    cfg.avg.forEach((p) => { if (p.v == null) { if (cur.length) seg.push(cur); cur = []; } else cur.push(p); }); if (cur.length) seg.push(cur);
    for (const sg of seg) if (sg.length > 1) s += `<path class="line" d="${sg.map((p, k) => `${k ? "L" : "M"}${f(X(p.i))},${f(Y(p.v))}`).join("")}" style="stroke:var(--accent)"/>`;
    const lastA = [...cfg.avg].reverse().find((p) => p.v != null); if (lastA) s += `<circle class="ring" cx="${f(X(lastA.i))}" cy="${f(Y(lastA.v))}" r="5" style="fill:var(--accent)"/>`;
    s += `<g class="cur" visibility="hidden"><line class="cursor" x1="0" x2="0" y1="${Tp}" y2="${Tp + ph}"/></g>`;
    host.innerHTML = `<svg viewBox="0 0 ${W} ${Hh}" style="height:${Hh}px" role="img" aria-label="${esc(T("Body weight", "Körpergewicht"))}">${s}</svg>`;
    const svg = host.firstElementChild, cr = svg.querySelector(".cur"), out = $(host.id + "R");
    const hide = () => { cr.setAttribute("visibility", "hidden"); if (out) out.innerHTML = cfg.read(null); };
    const at = (ev) => { const r = svg.getBoundingClientRect(), x = (ev.clientX - r.left) * (W / r.width), i = clamp(Math.round(((x - L) / pw) * (cfg.n - 1)), 0, cfg.n - 1); cr.firstElementChild.setAttribute("x1", f(X(i))); cr.firstElementChild.setAttribute("x2", f(X(i))); cr.setAttribute("visibility", "visible"); if (out) out.innerHTML = cfg.read(i); };
    svg.addEventListener("pointerdown", at); svg.addEventListener("pointermove", at); svg.addEventListener("pointerleave", hide); svg.addEventListener("pointercancel", hide);
    svg.addEventListener("pointerup", (e) => { if (e.pointerType !== "mouse") hide(); });
  }

  /* ---------- Körper (inside Progress) ---------- */
  function viewBody(v, emb) {
    const head = emb ? "" : `${backBar()}<h1 class="vtitle">${esc(T("Body weight", "Körpergewicht"))}</h1>`;
    const L = db.weights, today = todayISO(), g = db.settings.goals;
    const addBtn = `<button class="addbig sm" data-action="w-new"><span aria-hidden="true">+</span>${esc(weightOn(today) ? T("Change today's weight", "Heutiges Gewicht ändern") : T("Log weight", "Gewicht eintragen"))}</button>`;
    if (!L.length) return `${head}${addBtn}${emptyBox(T("No weight logged yet", "Noch kein Gewicht eingetragen"), esc(T("Weigh yourself in the morning, ideally after the toilet and before breakfast – a few times a week is enough. PFT shows the curve and the weekly average, and can set your protein goal from it.", "Am besten morgens nach dem Toilettengang und vor dem Frühstück wiegen – ein paar Mal pro Woche reicht. PFT zeigt die Kurve und den Wochenschnitt und kann daraus dein Eiweißziel berechnen.")))}`;
    const rg = state.wRange || "90d", days = { "30d": 30, "90d": 90, "1y": 365, all: Math.max(30, daysBetween(L[0].date, today) + 1) }[rg] || 90;
    const from = addDays(today, -(days - 1)), n = days;
    const pts = L.filter((w) => w.date >= from).map((w) => ({ i: daysBetween(from, w.date), kg: w.kg, date: w.date }));
    const avg = Array.from({ length: n }, (_, i) => { const d = addDays(from, i); return { i, v: L.some((w) => w.date <= d && w.date > addDays(d, -7)) ? wAvgAt(d, 7) : null }; });
    const ticks = rg === "30d" ? [0, 7, 14, 21, 28].map((i) => ({ i, text: dayMonth.format(isoDate(addDays(from, i))) })) : monthTicks(from, today).map((t) => ({ i: Math.round(t.x * (n - 1)), text: t.text }));
    const cw = curWeight(), a28 = wAvgAt(addDays(today, -28), 7), first = L[0];
    const d28 = cw != null && a28 != null ? cw - a28 : null, dAll = cw != null ? cw - first.kg : null;
    const sign = (x) => (x > 0.05 ? "+" : x < -0.05 ? "−" : "±");
    const chart = pts.length ? cmpBlock("bwChart", {
      kind: "body", pts, avg, n, ticks,
      read: (i) => { if (i == null) return `<b>Ø 7 ${esc(T("days", "Tage"))}: ${esc(kg1(cw))}</b><span>${esc(T("tap the chart", "Grafik antippen"))}</span>`; const d = addDays(from, i), e = weightOn(d), a = avg[i].v; return `<b>${esc(dayMonth.format(isoDate(d)))}: ${esc(e ? kg1(e.kg) : "–")}</b><span>Ø 7 ${esc(T("days", "Tage"))}: ${esc(a != null ? kg1(a) : "–")}</span>`; }
    }, `<span><i style="border-color:var(--accent)"></i>${esc(T("7-day average", "Ø 7 Tage"))}</span><span><i class="dotkey"></i>${esc(T("Entries", "Einträge"))}</span>`) : `<div class="chart-empty">${esc(T("No entries in this period.", "Keine Einträge in diesem Zeitraum."))}</div>`;
    // weekly averages with the calories of the same week – this is where the kcal numbers get a reference
    const weeks = [];
    for (let k = 0; k < 10; k++) {
      const ws = addDays(weekStart(today), -7 * k), we = addDays(ws, 6), wl = L.filter((w) => w.date >= ws && w.date <= we);
      if (!wl.length) continue;
      const md = new Map(); for (const m of db.meals) if (m.date >= ws && m.date <= we) md.set(m.date, (md.get(m.date) || 0) + sumMacros(m.items).kcal);
      weeks.push({ ws, avg: wl.reduce((x, w) => x + w.kg, 0) / wl.length, n: wl.length, kcal: md.size ? [...md.values()].reduce((x, y) => x + y, 0) / md.size : null });
    }
    const wkRows = weeks.map((w, k) => { const prev = weeks[k + 1], d = prev && daysBetween(prev.ws, w.ws) === 7 ? w.avg - prev.avg : null; return `<div class="kpirow"><span class="k">${esc(wkLabel(w.ws))}<small class="hint" style="display:block;font-weight:400">${esc(pl(w.n, "entry"))}${w.kcal ? ` · Ø ${nf0.format(w.kcal)} kcal` : ""}</small></span><span class="v"><b>${esc(kg1(w.avg))}</b></span>${d == null ? `<span class="dl">–</span>` : `<span class="dl">${sign(d)}${nf1.format(Math.abs(d))} kg</span>`}</div>`; }).join("");
    const est = energyEstimate();
    const estCard = est ? `<section class="card"><span class="label">${esc(T("Your calories in context", "Deine Kalorien im Bezug"))}</span><p style="color:var(--ink)">${T(`Last 4 weeks: Ø <b>${nf0.format(est.kcal)} kcal</b> a day eaten, weight <b>${sign(est.perWeek)}${nf1.format(Math.abs(est.perWeek))} kg</b> per week. Estimated maintenance: <b>~${nf0.format(Math.round(est.tdee / 50) * 50)} kcal</b> a day.`, `Letzte 4 Wochen: Ø <b>${nf0.format(est.kcal)} kcal</b> pro Tag gegessen, Gewicht <b>${sign(est.perWeek)}${nf1.format(Math.abs(est.perWeek))} kg</b> pro Woche. Geschätzter Erhaltungsbedarf: <b>~${nf0.format(Math.round(est.tdee / 50) * 50)} kcal</b> pro Tag.`)}</p><p>${esc(T("A rough estimate from what you logged (7,700 kcal ≈ 1 kg). The more days with meals and weight, the better it gets.", "Grobe Schätzung aus deinen Einträgen (7.700 kcal ≈ 1 kg). Je mehr Tage mit Essen und Gewicht, desto genauer."))}</p></section>`
      : `<section class="card"><span class="label">${esc(T("Your calories in context", "Deine Kalorien im Bezug"))}</span><p>${esc(T("Log your weight a few times a week and your meals on at least 14 of 28 days – then PFT estimates how many calories you need to keep your weight.", "Trag dein Gewicht ein paar Mal pro Woche und deine Mahlzeiten an mindestens 14 von 28 Tagen ein – dann schätzt PFT, wie viele Kalorien du brauchst, um dein Gewicht zu halten."))}</p></section>`;
    const auto = g.pMode === "auto", f = +g.pPerKg || 1.8;
    const protCard = `<section class="card"><span class="label">${esc(T("Protein goal", "Eiweißziel"))}</span>
      <div class="seg" role="group" aria-label="${esc(T("Protein goal", "Eiweißziel"))}"><button data-action="p-mode" data-arg="auto" aria-pressed="${auto}">${esc(T("From body weight", "Aus Körpergewicht"))}</button><button data-action="p-mode" data-arg="fixed" aria-pressed="${!auto}">${esc(T("Fixed", "Fester Wert"))}</button></div>
      ${auto ? `<div class="pills" role="group" aria-label="${esc(T("Grams per kg", "Gramm pro kg"))}">${[1.6, 1.8, 2, 2.2].map((x) => `<button data-action="p-perkg" data-arg="${x}" aria-pressed="${Math.abs(x - f) < 0.01}">${nf1.format(x)} g/kg</button>`).join("")}</div>
        <p style="color:var(--ink)">${T(`Goal: <b>${proteinGoal()} g protein</b> a day (${nf1.format(f)} g × ${nf1.format(cw)} kg).`, `Ziel: <b>${proteinGoal()} g Eiweiß</b> pro Tag (${nf1.format(f)} g × ${nf1.format(cw)} kg).`)}</p><p>${esc(T("1.6–2.2 g per kg is a common range for building muscle. The goal follows your weight automatically.", "1,6–2,2 g pro kg ist ein gängiger Bereich für Muskelaufbau. Das Ziel passt sich deinem Gewicht automatisch an."))}</p>`
        : `<p>${esc(g.p ? T(`Fixed at ${g.p} g – change it under More.`, `Fest auf ${g.p} g – ändern unter „Mehr“.`) : T("No protein goal set. Choose “From body weight” to get one.", "Kein Eiweißziel gesetzt. Wähle „Aus Körpergewicht“, um eins zu bekommen."))}</p>`}</section>`;
    const list = L.slice().reverse().slice(0, state.wAll ? 400 : 8).map((w) => `<button class="row nobadge" data-action="w-edit" data-arg="${w.date}"><span class="main"><span class="t1">${esc(kg1(w.kg))}</span><span class="t2">${esc(dayTxt(w.date))}</span></span><span class="val"></span><span class="chev" aria-hidden="true">›</span></button>`).join("");
    return `
      ${head}
      <section class="hero"><span class="label">${esc(T("Body weight · 7-day average", "Körpergewicht · Ø 7 Tage"))}</span><div class="heroval">${heroHTML(kg1(cw))}</div>
        <div class="herosub">${d28 != null ? `<span class="dl">${sign(d28)}${nf1.format(Math.abs(d28))} kg</span> ${esc(T("in 4 weeks", "in 4 Wochen"))} · ` : ""}${esc(T("last entry", "letzter Eintrag"))} ${esc(rel(lastWeight().date))}: ${esc(kg1(lastWeight().kg))}</div></section>
      ${addBtn}
      <div class="ctlrow">${rangePills("w-range", rg, ["30d", "90d", "1y", "all"])}</div>
      ${chart}
      ${st3([T("Ø 7 days", "Ø 7 Tage"), kg1(cw)], [T("4 weeks", "4 Wochen"), d28 != null ? `${sign(d28)}${nf1.format(Math.abs(d28))} kg` : "–"], [T("Since start", "Seit Beginn"), dAll != null ? `${sign(dAll)}${nf1.format(Math.abs(dAll))} kg` : "–"])}
      ${protCard}
      ${estCard}
      ${wkRows ? `<section class="sec"><div class="sechead"><h2 class="sectitle">${esc(T("Weekly average", "Wochenschnitt"))}</h2><span class="label">${esc(T("vs. week before", "vs. Vorwoche"))}</span></div>${wkRows}</section>` : ""}
      <section class="sec"><div class="sechead"><h2 class="sectitle">${esc(T("Entries", "Einträge"))}</h2><span class="label">${esc(pl(L.length, "entry"))}</span></div>${list}${L.length > 8 && !state.wAll ? `<button class="more" data-action="w-all">${esc(T(`Show all ${L.length}`, `Alle ${L.length} anzeigen`))}</button>` : ""}</section>
      <p class="hint">${esc(T("Daily weight jumps by 1–2 kg through water and food. Watch the 7-day average and the weekly trend, not single days.", "Das Tagesgewicht schwankt durch Wasser und Essen um 1–2 kg. Achte auf den 7-Tage-Schnitt und den Wochentrend, nicht auf einzelne Tage."))}</p>`;
  }

  /* ---------- weight entry sheet ---------- */
  let wEditing = null;
  function openWeight(date) {
    const d = date || todayISO(), e = weightOn(d), last = lastWeight();
    wEditing = e ? d : null;
    $("wTitle").textContent = e ? T("Edit weight", "Gewicht ändern") : T("Log weight", "Gewicht eintragen");
    $("wDate").value = d; $("wDate").max = todayISO();
    $("wKg").value = e ? fmtIn(e.kg) : last ? fmtIn(last.kg) : "";
    $("wErr").textContent = "";
    const del = $("wDelete"); del.hidden = !e; del.classList.remove("armed"); del.textContent = T("Delete", "Löschen");
    showSheet("wSheet");
    setTimeout(() => { const k = $("wKg"); k.focus(); try { k.select(); } catch { /* ignore */ } }, 80);
  }
