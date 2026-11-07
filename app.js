/* PFT 1.4.1 – Taps, sheets, gestures, timers, barcode scanner and app start. */
"use strict";
  const VIEWS = { hub: viewHub, train: viewTrain, prog: viewProg, body: viewBody, live: viewLive, session: viewSession, history: viewHistory, progress: viewProgress, exercise: viewExercise, workouts: viewTrain, tpl: viewTpl, sport: viewSport, settings: viewSettings, exlist: viewExlist, cali: viewCali, food: viewFood, meal: viewMeal, foods: viewFoods, mymeals: viewMyMeals, reports: viewReports, report: viewReport };
  const FAB = {
    exlist: [() => T("Exercise", "Übung"), () => openEx(null)], sport: [() => T("Log", "Eintragen"), () => openAct(null, state.stack[state.stack.length - 1].p)],
    foods: [() => T("Food", "Lebensmittel"), () => openFood(null)]
  };
  function render() {
    const top = state.stack[state.stack.length - 1], root = $("view");
    const focusId = document.activeElement && document.activeElement.id;
    const caret = focusId && document.activeElement.selectionStart != null ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null;
    const chipRow = root.querySelector(".chiprow"), keepScroll = chipRow ? chipRow.scrollLeft : 0;
    charts = []; cmpCharts = [];
    root.innerHTML = (VIEWS[top.v] || viewHub)(top);
    root.classList.toggle("hub", top.v === "hub");
    document.body.classList.toggle("hubmode", top.v === "hub");
    // tab bar: hidden while you're in a workout or a meal (focus + no accidental leaving)
    const noTabs = top.v === "live" || top.v === "meal";
    document.body.classList.toggle("notabs", noTabs);
    $("tabbar").hidden = noTabs;
    document.querySelectorAll("#tabbar [data-tab]").forEach((b) => { const on = b.dataset.tab === state.tab; b.setAttribute("aria-current", on ? "page" : "false"); b.classList.toggle("on", on); });
    const nb = $("tabbar").querySelector('[data-tab="prog"] .ndot'); if (nb) nb.hidden = !newReports("repNoted").length;
    root.classList.remove("enter");
    if (state.enter) { void root.offsetWidth; root.classList.add("enter"); state.enter = false; }
    const newRow = root.querySelector(".chiprow"); if (newRow) newRow.scrollLeft = keepScroll;
    if (focusId && root.contains($(focusId))) { const el = $(focusId); el.focus({ preventScroll: true }); if (caret && el.setSelectionRange) try { el.setSelectionRange(caret[0], caret[1]); } catch { /* not a text field */ } }
    charts.forEach((c) => drawChart($(c.id), { ...c.cfg, onScrub: (i) => scrubTo(c, i, $(c.id + "Val"), $(c.id + "Sub")) }));
    cmpCharts.forEach((c) => drawCmp($(c.id), c.cfg));
    if (state.full) renderFull();
    const fab = FAB[top.v], fabTxt = fab && fab[0]();
    $("fab").hidden = !fabTxt || !!rest;
    if (fabTxt) $("fabText").textContent = fabTxt;
    if (top.v === "hub" && pendingStart) { pendingStart = false; openStart(); }
  }
  let resizeTimer;
  window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { charts.forEach((c) => drawChart($(c.id), { ...c.cfg, onScrub: (i) => scrubTo(c, i, $(c.id + "Val"), $(c.id + "Sub")) })); cmpCharts.forEach((c) => drawCmp($(c.id), c.cfg)); if (state.full) drawFull(); }, 120); });
  function setLang(l) {
    LANG = l; try { localStorage.setItem(LANG_KEY, l); } catch { /* ignore */ }
    setLocale(); applyStatic(); buildEx(); buildFoodIndex(); ver++; render(); placeSplash(true);
  }

  /* ================= Navigation ================= */
  function go(v, p, extra) {
    const cur = state.stack[state.stack.length - 1];
    cur.scroll = window.scrollY; cur.snap = $("view").innerHTML; cur.snapCls = $("view").className.replace(/\benter\b/, "").trim();
    state.stack.push({ v, p, ...(extra || {}) }); state.enter = true; state.armed = null; state.histN = 60; state.exAll = false;
    render(); window.scrollTo(0, 0);
  }
  /* unsaved changes? editing an old workout or a meal asks before throwing them away */
  const draftSig = (d) => JSON.stringify([d.name, d.date, d.time, d.dur, d.note, d.ex.map((e) => [e.id, e.lv, e.rest, e.ss, e.sets.map((s) => [s.w, s.r, s.t, !!s.wu, !!s.drop, !!s.done])])]);
  function leaveNeedsConfirm() {
    const top = state.stack[state.stack.length - 1];
    if (top.v === "live" && draft && draft.editOf) return draftSig(draft) !== draft.sig;
    if (top.v === "meal" && mealDraft) return mealChanged();
    return false;
  }
  function askLeave() {
    const top = state.stack[state.stack.length - 1], meal = top.v === "meal";
    $("leaveTitle").textContent = meal ? T("Discard this meal?", "Mahlzeit verwerfen?") : T("Discard your changes?", "Änderungen verwerfen?");
    $("leaveText").textContent = meal ? T("You haven't saved it yet.", "Du hast sie noch nicht gespeichert.") : T("You changed this workout but haven't saved it.", "Du hast dieses Training geändert, aber noch nicht gespeichert.");
    $("leaveSave").textContent = meal ? T("Save meal", "Mahlzeit speichern") : T("Save changes", "Änderungen speichern");
    showSheet("leaveSheet");
  }
  function goBack(force) {
    if (state.stack.length < 2) return true;
    if (!force && leaveNeedsConfirm()) { askLeave(); return false; }
    const top = state.stack.pop();
    if (top.v === "live" && draft && draft.editOf) draft = null;
    if (top.v === "tpl") { const t = tplById(top.p); if (t && !t.items.length && !t.name.trim()) { db.templates = db.templates.filter((x) => x !== t); persist(); } else { clearTimeout(tplTimer); persist(); } }
    if (top.v === "live") saveDraft();
    if (top.v === "meal") mealDraft = null;
    state.armed = null; state.histN = 60;
    const nt = state.stack[state.stack.length - 1]; delete nt.fresh;
    render(); window.scrollTo(0, nt.scroll || 0);
    return true;
  }
  /* ---------- tabs: each tab keeps its own stack of screens ---------- */
  function selectTab(t, reset) {
    if (!state.stacks[t]) return;
    const cur = state.stack[state.stack.length - 1]; cur.scroll = window.scrollY;
    if (t === state.tab && !reset) { if (state.stack.length > 1) { state.stack.length = 1; state.armed = null; render(); } window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    if (reset) state.stacks[t] = [{ v: TAB_ROOT[t] }];
    state.tab = t; state.stack = state.stacks[t]; state.armed = null;
    render(); window.scrollTo(0, reset ? 0 : state.stack[state.stack.length - 1].scroll || 0);
  }
  /* open a tab fresh and push screens on top: openIn("prog", "report", id) */
  function openIn(t, v, p, extra) {
    state.stacks[t] = [{ v: TAB_ROOT[t] }]; state.tab = t; state.stack = state.stacks[t];
    if (v) { state.stack.push({ v, p, ...(extra || {}) }); state.enter = true; }
    state.armed = null; render(); window.scrollTo(0, 0);
  }
  const home = () => { state.stacks.train = [{ v: "train" }]; state.tab = "train"; state.stack = state.stacks.train; };
  function navTo(v) {
    const t = TAB_OF[v];
    if (!t) { go(v); return; }
    if (PROG_SEG[v]) state.progSeg = PROG_SEG[v];
    if (v === "body" && state.tab !== "prog") { state.progSeg = "body"; }
    openIn(t);
  }
  function openLive() {
    if (state.stack[state.stack.length - 1].v === "live") return;
    state.tab = "train"; state.stack = state.stacks.train;
    if (state.stack[state.stack.length - 1].v !== "live") { const cur = state.stack[state.stack.length - 1]; cur.scroll = window.scrollY; state.stack.push({ v: "live" }); state.enter = true; }
    render(); window.scrollTo(0, 0);
  }

  /* ================= Actions ================= */
  function startWorkout(tplId, fromSessionId, sport) {
    if (draft && !draft.editOf) { toast(T("A workout is already running", "Es läuft schon ein Training")); closeSheets(); openLive(); return; }
    const t = tplId && tplById(tplId), s = fromSessionId && sessionById(fromSessionId);
    const sp = sport || (t ? (t.items.length && t.items.every((it) => exOf(it.ex).cali) ? "cali" : "gym") : s ? s.sport : "gym");
    draft = { id: newId(), sport: sp, name: "", tpl: null, date: todayISO(), time: nowTime(), start: Date.now(), dur: "", note: "", ex: [] };
    const extra = (o) => ({ ...(o.lv != null ? { lv: o.lv } : {}), ...(o.rest != null ? { rest: o.rest } : {}), ...(o.ss ? { ss: o.ss } : {}) });
    if (t) { draft.name = t.name; draft.tpl = t.id; draft.ex = t.items.map((it) => ({ id: it.ex, tr: it.reps || "", ...extra(it), sets: Array.from({ length: Math.max(1, it.sets || 3) }, () => blankSet()) })); }
    else if (s) { draft.name = s.name; draft.tpl = s.tpl || null; draft.ex = s.ex.map((e) => ({ id: e.id, tr: e.tr || "", ...extra(e), sets: e.sets.filter((q) => !q.drop).map((q) => blankSet(q.wu)) })); }
    saveDraft(); closeSheets(); home(); state.stack.push({ v: "live" }); state.enter = true; render(); window.scrollTo(0, 0);
    if (!draft.ex.length) setTimeout(() => openPick("draft"), 260);
  }
  function editSession(id) {
    if (draft && !draft.editOf) { toast(T("Finish the running workout first", "Beende zuerst das laufende Training")); return; }
    const s = sessionById(id); if (!s) return;
    draft = {
      id: s.id, editOf: s.id, sport: s.sport, name: s.name || "", tpl: s.tpl || null, date: s.date, time: s.time || "", start: 0, dur: String(Math.round((s.dur || 0) / 60)), note: s.note || "",
      ex: s.ex.map((e) => ({ id: e.id, tr: e.tr || "", ...(e.lv != null ? { lv: e.lv } : {}), ...(e.rest != null ? { rest: e.rest } : {}), ...(e.ss ? { ss: e.ss } : {}), sets: e.sets.map((q) => ({ w: fmtIn(q.w), r: fmtIn(q.r), t: fmtIn(q.t), done: true, wu: !!q.wu, ...(q.drop ? { drop: true } : {}) })) }))
    };
    draft.sig = draftSig(draft);
    go("live");
  }
  function cleanSet(s, kind) {
    if (!s.done && (kind === "time" ? s.t === "" : s.r === "" || (kind === "kg" && s.w === ""))) return null;
    const flags = { ...(s.wu ? { wu: 1 } : {}), ...(s.drop ? { drop: 1 } : {}) };
    if (kind === "time") { const t = parseNum(s.t); return t > 0 ? { t: Math.round(t), ...flags } : null; }
    const r = parseNum(s.r); if (!(r > 0)) return null;
    const w = Math.max(0, parseNum(s.w) || 0);
    return { w: Math.round(w * 100) / 100, r: Math.round(r), ...flags };
  }
  function finishDraft() {
    const d = draft; if (!d) return;
    const ex = [];
    for (const e of d.ex) { const x = exOf(e.id), sets = e.sets.map((s) => cleanSet(s, x.kind)).filter(Boolean); if (sets.length) ex.push({ id: e.id, sets, ...(e.tr ? { tr: e.tr } : {}), ...(hasLv(x) ? { lv: lvKey(x, e.lv) } : {}), ...(e.rest != null ? { rest: e.rest } : {}), ...(e.ss ? { ss: e.ss } : {}) }); }
    fixSS(ex);
    if (!ex.length) { toast(T("No sets entered yet", "Noch keine Sätze eingetragen")); return; }
    const manual = parseNum(d.dur), orig = d.editOf ? sessionById(d.editOf) : null;
    const end = d.last ? Math.min(Date.now(), d.last + 10 * 60e3) : Date.now();
    const dur = manual > 0 ? Math.round(manual * 60) : orig ? orig.dur : Math.max(60, Math.min(5 * 3600, Math.round((end - d.start) / 1000)));
    const s = { id: d.editOf || d.id, sport: d.sport || "gym", date: d.date || todayISO(), time: d.time || "", dur, name: (d.name || "").trim() || autoName(ex, d.sport), tpl: d.tpl || null, ex, note: (d.note || "").trim(), created: orig ? orig.created : new Date().toISOString(), ...(orig && orig.example ? { example: true } : {}) };
    db.sessions = db.sessions.filter((x) => x.id !== s.id).concat(s);
    const wasEdit = !!d.editOf;
    draft = null; saveDraft(); stopRest(); persist();
    if (wasEdit) { state.stack.pop(); toast(T("Changes saved", "Änderungen gespeichert")); render(); window.scrollTo(0, 0); }
    else { home(); state.stack.push({ v: "session", p: s.id, fresh: true }); state.enter = true; render(); window.scrollTo(0, 0); }
  }
  function discardDraft() {
    if (!draft) return;
    if (draft.editOf) {
      const s = sessionById(draft.editOf); draft = null;
      if (s) { db.sessions = db.sessions.filter((x) => x !== s); persist(); toast(T("Workout deleted", "Training gelöscht"), { label: T("Undo", "Rückgängig"), fn: () => { db.sessions.push(s); persist(); render(); } }); }
      state.stack.pop(); state.stack.pop(); if (!state.stack.length) state.stack.push({ v: TAB_ROOT[state.tab] }); render(); return;
    }
    draft = null; saveDraft(); stopRest(); home(); state.armed = null; render(); window.scrollTo(0, 0); toast(T("Workout discarded", "Training verworfen"));
  }
  function newTemplate(items) {
    const t = { id: newId(), name: "", items: items || [] };
    db.templates.push(t); persist(); go("tpl", t.id);
    setTimeout(() => { const n = $("tplName"); if (n && !items) n.focus(); }, 60);
  }

  /* ---------- Click handling ---------- */
  document.addEventListener("click", (ev) => {
    if (ev.target.closest("[data-close]")) { closeSheetsAnimated(); return; }
    const a = ev.target.closest("[data-action]");
    if (!a || a.tagName === "SELECT" || a.tagName === "INPUT" || a.disabled) return;
    const act = a.dataset.action, arg = a.dataset.arg;
    const ARMABLE = { "discard": "discard", "ex-del": `ex-del:${arg}`, "tpl-ex-del": `tpl-ex:${arg}`, "tpl-del": "tpl-del", "clear-examples": "clear-ex", "meal-del": "meal-del" };
    if (state.armed && ARMABLE[act] !== state.armed) { state.armed = null; if (!ARMABLE[act] && !a.closest(".sheet")) render(); }
    const arm = (key) => { if (state.armed === key) { state.armed = null; return true; } state.armed = key; render(); return false; };
    const ij = () => String(arg).split(":").map(Number);
    const topP = () => state.stack[state.stack.length - 1].p;
    switch (act) {
      case "nav": navTo(arg); break;
      case "prog-seg": state.progSeg = arg; state.histN = 60; state.exAll = false; render(); break;
      case "meal-quick": openIn("today"); openMeal(null); break;
      case "w-new": openWeight(); break;
      case "w-edit": openWeight(arg); break;
      case "w-all": state.wAll = true; render(); break;
      case "w-range": state.wRange = arg; render(); break;
      case "p-mode": db.settings.goals.pMode = arg; if (arg === "auto" && !db.weights.length) toast(T("Log your weight first – Progress → Body", "Trag zuerst dein Gewicht ein – Fortschritt → Körper")); persist(); render(); break;
      case "p-perkg": db.settings.goals.pPerKg = +arg; persist(); render(); break;
      case "back": goBack(); break;
      case "lang": if (arg !== LANG) { setLang(arg); toast(arg === "de" ? "Sprache: Deutsch" : "Language: English"); } break;
      case "start": openStart(); break;
      case "start-cali": if (draft && !draft.editOf) openLive(); else startWorkout(null, null, "cali"); break;
      case "resume": openLive(); break;
      case "start-tpl": startWorkout(arg); break;
      case "start-free": startWorkout(null, null, arg || "gym"); break;
      case "nav-workouts": closeSheets(); openIn("train"); break;
      case "session": go("session", arg); break;
      case "act": { const s = sessionById(arg); if (s) openAct(s); break; }
      case "act-new": closeSheets(); openAct(null, arg); break;
      case "sport": go("sport", arg); break;
      case "ex": go("exercise", arg); break;
      case "ex-edit": openEx(arg); break;
      case "ex-lv": state.exLv[topP()] = +arg; render(); break;
      case "hist-filter": state.histFilter = arg; state.histN = 60; render(); break;
      case "hist-more": state.histN += 100; render(); break;
      case "p-range": state.pRange = arg; render(); break;
      case "p-metric": state.pMetric = arg; render(); break;
      case "g-win": state.gWin = arg; render(); break;
      case "ex-all": state.exAll = true; render(); break;
      case "ex-range": state.exRange = arg; render(); break;
      case "ex-metric": state.exMetric[exOf(topP()).kind] = arg; render(); break;
      case "sp-range": state.spRange = arg; render(); break;
      case "sp-metric": state.spMetric[topP()] = arg; render(); break;
      case "repeat": startWorkout(null, arg); break;
      case "edit-session": editSession(arg); break;
      case "tpl-from": {
        const s = sessionById(arg); if (!s) break;
        const items = s.ex.map((e) => { const x = exOf(e.id), w = e.sets.filter((q) => !q.wu && !q.drop), reps = w.map((q) => +(x.kind === "time" ? q.t : q.r)).filter(Boolean); return { ex: e.id, sets: Math.max(1, w.length), reps: e.tr || (reps.length ? (Math.min(...reps) === Math.max(...reps) ? String(reps[0]) : `${Math.min(...reps)}–${Math.max(...reps)}`) : ""), ...(e.lv != null ? { lv: e.lv } : {}), ...(e.rest != null ? { rest: e.rest } : {}), ...(e.ss ? { ss: e.ss } : {}) }; });
        const t = { id: newId(), name: s.name || "Workout", items }; db.templates.push(t); persist(); toast(T("Saved as workout", "Als Workout gespeichert")); go("tpl", t.id); break;
      }
      /* live workout */
      case "finish": finishDraft(); break;
      case "discard": if (arm("discard")) discardDraft(); break;
      case "set-done": toggleDone(...ij()); break;
      case "set-wu": {   // normal → warm-up → drop set (kg exercises) → normal
        const [i, j] = ij(), e = draft && draft.ex[i], s = e && e.sets[j]; if (!s) break;
        const canDrop = exOf(e.id).kind === "kg" && j > 0;
        if (!s.wu && !s.drop) s.wu = true; else if (s.wu) { s.wu = false; if (canDrop) s.drop = true; } else s.drop = false;
        saveDraft(); rerenderCard(i); break;
      }
      case "set-drop": {
        const [i, j] = ij(), e = draft && draft.ex[i]; if (!e || !e.sets[j]) break;
        e.sets.splice(j + 1, 0, { ...blankSet(), drop: true }); stopRest(); saveDraft(); rerenderCard(i);
        focusSet(i, j + 1, "r"); break;
      }
      case "rest-ex": openRestSheet(arg); break;
      case "rest-pick": pickRest(arg); break;
      case "xm-ss": xmSuperset(); break;
      case "set-add": { const e = draft && draft.ex[+arg]; if (!e) break; e.sets.push(blankSet()); saveDraft(); rerenderCard(+arg); break; }
      case "set-del": { const e = draft && draft.ex[+arg]; if (!e || !e.sets.length) break; e.sets.pop(); saveDraft(); rerenderCard(+arg); break; }
      case "ex-move": { const [i, dir] = ij(), L = draft.ex, k = i + dir; if (k < 0 || k >= L.length) break; [L[i], L[k]] = [L[k], L[i]]; saveDraft(); render(); break; }
      case "ex-del": {
        const i = +arg, e = draft && draft.ex[i]; if (!e) break;
        const has = e.sets.some((s) => s.done || s.w !== "" || s.r !== "" || s.t !== "");
        if (has && !arm(`ex-del:${i}`)) break;
        draft.ex.splice(i, 1); state.armed = null; saveDraft(); render(); break;
      }
      case "pick-open": openPick(arg); break;
      case "pick-swap": { const P = state.pick; if (!P || !P.swap) break; const tg = P.target; closeSheetsAnimated(); applySwap(tg, arg); break; }
      /* exercise menu (in a workout or a template) */
      case "xm": openXm(arg); break;
      case "xm-swap": { const c = state.xm; if (!c) break; closeSheets(); openPick(c.w === "d" ? `swap:d:${c.i}` : `swap:t:${c.t}:${c.i}`); break; }
      case "xm-edit": { const c = state.xm, id = c && xmId(c); if (!id) break; closeSheets(); openEx(id); break; }
      case "xm-hist": { const c = state.xm, id = c && xmId(c); if (!id) break; closeSheets(); go("exercise", id); break; }
      case "xm-move": xmMove(+arg); break;
      case "xm-del": xmDel(a); break;
      case "pick-toggle": { const P = state.pick; if (!P) break; const k = P.sel.indexOf(arg); if (k >= 0) P.sel.splice(k, 1); else P.sel.push(arg); renderPick(); break; }
      case "pick-group": if (state.pick) { state.pick.group = arg; renderPick(true); } break;
      case "ex-new-from-pick": { const P = state.pick; closeSheets(); openEx(null, P); break; }
      case "rest-add": if (rest) { rest.end += +arg * 1000; rest.total = Math.max(5, rest.total + +arg); if (rest.end > Date.now()) rest.rang = false; saveRest(); tickRest(); } break;
      case "rest-stop": stopRest(); break;
      /* templates */
      case "tpl": go("tpl", arg); break;
      case "tpl-new": newTemplate(); break;
      case "tpl-samples": loadSampleTemplates(); toast(T("Templates loaded – adjust them to you", "Vorlagen geladen – passe sie an")); render(); break;
      case "tpl-start": startWorkout(arg); break;
      case "tpl-sets": { const t = tplById(topP()), [i, d] = ij(); if (!t || !t.items[i]) break; t.items[i].sets = clamp((t.items[i].sets || 3) + d, 1, 12); persist(); render(); break; }
      case "tpl-move": { const t = tplById(topP()), [i, d] = ij(), k = i + d; if (!t || k < 0 || k >= t.items.length) break; [t.items[i], t.items[k]] = [t.items[k], t.items[i]]; persist(); render(); break; }
      case "tpl-ex-del": { const t = tplById(topP()); if (!t || !arm(`tpl-ex:${arg}`)) break; t.items.splice(+arg, 1); persist(); render(); break; }
      case "tpl-dup": { const t = tplById(arg); if (!t) break; const c = { id: newId(), name: `${t.name || "Workout"} (${T("copy", "Kopie")})`, items: t.items.map((it) => ({ ...it })) }; db.templates.push(c); persist(); state.stack.pop(); go("tpl", c.id); toast(T("Copy created", "Kopie erstellt")); break; }
      case "tpl-del": { const t = tplById(arg); if (!t || !arm("tpl-del")) break; db.templates = db.templates.filter((x) => x !== t); persist(); state.stack.pop(); render(); toast(T("Workout deleted", "Workout gelöscht"), { label: T("Undo", "Rückgängig"), fn: () => { db.templates.push(t); persist(); render(); } }); break; }
      /* nutrition */
      case "food-day": { const d = addDays(foodDay(), +arg); state.foodDay = d >= todayISO() ? null : d; render(); break; }
      case "meal-new": openMeal(null); break;
      case "meal": openMeal(arg); break;
      case "meal-type": if (mealDraft) { mealDraft.type = arg; document.querySelectorAll('[data-action="meal-type"]').forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.arg === arg))); } break;
      case "meal-save": saveMeal(); break;
      case "meal-del": {
        if (!mealDraft || !arm("meal-del")) break;
        if (mealDraft.mode === "tpl") {
          const t = tplById2(mealDraft.id); db.mealTpls = db.mealTpls.filter((x) => x.id !== mealDraft.id); persist(); mealDraft = null; state.stack.pop(); render();
          if (t) toast(T(`“${t.name}” deleted – logged meals stay`, `„${t.name}“ gelöscht – eingetragene Mahlzeiten bleiben`), { label: T("Undo", "Rückgängig"), fn: () => { db.mealTpls.push(t); persist(); render(); } });
          break;
        }
        const m = db.meals.find((x) => x.id === mealDraft.id); db.meals = db.meals.filter((x) => x.id !== mealDraft.id); persist(); mealDraft = null; state.stack.pop(); render(); if (m) toast(T("Meal deleted", "Mahlzeit gelöscht"), { label: T("Undo", "Rückgängig"), fn: () => { db.meals.push(m); persist(); render(); } }); break;
      }
      case "meal-tpl": saveDraftAsTpl(); break;
      case "mi-pick": openFoodPick(arg); break;
      case "mi-new": { const r = mealDraft && pendParse()[+String(arg).slice(1)]; if (r) openFood(null, { ret: { pend: r.key }, name: r.name || r.raw }); break; }
      case "mi-step": { const [k, dir] = String(arg).split(":"), i = itemIdx(k); if (i == null) break; touchItem(stepItem(mealDraft.items[i], +dir)); refreshMeal(); break; }
      case "mi-del": { const i = itemIdx(arg); if (i != null) removeItem(i); break; }
      case "m-fx": setFx(+arg); break;
      case "mt-add": logTpl(arg); break;
      case "mt-use": openTplMeal(arg, true); break;
      case "mt-edit": openTplMeal(arg, false); break;
      case "mt-new": newTplMeal(); break;
      case "off-search": runOff(arg); break;
      case "scan": openScan(arg); break;
      case "scan-meal": openMeal(null); openScan("meal"); break;
      case "off-pick": {
        const x = offState && offState.list[+arg]; if (!x) break;
        const ctx = offState.ctx === "pick" ? fpick : null;
        closeSheets(); openFood(null, { off: x, ret: ctx });
        break;
      }
      case "meal-again": {
        const m = db.meals.find((x) => x.id === arg); if (!m) break;
        const c = { ...m, id: newId(), date: foodDay(), time: foodDay() === todayISO() ? nowTime() : m.time || "", type: m.type || guessMealType(), items: m.items.map((it) => calcItem({ ...it })) }; delete c.example; delete c.text; delete c.ov;
        db.meals.push(c); persist(); render(); toast(T(`Added · ${nf0.format(sumMacros(c.items).kcal)} kcal`, `Hinzugefügt · ${nf0.format(sumMacros(c.items).kcal)} kcal`), { label: T("Undo", "Rückgängig"), fn: () => { db.meals = db.meals.filter((x) => x.id !== c.id); persist(); render(); } });
        break;
      }
      case "food-new": openFood(null); break;
      case "food-new-meal": if (mealDraft) openFood(null, { ret: { add: true } }); break;
      case "food-open": { const f = FOOD_BY.get(arg); if (f && f.own) openFood(arg); else if (f) openFood(null, { base: f }); break; }
      case "f-metric": state.fMetric = arg; render(); break;
      case "f-range": state.fRange = arg; render(); break;
      case "fpick-choose": chooseFood(arg); break;
      /* reports */
      case "rep-list": markRep("repNoted", newReports("repNoted")); if (arg) state.repType = arg; state.progSeg = "reports"; openIn("prog"); break;
      case "rep-new": {
        const nr = newReports("repNoted"); markRep("repNoted", nr); state.progSeg = "reports";
        if (nr.length === 1) { markRep("repSeen", nr); openIn("prog", "report", nr[0].id); } else { state.repType = nr.length ? nr[nr.length - 1].type : state.repType; openIn("prog"); }
        break;
      }
      case "rep-type": state.repType = arg; render(); break;
      case "rep-cmp": state.repCmp = arg; render(); break;
      case "rep-metric": state.repMetric = arg; render(); break;
      case "rep-open": { const p = periodFromId(arg); if (!p) break; markRep("repSeen", [p]); markRep("repNoted", [p]); go("report", p.id); break; }
      case "rep-step": {
        const top = state.stack[state.stack.length - 1], p = periodFromId(top.p); if (!p) break;
        const q = periodShift(p, +arg); if (q.from > todayISO()) break;
        markRep("repSeen", [q]); top.p = q.id; render(); window.scrollTo(0, 0); break;
      }
      /* data */
      case "export-json": exportJson(); break;
      case "export-csv": exportCsv(); break;
      case "examples": loadExamples(); break;
      case "clear-examples": if (arm("clear-ex")) clearExamples(); break;
      /* full screen chart */
      case "chart-full": openFull(arg); break;
      case "full-close": closeFull(); break;
      case "full-play": if (sim.playing) simPause(); else simPlay(); break;
      case "full-speed": sim.speed = +arg; document.querySelectorAll('[data-action="full-speed"]').forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.arg === arg))); break;
    }
  });
  $("fab").addEventListener("click", () => { const f = FAB[state.stack[state.stack.length - 1].v]; if (f) f[1](); });
  document.querySelectorAll("#tabbar [data-tab]").forEach((b) => b.addEventListener("click", () => { closeSheets(); selectTab(b.dataset.tab); }));
  /* leave a changed workout / meal */
  $("leaveSave").addEventListener("click", () => { const top = state.stack[state.stack.length - 1]; closeSheets(); if (top.v === "meal") saveMeal(); else finishDraft(); });
  $("leaveDiscard").addEventListener("click", () => { closeSheets(); goBack(true); });
  /* body weight */
  document.querySelectorAll("[data-wstep]").forEach((b) => b.addEventListener("click", () => { const el = $("wKg"), v = parseNum(el.value) || (lastWeight() ? lastWeight().kg : 75); el.value = fmtIn(Math.round((v + +b.dataset.wstep) * 10) / 10); }));
  $("wForm").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const v = parseNum($("wKg").value), d = $("wDate").value || todayISO();
    if (!(v > 20 && v < 400)) { $("wErr").textContent = T("Enter your weight in kg, e.g. 82.4", "Gewicht in kg eintragen, z. B. 82,4"); return; }
    if (d > todayISO()) { $("wErr").textContent = T("That date is in the future.", "Das Datum liegt in der Zukunft."); return; }
    if (wEditing && wEditing !== d) db.weights = db.weights.filter((w) => w.date !== wEditing);
    const prev = curWeight(); saveWeight(d, v); closeSheets(); render();
    const now = curWeight(), dd = prev != null ? now - prev : 0;
    toast(T(`${nf1.format(v)} kg saved${prev != null ? ` · Ø 7 days ${nf1.format(now)} kg` : ""}`, `${nf1.format(v)} kg gespeichert${prev != null ? ` · Ø 7 Tage ${nf1.format(now)} kg` : ""}`));
  });
  $("wDelete").addEventListener("click", () => {
    const b = $("wDelete"), d = wEditing; if (!d) return;
    if (!b.classList.contains("armed")) { b.classList.add("armed"); b.textContent = T("Really delete?", "Wirklich löschen?"); return; }
    const w = weightOn(d); db.weights = db.weights.filter((x) => x.date !== d); persist(); closeSheets(); render();
    toast(T("Entry deleted", "Eintrag gelöscht"), { label: T("Undo", "Rückgängig"), fn: () => { if (w) saveWeight(w.date, w.kg); render(); } });
  });
  $("backdrop").addEventListener("click", () => closeSheetsAnimated());

  function toggleDone(i, j) {
    const e = draft && draft.ex[i], s = e && e.sets[j]; if (!s) return;
    unlockAudio();
    if (s.done) { s.done = false; saveDraft(); rerenderCard(i); return; }
    const x = exOf(e.id), ph = placeholders(e, x, lastFor(e.id, draft, e.lv))[j];
    if (x.kind === "time") {
      const tv = s.t !== "" ? s.t : ph.t;
      if (!(parseNum(tv) > 0)) { toast(T("Enter the seconds", "Zeit in Sekunden eintragen")); focusSet(i, j, "t"); return; }
      s.t = tv;
    } else {
      const rv = s.r !== "" ? s.r : ph.r, wv = s.w !== "" ? s.w : ph.w;
      if (!(parseNum(rv) > 0)) { toast(T("Enter the reps", "Wiederholungen eintragen")); focusSet(i, j, "r"); return; }
      if (x.kind === "kg" && parseNum(wv) == null) { toast(T("Enter the weight", "Gewicht eintragen")); focusSet(i, j, "w"); return; }
      s.r = rv; s.w = wv;
    }
    s.done = true; draft.last = Date.now();
    if (!s.wu) {
      const { t, b } = bestBefore(e.id, x.kind, draft, e.lv);
      const v = t === "e1rm" ? e1rmOf(parseNum(s.w) || 0, parseNum(s.r) || 0) : t === "reps" ? parseNum(s.r) || 0 : parseNum(s.t) || 0;
      if (!s.drop && b > 0 && v > Math.max(b, e.prBest || 0) + 1e-9) { e.prBest = v; toast(`${T("New record", "Neuer Rekord")}: ${exName(x)} – ${t === "e1rm" ? `e1RM ${kg(Math.round(v * 2) / 2)}` : t === "reps" ? pl(v, "rep") : secTxt(v)}`); }
      const ss = ssInfo(draft.ex, i);
      if (ss && !ss.last) {   // superset: straight on to the next exercise, the rest comes after the last one
        stopRest();
        const nx = draft.ex[ss.next];
        toast(T(`Superset – now ${exName(exOf(nx.id))}`, `Supersatz – jetzt ${exName(exOf(nx.id))}`));
        setTimeout(() => { const c = document.querySelector(`.excard[data-ex="${ss.next}"]`); if (c) c.scrollIntoView({ block: "start", behavior: "smooth" }); }, 120);
      } else startRest(restFor(e));
    }
    try { navigator.vibrate && navigator.vibrate(12); } catch { /* ignore */ }
    saveDraft(); rerenderCard(i);
  }
  function focusSet(i, j, f) { setTimeout(() => { const el = $(`s-${i}-${j}-${f}`); if (el) el.focus(); }, 30); }

  document.addEventListener("input", (ev) => {
    const t = ev.target;
    if (t.classList.contains("sin") && draft) {
      const e = draft.ex[+t.dataset.i], s = e && e.sets[+t.dataset.j];
      if (s) { s[t.dataset.f] = t.value.replace(/[^\d.,]/g, ""); if (s[t.dataset.f] !== t.value) t.value = s[t.dataset.f]; queueDraftSave(); if (s.done) updateLiveMeta(); }
      return;
    }
    if (draft && t.id === "liveName") { draft.name = t.value; queueDraftSave(); return; }
    if (draft && t.id === "liveNote") { draft.note = t.value; queueDraftSave(); return; }
    if (draft && t.id === "liveDur") { draft.dur = t.value.replace(/[^\d]/g, ""); queueDraftSave(); return; }
    if (t.id === "tplName") { const tp = tplById(state.stack[state.stack.length - 1].p); if (tp) { tp.name = t.value; queuePersist(); } return; }
    if (t.classList.contains("repin")) { const tp = tplById(state.stack[state.stack.length - 1].p), it = tp && tp.items[+t.dataset.i]; if (it) { it.reps = t.value.replace(/-/g, "–"); queuePersist(); } return; }
    if (t.id === "pickQ" && state.pick) { state.pick.q = t.value; renderPick(); return; }
    if (t.id === "exQ") { state.exQ = t.value; render(); return; }
    if (t.id === "foodQ") { state.foodQ = t.value; render(); return; }
    if (t.id === "mealText" && mealDraft) { mealDraft.text = t.value; refreshMeal(); return; }
    if (t.id === "mealName" && mealDraft) { mealDraft.name = t.value; return; }
    if (t.classList.contains("iqty") && mealDraft) {
      const k = t.dataset.k, i = k && k[0] === "c" ? +k.slice(1) : null, it = i != null ? mealDraft.items[i] : null, v = parseNum(t.value);
      if (it && v != null && v >= 0 && v < 100000) { touchItem(setItemQty(it, v)); refreshItemRow(k, it); }
      return;
    }
    if (t.id === "fpickQ") { renderFoodPick(); return; }
    if (t.closest && t.closest("#actForm")) updateActPreview();
    if (t.id === "foodKj") { const kj = parseNum(t.value), kc = $("foodKcal"); if (kc.value === "" || kcalAuto) { kc.value = kj > 0 ? fmtIn(Math.round(kj / 4.184)) : ""; kcalAuto = kj > 0; } }
    if (t.id === "foodKcal") kcalAuto = false;
    if (t.closest && t.closest("#foodForm")) updateFoodPreview();
  });
  document.addEventListener("change", (ev) => {
    const t = ev.target;
    if (t.id === "importFile") { importBackup(t); return; }
    if (t.id === "openModeSel") { try { localStorage.setItem(OPEN_KEY, t.value); } catch { /* ignore */ } toast(T("Saved", "Gespeichert")); return; }
    if (t.id === "restSel") { db.settings.rest = +t.value; persist(); toast(+t.value ? `${T("Rest", "Pause")}: ${clock(+t.value)} min` : T("Rest timer off", "Pausen-Timer aus")); return; }
    if (t.id === "soundChk") { db.settings.sound = t.checked; persist(); if (t.checked) { unlockAudio(); beep(); } return; }
    if (t.classList.contains("sportchk")) { db.settings.hide = { ...db.settings.hide, [t.dataset.sp]: !t.checked }; persist(); toast(t.checked ? T(`${sportName(t.dataset.sp)} shown`, `${sportName(t.dataset.sp)} eingeblendet`) : T(`${sportName(t.dataset.sp)} hidden`, `${sportName(t.dataset.sp)} ausgeblendet`)); return; }
    if (t.id === "goalPkg") { const v = parseNum(t.value); if (v > 0.5 && v < 4) { db.settings.goals.pPerKg = Math.round(v * 10) / 10; persist(); render(); toast(T("Goal saved", "Ziel gespeichert")); } return; }
    if (t.id === "goalKcal" || t.id === "goalP") { const v = Math.max(0, Math.round(parseNum(t.value) || 0)); db.settings.goals[t.id === "goalKcal" ? "kcal" : "p"] = v; persist(); toast(T("Goal saved", "Ziel gespeichert")); return; }
    if (draft && t.id === "liveDate") { draft.date = t.value || todayISO(); saveDraft(); render(); return; }
    if (draft && t.id === "liveTime") { draft.time = t.value; saveDraft(); return; }
    if (draft && t.classList.contains("lvsel")) { const e = draft.ex[+t.dataset.i]; if (e) { e.lv = +t.value; e.prBest = 0; saveDraft(); rerenderCard(+t.dataset.i); } return; }
    if (t.classList.contains("tpllv")) { const tp = tplById(state.stack[state.stack.length - 1].p), it = tp && tp.items[+t.dataset.i]; if (it) { it.lv = +t.value; persist(); render(); } return; }
    if (mealDraft && t.id === "mealDate") { mealDraft.date = t.value || todayISO(); return; }
    if (mealDraft && t.classList.contains("iqty")) { const it = mealDraft.items[+String(t.dataset.k).slice(1)]; if (it) t.value = fmtIn(it.qty); return; }
    if (mealDraft && t.classList.contains("iunit")) { const i = itemIdx(t.dataset.k); if (i == null) return; const it = mealDraft.items[i]; setItemUnit(it, t.value); touchItem(it); refreshMeal(); return; }
    if (mealDraft && t.id === "mealTime") { mealDraft.time = t.value; return; }
  });
  document.addEventListener("focusin", (ev) => {
    const t = ev.target;
    if (!mealDraft || !t.classList || !t.classList.contains("iqty") || String(t.dataset.k)[0] !== "p") return;
    const i = itemIdx(t.dataset.k); if (i == null) return;
    refreshMeal();
    const el = $("iq-c" + i); if (el) { el.focus(); try { el.select(); } catch { /* ignore */ } }
  });
  document.addEventListener("toggle", (ev) => { if (ev.target.id === "liveMore" && draft) { draft.moreOpen = ev.target.open; } }, true);

  /* ================= Sheets ================= */
  const SHEETS = ["startSheet", "pickSheet", "exSheet", "xmSheet", "actSheet", "foodSheet", "fpickSheet", "leaveSheet", "wSheet", "restSheet"];
  let sheetTok = 0;
  function showSheet(id) { sheetTok++; $("backdrop").hidden = false; $(id).hidden = false; $(id).scrollTop = 0; }
  function sheetOpen() { return SHEETS.map((id) => $(id)).find((el) => el && !el.hidden) || null; }
  function dismissSheet(sh, fromY) {
    const b = $("backdrop"), H = sh.offsetHeight || window.innerHeight;
    if (document.activeElement && sh.contains(document.activeElement)) document.activeElement.blur();
    sh.style.animation = "none"; sh.style.transition = "none"; sh.style.transform = `translateY(${fromY || 0}px)`;
    void sh.offsetHeight;
    sh.style.transition = "transform .24s cubic-bezier(.2,.7,.3,1)"; sh.style.transform = `translateY(${H + 24}px)`;
    b.style.transition = "opacity .24s ease-out"; b.style.opacity = "0";
    const tok = ++sheetTok;
    setTimeout(() => { if (tok === sheetTok) closeSheets(); }, 240);
  }
  function closeSheetsAnimated() { const sh = sheetOpen(); if (sh) dismissSheet(sh, 0); else closeSheets(); }
  function closeSheets() {
    SHEETS.forEach((id) => { const el = $(id); el.style.transform = ""; el.style.transition = ""; el.style.animation = ""; el.classList.remove("dragging"); el.hidden = true; });
    $("backdrop").style.opacity = ""; $("backdrop").style.transition = ""; $("backdrop").hidden = true;
    state.pick = null; state.xm = null; actEditing = null; exEditing = null; foodEditing = null; foodOff = null; fpick = null;
  }

  /* ---------- Start chooser ---------- */
  function openStart() {
    if (draft && !draft.editOf) { openLive(); return; }
    const D = derived();
    const lastUse = (t) => { const s = D.desc.find((q) => q.tpl === t.id); return s ? s.date : ""; };
    const tpls = db.templates.filter((t) => t.items.length).slice().sort((a, b) => lastUse(a).localeCompare(lastUse(b)));
    const next = tpls[0];
    $("startList").innerHTML = tpls.map((t) => {
      const lu = lastUse(t);
      return `<button type="button" class="choice${t === next && tpls.length > 1 ? " pri" : ""}" data-action="start-tpl" data-arg="${esc(t.id)}"><b>${esc(t.name || T("Untitled", "Ohne Namen"))}</b><span>${t === next && tpls.length > 1 ? `${esc(T("Up next", "Als Nächstes dran"))} · ` : ""}${esc(t.items.map((it) => exName(exOf(it.ex))).join(", "))}${lu ? ` · ${esc(T("last", "zuletzt"))} ${esc(rel(lu))}` : ""}</span></button>`;
    }).join("") + `<div class="two"><button type="button" class="choice${tpls.length ? "" : " pri"}" data-action="start-free" data-arg="gym"><b>${esc(T("Free gym", "Freies Gym"))}</b><span>${esc(T("No template", "Ohne Vorlage"))}</span></button><button type="button" class="choice" data-action="start-free" data-arg="cali" style="border-color:${SPORTS.cali.color}55"><b>Calisthenics</b><span>${esc(T("Skills & levels", "Skills & Stufen"))}</span></button></div>`
      + (tpls.length ? "" : `<button type="button" class="choice" data-action="nav-workouts"><b>${esc(T("Build a workout", "Workout bauen"))}</b><span>${esc(T("Your own plans, e.g. push, pull, legs", "Eigene Pläne anlegen, z. B. Push, Pull, Beine"))}</span></button>`);
    $("startSports").parentElement.querySelector("#startSportsLab").hidden = !OPT_SPORTS.some(sportOn);
    $("startSports").innerHTML = OPT_SPORTS.filter(sportOn).map((k) => `<button type="button" class="mtile" data-action="act-new" data-arg="${k}"><span class="tile-t"><i style="background:${SPORTS[k].color}"></i>${esc(sportName(k))}</span><span class="tile-s">${esc(k === "run" ? T("Distance & time", "Distanz & Zeit") : k === "hyrox" ? T("Training or race", "Training oder Rennen") : k === "fb" ? T("Training or match", "Training oder Spiel") : T("e.g. bike, tennis", "z. B. Rad, Tennis"))}</span></button>`).join("");
    showSheet("startSheet");
  }

  /* ---------- Exercise picker ---------- */
  function openPick(target) {
    const has = derived().byEx.size > 0, swap = String(target).startsWith("swap:"), cur = swap ? xmId(xmCtx(target)) : null;
    const cali = (target === "draft" || swap) && draft && draft.sport === "cali";
    state.pick = { target, sel: [], group: cur ? (exOf(cur).cali && exOf(cur).cali !== "basic" ? "Cali" : exOf(cur).group) : cali ? "Cali" : has ? "Recent" : "All", q: "", swap, cur };
    $("pickQ").value = "";
    $("pickTitle").textContent = swap ? T("Swap exercise", "Übung tauschen") : T("Add exercises", "Übungen hinzufügen");
    $("pickGo").hidden = swap;
    renderPick(true);
    showSheet("pickSheet");
  }
  function renderPick(chips) {
    const P = state.pick; if (!P) return;
    const D = derived(), lastOf = (id) => { const h = D.byEx.get(id); return h ? h[h.length - 1].s.date : ""; };
    const gname = (g) => (g === "Recent" ? T("Recent", "Zuletzt") : g === "All" ? T("All", "Alle") : g === "Cali" ? "Calisthenics" : groupName(g));
    if (chips) {
      const gs = (D.byEx.size ? ["Recent"] : []).concat(["All", "Cali"], GROUPS);
      $("pickGroups").innerHTML = gs.map((g) => `<button type="button" class="fchip" data-action="pick-group" data-arg="${esc(g)}" aria-pressed="${P.group === g}">${GROUP_COLORS[g] ? `<i style="background:${GROUP_COLORS[g]}"></i>` : g === "Cali" ? `<i style="background:${SPORTS.cali.color}"></i>` : ""}${esc(gname(g))}</button>`).join("");
    }
    let xs = [...EX.values()].filter((x) => !x.hidden);
    const q = fold(P.q.trim());
    if (q) xs = xs.filter((x) => fold(x.de).includes(q) || fold(x.en).includes(q) || fold(groupName(x.group)).includes(q));
    else if (P.group === "Recent") xs = xs.filter((x) => lastOf(x.id)).sort((a, b) => lastOf(b.id).localeCompare(lastOf(a.id))).slice(0, 40);
    else if (P.group === "Cali") xs = xs.filter((x) => x.cali).sort((a, b) => CTYPES.findIndex((c) => c[0] === a.cali) - CTYPES.findIndex((c) => c[0] === b.cali));
    else if (P.group !== "All") xs = xs.filter((x) => x.group === P.group);
    if (q || P.group === "All" || GROUPS.includes(P.group)) xs.sort((a, b) => (GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group)) || exName(a).localeCompare(exName(b), LANG));
    $("pickList").innerHTML = xs.map((x) => {
      const k = P.sel.indexOf(x.id), lu = lastOf(x.id);
      if (P.swap) return `<button type="button" class="pickrow${x.id === P.cur ? " cur" : ""}" data-action="pick-swap" data-arg="${esc(x.id)}"${x.id === P.cur ? " disabled" : ""}><span class="checkc${x.id === P.cur ? " on" : ""}" aria-hidden="true">${x.id === P.cur ? "✓" : "⇄"}</span><span class="main"><span class="t1">${esc(exName(x))}${x.id === P.cur ? ` <span class="tag">${esc(T("current", "aktuell"))}</span>` : ""}</span><span class="t2">${esc(groupName(x.group))} · ${esc(kindText(x.kind))}${lu ? ` · ${esc(T("last", "zuletzt"))} ${esc(rel(lu))}` : ""}</span></span>${badgeEx(x)}</button>`;
      return `<button type="button" class="pickrow" data-action="pick-toggle" data-arg="${esc(x.id)}" aria-pressed="${k >= 0}"><span class="checkc${k >= 0 ? " on" : ""}" aria-hidden="true">${k >= 0 ? k + 1 : ""}</span><span class="main"><span class="t1">${esc(exName(x))}</span><span class="t2">${esc(groupName(x.group))} · ${esc(kindText(x.kind))}${hasLv(x) ? ` · ${pl(x.lv.length, "level")}` : ""}${lu ? ` · ${esc(T("last", "zuletzt"))} ${esc(rel(lu))}` : ""}</span></span>${badgeEx(x)}</button>`;
    }).join("") || `<p class="hint" style="padding:14px 0">${esc(T("Nothing found. Add it with “New exercise”.", "Nichts gefunden. Leg sie mit „Neue Übung\" an."))}</p>`;
    $("pickGo").disabled = !P.sel.length;
    $("pickGo").textContent = P.sel.length ? T(`Add ${P.sel.length}`, `${P.sel.length} hinzufügen`) : T("Add", "Hinzufügen");
    if (chips) document.querySelectorAll("#pickGroups .fchip").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.arg === P.group)));
  }
  $("pickForm").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const P = state.pick; if (!P || !P.sel.length) return;
    if (P.target === "draft" && draft) {
      for (const id of P.sel) {
        const x = exOf(id), lv = hasLv(x) ? Math.max(0, topLevel(id)) : null, last = lastFor(id, draft, lv), n = last ? Math.max(1, last.e.sets.filter((q) => !q.wu).length) : 3;
        draft.ex.push({ id, tr: "", ...(lv != null ? { lv } : {}), sets: Array.from({ length: n }, () => blankSet()) });
      }
      saveDraft();
    } else if (P.target.startsWith("tpl:")) {
      const t = tplById(P.target.slice(4));
      if (t) { for (const id of P.sel) { const x = exOf(id); t.items.push({ ex: id, sets: 3, reps: x.kind === "kg" ? "8–12" : "", ...(hasLv(x) ? { lv: Math.max(0, topLevel(id)) } : {}) }); } persist(); }
    }
    const n = P.sel.length;
    closeSheetsAnimated(); render();
    setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }), 80);
    toast(T(`${pl(n, "exercise")} added`, `${pl(n, "exercise")} hinzugefügt`));
  });

  /* ---------- Exercise menu: swap, edit, history, move, remove – right from the workout ---------- */
  const xmCtx = (arg) => { const p = String(arg).replace(/^swap:/, "").split(":"); return p[0] === "d" ? { w: "d", i: +p[1] } : { w: "t", t: p[1], i: +p[2] }; };
  function xmList(c) { if (c.w === "d") return draft ? draft.ex : null; const t = tplById(c.t); return t ? t.items : null; }
  function xmId(c) { const L = c && xmList(c), it = L && L[c.i]; return it ? (c.w === "d" ? it.id : it.ex) : null; }
  function openXm(arg) {
    const top = state.stack[state.stack.length - 1], c = String(arg).startsWith("d:") ? xmCtx(arg) : { w: "t", t: top.p, i: +String(arg).split(":")[1] };
    const L = xmList(c), id = xmId(c); if (!id) return;
    state.xm = c;
    const x = exOf(id), e = L[c.i], has = c.w === "d" && e.sets.some((s) => s.done || s.w !== "" || s.r !== "" || s.t !== "");
    const used = (derived().byEx.get(id) || []).length;
    $("xmHead").innerHTML = `${badgeEx(x)}<div class="xmt"><b id="xmTitle">${esc(exName(x))}</b><span class="exmeta"><i style="background:${GROUP_COLORS[x.group] || "#D4D4D8"}"></i>${esc(groupName(x.group))} · ${esc(kindText(x.kind))}${used ? ` · ${esc(pl(used, "workout"))}` : ""}</span></div>`;
    const item = (act, icon, t1, t2, extra, arg) => `<button type="button" class="menuitem${extra || ""}" data-action="${act}"${arg != null ? ` data-arg="${arg}"` : ""}${extra && extra.includes("disabled") ? " disabled" : ""}><span class="mi" aria-hidden="true">${icon}</span><span class="main"><span class="t1">${esc(t1)}</span>${t2 ? `<span class="t2">${esc(t2)}</span>` : ""}</span></button>`;
    $("xmList").innerHTML =
      item("xm-swap", "⇄", T("Swap exercise", "Übung tauschen"), has ? T("Picked the wrong one? Choose another – your entered sets stay.", "Falsche erwischt? Andere wählen – deine eingetragenen Sätze bleiben.") : T("Picked the wrong one? Choose another.", "Falsche erwischt? Einfach eine andere wählen."))
      + item("xm-edit", "✎", T("Edit exercise", "Übung bearbeiten"), x.base || used ? T("Name and muscle group", "Name und Muskelgruppe") : T("Name, muscle group and how it's measured", "Name, Muskelgruppe und Messart"))
      + item("xm-hist", "↗", T("History & records", "Verlauf & Rekorde"), used ? T("Chart of all your workouts", "Grafik über alle Trainings") : T("No data yet", "Noch keine Daten"))
      + (c.i < L.length - 1 || (L[c.i] && L[c.i].ss) ? item("xm-ss", "⇅", L[c.i].ss ? T("Remove from superset", "Aus dem Supersatz lösen") : T("Superset with next exercise", "Supersatz mit nächster Übung"), L[c.i].ss ? T("Rest again after each set", "Wieder Pause nach jedem Satz") : T(`With ${exName(exOf(c.w === "d" ? L[c.i + 1].id : L[c.i + 1].ex))} – rest only after the second`, `Mit ${exName(exOf(c.w === "d" ? L[c.i + 1].id : L[c.i + 1].ex))} – Pause erst nach der zweiten`)) : "")
      + `<div class="two">${item("xm-move", "↑", T("Move up", "Nach oben"), "", c.i === 0 ? " half disabled" : " half", -1)}${item("xm-move", "↓", T("Move down", "Nach unten"), "", c.i === L.length - 1 ? " half disabled" : " half", 1)}</div>`
      + `<button type="button" class="menuitem danger" data-action="xm-del" data-has="${has ? 1 : 0}"><span class="mi" aria-hidden="true">✕</span><span class="main"><span class="t1">${esc(c.w === "d" ? T("Remove from workout", "Aus dem Training entfernen") : T("Remove from plan", "Aus dem Workout entfernen"))}</span>${has ? `<span class="t2">${esc(T("Entered sets are lost", "Eingetragene Sätze gehen verloren"))}</span>` : ""}</span></button>`;
    showSheet("xmSheet");
  }
  function xmMove(dir) {
    const c = state.xm, L = c && xmList(c); if (!L) return;
    const k = c.i + dir; if (k < 0 || k >= L.length) return;
    [L[c.i], L[k]] = [L[k], L[c.i]];
    fixSS(L);
    if (c.w === "d") saveDraft(); else persist();
    closeSheetsAnimated(); render();
    setTimeout(() => { const el = c.w === "d" ? document.querySelector(`.excard[data-ex="${k}"]`) : document.querySelectorAll(".tplrow")[k]; if (el) el.scrollIntoView({ block: "center", behavior: "smooth" }); }, 60);
  }
  function xmDel(btn) {
    const c = state.xm, L = c && xmList(c); if (!L || !L[c.i]) return;
    if (btn.dataset.has === "1" && !btn.classList.contains("armed")) { btn.classList.add("armed"); btn.querySelector(".t1").textContent = T("Really remove?", "Wirklich entfernen?"); return; }
    const [it] = L.splice(c.i, 1), x = exOf(c.w === "d" ? it.id : it.ex);
    fixSS(L);
    if (c.w === "d") saveDraft(); else persist();
    closeSheetsAnimated(); render();
    toast(T(`${exName(x)} removed`, `${exName(x)} entfernt`), { label: T("Undo", "Rückgängig"), fn: () => { const L2 = xmList(c); if (!L2) return; L2.splice(Math.min(c.i, L2.length), 0, it); if (c.w === "d") saveDraft(); else persist(); render(); } });
  }
  /* link with the next exercise (or join its superset) – or leave the superset */
  function xmSuperset() {
    const c = state.xm, L = c && xmList(c); if (!L || !L[c.i]) return;
    const e = L[c.i];
    if (e.ss) { delete e.ss; fixSS(L); toast(T("Superset removed", "Supersatz gelöst")); }
    else { const nx = L[c.i + 1]; if (!nx) return; e.ss = nx.ss || "s" + Math.random().toString(36).slice(2, 7); nx.ss = e.ss; toast(T("Superset – rest only after the last exercise", "Supersatz – Pause erst nach der letzten Übung")); }
    if (c.w === "d") saveDraft(); else persist();
    closeSheetsAnimated(); render();
  }
  /* rest per exercise: kept in the workout plan, and remembered for the exercise */
  let restCtx = null;
  function openRestSheet(arg) {
    const top = state.stack[state.stack.length - 1], c = String(arg).startsWith("d:") ? xmCtx(arg) : { w: "t", t: top.p, i: +String(arg).split(":")[1] };
    const L = xmList(c), it = L && L[c.i]; if (!it) return;
    restCtx = c;
    const id = c.w === "d" ? it.id : it.ex, cur = c.w === "d" ? restFor(it) : it.rest != null ? +it.rest : null, def = +db.settings.rest || 0;
    const ss = ssInfo(L, c.i);
    $("restSub").textContent = `${exName(exOf(id))}${ss && !ss.last ? ` · ${T("in a superset the rest comes after the last exercise", "im Supersatz kommt die Pause nach der letzten Übung")}` : ""}`;
    const opts = [["def", `${T("Default", "Standard")} · ${restTxt(def)}`], [30], [45], [60], [75], [90], [120], [150], [180], [240], [300], [0, T("No rest", "Keine Pause")]];
    $("restGrid").innerHTML = opts.map(([v, lab]) => { const on = v === "def" ? (c.w === "t" ? cur == null : it.rest == null && !(db.settings.restEx && db.settings.restEx[id] != null)) : cur === v && (c.w === "t" || it.rest != null || (db.settings.restEx && db.settings.restEx[id] != null)); return `<button type="button" class="restopt${v === "def" ? " wide" : ""}" data-action="rest-pick" data-arg="${v}" aria-pressed="${on}">${esc(lab || clock(v))}</button>`; }).join("");
    showSheet("restSheet");
  }
  function pickRest(arg) {
    const c = restCtx, L = c && xmList(c), it = L && L[c.i]; if (!it) return;
    const id = c.w === "d" ? it.id : it.ex, v = arg === "def" ? null : +arg;
    db.settings.restEx = { ...(db.settings.restEx || {}) };
    if (v == null) { delete it.rest; delete db.settings.restEx[id]; } else { it.rest = v; db.settings.restEx[id] = v; }
    // a running workout from a plan: the plan remembers it too
    if (c.w === "d") { const t = draft.tpl && tplById(draft.tpl), ti = t && t.items.find((x) => x.ex === id); if (ti) { if (v == null) delete ti.rest; else ti.rest = v; } saveDraft(); }
    persist(); closeSheetsAnimated(); render();
    toast(v == null ? T("Default rest", "Standard-Pause") : T(`Rest ${restTxt(v)} for ${exName(exOf(id))}`, `Pause ${restTxt(v)} für ${exName(exOf(id))}`));
  }
  function applySwap(target, id) {
    const c = xmCtx(target), L = xmList(c); if (!L || !L[c.i]) return;
    const x = exOf(id), it = L[c.i], old = exOf(c.w === "d" ? it.id : it.ex);
    if (old.id === id) return;
    const fits = (old.kind === "time") === (x.kind === "time");
    if (c.w === "d") {
      it.id = id; delete it.prBest;
      if (!fits) it.sets = it.sets.map((q) => blankSet(q.wu));
      if (hasLv(x)) it.lv = Math.max(0, topLevel(id)); else delete it.lv;
      saveDraft();
    } else {
      it.ex = id;
      if (!fits) it.reps = x.kind === "kg" ? "8–12" : "";
      if (hasLv(x)) it.lv = Math.max(0, topLevel(id)); else delete it.lv;
      persist();
    }
    render();
    toast(T(`Swapped: ${exName(old)} → ${exName(x)}`, `Getauscht: ${exName(old)} → ${exName(x)}`));
  }

  /* ---------- Custom exercise ---------- */
  let exEditing = null, exKind = "kg", exReturn = null;
  function setExKind(k) { exKind = k; document.querySelectorAll("#exForm [data-kind]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.kind === k))); $("exKindHint").textContent = kindHint(k); }
  function openEx(id, returnPick) {
    const x = id ? exOf(id) : null;
    exEditing = x; exReturn = returnPick || null;
    $("exTitle").textContent = x ? T("Edit exercise", "Übung bearbeiten") : T("New exercise", "Neue Übung");
    $("exName").value = x ? exName(x) : (returnPick && returnPick.q) || "";
    $("exGroup").innerHTML = GROUPS.map((g) => `<option value="${esc(g)}"${(x ? x.group : "Brust") === g ? " selected" : ""}>${esc(groupName(g))}</option>`).join("");
    setExKind(x ? x.kind : returnPick && returnPick.group === "Cali" ? "bw" : "kg");
    const locked = !!(x && (x.base || (derived().byEx.get(x.id) || []).length));
    document.querySelectorAll("#exForm [data-kind]").forEach((b) => { b.disabled = locked; });
    $("exCali").checked = x ? !!x.cali : !!(returnPick && returnPick.group === "Cali");
    $("exCaliWrap").hidden = !!(x && x.base);
    $("exAllHint").hidden = !x;
    $("exErr").textContent = "";
    const del = $("exDelete"); del.hidden = !x || x.base; del.classList.remove("armed"); del.textContent = T("Delete", "Löschen");
    showSheet("exSheet");
    if (!x) setTimeout(() => $("exName").focus(), 60);
  }
  document.querySelectorAll("#exForm [data-kind]").forEach((b) => b.addEventListener("click", () => setExKind(b.dataset.kind)));
  $("exForm").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const name = $("exName").value.trim().replace(/\s+/g, " "), group = $("exGroup").value, cali = $("exCali").checked;
    if (!name) { $("exErr").textContent = T("Give the exercise a name.", "Gib der Übung einen Namen."); return; }
    const clash = [...EX.values()].find((x) => !x.hidden && (fold(x.de) === fold(name) || fold(x.en) === fold(name)) && (!exEditing || x.id !== exEditing.id));
    if (clash) { $("exErr").textContent = T(`“${exName(clash)}” already exists (${groupName(clash.group)}).`, `„${exName(clash)}" gibt es schon (${groupName(clash.group)}).`); return; }
    let id;
    if (exEditing && exEditing.base) { db.settings.exOver[exEditing.id] = { name, group }; id = exEditing.id; }
    else if (exEditing) { const c = db.exercises.find((e) => e.id === exEditing.id); if (c) { c.name = name; c.group = group; c.kind = exKind; c.cali = cali ? (exKind === "time" ? "static" : "basic") : null; } id = exEditing.id; }
    else { id = "c" + newId(); db.exercises.push({ id, name, group, kind: exKind, cali: cali ? (exKind === "time" ? "static" : "basic") : null }); }
    persist();
    const ret = exReturn, wasEdit = !!exEditing;
    // a custom exercise switched between hold time and reps: entered values in the running workout no longer fit
    if (draft && exEditing && (exEditing.kind === "time") !== (exKind === "time") && !exEditing.base) for (const e of draft.ex) if (e.id === id) e.sets = e.sets.map((q) => blankSet(q.wu));
    if (draft) saveDraft();
    closeSheets(); render();
    if (ret && ret.swap) { applySwap(ret.target, id); }
    else if (ret) { openPick(ret.target); state.pick.sel = ret.sel.concat(id); state.pick.group = "All"; renderPick(true); }
    toast(wasEdit ? T("Exercise saved", "Übung gespeichert") : T("Exercise added", "Übung angelegt"));
  });
  $("exDelete").addEventListener("click", () => {
    const x = exEditing, b = $("exDelete"); if (!x || x.base) return;
    const used = (derived().byEx.get(x.id) || []).length || db.templates.some((t) => t.items.some((it) => it.ex === x.id));
    if (!b.classList.contains("armed")) { b.classList.add("armed"); b.textContent = used ? T("Hide?", "Ausblenden?") : T("Really delete?", "Wirklich löschen?"); return; }
    if (used) { const c = db.exercises.find((e) => e.id === x.id); if (c) c.hidden = true; }
    else db.exercises = db.exercises.filter((e) => e.id !== x.id);
    persist(); closeSheets();
    const top = state.stack[state.stack.length - 1]; if (top.v === "exercise" && top.p === x.id) state.stack.pop();
    render(); toast(used ? T("Exercise hidden – your data stays", "Übung ausgeblendet – deine Daten bleiben") : T("Exercise deleted", "Übung gelöscht"));
  });

  /* ---------- Other sports: log sheet ---------- */
  let actEditing = null, actSport = "run", actKind = "", actRpe = 0;
  function setActSport(sp) {
    actSport = sp; const S = SPORTS[sp];
    document.querySelectorAll("#actSportSeg [data-sport]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.sport === sp)));
    $("actTitle").textContent = actEditing ? T(`Edit ${sportName(sp)}`, `${sportName(sp)} bearbeiten`) : sp === "run" ? T("Log a run", "Lauf eintragen") : sp === "other" ? T("Log a sport", "Sport eintragen") : T(`Log ${sportName(sp)}`, `${sportName(sp)} eintragen`);
    $("actNameWrap").hidden = sp !== "other";
    $("actDistWrap").hidden = !(sp === "run" || sp === "hyrox" || sp === "other");
    $("actDist").placeholder = sp === "run" ? "0.0" : T("optional", "optional");
    $("actSWrap").hidden = !(sp === "run" || sp === "hyrox");
    $("actGoalsWrap").hidden = sp !== "fb";
    $("actTypeWrap").hidden = !S.types;
    if (S.types && !S.types.includes(actKind)) actKind = sp === "fb" ? "Training" : S.types[0];
    $("actType").innerHTML = (S.types || []).map((t) => `<label class="chip"><input type="radio" name="actType" value="${esc(t)}"${t === actKind ? " checked" : ""}><span>${esc(typeName(t))}</span></label>`).join("");
    $("actM").placeholder = sp === "fb" ? "90" : sp === "run" ? "30" : "60";
    updateActPreview();
  }
  function openAct(s, sp) {
    actEditing = s || null;
    actKind = s ? s.kind || "" : ""; actRpe = s ? s.rpe || 0 : 0;
    $("actName").value = s ? s.name || "" : "";
    $("actDist").value = s && s.dist ? fmtIn(s.dist) : "";
    const dur = s ? s.dur : 0;
    $("actH").value = dur >= 3600 ? Math.floor(dur / 3600) : ""; $("actM").value = dur ? Math.floor((dur % 3600) / 60) : ""; $("actS").value = dur && dur % 60 ? dur % 60 : "";
    $("actGoals").value = s && s.goals ? s.goals : ""; $("actAssists").value = s && s.assists ? s.assists : "";
    $("actDate").value = s ? s.date : todayISO(); $("actDate").max = todayISO();
    $("actTime").value = s ? s.time || "" : nowTime();
    $("actNote").value = s ? s.note || "" : "";
    $("actRpe").innerHTML = Array.from({ length: 10 }, (_, k) => `<label class="chip"><input type="radio" name="actRpe" value="${k + 1}"${actRpe === k + 1 ? " checked" : ""}><span>${k + 1}</span></label>`).join("");
    $("actErr").textContent = "";
    document.querySelectorAll("#actSportSeg button").forEach((b) => { b.disabled = !!s; });
    const del = $("actDelete"); del.hidden = !s; del.classList.remove("armed"); del.textContent = T("Delete", "Löschen");
    setActSport(s ? s.sport : sp || "run");
    showSheet("actSheet");
  }
  document.querySelectorAll("#actSportSeg [data-sport]").forEach((b) => b.addEventListener("click", () => setActSport(b.dataset.sport)));
  $("actType").addEventListener("change", (ev) => { actKind = ev.target.value; });
  $("actRpe").addEventListener("click", (ev) => { const lab = ev.target.closest("label"), inp = lab && lab.querySelector("input"); if (inp && +inp.value === actRpe && ev.target.tagName !== "INPUT") { ev.preventDefault(); inp.checked = false; actRpe = 0; } });
  $("actRpe").addEventListener("change", (ev) => { actRpe = +ev.target.value; });
  const actDur = () => (parseNum($("actH").value) || 0) * 3600 + (parseNum($("actM").value) || 0) * 60 + ($("actSWrap").hidden ? 0 : parseNum($("actS").value) || 0);
  function updateActPreview() {
    const p = $("actPreview"), dist = parseNum($("actDist").value), dur = actDur();
    if (actSport === "run" && dist > 0 && dur > 0) { p.hidden = false; p.innerHTML = `Pace <b>${paceTxt(dur / dist)}</b> · <b>${nf1.format(dist / (dur / 3600))} km/h</b>`; }
    else if (actSport === "hyrox" && dist > 0 && dur > 0) { p.hidden = false; p.innerHTML = `Ø <b>${paceTxt(dur / dist)}</b> ${esc(T("incl. stations", "inklusive Stationen"))}`; }
    else p.hidden = true;
  }
  $("actForm").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const dist = parseNum($("actDist").value), dur = Math.round(actDur()), sp = actSport;
    const err = (m) => { $("actErr").textContent = m; };
    if (sp === "other" && !$("actName").value.trim()) return err(T("Which sport? E.g. “Cycling”.", "Welche Sportart? Trag z. B. „Radfahren\" ein."));
    if (sp === "run" && !(dist > 0)) return err(T("How far did you run?", "Wie weit bist du gelaufen?"));
    if (dist != null && (dist < 0 || dist > 500)) return err(T("The distance doesn't look right.", "Die Distanz sieht nicht richtig aus."));
    if (!(dur > 0)) return err(T("How long did it take?", "Wie lange hat es gedauert?"));
    if (dur > 24 * 3600) return err(T("The duration doesn't look right.", "Die Dauer sieht nicht richtig aus."));
    const s = {
      id: actEditing ? actEditing.id : newId(), sport: sp, date: $("actDate").value || todayISO(), time: $("actTime").value || "", dur,
      ...(dist > 0 ? { dist: Math.round(dist * 100) / 100 } : {}), ...(SPORTS[sp].types && actKind ? { kind: actKind } : {}), ...(actRpe ? { rpe: actRpe } : {}),
      ...(sp === "other" ? { name: $("actName").value.trim() } : {}), ...(sp === "fb" && parseNum($("actGoals").value) > 0 ? { goals: Math.round(parseNum($("actGoals").value)) } : {}),
      ...(sp === "fb" && parseNum($("actAssists").value) > 0 ? { assists: Math.round(parseNum($("actAssists").value)) } : {}),
      note: $("actNote").value.trim(), created: actEditing ? actEditing.created : new Date().toISOString(), ...(actEditing && actEditing.example ? { example: true } : {})
    };
    db.sessions = db.sessions.filter((x) => x.id !== s.id).concat(s);
    const wasEdit = !!actEditing; persist(); closeSheetsAnimated();
    const top = state.stack[state.stack.length - 1];
    if (!wasEdit && top.v === "hub") go("sport", sp); else render();
    toast(wasEdit ? T("Saved", "Gespeichert") : sp === "run" ? `${T("Run saved", "Lauf gespeichert")} · ${paceTxt(dur / dist)}` : T("Saved", "Gespeichert"));
  });
  $("actDelete").addEventListener("click", () => {
    const s = actEditing, b = $("actDelete"); if (!s) return;
    if (!b.classList.contains("armed")) { b.classList.add("armed"); b.textContent = T("Really delete?", "Wirklich löschen?"); return; }
    db.sessions = db.sessions.filter((x) => x.id !== s.id); persist(); closeSheetsAnimated(); render();
    toast(T("Deleted", "Gelöscht"), { label: T("Undo", "Rückgängig"), fn: () => { db.sessions.push(s); persist(); render(); } });
  });

  /* ---------- Own food (also from the pack or from Open Food Facts) ---------- */
  let foodEditing = null, foodReturn = null, foodOff = null, foodPer = "g", kcalAuto = false;
  const FOOD_NUM = ["Kcal", "F", "Sf", "C", "Su", "Fi", "P", "Sa"], FKEY = { Kcal: "kcal", F: "f", Sf: "sf", C: "c", Su: "su", Fi: "fi", P: "p", Sa: "sa" };
  /* values per 100 g, per 100 ml or per serving – switching converts what's already typed in */
  function setFoodPer(per, convert) {
    const old = foodPer, por = parseNum($("foodPor").value);
    if (convert && por > 0 && old !== per && (old === "por" || per === "por")) {
      const k = per === "por" ? por / 100 : 100 / por;
      for (const id of FOOD_NUM.map((x) => "food" + x).concat("foodKj")) { const el = $(id), v = parseNum(el.value); if (v != null) el.value = fmtIn(id === "foodKcal" || id === "foodKj" ? Math.round(v * k) : Math.round(v * k * 10) / 10); }
    }
    foodPer = per;
    document.querySelectorAll("#foodPerSeg [data-per]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.per === per)));
    const f = $("foodPorField"), dest = per === "por" ? $("foodPorTop") : $("foodPorLow");
    if (f.parentElement !== dest) dest.appendChild(f);
    $("foodPerHint").textContent = per === "por" ? T("Enter the serving size and the values per serving – PFT converts them to 100 g.", "Portionsgröße und die Werte pro Portion eintragen – PFT rechnet auf 100 g um.")
      : per === "ml" ? T("For drinks: values per 100 ml from the label.", "Für Getränke: Werte pro 100 ml von der Nährwerttabelle.") : T("Copy the values from the nutrition label on the pack.", "Übertrage die Werte von der Nährwerttabelle auf der Packung.");
    updateFoodPreview();
  }
  document.querySelectorAll("#foodPerSeg [data-per]").forEach((b) => b.addEventListener("click", () => { setFoodPer(b.dataset.per, true); if (b.dataset.per === "por" && !parseNum($("foodPor").value)) $("foodPor").focus(); }));
  function openFood(id, opts) {
    const x = id ? db.foods.find((f) => f.id === id) : null, base = opts && opts.base, off = opts && opts.off;
    foodEditing = x; foodReturn = (opts && opts.ret) || null; foodOff = off || null; kcalAuto = false;
    $("foodTitle").textContent = x ? T("Edit food", "Lebensmittel bearbeiten") : T("New food", "Neues Lebensmittel");
    const v = x ? { ...x } : off ? { name: off.name.slice(0, 50), brand: off.brand.slice(0, 40), kcal: off.kcal, p: off.p, f: off.f, c: off.c, sf: off.sf, su: off.su, fi: off.fi, sa: off.sa, por: off.pc, pack: off.pack, liq: off.liq }
      : base ? { name: foodName(base), kcal: base.kcal, p: base.p, f: base.f, c: base.c, pc: base.u.pc || base.u.slice || 0, por: base.u.portion || base.u.pot || 0, pack: base.u.pack || 0, liq: isLiq(base) } : { name: (opts && opts.name) || "" };
    const put = (el, val) => { $(el).value = val != null && val !== "" && !(typeof val === "number" && !Number.isFinite(val)) ? fmtIn(val) : ""; };
    $("foodName").value = v.name || ""; $("foodBrand").value = v.brand || "";
    for (const k of FOOD_NUM) put("food" + k, v[FKEY[k]]);
    if (!(+v.kcal > 0)) $("foodKcal").value = "";
    $("foodKj").value = ""; put("foodPc", v.pc || ""); put("foodPor", v.por || ""); put("foodPack", v.pack || "");
    $("foodAlias").value = x ? x.alias || "" : "";
    $("foodCode").value = x ? x.code || x.off || "" : off ? off.code || "" : (opts && opts.code) || "";
    $("foodErr").textContent = "";
    const del = $("foodDelete"); del.hidden = !x; del.classList.remove("armed"); del.textContent = T("Delete", "Löschen");
    $("foodBaseHint").hidden = !base;
    $("foodOffHint").hidden = !off && !(opts && opts.code);
    if (!off && opts && opts.code) $("foodOffHint").textContent = T(`Barcode ${opts.code} – enter the name and the values from the pack. Next time the scanner finds it straight away.`, `Barcode ${opts.code} – Namen und Werte von der Packung eintragen. Beim nächsten Scan wird es direkt gefunden.`);
    if (off) $("foodOffHint").textContent = T(`From Open Food Facts${off.qty ? ` (${off.qty})` : ""} – check the values against your pack, then save.`, `Aus Open Food Facts${off.qty ? ` (${off.qty})` : ""} – Werte mit der Packung vergleichen, dann speichern.`);
    foodPer = "g"; setFoodPer(v.liq ? "ml" : "g", false);
    showSheet("foodSheet");
    if (!x && !base && !off) setTimeout(() => { if (!scanOpen()) $("foodName").focus(); }, 60);
  }
  function updateFoodPreview() {
    const g = (k) => parseNum($("food" + k).value), p = g("P") || 0, f = g("F") || 0, c = g("C") || 0, k = g("Kcal"), calc = Math.round(4 * p + 4 * c + 9 * f);
    const por = parseNum($("foodPor").value), m = foodPer === "por" ? (por > 0 ? 100 / por : null) : 1, unit = foodPer === "ml" ? "ml" : "g";
    let h = `${esc(T("Calculated from protein, fat and carbs", "Aus Eiweiß, Fett und KH berechnet"))}: <b>${nf0.format(calc)} kcal</b>${k ? ` · ${esc(T("entered", "eingetragen"))}: <b>${nf0.format(k)} kcal</b>` : ""}`;
    if (k && calc > 20 && Math.abs(k - calc) / k > 0.25) h += `<br><span class="neg">${esc(T("Quite different – please check the values.", "Weicht stark ab – bitte die Werte prüfen."))}</span>`;
    if (foodPer === "por") h += m ? `<br>${esc(T("Per 100 g", "Pro 100 g"))}: <b>${nf0.format((k || calc) * m)} kcal</b> · ${esc(macroLine1({ p: p * m, f: f * m, c: c * m }))} g` : `<br>${esc(T("Enter the serving size first.", "Zuerst die Portionsgröße eintragen."))}`;
    else if (por > 0 || parseNum($("foodPc").value) > 0) { const w = por > 0 ? por : parseNum($("foodPc").value); h += `<br>${esc(por > 0 ? T("1 serving", "1 Portion") : T("1 piece", "1 Stück"))} (${nf.format(w)} ${unit}): <b>${nf0.format(((k || calc) * w) / 100)} kcal</b> · ${esc(macroLine1({ p: (p * w) / 100, f: (f * w) / 100, c: (c * w) / 100 }))} g`; }
    $("foodPreview").innerHTML = h;
  }
  $("foodForm").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const err = (t) => { $("foodErr").textContent = t; };
    const name = $("foodName").value.trim().replace(/\s+/g, " "), brand = $("foodBrand").value.trim().replace(/\s+/g, " ");
    const num = (id) => parseNum($(id).value), por = num("foodPor"), pc = num("foodPc"), pack = num("foodPack");
    if (!name) { err(T("Give it a name.", "Gib einen Namen ein.")); return; }
    const code = codeDigits($("foodCode").value);
    if (code && !/^\d{8,14}$/.test(code)) { err(T("A barcode has 8 to 14 digits.", "Ein Barcode hat 8 bis 14 Ziffern.")); $("foodCode").focus(); return; }
    const twin = code && foodByCode(code);
    if (twin && (!foodEditing || twin.id !== foodEditing.id)) { err(T(`This barcode is already saved with “${foodName(twin)}”.`, `Dieser Barcode ist schon bei „${foodName(twin)}“ gespeichert.`)); return; }
    if (foodPer === "por" && !(por > 0)) { err(T("Enter how many grams one serving has – or switch to 100 g.", "Trag ein, wie viel Gramm eine Portion hat – oder stell auf 100 g um.")); $("foodPor").focus(); return; }
    const m = foodPer === "por" ? 100 / por : 1, v = {};
    for (const k of FOOD_NUM) { const x = num("food" + k); v[FKEY[k]] = x == null ? null : x * m; }
    const kj = num("foodKj"); if (!(v.kcal > 0) && kj > 0) v.kcal = (kj / 4.184) * m;
    if (v.p == null || v.f == null || v.c == null) { err(T("Enter at least protein, fat and carbs (0 is fine).", "Mindestens Eiweiß, Fett und Kohlenhydrate eintragen (0 ist ok).")); return; }
    if ([v.p, v.f, v.c, v.sf, v.su, v.fi, v.sa].some((x) => x != null && x < 0) || v.p + v.f + v.c > 101) { err(foodPer === "por" ? T("Per 100 g that would be more than 100 g – check the serving size.", "Auf 100 g wären das mehr als 100 g – bitte die Portionsgröße prüfen.") : T("Per 100 g the values can't add up to more than 100 g.", "Pro 100 g können die Werte zusammen nicht mehr als 100 g sein.")); return; }
    if (v.sf != null && v.sf > v.f + 0.05) { err(T("Saturates can't be more than fat.", "Gesättigte Fettsäuren können nicht mehr als Fett sein.")); return; }
    if (v.su != null && v.su > v.c + 0.05) { err(T("Sugars can't be more than carbs.", "Zucker kann nicht mehr als Kohlenhydrate sein.")); return; }
    const off = foodOff, liq = foodPer === "ml" || (foodPer === "por" && !!(foodEditing ? foodEditing.liq : off && off.liq));
    const rec = {
      id: foodEditing ? foodEditing.id : "f" + newId(), name, ...(brand ? { brand } : {}), p: r1(v.p), f: r1(v.f), c: r1(v.c), kcal: v.kcal > 0 ? Math.round(v.kcal) : 0,
      ...Object.fromEntries(["sf", "su", "fi", "sa"].filter((k) => v[k] != null).map((k) => [k, Math.round(v[k] * 100) / 100])),
      pc: pc > 0 ? pc : 0, ...(por > 0 ? { por } : {}), ...(pack > 0 ? { pack } : {}), ...(liq ? { liq: true } : {}), alias: $("foodAlias").value.trim(),
      ...(off && off.code ? { off: off.code } : foodEditing && foodEditing.off ? { off: foodEditing.off } : {}), ...(code ? { code } : {})
    };
    db.foods = db.foods.filter((x) => x.id !== rec.id).concat(rec);
    persist();
    const ret = foodReturn, wasEdit = !!foodEditing; closeSheets();
    if (ret && mealDraft) { applyPickedFood(ret, rec.id); if (state.stack[state.stack.length - 1].v === "meal") { render(); refreshMeal(); } else render(); }
    else render();
    toast(wasEdit ? T("Food saved", "Lebensmittel gespeichert") : ret && mealDraft ? T(`${name} added to the meal`, `${name} in die Mahlzeit übernommen`) : T(`${name} saved – type its name in any meal`, `${name} gespeichert – in jeder Mahlzeit einfach den Namen eintippen`));
  });
  $("foodDelete").addEventListener("click", () => {
    const x = foodEditing, b = $("foodDelete"); if (!x) return;
    if (!b.classList.contains("armed")) { b.classList.add("armed"); b.textContent = T("Really delete?", "Wirklich löschen?"); return; }
    db.foods = db.foods.filter((f) => f.id !== x.id); persist(); closeSheets(); render(); toast(T("Food deleted – saved meals keep their values", "Gelöscht – gespeicherte Mahlzeiten behalten ihre Werte"));
  });

  /* ---------- Pick a food for a meal line: { pend: chunk key } for a line that wasn't recognised, { idx } for a food in the list ---------- */
  let fpick = null;
  function openFoodPick(key) {
    const d = mealDraft; if (!d) return;
    let ctx, title, q;
    if (key[0] === "p" && !(pendParse()[+key.slice(1)] || {}).food) {
      const r = pendParse()[+key.slice(1)]; if (!r) return;
      ctx = { pend: r.key }; title = `„${r.raw}"`; q = r.name || r.raw;
    } else {
      const i = itemIdx(key); if (i == null) return;
      if (key[0] === "p") refreshMeal();
      const it = d.items[i]; ctx = { idx: i }; title = itemName(it); q = itemName(it);
    }
    fpick = ctx;
    $("fpickTitle").textContent = title;
    $("fpickQ").value = q;
    $("fpickDel").hidden = ctx.idx == null;
    renderFoodPick();
    showSheet("fpickSheet");
  }
  function renderFoodPick() {
    const q = $("fpickQ").value.trim(), list = q ? searchFoods(q, 30) : FOODS.slice(0, 30);
    $("fpickList").innerHTML = (list.map((x) => `<button type="button" class="pickrow" data-action="fpick-choose" data-arg="${esc(x.id)}">${badge(foodName(x), x.own ? "#FFE83A" : "#7CF2C9")}<span class="main"><span class="t1">${esc(foodName(x))}${x.own ? ` <span class="tag">${esc(T("Own", "Eigene"))}</span>` : ""}</span><span class="t2">${nf0.format(x.kcal)} kcal · ${esc(macroLine1(x))} g ${esc(T("per 100 g", "pro 100 g"))}</span></span><span></span></button>`).join("") || `<p class="hint" style="padding:14px 0">${esc(T("Nothing found in the app.", "In der App nichts gefunden."))}</p>`)
      + `<div class="offbox" id="fpickOff">${offBlockHTML("pick", q)}</div>`;
  }
  function applyPickedFood(ctx, id) {
    const d = mealDraft, food = FOOD_BY.get(id); if (!d || !food) return;
    if (ctx.add) { commitPending(); const u = food.def, g = u === "g" ? 100 : food.u[u] || 100, it = mkItem(food, u === "g" ? 100 : 1, u, g); it.q0 = it.qty / d.fx; d.items.push(it); return; }
    if (ctx.pend) { d.ov[ctx.pend] = id; return; }
    const old = d.items[ctx.idx]; if (!old) return;
    const it = swapItemFood(old, food); it.q0 = it.qty / d.fx; d.items[ctx.idx] = it;
  }
  function chooseFood(id) {
    if (!mealDraft || !fpick) return;
    applyPickedFood(fpick, id);
    closeSheetsAnimated(); refreshMeal();
  }
  $("fpickNew").addEventListener("click", () => {
    if (!mealDraft || !fpick) return;
    const ctx = fpick, q = $("fpickQ").value.trim(); closeSheets();
    openFood(null, { ret: ctx, name: q });
  });
  $("fpickDel").addEventListener("click", () => {
    if (!mealDraft || !fpick || fpick.idx == null) return;
    const i = fpick.idx; closeSheetsAnimated(); removeItem(i);
  });
  function removeItem(i) {
    const d = mealDraft, it = d && d.items[i]; if (!it) return;
    d.items.splice(i, 1); refreshMeal();
    toast(T(`${itemName(it)} removed`, `${itemName(it)} entfernt`), { label: T("Undo", "Rückgängig"), fn: () => { if (mealDraft !== d) return; d.items.splice(Math.min(i, d.items.length), 0, it); refreshMeal(); } });
  }

  /* ---------- Barcode: scan with the camera or type the number ----------
     Contexts: "foods" (Foods list – open or create the food), "meal" (meal editor – add it),
     "pick" (food picker of a meal line – swap it), "food" (own-food sheet – fill the barcode field).
     Reading uses the browser's BarcodeDetector where it exists (Android, Chrome on Mac) and otherwise
     ZXing (iPhone – Safari has no BarcodeDetector), a file next to index.html that is loaded on first use
     (or a few seconds after start) and then kept offline by the service worker.
     Found codes are looked up in your own foods first, then on Open Food Facts. */
  const ZX_SRC = "zxing.min.js?v=a5740af3";
  const ICON_SCAN = '<svg class="ic" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M7 8v8M10 8v8M12.5 8v8M15 8v8M17 8v8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  const scanBtnHTML = (ctx, cls) => `<button type="button" class="${cls || "scanbtn"}" data-action="scan" data-arg="${ctx}" aria-label="${esc(T("Scan barcode", "Barcode scannen"))}">${ICON_SCAN}</button>`;

  /* digits only; a 12-digit UPC-A is the same product as the 13-digit EAN with a leading 0 */
  const codeDigits = (s) => String(s == null ? "" : s).replace(/[\s-]/g, "");
  const isCodeLike = (s) => /^\d{8,14}$/.test(codeDigits(s));
  const codeKey = (s) => codeDigits(s).replace(/^0+/, "");
  const offCode = (c) => (c.length === 12 ? "0" + c : c);
  /* GTIN check digit (EAN-8, UPC-A, EAN-13, GTIN-14) – an 8-digit UPC-E can't be checked this way, so it passes */
  function codeOk(c) {
    if (!/^\d+$/.test(c) || ![8, 12, 13, 14].includes(c.length)) return /^\d{8,14}$/.test(c);
    let s = 0;
    for (let i = c.length - 2, w = 3; i >= 0; i--, w = 4 - w) s += +c[i] * w;
    return (10 - (s % 10)) % 10 === +c[c.length - 1];
  }
  const foodByCode = (c) => { const k = codeKey(c); return k ? FOODS.find((x) => x.own && x.code && codeKey(x.code) === k) || null : null; };

  let scanSt = null, zxP = null;
  const scanOpen = () => !!scanSt;
  const hasDetector = () => typeof window.BarcodeDetector === "function";
  function loadZxing() {
    if (window.ZXing) return Promise.resolve();
    if (!zxP) zxP = new Promise((res, rej) => {
      const el = document.createElement("script");
      el.src = ZX_SRC; el.async = true;
      el.onload = () => (window.ZXing ? res() : (zxP = null, rej(new Error("ZXing missing"))));
      el.onerror = () => { zxP = null; el.remove(); rej(new Error("load")); };
      document.head.appendChild(el);
    });
    return zxP;
  }
  /* why ZXing didn't load: offline, or the file is not on the server (e.g. not uploaded to GitHub) */
  async function zxWhy() {
    if (navigator.onLine === false) return "offline";
    try {
      const r = await fetch(ZX_SRC.split("?")[0] + "?probe=" + Date.now(), { method: "HEAD", cache: "no-store" });
      return r.status === 404 ? "missing" : r.ok ? "load" : "offline";
    } catch (e) { return "offline"; }
  }
  /* on iPhones: fetch the reader quietly a few seconds after start, so the first scan is quick and works offline */
  function zxPrefetch() {
    if (hasDetector() || window.ZXing || navigator.onLine === false || location.protocol === "file:") return;
    setTimeout(() => { if (!window.ZXing) fetch(ZX_SRC).catch(() => { /* tried again when scanning */ }); }, 6000);
  }
  /* returns a function video → code | null */
  async function scanDecoder() {
    if (hasDetector()) {
      try {
        const have = await window.BarcodeDetector.getSupportedFormats(), want = ["ean_13", "ean_8", "upc_a", "upc_e"].filter((f) => have.includes(f));
        if (want.length) { const det = new window.BarcodeDetector({ formats: want }); return async (v) => { const r = await det.detect(v); return r && r.length ? r[0].rawValue : null; }; }
      } catch (e) { /* fall back to ZXing */ }
    }
    await loadZxing();
    const Z = window.ZXing, hints = new Map(), reader = new Z.MultiFormatReader();
    hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E]);
    hints.set(Z.DecodeHintType.TRY_HARDER, true);
    reader.setHints(hints);
    const cv = document.createElement("canvas"), cx = cv.getContext("2d", { willReadFrequently: true });
    return (v) => {
      const vw = v.videoWidth, vh = v.videoHeight; if (!vw || !vh) return null;
      // the middle of the picture, where the frame is – smaller is faster and ignores other codes nearby
      const sw = Math.round(vw * 0.9), sh = Math.round(vh * (vw > vh ? 0.7 : 0.45)), k = Math.min(1, 900 / sw);
      cv.width = Math.round(sw * k); cv.height = Math.round(sh * k);
      cx.drawImage(v, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, cv.width, cv.height);
      try { return reader.decodeWithState(new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(cv)))).getText(); }
      catch (e) { return null; }
      finally { reader.reset(); }
    };
  }

  function scanUI(msg, opts) {
    const o = opts || {};
    $("scanMsg").textContent = msg || "";
    $("scan").classList.toggle("live", !!o.live);
    $("scan").classList.toggle("nocam", !!o.nocam);
    $("scanErr").textContent = o.err || "";
    $("scanAfter").hidden = !o.after;
    $("scanRetry").hidden = !o.retry;
    $("scanManual").hidden = !!o.noManual;
    $("scanBusy").hidden = !o.busy;
  }
  function scanStop(s) {
    if (!s) return;
    clearTimeout(s.timer); s.timer = 0;
    if (s.stream) { s.stream.getTracks().forEach((t) => { try { t.stop(); } catch (e) { /* already stopped */ } }); s.stream = null; }
    const v = $("scanVideo"); try { v.pause(); } catch (e) { /* not playing */ } v.srcObject = null;
  }
  function openScan(ctx) {
    if (scanSt) closeScan();
    const ret = ctx === "pick" ? fpick : ctx === "meal" ? { add: true } : ctx === "food" ? foodReturn : null;
    if ((ctx === "pick" || ctx === "meal") && !mealDraft) return;
    const s = scanSt = { ctx, ret, done: false, stream: null, timer: 0, decode: null, code: "" };
    $("scanCode").value = "";
    $("scanTitle").textContent = ctx === "food" ? T("Barcode of this food", "Barcode dieses Lebensmittels") : T("Scan barcode", "Barcode scannen");
    $("scanHint").textContent = ctx === "meal" || ctx === "pick" ? T("Hold the barcode inside the frame, about 15–20 cm away – the product goes straight into your meal.", "Halte den Barcode in den Rahmen, etwa 15–20 cm entfernt – das Produkt kommt direkt in deine Mahlzeit.")
      : T("Hold the barcode inside the frame, about 15–20 cm away – it is read by itself.", "Halte den Barcode in den Rahmen, etwa 15–20 cm entfernt – er wird von selbst erkannt.");
    $("scan").hidden = false;
    document.body.classList.add("scanning");
    scanCam(s);
  }
  async function scanCam(s) {
    scanUI(T("Starting the camera …", "Kamera wird gestartet …"), { busy: true });
    const md = navigator.mediaDevices;
    if (!md || typeof md.getUserMedia !== "function") { scanNoCam(s, "nocam"); return; }
    // camera and reader start together: the permission question and the download overlap
    const getCam = () => md.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } } })
      .catch((e) => (e && e.name === "OverconstrainedError" ? md.getUserMedia({ audio: false, video: true }) : Promise.reject(e)));
    let [dec, cam] = await Promise.allSettled([scanDecoder(), getCam()]);
    if (scanSt !== s || s.done) { if (cam.status === "fulfilled") cam.value.getTracks().forEach((t) => t.stop()); return; }
    if (cam.status === "rejected") { const n = cam.reason && cam.reason.name; scanNoCam(s, n === "NotAllowedError" || n === "SecurityError" ? "denied" : "nocam"); return; }
    s.stream = cam.value;
    if (dec.status === "rejected") { // one more try (a dropped connection), then say why
      [dec] = await Promise.allSettled([scanDecoder()]);
      if (scanSt !== s || s.done) { scanStop(s); return; }
      if (dec.status === "rejected") { scanStop(s); scanNoCam(s, await zxWhy()); return; }
    }
    s.decode = dec.value;
    const track = s.stream.getVideoTracks()[0];
    if (track) {
      track.addEventListener("ended", () => { if (scanSt === s && !s.done) { scanStop(s); scanUI(T("The camera was stopped (another app?). Tap “Scan again” or type the number.", "Die Kamera wurde beendet (andere App?). „Neu scannen“ antippen oder die Nummer eintippen."), { nocam: true, after: true, noManual: true }); } });
      try { if (track.getCapabilities && (track.getCapabilities().focusMode || []).includes("continuous")) track.applyConstraints({ advanced: [{ focusMode: "continuous" }] }).catch(() => {}); } catch (e) { /* no focus control */ }
    }
    const v = $("scanVideo");
    v.muted = true; v.defaultMuted = true; v.autoplay = true; v.setAttribute("playsinline", ""); v.setAttribute("webkit-playsinline", "");
    v.srcObject = s.stream;
    // iPhone: play() can hang until the first frame – don't wait for it forever
    await Promise.race([v.play().catch(() => {}), new Promise((r) => setTimeout(r, 1500))]);
    if (scanSt !== s || s.done) { scanStop(s); return; }
    scanUI("", { live: true });
    scanTick(s);
  }
  function scanNoCam(s, why) {
    if (scanSt !== s) return;
    const msg = why === "denied" ? T("No access to the camera. Allow it for PFT (iPhone: Settings › Safari › Camera) – or type the number below.", "Kein Zugriff auf die Kamera. Erlaube ihn für PFT (iPhone: Einstellungen › Safari › Kamera) – oder tippe die Nummer unten ein.")
      : why === "missing" ? T("The barcode reader (file zxing.min.js) is missing on your site – upload it next to index.html. Until then: type the number below.", "Der Barcode-Leser (Datei zxing.min.js) fehlt auf deiner Seite – lade ihn neben index.html hoch. Bis dahin: Nummer unten eintippen.")
      : why === "offline" ? T("The barcode reader is loaded once over the internet – you seem to be offline. Type the number below.", "Der Barcode-Leser wird einmal aus dem Internet geladen – du scheinst offline zu sein. Tippe die Nummer unten ein.")
      : why === "load" ? T("The barcode reader couldn't be started. Close PFT completely, open it again and try once more – or type the number below.", "Der Barcode-Leser ließ sich nicht starten. PFT ganz schließen, neu öffnen und nochmal versuchen – oder die Nummer unten eintippen.")
      : T("No camera available – type the number below.", "Keine Kamera verfügbar – tippe die Nummer unten ein.");
    // "Scan again" after a loading problem (back online, file uploaded …)
    scanUI(msg, { nocam: true, after: why !== "nocam" && why !== "denied", noManual: true });
    setTimeout(() => { if (scanSt === s && !s.done) $("scanCode").focus(); }, 60);
  }
  function scanTick(s) {
    if (scanSt !== s || s.done || !s.decode) return;
    const v = $("scanVideo");
    if (!s.t0) s.t0 = Date.now();
    if (!s.nudged && (v.paused || v.readyState < 2) && Date.now() - s.t0 > 2500) { s.nudged = true; $("scanMsg").textContent = T("Camera picture stays black? Tap it.", "Kamerabild bleibt schwarz? Einmal antippen."); }
    Promise.resolve().then(() => (v.readyState >= 2 ? s.decode(v) : null)).then((raw) => {
      if (scanSt !== s || s.done) return;
      const c = codeDigits(raw || "");
      if (/^\d{8,14}$/.test(c) && codeOk(c)) { scanGot(s, c, true); return; }
      s.timer = setTimeout(() => scanTick(s), 80);
    }, () => { if (scanSt === s && !s.done) s.timer = setTimeout(() => scanTick(s), 300); });
  }
  /* a code from the camera or typed in */
  function scanGot(s, c, fromCam) {
    s.done = true; s.code = c; scanStop(s);
    if (fromCam && navigator.vibrate) { try { navigator.vibrate(40); } catch (e) { /* no vibration */ } }
    $("scanCode").value = c;
    const own = foodByCode(c);
    if (s.ctx === "food") {
      const blank = !foodEditing && !$("foodName").value.trim() && !FOOD_NUM.some((k) => $("food" + k).value.trim());
      if (own && (!foodEditing || own.id !== foodEditing.id)) { closeScan(); $("foodCode").value = c; $("foodErr").textContent = T(`This barcode is already saved with “${foodName(own)}”.`, `Dieser Barcode ist schon bei „${foodName(own)}“ gespeichert.`); return; }
      if (!blank) { closeScan(); $("foodCode").value = c; toast(T("Barcode added", "Barcode übernommen")); return; }
    } else if (own) { scanDone(s, { food: own }); return; }
    scanUI(T(`${c} – searching Open Food Facts …`, `${c} – Suche in Open Food Facts …`), { busy: true });
    offSearch(offCode(c)).then((list) => {
      if (scanSt !== s) return;
      if (list.length) scanDone(s, { off: { ...list[0], code: c } });
      else scanUI(c, { err: T("Open Food Facts doesn't know this product (or has no nutrition values for it). Enter the values from the pack – next time the scanner finds it straight away.", "Open Food Facts kennt dieses Produkt nicht (oder hat keine Nährwerte dazu). Trag die Werte von der Packung ein – beim nächsten Scan wird es direkt gefunden."), after: true, nocam: true });
    }, () => {
      if (scanSt !== s) return;
      scanUI(c, { err: T("Open Food Facts couldn't be reached – are you online? Try again or enter the values from the pack.", "Open Food Facts war nicht erreichbar – bist du online? Nochmal versuchen oder die Werte von der Packung eintragen."), after: true, retry: true, nocam: true });
    });
  }
  function scanDone(s, r) {
    const ctx = s.ctx, ret = s.ret, c = s.code;
    closeScan();
    if (ctx === "food") { if (r.off) openFood(null, { off: r.off, ret }); else $("foodCode").value = c; return; }
    if (ctx === "pick") closeSheets();
    if (r.food) {
      if ((ctx === "meal" || ctx === "pick") && mealDraft) { applyPickedFood(ret || { add: true }, r.food.id); refreshMeal(); toast(T(`${foodName(r.food)} added – check the amount`, `${foodName(r.food)} eingetragen – Menge prüfen`)); }
      else openFood(r.food.id);
      return;
    }
    if (r.off) openFood(null, { off: r.off, ret: ctx === "foods" ? null : ret });
    else openFood(null, { code: c, ret: ctx === "foods" ? null : ret });
  }
  function closeScan() {
    const s = scanSt; if (!s) return;
    scanSt = null; scanStop(s);
    $("scan").hidden = true;
    document.body.classList.remove("scanning");
    const a = document.activeElement; if (a && $("scan").contains(a)) a.blur();
  }
  $("scanClose").addEventListener("click", closeScan);
  // a tap on the picture starts the video if the phone held it back
  document.querySelector(".scan-cam").addEventListener("click", () => {
    const s = scanSt, v = $("scanVideo");
    if (s && s.stream && !s.done) { v.play().catch(() => {}); if (s.nudged && v.readyState >= 2) $("scanMsg").textContent = ""; }
  });
  zxPrefetch();
  $("scanForm").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const s = scanSt; if (!s) return;
    const c = codeDigits($("scanCode").value);
    if (!/^\d{8,14}$/.test(c)) { $("scanErr").textContent = T("A barcode has 8 to 14 digits.", "Ein Barcode hat 8 bis 14 Ziffern."); return; }
    if (!codeOk(c)) { $("scanErr").textContent = T("The last digit doesn't fit – please compare the number with the pack.", "Die letzte Ziffer passt nicht – bitte die Nummer mit der Packung vergleichen."); return; }
    $("scanCode").blur();
    scanGot(s, c, false);
  });
  $("scanRetry").addEventListener("click", () => { const s = scanSt; if (s && s.code) scanGot(s, s.code, false); });
  $("scanManual").addEventListener("click", () => { const s = scanSt; if (s) scanDone(s, {}); });
  $("scanAgain").addEventListener("click", () => { const s = scanSt; if (!s) return; s.done = false; s.code = ""; $("scanCode").value = ""; scanCam(s); });
  document.addEventListener("visibilitychange", () => { if (document.hidden && scanSt && !scanSt.done) closeScan(); });

  /* ---------- Rest timer ---------- */
  let restTimer = 0, actx = null;
  function unlockAudio() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === "suspended") actx.resume(); } catch { actx = null; } }
  function beep() {
    if (!actx || !db.settings.sound) return;
    try { [0, 0.22].forEach((t0) => { const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(actx.destination); const t = actx.currentTime + t0; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18); o.start(t); o.stop(t + 0.2); }); } catch { /* ignore */ }
  }
  const saveRest = () => { try { if (rest) localStorage.setItem(REST_KEY, JSON.stringify(rest)); else localStorage.removeItem(REST_KEY); } catch { /* ignore */ } };
  function startRest(sec) { const total = sec != null ? sec : +db.settings.rest || 0; if (!total) return; rest = { end: Date.now() + total * 1000, total }; saveRest(); tickRest(); $("fab").hidden = true; }
  function stopRest() { rest = null; saveRest(); tickRest(); }
  function tickRest() {
    const bar = $("restbar");
    if (!rest) { bar.hidden = true; bar.classList.remove("over"); document.body.classList.remove("resting"); clearInterval(restTimer); restTimer = 0; const top = state.stack[state.stack.length - 1]; $("fab").hidden = !FAB[top.v]; return; }
    const left = (rest.end - Date.now()) / 1000;
    bar.hidden = false; document.body.classList.add("resting");
    if (left <= 0) {
      if (!rest.rang) { rest.rang = true; saveRest(); try { navigator.vibrate && navigator.vibrate([180, 90, 180]); } catch { /* ignore */ } beep(); }
      bar.classList.add("over"); $("restLabel").textContent = T("Rest over – next set", "Pause vorbei – nächster Satz"); $("restTime").textContent = "+" + clock(-left); $("restProg").style.width = "100%";
      if (-left > 90) { stopRest(); return; }
    } else {
      bar.classList.remove("over"); $("restLabel").textContent = T("Rest", "Pause"); $("restTime").textContent = clock(Math.ceil(left));
      $("restProg").style.width = `${clamp((1 - left / rest.total) * 100, 0, 100).toFixed(1)}%`;
    }
    if (!restTimer) restTimer = setInterval(tickRest, 250);
  }
  setInterval(() => {
    if (!draft || draft.editOf) return;
    const t = clock((Date.now() - draft.start) / 1000);
    const c = $("liveClock"); if (c) c.textContent = t;
    document.querySelectorAll("[data-clock]").forEach((el) => { el.textContent = t; });
  }, 1000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { tickRest(); if (state.stack[state.stack.length - 1].v === "hub") render(); } });

  /* ================= Backup & export ================= */
  function lastBackupDays() { try { const v = localStorage.getItem(BACKUP_KEY); return v ? Math.floor((Date.now() - Date.parse(v)) / 864e5) : null; } catch { return null; } }
  function lastBackupText() { const d = lastBackupDays(); return d == null ? T("never", "noch nie") : d === 0 ? T("today", "heute") : d === 1 ? T("yesterday", "gestern") : T(`${d} days ago`, `vor ${d} Tagen`); }
  async function offer(filename, data) {
    const file = new File([data], filename, { type: filename.endsWith(".csv") ? "text/csv" : "application/json" });
    let ok = false;
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: filename }); ok = true; }
      catch (e) { if (e && e.name === "AbortError") return; }
    }
    if (!ok) { const url = URL.createObjectURL(file), a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); }
    if (filename.includes("backup")) { try { localStorage.setItem(BACKUP_KEY, new Date().toISOString()); } catch { /* ignore */ } render(); }
  }
  function exportJson() { offer(`pft-backup-${todayISO()}.json`, JSON.stringify({ app: "pft", version: 3, appVersion: VERSION, exportedAt: new Date().toISOString(), data: packDb(db) })); }
  function exportCsv() {
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`, num = (v) => (v == null || v === "" ? "" : String(v).replace(".", ","));
    const lines = ["Datum;Uhrzeit;Sportart;Training;Übung;Stufe;Muskelgruppe;Satz;Satzart;Supersatz;Gewicht (kg);Wdh.;Sekunden;e1RM (kg);Dauer (min);Distanz (km);Art;Anstrengung;Notiz"];
    for (const s of derived().asc) {
      const base = [s.date.split("-").reverse().join("."), s.time || "", SPORTS[s.sport].de];
      if (isLift(s)) {
        for (const e of s.ex) { const x = exOf(e.id); let n = 0; e.sets.forEach((st) => { lines.push(base.concat([q(s.name), q(x.de), q(hasLv(x) ? x.lv[lvKey(x, e.lv)][1] : ""), x.group, st.wu ? "A" : st.drop ? "D" : ++n, st.wu ? "Aufwärmen" : st.drop ? "Dropsatz" : "", e.ss ? "ja" : "", num(st.w), st.r || "", st.t || "", x.kind === "kg" && !st.wu && !st.drop ? num(Math.round(e1rmOf(+st.w, +st.r) * 10) / 10) : "", Math.round(s.dur / 60), "", "", "", q(s.note)]).join(";")); }); }
      } else lines.push(base.concat([q(s.name || ""), "", "", "", "", "", "", "", "", "", "", Math.round(s.dur / 60), num(s.dist || ""), q(s.kind || ""), s.rpe || "", q(s.note)]).join(";"));
    }
    lines.push("", "Datum;Uhrzeit;Mahlzeit;Name;Lebensmittel;Menge;Gramm;kcal;Eiweiß (g);Fett (g);Kohlenhydrate (g)");
    for (const m of db.meals.slice().sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")))) {
      for (const it of m.items) lines.push([m.date.split("-").reverse().join("."), m.time || "", q((MEAL_TYPES.find((t) => t[0] === m.type) || MEAL_TYPES[3])[2]), q(m.name || ""), q(it.n), q(amountTxt(it)), num(it.g), num(it.kcal), num(it.p), num(it.f), num(it.c)].join(";"));
    }
    if (db.weights.length) { lines.push("", "Datum;Körpergewicht (kg)"); for (const w of db.weights) lines.push([w.date.split("-").reverse().join("."), num(w.kg)].join(";")); }
    offer(`pft-${todayISO()}.csv`, "﻿" + lines.join("\r\n"));
  }
  /* the weight you entered here wins over the backup's for the same day */
  const mergeWeights = (a, b) => { const m = new Map(b.map((w) => [w.date, w])); for (const w of a) m.set(w.date, w); return [...m.values()].sort((x, y) => x.date.localeCompare(y.date)); };
  async function importBackup(input) {
    const file = input.files && input.files[0]; input.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || parsed.app !== "pft" || !parsed.data) { toast(T("That isn't a PFT backup", "Das ist kein PFT-Backup")); return; }
      const inc = normDb(parsed.data);
      const merge = (a, b) => { const ids = new Set(a.map((x) => x.id)); return a.concat(b.filter((x) => !ids.has(x.id))); };
      const n0 = db.sessions.length, m0 = db.meals.length;
      db.sessions = merge(db.sessions, inc.sessions); db.templates = merge(db.templates, inc.templates); db.exercises = merge(db.exercises, inc.exercises);
      db.meals = merge(db.meals, inc.meals); db.foods = merge(db.foods, inc.foods); db.mealTpls = merge(db.mealTpls, inc.mealTpls);
      db.weights = mergeWeights(db.weights, inc.weights);
      buildFoodIndex(); unpackDb(db); upgradeMeals();
      db.settings = { ...inc.settings, ...db.settings, exOver: { ...inc.settings.exOver, ...db.settings.exOver }, goals: db.settings.goals.kcal || db.settings.goals.p ? db.settings.goals : inc.settings.goals };
      persist(); render();
      toast(T(`${pl(db.sessions.length - n0, "session")} and ${pl(db.meals.length - m0, "meal")} loaded`, `${pl(db.sessions.length - n0, "session")} und ${pl(db.meals.length - m0, "meal")} geladen`));
    } catch { toast(T("The file couldn't be read", "Die Datei konnte nicht gelesen werden")); }
  }

  /* ================= Sample data ================= */
  const SAMPLE_TPL = [
    ["Push", [["x:bench", 3, "6–8"], ["x:db-ohp", 3, "8–10"], ["x:incline-db", 3, "8–12"], ["x:lat-raise", 3, "12–15"], ["x:pushdown", 3, "10–12"]]],
    ["Pull", [["x:deadlift", 3, "5"], ["x:pullup", 3, "6–10"], ["x:bb-row", 3, "8–10"], ["x:face-pull", 3, "12–15"], ["x:db-curl", 3, "10–12"]]],
    [T("Legs", "Beine"), [["x:squat", 3, "5–8"], ["x:rdl", 3, "8–10"], ["x:leg-press", 3, "10–12"], ["x:leg-curl", 3, "10–12"], ["x:calf", 3, "12–15"], ["x:plank", 3, ""]]]
  ];
  function loadSampleTemplates(example) {
    const out = SAMPLE_TPL.map(([name, items]) => ({ id: newId() + name.length, name, items: items.map(([ex, sets, reps]) => ({ ex, sets, reps })), ...(example ? { example: true } : {}) }));
    out.push({ id: newId() + "cs", name: T("Skills", "Skills"), items: [{ ex: "c:handstand", sets: 4, reps: "20–30", lv: 1 }, { ex: "c:front-lever", sets: 4, reps: "8–12", lv: 1 }, { ex: "c:muscle-up", sets: 3, reps: "3–5", lv: 1 }, { ex: "c:lsit", sets: 3, reps: "10–20", lv: 1 }], ...(example ? { example: true } : {}) });
    db.templates = db.templates.concat(out); persist(); return out;
  }
  function loadExamples() {
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const tpls = loadSampleTemplates(true), today = todayISO(), ws = weekStart(today), sessions = [];
    const start = { "x:bench": 70, "x:db-ohp": 18, "x:incline-db": 22, "x:lat-raise": 8, "x:pushdown": 25, "x:deadlift": 110, "x:pullup": 0, "x:bb-row": 60, "x:face-pull": 15, "x:db-curl": 12, "x:squat": 85, "x:rdl": 70, "x:leg-press": 140, "x:leg-curl": 35, "x:calf": 60 };
    const inc = { "x:bench": 1.25, "x:deadlift": 2.5, "x:squat": 2.5, "x:rdl": 1.7, "x:leg-press": 4, "x:bb-row": 1.25 };
    const stamp = new Date().toISOString();
    for (let w = 11; w >= 0; w--) {
      const wk = addDays(ws, -7 * w), prog = 11 - w;
      [[0, 0], [2, 1], [4, 2]].forEach(([day, ti]) => {
        const date = addDays(wk, day); if (date > today || (w === 3 && ti === 2) || (w === 7 && ti === 1)) return;
        const t = tpls[ti];
        const ex = t.items.map((it) => {
          const x = exOf(it.ex), rr = String(it.reps).match(/\d+/g) || ["10"], lo = +rr[0], hi = +(rr[1] || rr[0]);
          const sets = [];
          if (it.ex === "x:bench" || it.ex === "x:squat" || it.ex === "x:deadlift") sets.push({ w: Math.round(start[it.ex] * 0.5 / 2.5) * 2.5, r: 8, wu: 1 });
          for (let k = 0; k < it.sets; k++) {
            if (x.kind === "time") { sets.push({ t: 45 + prog * 3 + Math.round(rnd() * 10) }); continue; }
            if (x.kind === "bw") { sets.push({ w: prog > 8 ? 5 : 0, r: Math.max(4, 6 + Math.floor(prog / 3) - k + (rnd() > 0.6 ? 1 : 0)) }); continue; }
            const base = start[it.ex] || 20, step = inc[it.ex] || 0.6;
            const wt = Math.round((base + step * 2 * Math.floor(prog / 2)) / 1.25) * 1.25;
            sets.push({ w: wt, r: clamp(hi - k - (rnd() > 0.7 ? 1 : 0) + (prog % 3 === 2 ? 1 : 0), lo - 1, hi) });
          }
          return { id: it.ex, sets, tr: it.reps };
        });
        sessions.push({ id: newId() + w + ti, sport: "gym", date, time: "18:" + pad(Math.floor(rnd() * 50)), dur: (55 + Math.floor(rnd() * 25)) * 60, name: t.name, tpl: t.id, ex, note: "", created: stamp, example: true });
      });
      // calisthenics on Saturdays: handstand, front lever, muscle-up, L-sit with slowly rising levels
      { const date = addDays(wk, 5); if (date <= today) {
        const lvH = prog < 5 ? 0 : prog < 9 ? 1 : 2, lvF = prog < 4 ? 0 : prog < 8 ? 1 : 2, lvM = prog < 6 ? 0 : 1, lvL = prog < 3 ? 0 : prog < 8 ? 1 : 2;
        const hold = (lv, base) => Array.from({ length: 3 }, () => ({ t: Math.round(base + (prog % 4) * 4 + rnd() * 6) }));
        const ex = [
          { id: "c:handstand", lv: lvH, sets: hold(lvH, lvH === 2 ? 8 : 25) },
          { id: "c:front-lever", lv: lvF, sets: hold(lvF, lvF === 2 ? 4 : 9) },
          { id: "c:muscle-up", lv: lvM, sets: Array.from({ length: 3 }, (_, k) => ({ w: 0, r: Math.max(1, 3 + (prog % 3) - k) })) },
          { id: "c:lsit", lv: lvL, sets: hold(lvL, 10) },
          { id: "x:dips", sets: Array.from({ length: 3 }, (_, k) => ({ w: 0, r: 10 + Math.floor(prog / 2) - k })) }
        ];
        sessions.push({ id: newId() + "c" + w, sport: "cali", date, time: "10:30", dur: 65 * 60, name: "Skills", tpl: tpls[3].id, ex, note: "", created: stamp, example: true });
      } }
      [[1, 6 + Math.round(rnd() * 3), "Locker"], [6, 9 + Math.round(rnd() * 5), w % 3 === 0 ? "Langer Lauf" : "Tempo"]].forEach(([day, km, kind]) => {
        const date = addDays(wk, day); if (date > today) return;
        const pace = (kind === "Tempo" ? 300 : 340) - prog * 2 + Math.round(rnd() * 12);
        sessions.push({ id: newId() + "r" + w + day, sport: "run", date, time: "07:30", dur: Math.round(pace * km), dist: km, kind, rpe: kind === "Tempo" ? 7 : 4, note: "", created: stamp, example: true });
      });
      if (w % 2 === 0) { const date = addDays(wk, 3); if (date <= today) sessions.push({ id: newId() + "h" + w, sport: "hyrox", date, time: "19:00", dur: w === 4 ? 82 * 60 + 14 : 60 * 60, kind: w === 4 ? "Simulation" : "Training", rpe: w === 4 ? 9 : 7, note: w === 4 ? T("Wall balls at the end were hard", "Wall Balls am Ende hart") : "", created: stamp, example: true }); }
      { const date = addDays(wk, 6); if (date <= today && w % 4 !== 1) sessions.push({ id: newId() + "f" + w, sport: "fb", date, time: "15:00", dur: (w % 2 ? 90 : 75) * 60, kind: w % 2 ? "Spiel" : "Training", ...(w % 2 && rnd() > 0.5 ? { goals: 1 } : {}), ...(w % 2 && rnd() > 0.6 ? { assists: 1 } : {}), rpe: 7, note: "", created: stamp, example: true }); }
    }
    // a week of meals
    const MENU = [
      ["breakfast", "07:45", T("4 eggs, 2 slices wholegrain bread, 1 tbsp butter, 1 banana", "4 Eier, 2 Scheiben Vollkornbrot, 1 EL Butter, 1 Banane")],
      ["breakfast", "07:45", T("80 g oats, 300 ml milk, 1 scoop whey, 1 handful berries", "80 g Haferflocken, 300 ml Milch, 1 Messlöffel Whey, 1 Handvoll Beeren")],
      ["lunch", "12:30", T("200 g chicken breast, 250 g rice, 200 g broccoli, 1 tbsp olive oil", "200 g Hähnchenbrust, 250 g Reis, 200 g Brokkoli, 1 EL Olivenöl")],
      ["lunch", "12:30", T("1 serving pasta, 125 g mince, 1 serving tomato sauce, 1 tbsp parmesan", "1 Portion Nudeln, 125 g Hackfleisch, 1 Portion Tomatensoße, 1 EL Parmesan")],
      ["snack", "16:00", T("1 skyr, 1 handful almonds, 1 apple", "1 Skyr, 1 Handvoll Mandeln, 1 Apfel")],
      ["dinner", "19:30", T("salmon 150 g, 2 potatoes, salad, 1 tbsp olive oil", "Lachs 150 g, 2 Kartoffeln, Salat, 1 EL Olivenöl")],
      ["dinner", "19:30", T("2 wraps, 150 g chicken, 1 avocado, 1 tomato, 30 g cheese", "2 Wraps, 150 g Hähnchen, 1 Avocado, 1 Tomate, 30 g Käse")],
      ["snack", "21:30", T("250 g quark, 1 tsp honey", "250 g Magerquark, 1 TL Honig")]
    ];
    const meals = [];
    for (let d = 6; d >= 0; d--) {
      const date = addDays(today, -d);
      [[0, 1], [2, 3], [4], [5, 6], [7]].forEach((opts, k) => {
        if (d === 0 && k > 2) return;
        const [type, time, text] = MENU[opts[(d + k) % opts.length]];
        const items = parseMeal(text, {}).filter((x) => x.food).map(itemFromParse);
        meals.push({ id: newId() + "m" + d + k, date, time, type, items, example: true });
      });
    }
    // two "My meals" – the porridge with adjustable amounts
    const myMeals = [[T("Porridge", "Porridge"), "breakfast", T("80 g oats, 30 g almonds, 150 ml milk, 20 g honey, half an apple, 1 banana, 40 g peanut butter", "Haferflocken 80g, Mandeln 30g, Milch 150g, Honig 20g, halber Apfel, 1 Banane, Erdnussbutter 40g")],
      [T("Post-workout shake", "Shake nach dem Training"), "snack", T("1 scoop whey, 300 ml milk, 1 banana", "1 Messlöffel Whey, 300 ml Milch, 1 Banane")]]
      .map(([name, type, text], i) => ({ id: newId() + "t" + i, name, type, items: parseMeal(text, {}).filter((x) => x.food).map(itemFromParse), created: today, used: 0, example: true }));
    db.sessions = db.sessions.concat(sessions); db.meals = db.meals.concat(meals); db.mealTpls = db.mealTpls.concat(myMeals); persist(); render();
    toast(T(`${sessions.length} sample sessions and ${meals.length} meals loaded`, `${sessions.length} Beispiel-Einheiten und ${meals.length} Mahlzeiten geladen`));
  }
  function clearExamples() {
    db.sessions = db.sessions.filter((s) => !s.example); db.templates = db.templates.filter((t) => !t.example); db.meals = db.meals.filter((m) => !m.example); db.mealTpls = db.mealTpls.filter((m) => !m.example);
    persist(); render(); toast(T("Sample data removed", "Beispieldaten entfernt"));
  }

  /* ================= Toast ================= */
  let toastTimer;
  function toast(msg, action) {
    const t = $("toast"); t.textContent = "";
    const span = document.createElement("span"); span.textContent = msg; t.appendChild(span);
    if (action) { const b = document.createElement("button"); b.className = "toastbtn"; b.type = "button"; b.textContent = action.label; b.addEventListener("click", () => { t.hidden = true; action.fn(); }); t.appendChild(b); }
    t.style.bottom = rest ? "calc(96px + env(safe-area-inset-bottom, 0px))" : "";
    t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, action ? 7000 : 3000);
  }

  /* ================= Full-screen chart with replay ================= */
  const sim = { playing: false, t: 0, speed: 1, raf: 0, last: 0 };
  const fullChart = () => charts.find((c) => c.id === state.full);
  function drawFull() {
    const c = fullChart(); if (!c) return;
    const n = c.cfg.points.length, landscape = window.innerWidth > window.innerHeight && window.innerHeight < 500;
    const h = landscape ? Math.max(200, window.innerHeight - 40) : Math.max(240, Math.min(520, window.innerHeight - 330));
    drawChart($("fullChart"), { ...c.cfg, height: h, reveal: sim.t >= n - 1 ? null : sim.t, onScrub: (i) => scrubTo(c, i, $("fullVal"), $("fullSub")) });
    $("fullSlider").value = n > 1 ? String(sim.t / (n - 1)) : "1";
    if (sim.playing || sim.t < n - 1) { const i = clamp(Math.round(sim.t), 0, n - 1); scrubTo(c, i, $("fullVal"), $("fullSub")); } else scrubTo(c, null, $("fullVal"), $("fullSub"));
  }
  function renderFull() { const c = fullChart(); if (!c) { closeFull(); return; } $("fullTitle").textContent = c.hero.label; drawFull(); }
  function openFull(id) { const c = charts.find((x) => x.id === id); if (!c) return; state.full = id; sim.t = c.cfg.points.length - 1; $("full").hidden = false; document.body.classList.add("fullmode"); renderFull(); }
  function closeFull() { simPause(); state.full = null; $("full").hidden = true; document.body.classList.remove("fullmode"); }
  const updatePlayBtn = () => { $("fullPlay").textContent = sim.playing ? T("❚❚ Pause", "❚❚ Pause") : T("▶ Replay", "▶ Abspielen"); };
  function simFrame(ts) {
    const c = fullChart(); if (!c || !sim.playing) return;
    const n = c.cfg.points.length, dt = sim.last ? ts - sim.last : 16; sim.last = ts;
    const dur = clamp(n * 220, 2500, 9000) / sim.speed;
    sim.t = Math.min(n - 1, sim.t + (dt / dur) * (n - 1));
    drawFull();
    if (sim.t >= n - 1) { simPause(); drawFull(); return; }
    sim.raf = requestAnimationFrame(simFrame);
  }
  function simPlay() { const c = fullChart(); if (!c) return; const n = c.cfg.points.length; if (sim.t >= n - 1) sim.t = 0; sim.playing = true; sim.last = 0; updatePlayBtn(); sim.raf = requestAnimationFrame(simFrame); }
  function simPause() { sim.playing = false; cancelAnimationFrame(sim.raf); updatePlayBtn(); }
  $("fullSlider").addEventListener("input", (e) => { const c = fullChart(); if (!c) return; simPause(); sim.t = +e.target.value * (c.cfg.points.length - 1); drawFull(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { if (scanOpen()) closeScan(); else if (state.full) closeFull(); else if (sheetOpen()) closeSheetsAnimated(); } });

  /* ================= Gestures (from PFM) ================= */
  const easeOut = "cubic-bezier(.2,.7,.3,1)";
  const vel = (g) => { const n = g.samples.length; if (n < 2) return 0; const a = g.samples[Math.max(0, n - 5)], b = g.samples[n - 1]; return (b.p - a.p) / Math.max(1, b.t - a.t); };
  const sample = (g, p) => { g.samples.push({ p, t: performance.now() }); if (g.samples.length > 8) g.samples.shift(); };
  let gest = null, gRaf = 0;
  const frame = (fn) => { if (!gRaf) gRaf = requestAnimationFrame(() => { gRaf = 0; fn(); }); };
  /* 1. Swipe right to go back – from the left edge (like PFM) or anywhere on the page, the page you came from is visible underneath */
  const NO_SWIPE = "input, textarea, select, .chart, .chiprow, .full, [contenteditable]";
  function backStart() {
    const prev = state.stack[state.stack.length - 2], u = $("under");
    u.innerHTML = prev && prev.snap ? `<div class="app" style="transform:translateY(${-(prev.scroll || 0)}px)"><main class="${esc(prev.snapCls || "view")}">${prev.snap}</main></div><div class="under-dim"></div>` : `<div class="under-dim"></div>`;
    u.hidden = false; document.body.classList.add("swiping"); $("app").classList.add("dragging");
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }
  function backPaint(dx) {
    const W = window.innerWidth, f = Math.min(1, dx / W), app = $("app"), u = $("under"), inner = u.firstElementChild, dim = u.lastElementChild;
    app.style.transform = `translate3d(${dx}px,0,0)`;
    if (inner && inner !== dim) inner.style.translate = `${-0.28 * W * (1 - f)}px 0`;
    dim.style.opacity = String(0.5 * (1 - f));
  }
  function backFinish(go2) {
    const app = $("app"), u = $("under"), W = window.innerWidth, inner = u.firstElementChild, dim = u.lastElementChild;
    app.style.transition = `transform .26s ${easeOut}`; dim.style.transition = `opacity .26s ${easeOut}`;
    if (inner && inner !== dim) inner.style.transition = `translate .26s ${easeOut}`;
    if (go2) { app.style.transform = `translate3d(${W}px,0,0)`; dim.style.opacity = "0"; if (inner && inner !== dim) inner.style.translate = "0 0"; }
    else { app.style.transform = "translate3d(0,0,0)"; dim.style.opacity = "0.5"; if (inner && inner !== dim) inner.style.translate = `${-0.28 * W}px 0`; }
    setTimeout(() => {
      if (go2) { state.enter = false; goBack(); }
      app.style.transition = "none"; app.style.transform = ""; app.classList.remove("dragging");
      u.hidden = true; u.innerHTML = ""; document.body.classList.remove("swiping");
    }, 270);
  }
  /* 2. Pull down on the main menu to get back to the start screen; swipe the start screen up to leave it */
  function splashPaint(y) { $("splash").style.transform = `translate3d(0,${y}px,0)`; }
  function splashShowForPull() { const sp = $("splash"); sp.classList.remove("gone"); sp.classList.add("static", "dragging"); sp.style.transition = "none"; sp.style.opacity = "1"; sp.hidden = false; splashPaint(-window.innerHeight); placeSplash(true); }
  function splashSettle(show) {
    const sp = $("splash"), H = window.innerHeight;
    sp.classList.remove("dragging"); sp.style.transition = `transform .32s ${easeOut}`;
    if (show) { splashPaint(0); splashDone = false; setTimeout(() => { sp.style.transition = ""; sp.style.transform = ""; }, 330); }
    else { splashPaint(-H); splashDone = true; setTimeout(() => { sp.hidden = true; sp.style.transition = ""; sp.style.transform = ""; sp.classList.remove("static"); }, 330); }
  }
  /* 3. Drag a sheet down by its top edge (or anywhere while it is scrolled to the top) to close it */
  function sheetPaint(g) { g.sheet.style.transform = `translate3d(0,${g.d}px,0)`; $("backdrop").style.opacity = String(1 - Math.min(0.85, g.d / (g.sheet.offsetHeight || 1))); }
  document.addEventListener("touchstart", (e) => {
    gest = null;
    if (e.touches.length !== 1 || state.full || scanOpen()) return;
    const t = e.touches[0], base = { x: t.clientX, y: t.clientY, d: 0, active: false, samples: [] };
    const sh = sheetOpen();
    if (sh) {
      if (!sh.contains(e.target)) return;
      const r = sh.getBoundingClientRect(), head = t.clientY - r.top < 64;
      if (!head && (sh.scrollTop > 0 || e.target.closest("input, select, textarea, .chiprow, .chips, .pills"))) return;
      gest = { ...base, kind: "sheet", sheet: sh, head };
      return;
    }
    const sp = $("splash");
    if (!splashDone && !sp.hidden) { gest = { ...base, kind: "splashUp" }; return; }
    if (!splashDone) return;
    if (state.stack.length >= 2) {
      if (t.clientX <= 36) { gest = { ...base, kind: "back", edge: true }; return; }
      // in a workout and in the meal editor only from the left edge – so a swipe between the set rows never leaves by accident
      const topv = state.stack[state.stack.length - 1].v;
      if (topv === "live" || topv === "meal") return;
      if (!e.target.closest(NO_SWIPE)) { gest = { ...base, kind: "back", edge: false }; return; }
    }
    if (state.stack.length === 1 && state.tab === "today" && window.scrollY <= 0 && !e.target.closest("#tabbar")) gest = { ...base, kind: "pull" };
  }, { passive: true });
  document.addEventListener("touchmove", (e) => {
    const g = gest; if (!g) return;
    const t = e.touches[0], dx = t.clientX - g.x, dy = t.clientY - g.y;
    if (!g.active) {
      if (g.kind === "back") {
        if (Math.abs(dy) > 10 && Math.abs(dy) > dx * (g.edge ? 1 : 0.7)) { gest = null; return; }
        if (dx < (g.edge ? 8 : 16)) { if (dx < -10) gest = null; return; }
        g.active = true; g.x = t.clientX - 8; backStart();
      } else {
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) { gest = null; return; }
        const want = g.kind === "splashUp" ? -dy : dy;
        if (want < 6) { if (want < -8) gest = null; return; }
        if (g.kind === "pull" && window.scrollY > 0) { gest = null; return; }
        if (g.kind === "sheet" && !g.head && g.sheet.scrollTop > 0) { gest = null; return; }
        g.active = true; g.y = t.clientY - (want > 0 ? 6 : 0) * Math.sign(dy);
        if (g.kind === "pull") splashShowForPull();
        if (g.kind === "splashUp") $("splash").classList.add("static", "dragging");
        if (g.kind === "sheet") { g.sheet.classList.add("dragging"); g.sheet.style.animation = "none"; g.sheet.style.transition = "none"; $("backdrop").style.transition = "none"; if (document.activeElement && g.sheet.contains(document.activeElement)) document.activeElement.blur(); }
      }
    }
    if (e.cancelable) e.preventDefault();
    if (g.kind === "back") { g.d = Math.max(0, t.clientX - g.x); sample(g, g.d); frame(() => backPaint(g.d)); }
    else if (g.kind === "pull") { g.d = Math.max(0, t.clientY - g.y); sample(g, g.d); frame(() => splashPaint(Math.min(0, g.d - window.innerHeight))); }
    else if (g.kind === "splashUp") { g.d = Math.max(0, g.y - t.clientY); sample(g, g.d); frame(() => splashPaint(-g.d)); }
    else if (g.kind === "sheet") { g.d = Math.max(0, t.clientY - g.y); sample(g, g.d); frame(() => sheetPaint(g)); }
  }, { passive: false });
  function gestEnd(cancel) {
    const g = gest; gest = null;
    if (!g || !g.active) return;
    cancelAnimationFrame(gRaf); gRaf = 0;
    const v = cancel ? 0 : vel(g), W = window.innerWidth, H = window.innerHeight;
    if (g.kind === "back") {
      const go2 = !cancel && (g.d > W * 0.33 || (v > 0.4 && g.d > 30));
      backPaint(g.d);
      if (go2 && leaveNeedsConfirm()) { backFinish(false); setTimeout(askLeave, 280); } else backFinish(go2);
    }
    else if (g.kind === "pull") { splashPaint(Math.min(0, g.d - H)); splashSettle(!cancel && (g.d > H * 0.25 || (v > 0.5 && g.d > 50))); }
    else if (g.kind === "splashUp") { splashPaint(-g.d); splashSettle(!(!cancel && (g.d > H * 0.2 || (v > 0.5 && g.d > 40)))); }
    else if (g.kind === "sheet") {
      const sh = g.sheet; sh.classList.remove("dragging");
      if (!cancel && (g.d > Math.min(160, sh.offsetHeight * 0.3) || (v > 0.5 && g.d > 40))) dismissSheet(sh, g.d);
      else { sh.style.transition = `transform .24s ${easeOut}`; sh.style.transform = "translate3d(0,0,0)"; $("backdrop").style.transition = "opacity .24s"; $("backdrop").style.opacity = "1"; setTimeout(() => { sh.style.transition = ""; }, 260); }
    }
  }
  document.addEventListener("touchend", () => gestEnd(false));
  document.addEventListener("touchcancel", () => gestEnd(true));

  /* ================= Start screen ================= */
  function openMode() { try { const v = localStorage.getItem(OPEN_KEY); return ["splash", "menu", "start"].includes(v) ? v : "splash"; } catch { return "splash"; } }
  let splashDone = false, pendingStart = false;
  /* The quote sits on the dark floor below the chalk cloud */
  function placeSplash(force) {
    const sp = $("splash"); if (!sp || sp.hidden || (splashDone && !force)) return;
    const img = sp.querySelector("img"), W = sp.clientWidth, H = sp.clientHeight;
    if (!W || !H) return;
    const IW = img.naturalWidth || 1200, IH = img.naturalHeight || 1600, WY = IH * (1300 / 1600);
    const sc = Math.max(W / IW, H / IH), rh = IH * sc;
    let off = (H - rh) / 2;
    if (rh > H + 1) { off = Math.min(0, Math.max(H - rh, 0.78 * H - WY * sc)); img.style.objectPosition = `55% ${((off / (H - rh)) * 100).toFixed(1)}%`; }
    else img.style.objectPosition = "55% 50%";
    const baseY = off + WY * sc, bs = getComputedStyle($("splashBottom"));
    const need = $("splashQuote").offsetHeight + $("splashGo").offsetHeight + parseFloat(bs.paddingTop) + parseFloat(bs.paddingBottom) + (parseFloat(bs.rowGap) || 0) + 24;
    sp.style.setProperty("--water", Math.round(Math.min(baseY, H - need)) + "px");
  }
  function hideSplash() {
    if (splashDone) return;
    splashDone = true;
    const sp = $("splash"); sp.style.transition = ""; sp.style.transform = ""; sp.style.opacity = ""; sp.classList.add("gone");
    setTimeout(() => { if (!splashDone) return; sp.hidden = true; sp.classList.remove("static"); }, 650);
  }

  /* ================= Boot: load the data (IndexedDB is asynchronous), then show the app ================= */
  let deep = "";
  async function boot() {
    await load();
    applyStatic();
    /* Deep links (Home Screen shortcuts): #start #live #meal #scan #weight #food #mymeals #progress #body #history #reports #cali #workouts #run #hyrox #fb #more */
    try { deep = (location.hash || "").replace(/^#/, "").toLowerCase(); } catch { deep = ""; }
    const DEEP = ["start", "live", "meal", "scan", "weight", "food", "mymeals", "progress", "body", "history", "reports", "cali", "workouts", "run", "hyrox", "fb", "more", "settings"];
    const into = (t, extra) => { state.tab = t; state.stack = state.stacks[t]; if (extra) state.stack.push(...extra); };
    if (deep === "start" || (!deep && openMode() === "start")) { if (draft) into("train", [{ v: "live" }]); else pendingStart = true; }
    else if (deep === "live" && draft) into("train", [{ v: "live" }]);
    else if (["progress", "body", "history", "reports", "weight"].includes(deep)) { state.progSeg = PROG_SEG[deep === "weight" ? "body" : deep]; into("prog"); }
    else if (deep === "food" || deep === "meal" || deep === "scan") into("food");
    else if (deep === "mymeals") into("food", [{ v: "mymeals" }]);
    else if (deep === "cali") into("train", [{ v: "cali" }]);
    else if (deep === "workouts") into("train");
    else if (["run", "hyrox", "fb"].includes(deep)) into("train", [{ v: "sport", p: deep }]);
    else if (deep === "more" || deep === "settings") into("more");
    if (DEEP.includes(deep) || openMode() !== "splash") { $("splash").hidden = true; splashDone = true; }
    try { if (deep) history.replaceState(null, "", location.pathname + location.search); } catch { /* ignore */ }
    placeSplash();
    $("splash").querySelector("img").addEventListener("load", () => placeSplash());
    window.addEventListener("resize", () => placeSplash());
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => placeSplash());
    $("splash").addEventListener("click", hideSplash);
    $("splash").addEventListener("keydown", (e) => { if (["Enter", " ", "Escape"].includes(e.key)) { e.preventDefault(); hideSplash(); } });
    render();
    if (deep === "meal" || deep === "scan") openMeal(null);
    if (deep === "scan") openScan("meal");
    if (deep === "weight") openWeight();
    tickRest();
  }
  boot().catch((e) => { console.error(e); try { render(); } catch { /* ignore */ } });
