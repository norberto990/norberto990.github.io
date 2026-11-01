/* =====================================================================
   Lista de Animes do Betoro-chan — site
   Dados no Supabase (tabelas works, list_items, comments, profiles).
   ===================================================================== */
"use strict";

/* ---------------- constantes ---------------- */
const KINDS = {
  anime: { label: "Animes", one: "anime", path: "/animes", ph: "Buscar ou adicionar anime…" },
  manga: { label: "Mangás", one: "mangá", path: "/mangas", ph: "Buscar ou adicionar mangá…" },
  novel: { label: "Novels", one: "novel", path: "/novels", ph: "Buscar ou adicionar novel…" },
};
const ST = ["assistindo", "visto", "quero", "dropei"];
const UNIT = { anime: ["Episódios", "ep."], manga: ["Capítulos", "cap."], novel: ["Volumes", "vol."] };
const PAGE = 40;
function stLabel(s, k) {
  const read = k !== "anime";
  return ({ assistindo: read ? "Lendo" : "Assistindo", visto: read ? "Li" : "Vi", quero: read ? "Quero ler" : "Quero ver", dropei: "Dropei" })[s] || s;
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------------- utilidades ---------------- */
const $ = id => document.getElementById(id);
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}
function svg(path) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  for (const [k, v] of Object.entries({ viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2.2", "stroke-linecap": "round", "stroke-linejoin": "round" })) s.setAttribute(k, v);
  s.innerHTML = path; return s;
}
const I_IMG = '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>';
const I_CHAT = '<path d="M4 5h16v11H9l-5 4z"/>';
const I_EDIT = '<path d="M4 20h4L19 9l-4-4L4 16z"/>';
const I_DEL = '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>';
const I_X = '<path d="M6 6l12 12M18 6 6 18"/>';
const norm = t => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const slugify = t => norm(t).replace(/[^a-z0-9 ]/g, "").trim().replace(/ +/g, "-").slice(0, 100) || "obra";
const fmt = n => (Math.round(n * 10) / 10).toLocaleString("pt-BR");
function ago(t) {
  const d = (Date.now() - t) / 1000;
  if (d < 60) return "agora";
  if (d < 3600) return "há " + Math.floor(d / 60) + " min";
  if (d < 86400) return "há " + Math.floor(d / 3600) + " h";
  const dd = Math.floor(d / 86400); if (dd < 30) return "há " + dd + (dd === 1 ? " dia" : " dias");
  const mm = Math.floor(dd / 30); if (mm < 12) return "há " + mm + (mm === 1 ? " mês" : " meses");
  const yy = Math.floor(dd / 365); return "há " + yy + (yy === 1 ? " ano" : " anos");
}
function toast(msg) { const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, 2600); }
function lsGet(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
function errMsg(e) {
  const m = String((e && (e.message || e.error_description)) || e || "");
  if (/Invalid login/i.test(m)) return "E-mail ou senha errados.";
  if (/already registered/i.test(m)) return "Esse e-mail já tem conta. Use “Entrar”.";
  if (/Password should be/i.test(m)) return "A senha precisa ter pelo menos 6 caracteres.";
  if (/Email not confirmed/i.test(m)) return "Confirme seu e-mail antes de entrar (veja sua caixa de entrada).";
  if (/rate limit/i.test(m)) return "Muitas tentativas seguidas. Espere um pouco.";
  if (/duplicate key/i.test(m)) return "Isso já existe.";
  if (/row-level security|permission/i.test(m)) return "Você precisa entrar na sua conta para fazer isso.";
  if (/Failed to fetch|NetworkError/i.test(m)) return "Sem conexão. Verifique a internet.";
  return "Algo deu errado. Tente de novo.";
}

/* ---------------- acesso aos dados ---------------- */
function realApi() {
  const C = window.CONFIG || {};
  if (!C.SUPABASE_URL || /COLE_AQUI/.test(C.SUPABASE_URL)) return null;
  const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
  const ok = r => { if (r.error) throw r.error; return r.data; };
  async function all(table, cols) { // busca tudo, de 1000 em 1000
    let out = [], from = 0;
    for (;;) { const d = ok(await sb.from(table).select(cols || "*").range(from, from + 999)); out = out.concat(d); if (d.length < 1000) return out; from += 1000; }
  }
  return {
    async loadAll() {
      const [works, items, profiles, comments] = await Promise.all([all("works"), all("list_items"), all("profiles"), all("comments", "id,work_id,user_id,created_at")]);
      return { works, items, profiles, comments };
    },
    loadTable: t => all(t, t === "comments" ? "id,work_id,user_id,created_at" : "*"),
    loadComments: async wid => ok(await sb.from("comments").select("*").eq("work_id", wid).order("created_at")),
    insertWork: async w => ok(await sb.from("works").insert(w).select().single()),
    updateWork: async (id, p) => ok(await sb.from("works").update(p).eq("id", id).select().single()),
    upsertItem: async it => ok(await sb.from("list_items").upsert(it).select().single()),
    deleteItem: async (uid, wid) => ok(await sb.from("list_items").delete().eq("user_id", uid).eq("work_id", wid)),
    insertComment: async c => ok(await sb.from("comments").insert(c).select().single()),
    deleteComment: async id => ok(await sb.from("comments").delete().eq("id", id)),
    updateNick: async (uid, nick) => ok(await sb.from("profiles").upsert({ id: uid, nick }).select().single()),
    async upload(uid, blob) {
      const ext = (blob.type.split("/")[1] || "png").replace("jpeg", "jpg");
      const path = uid + "/" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7) + "." + ext;
      ok(await sb.storage.from("imagens").upload(path, blob, { contentType: blob.type, upsert: false }));
      return sb.storage.from("imagens").getPublicUrl(path).data.publicUrl;
    },
    async session() { const { data } = await sb.auth.getSession(); return data.session ? data.session.user : null; },
    onAuth: cb => sb.auth.onAuthStateChange((_e, s) => cb(s ? s.user : null)),
    signIn: async (email, password) => ok(await sb.auth.signInWithPassword({ email, password })),
    signUp: async (email, password, nick) => ok(await sb.auth.signUp({ email, password, options: { data: { nick }, emailRedirectTo: location.origin + "/" } })),
    google: async () => ok(await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + location.pathname } })),
    signOut: async () => { await sb.auth.signOut(); },
    resetPassword: async email => ok(await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + "/" })),
    subscribe(cb) {
      const ch = sb.channel("tudo");
      for (const t of ["works", "list_items", "comments", "profiles"]) ch.on("postgres_changes", { event: "*", schema: "public", table: t }, p => cb(t, p));
      ch.subscribe();
    },
  };
}
const api = window.__MOCK_API || realApi();

/* ---------------- estado ---------------- */
let me = null;                    // usuário logado
let works = new Map();            // id -> obra
let items = [];                   // list_items
let profiles = new Map();         // id -> perfil
let comments = [];                // id, work_id, user_id, created_at (para contar)
let ready = false;
let cat = "anime", mode = "minha", stFilter = "todos", person = "todos", sortBy = "novidades", shown = PAGE;
let route = { view: "home" };
let draft = null, quick = null, delArm = null, suggOpen = false, busy = false, nickEdit = false, flash = null;
let wvTab = "detalhes", wvEdit = false, wvEditImg = null;
let chatWork = null, chatMsgs = [], replyTo = null, chatFile = null, chatBusy = false, chatDel = null, chatFlash = null;
let seen = lsGet("comentariosVistos", {});

const canEdit = () => !!(api && me);
const myId = () => me ? me.id : null;
const itemsOf = uid => items.filter(i => i.user_id === uid);
const myItems = () => me ? itemsOf(me.id) : [];
const myItem = wid => me ? items.find(i => i.user_id === me.id && i.work_id === wid) : null;
const workHref = w => "/" + w.kind + "/" + w.slug;

function stats(wid) {
  const who = items.filter(i => i.work_id === wid);
  const sc = who.map(i => i.score).filter(Boolean);
  return { who, avg: sc.length ? sc.reduce((a, b) => a + b, 0) / sc.length : null, nScores: sc.length };
}
function coverOf(w) {
  if (w.cover_url) return w.cover_url;
  const mine = myItem(w.id); if (mine && mine.image_url) return mine.image_url;
  const any = items.find(i => i.work_id === w.id && i.image_url); return any ? any.image_url : null;
}
const commentCount = wid => comments.reduce((n, c) => n + (c.work_id === wid ? 1 : 0), 0);
function unread(wid) {
  const t = seen[wid] || 0;
  return comments.some(c => c.work_id === wid && c.user_id !== myId() && Date.parse(c.created_at) > t);
}

/* ---------------- pessoas ---------------- */
function pName(uid) {
  const p = profiles.get(uid); const n = p && p.nick ? p.nick.trim() : "";
  return uid === myId() ? (n || "Você") : (n || "Alguém");
}
function colorOf(uid) { let x = 0; for (const c of String(uid)) x = (x * 31 + c.charCodeAt(0)) >>> 0; return "hsl(" + (x % 360) + " 62% 46%)"; }
function avEl(uid) {
  const p = profiles.get(uid);
  if (p && p.avatar_url) { const im = h("img", { src: p.avatar_url, alt: "", class: "ava", referrerpolicy: "no-referrer" }); im.onerror = () => im.replaceWith(initials(uid)); return im; }
  return initials(uid);
}
function initials(uid) { return h("span", { class: "ava", style: "background:" + colorOf(uid), "aria-hidden": "true" }, (pName(uid).replace(/^Você$/, "?")).charAt(0).toUpperCase()); }
function whoChips(who, k, max) {
  const list = who.slice(0, max || who.length);
  const out = list.map(i => h("span", { class: "av s-" + i.status, title: pName(i.user_id) + ": " + stLabel(i.status, k) }, avEl(i.user_id), pName(i.user_id), h("i", {})));
  if (max && who.length > max) out.push(h("span", { class: "av" }, "+" + (who.length - max)));
  return out;
}

/* ---------------- imagens ---------------- */
function coverEl(url, cls) {
  const ph = () => h("div", { class: "cover none " + (cls || ""), "aria-hidden": "true" }, svg(I_IMG));
  if (!url) return ph();
  const im = h("img", { class: "cover " + (cls || ""), src: url, alt: "", loading: "lazy" });
  im.addEventListener("error", () => im.replaceWith(ph()));
  return im;
}
async function shrink(file) {
  if (file.type === "image/gif") return file;
  try {
    const bmp = await createImageBitmap(file);
    const r = Math.min(1, 900 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(bmp.width * r)); c.height = Math.max(1, Math.round(bmp.height * r));
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    let b = await new Promise(res => c.toBlob(res, "image/webp", .84));
    if (!b || b.type !== "image/webp") b = await new Promise(res => c.toBlob(res, "image/jpeg", .86));
    return b || file;
  } catch { return file; }
}
async function uploadImg(file) {
  if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type)) throw new Error("tipo");
  const blob = await shrink(file);
  if (blob.size > 5 * 1024 * 1024) throw new Error("grande");
  return api.upload(me.id, blob);
}
function imgError(e) {
  const m = String(e && e.message);
  return m === "tipo" ? "Formato não aceito. Use PNG, JPG, GIF ou WebP." : m === "grande" ? "Imagem grande demais (máx. 5 MB)." : "Não deu para enviar a imagem. " + errMsg(e);
}
function imgPicker(id, current, onpick, onclear) {
  const input = h("input", { type: "file", id, accept: "image/png,image/jpeg,image/gif,image/webp", hidden: true, onchange: e => { const f = e.target.files && e.target.files[0]; if (f) onpick(f); } });
  const prev = current ? h("img", { class: "cover big", src: current, alt: "Prévia" }) : h("div", { class: "cover big none", "aria-hidden": "true" }, svg(I_IMG));
  return h("div", { class: "imgpick" }, prev,
    h("div", { class: "imgbtns" },
      h("label", { class: "btn alt", for: id }, current ? "Trocar imagem" : "Anexar imagem"), input,
      current && onclear ? h("button", { class: "link", type: "button", onclick: onclear }, "Remover imagem") : null,
      h("small", {}, "Capa, print ou o que quiser. Opcional.")));
}

/* ---------------- busca por semelhança ---------------- */
function grams(s) { const p = "  " + s + " "; const g = new Set(); for (let i = 0; i < p.length - 2; i++) g.add(p.slice(i, i + 3)); return g; }
function tri(a, b) { const A = grams(a), B = grams(b); let n = 0; for (const x of A) if (B.has(x)) n++; return n / (A.size + B.size - n); }
function sim(q, w) {
  const names = [w.title, ...String(w.alt_titles || "").split(/\s*[·,;\/|\n]\s*/)].map(norm).filter(Boolean);
  let best = 0;
  for (const n of names) {
    if (n === q) return 1;
    if (n.startsWith(q)) best = Math.max(best, .92);
    else if (n.includes(q)) best = Math.max(best, .82);
    else {
      const qw = q.split(" ").filter(x => x.length > 1), nw = n.split(" ");
      const hit = qw.filter(x => nw.some(y => y.startsWith(x))).length;
      if (hit && qw.length) best = Math.max(best, .4 + .4 * hit / qw.length);
      if (q.length >= 3) {
        best = Math.max(best, tri(q, n) * 1.15);
        if (qw.length === 1) for (const y of nw) if (y.length >= 4) best = Math.max(best, tri(q, y) * 1.05);
      }
    }
  }
  return best;
}

/* ---------------- ações ---------------- */
async function setItem(w, patch) {
  if (!canEdit()) { openLogin(); return; }
  const old = myItem(w.id);
  const row = { user_id: me.id, work_id: w.id, status: (old && old.status) || "visto", score: old ? old.score : null, progress: old ? old.progress : 0, image_url: old ? old.image_url : null, ...patch, updated_at: new Date().toISOString() };
  if (row.status === "visto" && w.total && !("progress" in patch) && (!old || old.status !== "visto")) row.progress = w.total;
  // atualização otimista
  items = items.filter(i => !(i.user_id === me.id && i.work_id === w.id)).concat([row]);
  flash = w.id; render();
  try { const saved = await api.upsertItem(row); items = items.filter(i => !(i.user_id === me.id && i.work_id === w.id)).concat([saved]); }
  catch (e) { items = items.filter(i => !(i.user_id === me.id && i.work_id === w.id)).concat(old ? [old] : []); render(); toast(errMsg(e)); }
}
async function removeItem(w) {
  const old = myItem(w.id); if (!old) return;
  items = items.filter(i => i !== old); render();
  try { await api.deleteItem(me.id, w.id); toast("Removido: " + w.title); }
  catch (e) { items.push(old); render(); toast(errMsg(e)); }
}
async function createWork(kind, title, alt, cover) {
  let slug = slugify(title), n = 2;
  const taken = new Set([...works.values()].filter(w => w.kind === kind).map(w => w.slug));
  while (taken.has(slug)) slug = slugify(title).slice(0, 95) + "-" + (n++);
  const w = await api.insertWork({ kind, title: title.slice(0, 160), slug, alt_titles: (alt || "").slice(0, 600), cover_url: cover || null, created_by: me.id });
  works.set(w.id, w); return w;
}
function findWork(kind, title) { const k = norm(title); return [...works.values()].find(w => w.kind === kind && norm(w.title) === k); }

/* ---------------- rotas ---------------- */
function parseRoute(path) {
  const p = path.replace(/\/+$/, "") || "/";
  let m;
  if ((m = p.match(/^\/(anime|manga|novel)\/([a-z0-9-]+)$/))) return { view: "work", kind: m[1], slug: m[2] };
  if ((m = p.match(/^\/(animes|mangas|novels)(?:\/(galera|catalogo))?$/))) return { view: "home", kind: m[1].slice(0, -1), mode: m[2] || "minha" };
  return { view: "home", kind: "anime", mode: me ? "minha" : "catalogo" };
}
function go(path, replace) {
  if (replace) history.replaceState(null, "", path); else history.pushState(null, "", path);
  applyRoute(); window.scrollTo({ top: 0 });
}
function applyRoute() {
  route = parseRoute(location.pathname);
  if (route.view === "home") {
    if (route.kind !== cat) { stFilter = "todos"; person = "todos"; shown = PAGE; }
    cat = route.kind; mode = route.mode;
  } else { cat = route.kind; wvTab = "detalhes"; wvEdit = false; wvEditImg = null; }
  closeSearch(); draft = null; renderNew(); render();
}
function homePath() { return KINDS[cat].path + (mode === "minha" ? "" : "/" + mode); }
document.addEventListener("click", e => {
  const a = e.target.closest("a[data-link]");
  if (a && !e.ctrlKey && !e.metaKey && !e.shiftKey && a.origin === location.origin) { e.preventDefault(); go(a.pathname); }
  if (e.target.closest("[data-login]")) openLogin();
});
window.addEventListener("popstate", applyRoute);

/* ---------------- render geral ---------------- */
function render() {
  const keep = {}; for (const el of document.querySelectorAll("#list input:not([type=file]), #wv input:not([type=file]), #wv textarea, #me input")) if (el.id) keep[el.id] = el.value;
  const ae = document.activeElement, fid = ae && ae.id, caret = ae && ae.selectionStart;
  $("app").dataset.cat = cat;
  renderMe(); renderNote();
  const isWork = route.view === "work";
  $("home").hidden = isWork; $("wv").hidden = !isWork; $("app").classList.toggle("wide", isWork);
  if (isWork) renderWork();
  else {
    $("q").placeholder = canEdit() ? KINDS[cat].ph : "Buscar " + KINDS[cat].one + "…";
    $("addbtn").hidden = !canEdit();
    renderCats(); renderSeg(); renderFilters(); renderList(); if (suggOpen) renderSugg();
    document.title = KINDS[cat].label + " · Lista de Animes do Betoro-chan";
  }
  if (chatWork) renderChat(false);
  for (const [id, v] of Object.entries(keep)) { const el = $(id); if (el) el.value = v; }
  if (fid && fid !== "q") { const el = $(fid); if (el && el !== document.activeElement) { el.focus(); try { if (caret != null) el.setSelectionRange(caret, caret); } catch {} } }
  flash = null;
}
function renderNote() {
  $("note").textContent = !api ? "O site ainda não foi ligado ao banco de dados. Preencha o arquivo config.js (veja o passo a passo)." : !ready ? "Carregando…" : "";
}
function renderMe() {
  const box = $("me");
  if (!api) { box.replaceChildren(); return; }
  if (!me) {
    box.replaceChildren(h("span", {}, "Você está só olhando."), h("button", { class: "btn", type: "button", onclick: () => openLogin() }, "Entrar ou criar conta"));
    return;
  }
  if (nickEdit) {
    box.replaceChildren(h("form", { style: "display:flex;gap:8px;flex-wrap:wrap;align-items:center", onsubmit: async e => {
      e.preventDefault(); const v = $("nick").value.trim().slice(0, 40); if (!v) return;
      nickEdit = false;
      try { const p = await api.updateNick(me.id, v); profiles.set(me.id, p); toast("Agora você é " + v); } catch (er) { toast(errMsg(er)); }
      render();
    } }, "Seu nome:", h("input", { id: "nick", maxlength: "40", value: (profiles.get(me.id) || {}).nick || "", placeholder: "Ex.: Betoro" }),
      h("button", { class: "link", type: "submit" }, "Salvar"), h("button", { class: "link", type: "button", onclick: () => { nickEdit = false; render(); } }, "Cancelar")));
    setTimeout(() => { const el = $("nick"); if (el && document.activeElement !== el) el.focus(); });
    return;
  }
  const people = new Set(items.map(i => i.user_id)).size;
  box.replaceChildren(avEl(me.id), "Você aparece como ", h("b", {}, pName(me.id)),
    h("button", { class: "link", type: "button", onclick: () => { nickEdit = true; render(); } }, "trocar nome"),
    h("span", {}, "· " + people + (people === 1 ? " pessoa" : " pessoas") + " na lista ·"),
    h("button", { class: "link", type: "button", onclick: async () => { await api.signOut(); toast("Você saiu."); } }, "Sair"));
}
function renderCats() {
  $("cats").replaceChildren(...Object.entries(KINDS).map(([k, v]) => {
    const n = me ? myItems().filter(i => (works.get(i.work_id) || {}).kind === k).length : [...works.values()].filter(w => w.kind === k).length;
    return h("a", { class: "cat", role: "tab", "data-k": k, "aria-selected": cat === k, href: v.path + (mode === "minha" ? "" : "/" + mode), "data-link": true, style: "text-decoration:none" },
      v.label, h("small", {}, n + (me ? " na sua lista" : " obras")));
  }));
}
function renderSeg() {
  const tabs = [["minha", "Minha lista"], ["galera", "Galera"], ["catalogo", "Catálogo"]].filter(t => me || t[0] !== "minha");
  $("seg").replaceChildren(...tabs.map(([m, l]) => h("a", { role: "tab", "aria-selected": mode === m, href: KINDS[cat].path + (m === "minha" ? "" : "/" + m), "data-link": true, class: "segbtn" }, l)));
}
function renderFilters() {
  const f = $("filters");
  const chip = (pressed, label, onclick, extra) => h("button", { class: "fchip" + (extra || ""), "aria-pressed": pressed, type: "button", onclick }, label);
  if (mode === "minha") {
    const its = myItems().filter(i => (works.get(i.work_id) || {}).kind === cat);
    if (!its.length) { f.replaceChildren(); return; }
    f.replaceChildren(...["todos", ...ST].map(s => {
      const n = s === "todos" ? its.length : its.filter(i => i.status === s).length;
      if (s !== "todos" && !n) return null;
      return chip(stFilter === s, (s === "todos" ? "Todos" : stLabel(s, cat)) + " · " + n, () => { stFilter = s; render(); }, s !== "todos" ? " s-" + s : "");
    }).filter(Boolean));
  } else if (mode === "galera") {
    const ids = [...new Set(items.filter(i => (works.get(i.work_id) || {}).kind === cat).map(i => i.user_id))];
    if (ids.length < 2) { f.replaceChildren(); return; }
    f.replaceChildren(chip(person === "todos", "Todo mundo", () => { person = "todos"; render(); }),
      ...ids.map(id => { const b = chip(person === id, "", () => { person = id; render(); }); b.replaceChildren(avEl(id), pName(id)); return b; }));
  } else {
    f.replaceChildren(...[["novidades", "Novidades"], ["populares", "Mais populares na galera"], ["nota", "Melhor nota"], ["az", "A–Z"]].map(([k, l]) => chip(sortBy === k, l, () => { sortBy = k; shown = PAGE; render(); })));
  }
}
const empty = (title, text) => h("li", { class: "empty" }, h("strong", {}, title), text);

function renderList() {
  const ul = $("list"), more = $("morebox"); more.replaceChildren();
  if (!ready) { ul.replaceChildren(empty("Carregando…", "")); return; }
  const ofCat = [...works.values()].filter(w => w.kind === cat);
  if (mode === "minha") {
    let its = myItems().filter(i => (works.get(i.work_id) || {}).kind === cat);
    const total = its.length;
    if (stFilter !== "todos") its = its.filter(i => i.status === stFilter);
    its.sort((a, b) => ST.indexOf(a.status) - ST.indexOf(b.status) || Date.parse(b.updated_at) - Date.parse(a.updated_at));
    if (!its.length) { ul.replaceChildren(empty(total ? "Nada nesse filtro" : "Nada por aqui ainda", total ? "Troque o filtro acima." : "Use a busca lá em cima, ou veja o Catálogo para marcar o que você já viu.")); return; }
    ul.replaceChildren(...its.map(i => myCard(works.get(i.work_id), i)));
    return;
  }
  let ws;
  if (mode === "galera") {
    ws = ofCat.map(w => ({ w, s: stats(w.id) })).filter(x => x.s.who.length);
    if (person !== "todos") ws = ws.filter(x => x.s.who.some(i => i.user_id === person));
    ws.sort((a, b) => Math.max(...b.s.who.map(i => Date.parse(i.updated_at))) - Math.max(...a.s.who.map(i => Date.parse(i.updated_at))));
    if (!ws.length) { ul.replaceChildren(empty("Ninguém marcou " + KINDS[cat].label.toLowerCase() + " ainda", "Seja o primeiro: use a busca ou o Catálogo.")); return; }
  } else {
    ws = ofCat.map(w => ({ w, s: stats(w.id) }));
    const by = { novidades: (a, b) => Date.parse(b.w.created_at) - Date.parse(a.w.created_at), populares: (a, b) => b.s.who.length - a.s.who.length || (b.s.avg || 0) - (a.s.avg || 0), nota: (a, b) => (b.s.avg ?? -1) - (a.s.avg ?? -1) || b.s.nScores - a.s.nScores, az: (a, b) => a.w.title.localeCompare(b.w.title, "pt-BR") };
    ws.sort(by[sortBy]);
    if (!ws.length) { ul.replaceChildren(empty("O catálogo está vazio", "As novidades chegam todo dia às 9:30. Você também pode adicionar pela busca.")); return; }
  }
  ul.replaceChildren(...ws.slice(0, shown).map(x => workCard(x.w, x.s)));
  if (ws.length > shown) more.replaceChildren(h("button", { class: "btn alt", type: "button", onclick: () => { shown += PAGE; render(); } }, "Mostrar mais (" + (ws.length - shown) + ")"));
}

function chatBtn(w) {
  const n = commentCount(w.id), u = unread(w.id);
  return h("button", { class: "icon chatb" + (u ? " new" : ""), type: "button", title: "Comentários", "aria-label": "Comentários sobre " + w.title + " (" + n + ")", onclick: () => openChat(w) }, svg(I_CHAT), n ? h("span", { class: "cnt" }, n) : null);
}
function notaSelect(id, val, onchange) {
  const s = h("select", { id, class: "nota" + (val ? " has" : ""), "aria-label": "Nota", onchange });
  s.append(h("option", { value: "" }, "★ nota"));
  for (let n = 10; n >= 1; n--) s.append(h("option", { value: n, selected: val === n }, "★ " + n));
  return s;
}
function titleLink(w) { return h("a", { href: workHref(w), "data-link": true, style: "color:inherit;text-decoration:none" }, h("b", {}, w.title)); }
const isNew = w => w.auto && Date.now() - Date.parse(w.created_at) < 3 * 864e5;

function myCard(w, i) {
  if (!w) return null;
  const s = stats(w.id), others = s.who.filter(x => x.user_id !== me.id);
  const kid = w.id.slice(0, 8);
  const ctl = h("div", { class: "c-ctl" },
    (() => { const sel = h("select", { id: "st-" + kid, class: "pill s-" + i.status, "aria-label": "Situação", onchange: e => setItem(w, { status: e.target.value }) });
      ST.forEach(x => sel.append(h("option", { value: x, selected: x === i.status }, stLabel(x, w.kind)))); return sel; })(),
    notaSelect("nt-" + kid, i.score, e => setItem(w, { score: e.target.value ? Number(e.target.value) : null })),
    chatBtn(w),
    h("a", { class: "icon", href: workHref(w), "data-link": true, title: "Abrir página da obra", "aria-label": "Abrir " + w.title }, svg(I_EDIT)),
    delArm === w.id
      ? h("button", { class: "icon warn", type: "button", onclick: () => { delArm = null; removeItem(w); } }, "Remover?")
      : h("button", { class: "icon", type: "button", title: "Tirar da minha lista", "aria-label": "Tirar " + w.title + " da lista", onclick: () => { delArm = w.id; render(); setTimeout(() => { if (delArm === w.id) { delArm = null; render(); } }, 3000); } }, svg(I_DEL)));
  const prog = i.progress ? h("span", { class: "meta" }, UNIT[w.kind][1] + " " + i.progress + (w.total ? " / " + w.total : "")) : null;
  return h("li", { class: "card s-" + i.status + (flash === w.id ? " flash" : "") },
    h("div", { class: "c-top" }, coverEl(i.image_url || coverOf(w)),
      h("div", { class: "c-name" }, titleLink(w), w.alt_titles ? h("small", {}, w.alt_titles) : null, prog,
        others.length ? h("div", { class: "who", style: "margin-top:6px" }, whoChips(others, w.kind, 3)) : null), ctl));
}
function workCard(w, s) {
  const mine = myItem(w.id);
  const card = h("li", { class: "card s-" + (mine ? mine.status : s.who[0] ? s.who[0].status : "quero") + (flash === w.id ? " flash" : "") },
    h("div", { class: "c-top" }, coverEl(coverOf(w)),
      h("div", { class: "c-name" }, titleLink(w),
        h("small", {}, [w.format, w.year, w.status].filter(Boolean).join(" · ") || w.alt_titles || ""),
        isNew(w) ? h("span", { class: "autotag newtag" }, "novo hoje") : null,
        s.who.length ? h("div", { class: "who", style: "margin-top:6px" }, whoChips(s.who, w.kind)) : null),
      h("div", { class: "meta col" }, s.avg != null ? h("span", { class: "score" }, fmt(s.avg)) : null, h("span", {}, s.who.length + (s.who.length === 1 ? " pessoa" : " pessoas")), chatBtn(w))));
  if (mine) card.append(h("div", { class: "meta" }, "Você: ", h("span", { class: "mine-tag s-" + mine.status }, stLabel(mine.status, w.kind)), mine.score ? h("span", { class: "score" }, mine.score) : null));
  else if (canEdit()) {
    if (quick === w.id) card.append(h("div", { class: "sts" }, ST.map(st => h("button", { class: "st s-" + st, type: "button", onclick: () => { quick = null; setItem(w, { status: st }); toast(w.title + ": " + stLabel(st, w.kind)); } }, stLabel(st, w.kind)))));
    else card.append(h("div", {}, h("button", { class: "link", type: "button", onclick: () => { quick = w.id; render(); } }, "+ Marcar na minha lista")));
  }
  return card;
}

/* ---------------- AniList (busca de informações) ---------------- */
const AL_KINDS = {
  anime: { type: "ANIME", formats: ["TV", "TV_SHORT", "MOVIE", "ONA", "OVA", "SPECIAL"] },
  manga: { type: "MANGA", formats: ["MANGA", "ONE_SHOT"] },
  novel: { type: "MANGA", formats: ["NOVEL"] },
};
const AL_FORMAT = { TV: "TV", TV_SHORT: "TV (curto)", MOVIE: "Filme", ONA: "ONA", OVA: "OVA", SPECIAL: "Especial", MANGA: "Mangá", ONE_SHOT: "One-shot", NOVEL: "Light novel" };
const AL_STATUS = { FINISHED: "Finalizado", RELEASING: "Em lançamento", NOT_YET_RELEASED: "Ainda não lançado", CANCELLED: "Cancelado", HIATUS: "Em hiato" };
const AL_SOURCE = { ORIGINAL: "Original", MANGA: "Mangá", LIGHT_NOVEL: "Light novel", WEB_NOVEL: "Web novel", NOVEL: "Novel", VISUAL_NOVEL: "Visual novel", VIDEO_GAME: "Jogo", GAME: "Jogo", WEB_MANGA: "Web mangá", OTHER: "Outro" };
const AL_GENRE = { Action: "Ação", Adventure: "Aventura", Comedy: "Comédia", Drama: "Drama", Ecchi: "Ecchi", Fantasy: "Fantasia", Horror: "Terror", "Mahou Shoujo": "Mahou Shoujo", Mecha: "Mecha", Music: "Música", Mystery: "Mistério", Psychological: "Psicológico", Romance: "Romance", "Sci-Fi": "Ficção científica", "Slice of Life": "Slice of life", Sports: "Esportes", Supernatural: "Sobrenatural", Thriller: "Suspense" };
const AL_FIELDS = `id idMal format status episodes chapters volumes source isAdult
  title { romaji english native } synonyms startDate { year }
  genres coverImage { extraLarge large } description(asHtml: false)
  studios(isMain: true) { nodes { name } }
  staff(perPage: 3, sort: RELEVANCE) { edges { role node { name { full } } } }`;
const alCache = new Map();
async function anilistSearch(q, kind) {
  const key = kind + ":" + norm(q);
  if (alCache.has(key)) return alCache.get(key);
  const k = AL_KINDS[kind];
  const p = fetch("https://graphql.anilist.co", {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: `query($q: String, $type: MediaType, $f: [MediaFormat]) { Page(perPage: 6) { media(search: $q, type: $type, format_in: $f, isAdult: false, sort: SEARCH_MATCH) { ${AL_FIELDS} } } }`, variables: { q, type: k.type, f: k.formats } }),
  }).then(r => r.ok ? r.json() : Promise.reject(new Error("anilist " + r.status)))
    .then(j => ((j.data && j.data.Page && j.data.Page.media) || []).filter(m => !m.isAdult).map(m => alToWork(m, kind)));
  alCache.set(key, p); p.catch(() => alCache.delete(key));
  return p;
}
function alToWork(m, kind) {
  const title = m.title.romaji || m.title.english || m.title.native;
  const alts = [m.title.english, m.title.native, ...(m.synonyms || [])].filter(Boolean).filter((v, i, a) => v !== title && a.indexOf(v) === i);
  let alt = ""; for (const a of alts) { if ((alt + " · " + a).length > 590) break; alt = alt ? alt + " · " + a : a; }
  const author = kind === "anime" ? ((m.studios && m.studios.nodes) || []).map(x => x.name).join(", ")
    : ((m.staff && m.staff.edges) || []).filter(e => /story|original|art/i.test(e.role)).map(e => e.node.name.full).filter((v, i, a) => a.indexOf(v) === i).join(", ");
  const syn = String(m.description || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#039;/g, "'").replace(/\n{3,}/g, "\n\n").trim().slice(0, 5900);
  return {
    kind, title: title.slice(0, 160), alt_titles: alt,
    cover_url: (m.coverImage && (m.coverImage.extraLarge || m.coverImage.large)) || null,
    synopsis: syn, genres: (m.genres || []).map(g => AL_GENRE[g] || g).join(", ").slice(0, 300),
    format: AL_FORMAT[m.format] || m.format || "",
    total: kind === "anime" ? (m.episodes ?? null) : kind === "novel" ? (m.volumes ?? m.chapters ?? null) : (m.chapters ?? null),
    status: AL_STATUS[m.status] || "", year: (m.startDate && m.startDate.year) || null,
    studio: author.slice(0, 200), source: AL_SOURCE[m.source] || "",
    anilist_id: m.id, mal_id: m.idMal ?? null,
  };
}
function alSummary(a) {
  const U = UNIT[a.kind];
  return [a.format, a.year, a.total ? a.total + " " + U[0].toLowerCase() : null, a.status].filter(Boolean).join(" · ");
}
// cria (ou reaproveita) a obra a partir de um resultado do AniList
async function workFromAnilist(a) {
  let w = [...works.values()].find(x => x.anilist_id === a.anilist_id) || findWork(a.kind, a.title);
  if (w) {
    const patch = {}; for (const k of ["cover_url", "synopsis", "genres", "format", "status", "studio", "source", "alt_titles"]) if (!w[k] && a[k]) patch[k] = a[k];
    if (w.total == null && a.total != null) patch.total = a.total;
    if (w.year == null && a.year != null) patch.year = a.year;
    if (Object.keys(patch).length) { w = await api.updateWork(w.id, patch); works.set(w.id, w); }
    return w;
  }
  let slug = slugify(a.title), n = 2;
  const taken = new Set([...works.values()].filter(x => x.kind === a.kind).map(x => x.slug));
  while (taken.has(slug)) slug = slugify(a.title).slice(0, 95) + "-" + (n++);
  w = await api.insertWork({ ...a, slug, created_by: me.id });
  works.set(w.id, w); return w;
}
async function addFromAnilist(a, status) {
  if (!canEdit()) { openLogin(); return; }
  try {
    const w = await workFromAnilist(a);
    if (status) { await setItem(w, { status }); toast(w.title + ": " + stLabel(status, w.kind)); }
    return w;
  } catch (e) { toast(errMsg(e)); }
}
let alQ = "", alRes = null, alErr = false, alT = null;
function queueAnilist(q) {
  const key = cat + "|" + q;
  if (key === alQ) return;
  alQ = key; alRes = null; alErr = false; clearTimeout(alT);
  if (q.length < 2) return;
  alT = setTimeout(async () => {
    const mine = key, kind = cat;
    try { const r = await anilistSearch(q, kind); if (alQ === mine) { alRes = r; if (suggOpen) renderSugg(); } }
    catch { if (alQ === mine) { alErr = true; if (suggOpen) renderSugg(); } }
  }, 450);
}

/* ---------------- busca e sugestões ---------------- */
function renderSugg() {
  const box = $("sugg"), raw = $("q").value, q = norm(raw);
  if (!suggOpen || !q) { box.hidden = true; return; }
  const res = [...works.values()].filter(w => w.kind === cat).map(w => ({ w, sc: sim(q, w) })).filter(x => x.sc >= .34).sort((a, b) => b.sc - a.sc || stats(b.w.id).who.length - stats(a.w.id).who.length).slice(0, 6);
  const exact = res.some(x => x.sc === 1);
  const kids = res.map(({ w }) => {
    const m = myItem(w.id), s = stats(w.id);
    return h("div", { class: "sg" },
      h("div", { class: "sg-head" }, coverEl(coverOf(w), "sm"),
        h("div", { class: "sg-t" }, titleLink(w), h("small", {}, w.alt_titles || [w.format, w.year].filter(Boolean).join(" · "))),
        m ? h("span", { class: "mine-tag s-" + m.status }, "Na sua lista: " + stLabel(m.status, w.kind)) : null),
      s.who.length ? h("div", { class: "who" }, whoChips(s.who, w.kind, 4)) : null,
      canEdit() ? h("div", { class: "sts" }, ST.map(st => h("button", { class: "st s-" + st + (m && m.status === st ? " on" : ""), type: "button", onclick: () => { setItem(w, { status: st }); toast(w.title + ": " + stLabel(st, w.kind)); closeSearch(); } }, stLabel(st, w.kind))),
        h("a", { class: "link", href: workHref(w), "data-link": true }, m ? "Nota e progresso" : "+ nota e progresso")) : null);
  });
  if (!res.length) kids.push(h("p", { class: "hint" }, "Nada parecido no site ainda."));
  queueAnilist(raw.trim());
  const onSite = new Set([...works.values()].map(w => w.anilist_id).filter(Boolean));
  const shownIds = new Set(res.map(x => x.w.anilist_id).filter(Boolean));
  kids.push(h("p", { class: "sg-sec" }, "Encontrado no AniList"));
  if (alErr) kids.push(h("p", { class: "hint" }, "Não deu para buscar no AniList agora."));
  else if (!alRes) kids.push(h("p", { class: "hint" }, "Buscando…"));
  else {
    const al = alRes.filter(a => !shownIds.has(a.anilist_id)).slice(0, 5);
    if (!al.length) kids.push(h("p", { class: "hint" }, "Nada novo encontrado."));
    for (const a of al) kids.push(h("div", { class: "sg" },
      h("div", { class: "sg-head" }, coverEl(a.cover_url, "sm"),
        h("div", { class: "sg-t" }, h("b", {}, a.title), h("small", {}, alSummary(a)), a.alt_titles ? h("small", {}, a.alt_titles) : null),
        onSite.has(a.anilist_id) ? h("span", { class: "autotag" }, "já no site") : null),
      canEdit() ? h("div", { class: "sts" }, ST.map(st => h("button", { class: "st s-" + st, type: "button", onclick: async () => { closeSearch(); await addFromAnilist(a, st); } }, stLabel(st, a.kind))),
        h("button", { class: "link", type: "button", onclick: async () => { closeSearch(); const w = await addFromAnilist(a, null); if (w) go(workHref(w)); } }, "Ver página")) : null));
  }
  if (canEdit() && !exact) kids.push(h("button", { class: "new", type: "button", onclick: () => {
    draft = { t: raw.trim(), sub: "", s: "visto", n: null, k: cat }; closeSearch(); renderNew();
    setTimeout(() => { const el = $("nf-sub"); if (el) el.focus(); });
  } }, "+ Não achei: adicionar “" + raw.trim() + "” à mão"));
  if (!canEdit()) kids.push(h("p", { class: "hint" }, h("button", { class: "link", type: "button", "data-login": true }, "Entre na sua conta"), " para marcar ou adicionar."));
  box.replaceChildren(...kids); box.hidden = false;
}
function closeSearch() { suggOpen = false; $("q").value = ""; $("sugg").hidden = true; }
$("q").addEventListener("input", () => { suggOpen = true; renderSugg(); });
$("q").addEventListener("focus", () => { if ($("q").value) { suggOpen = true; renderSugg(); } });
$("q").addEventListener("keydown", e => { if (e.key === "Escape") { closeSearch(); $("q").blur(); } });
document.addEventListener("pointerdown", e => { if (suggOpen && !$("searchbox").contains(e.target)) { suggOpen = false; $("sugg").hidden = true; } });

/* ---------------- adicionar obra nova ---------------- */
function renderNew() {
  const box = $("newform");
  if (!draft) { box.replaceChildren(); return; }
  const stRow = h("div", { class: "sts" }), kindRow = h("div", { class: "kinds", role: "radiogroup", "aria-label": "Tipo" }), imgBox = h("div", {}), title = h("h2", {});
  const paintImg = () => imgBox.replaceChildren(imgPicker("nf-img", draft.preview || null,
    f => { draft.file = f; draft.preview = URL.createObjectURL(f); paintImg(); },
    () => { draft.file = null; draft.preview = null; paintImg(); }));
  const paint = () => {
    title.textContent = "Novo " + KINDS[draft.k].one;
    if (box.firstChild) box.firstChild.dataset.k = draft.k;
    kindRow.replaceChildren(...Object.entries(KINDS).map(([k, v]) => h("button", { class: "kind", type: "button", role: "radio", "data-k": k, "aria-checked": draft.k === k, onclick: () => { draft.k = k; paint(); } }, cap(v.one))));
    stRow.replaceChildren(...ST.map(s => h("button", { class: "st s-" + s + (draft.s === s ? " on" : ""), type: "button", onclick: () => { draft.s = s; paint(); } }, stLabel(s, draft.k))));
  };
  const save = h("button", { class: "btn", type: "submit" }, "Salvar");
  box.replaceChildren(h("form", { class: "newform", onsubmit: async e => {
    e.preventDefault(); if (busy) return;
    const t = $("nf-t").value.trim(); if (!t) return;
    const kind = draft.k, alt = $("nf-sub").value.trim(), score = $("nf-n").value ? Number($("nf-n").value) : null;
    busy = true; save.disabled = true; save.textContent = "Salvando…";
    try {
      let cover = null; if (draft.file) { save.textContent = "Enviando imagem…"; cover = await uploadImg(draft.file); }
      let w = findWork(kind, t);
      if (!w) w = await createWork(kind, t, alt, cover);
      else if (cover && !w.cover_url) { w = await api.updateWork(w.id, { cover_url: cover }); works.set(w.id, w); }
      const st = draft.s; draft = null; renderNew();
      if (cat !== kind || mode !== "minha") go(KINDS[kind].path);
      await setItem(w, { status: st, score, image_url: cover && w.cover_url !== cover ? cover : (myItem(w.id) || {}).image_url || null });
      toast("Adicionado: " + t + " (" + KINDS[kind].one + ")");
    } catch (er) { toast(String(er && er.message).match(/tipo|grande/) ? imgError(er) : errMsg(er)); save.disabled = false; save.textContent = "Salvar"; }
    busy = false;
  } },
    title,
    h("div", { class: "field" }, "É um…", kindRow),
    h("label", { class: "field" }, "Nome", h("input", { id: "nf-t", value: draft.t, maxlength: "160", required: true })),
    h("label", { class: "field" }, "Subnome (outros nomes da mesma obra)", h("input", { id: "nf-sub", maxlength: "600", placeholder: "Ex.: Sousou no Frieren, 葬送のフリーレン" })),
    imgBox, stRow,
    h("div", { class: "row2" }, notaSelect("nf-n", null, e => e.target.classList.toggle("has", !!e.target.value)),
      h("div", { class: "actions" }, h("button", { class: "btn alt", type: "button", onclick: () => { draft = null; renderNew(); } }, "Cancelar"), save)),
    h("small", { class: "note" }, "Se for uma obra conhecida, a atualização das 9:30 completa a capa, a sinopse e o número de episódios sozinha.")));
  paint(); paintImg();
}
$("addbtn").addEventListener("click", () => {
  if (!canEdit()) { openLogin(); return; }
  draft = { t: $("q").value.trim(), k: cat, s: "visto" }; closeSearch(); renderNew();
  setTimeout(() => { const el = $("nf-t"); if (el) { el.focus(); el.scrollIntoView({ block: "center", behavior: "smooth" }); } });
});

/* ---------------- página da obra ---------------- */
function currentWork() { return [...works.values()].find(w => w.kind === route.kind && w.slug === route.slug); }
function renderWork() {
  const box = $("wv"), w = currentWork();
  if (!w) {
    box.replaceChildren(h("div", { class: "wv-in" }, h("div", { class: "empty" }, h("strong", {}, ready ? "Obra não encontrada" : "Carregando…"),
      ready ? h("a", { href: KINDS[route.kind].path, "data-link": true, class: "link" }, "Voltar para a lista") : "")));
    return;
  }
  document.title = w.title + " · Lista de Animes do Betoro-chan";
  const k = w.kind, U = UNIT[k], s = stats(w.id), mine = myItem(w.id);
  const ofKind = [...works.values()].filter(x => x.kind === k).map(x => ({ x, s: stats(x.id) }));
  const ranked = ofKind.filter(o => o.s.avg != null).sort((a, b) => b.s.avg - a.s.avg || b.s.who.length - a.s.who.length);
  const pop = ofKind.filter(o => o.s.who.length).sort((a, b) => b.s.who.length - a.s.who.length);
  const rank = ranked.findIndex(o => o.x.id === w.id) + 1, popr = pop.findIndex(o => o.x.id === w.id) + 1;
  box.style.setProperty("--wk", "var(--c-" + k + ")");
  const cnt = st => s.who.filter(i => i.status === st).length;
  const cov = coverOf(w);
  const info = [["Tipo", w.format], [U[0], w.total || "?"], ["Situação", w.status], ["Ano", w.year], [k === "anime" ? "Estúdio" : "Autor", w.studio], ["Fonte", w.source], ["Gêneros", w.genres]].filter(x => x[1]);
  const side = h("aside", { class: "wv-side" },
    cov ? h("img", { class: "wv-cover", src: cov, alt: "Capa de " + w.title }) : h("div", { class: "wv-cover" }, svg(I_IMG)),
    w.alt_titles ? h("div", { class: "blk" }, h("h3", {}, "Outros nomes"), h("dl", {}, ...w.alt_titles.split(/\s*[·,]\s*/).filter(Boolean).flatMap(n => [h("dt", {}, "•"), h("dd", {}, n)]))) : null,
    h("div", { class: "blk" }, h("h3", {}, "Informações"), h("dl", {}, ...info.flatMap(([a, b]) => [h("dt", {}, a), h("dd", {}, String(b))]))),
    h("div", { class: "blk" }, h("h3", {}, "Estatísticas da galera"), h("dl", {},
      h("dt", {}, "Nota"), h("dd", {}, s.avg != null ? fmt(s.avg) + " (" + s.nScores + (s.nScores === 1 ? " nota)" : " notas)") : "—"),
      h("dt", {}, "Ranking"), h("dd", {}, rank ? "#" + rank : "—"),
      h("dt", {}, "Popularidade"), h("dd", {}, popr ? "#" + popr : "—"),
      h("dt", {}, "Na lista de"), h("dd", {}, s.who.length + (s.who.length === 1 ? " pessoa" : " pessoas")),
      h("dt", {}, "Comentários"), h("dd", {}, String(commentCount(w.id))))),
    w.anilist_id ? h("div", { class: "blk" }, h("h3", {}, "Links"), h("dl", {},
      h("dt", {}, "•"), h("dd", {}, h("a", { href: "https://anilist.co/" + (k === "anime" ? "anime" : "manga") + "/" + w.anilist_id, target: "_blank", rel: "noopener" }, "AniList")),
      w.mal_id ? h("dt", {}, "•") : null, w.mal_id ? h("dd", {}, h("a", { href: "https://myanimelist.net/" + (k === "anime" ? "anime" : "manga") + "/" + w.mal_id, target: "_blank", rel: "noopener" }, "MyAnimeList")) : null)) : null);

  const score = h("div", { class: "scorebox" },
    h("div", { class: "sc-main" }, h("small", {}, "Nota"), h("b", {}, s.avg != null ? fmt(s.avg) : "—"), h("span", {}, s.nScores + (s.nScores === 1 ? " nota" : " notas"))),
    h("div", { class: "sc-stats" },
      h("div", {}, h("small", {}, "Ranking"), h("b", {}, rank ? "#" + rank : "—")),
      h("div", {}, h("small", {}, "Popularidade"), h("b", {}, popr ? "#" + popr : "—")),
      h("div", {}, h("small", {}, "Membros"), h("b", {}, s.who.length)),
      h("div", {}, h("small", {}, stLabel("visto", k)), h("b", {}, cnt("visto")))));

  let mineBox;
  if (canEdit()) {
    const ep = mine ? mine.progress || 0 : 0;
    const setEp = n => { n = Math.max(0, w.total ? Math.min(w.total, n) : n); const p = { progress: n };
      if (w.total && n >= w.total) { p.status = "visto"; toast("Terminou! Marcado como " + stLabel("visto", k)); }
      else if (n > 0 && (!mine || mine.status === "quero")) p.status = "assistindo";
      setItem(w, p); };
    mineBox = h("div", { class: "mine-box" }, h("h3", {}, mine ? "Na sua lista" : "Adicionar à minha lista"),
      h("div", { class: "sts" }, ST.map(st => h("button", { class: "st s-" + st + (mine && mine.status === st ? " on" : ""), type: "button", onclick: () => { setItem(w, { status: st }); toast(w.title + ": " + stLabel(st, k)); } }, stLabel(st, k)))),
      mine ? h("div", { class: "prog" }, notaSelect("wv-nota", mine.score, e => setItem(w, { score: e.target.value ? Number(e.target.value) : null })),
        h("span", {}, U[0] + ":"), h("input", { id: "wv-ep", type: "number", min: "0", value: ep, "aria-label": U[0], onchange: e => setEp(Number(e.target.value) || 0) }),
        h("span", {}, "/ " + (w.total || "?")), h("button", { type: "button", onclick: () => setEp(ep + 1) }, "+1"),
        w.total ? h("div", { class: "bar-p" }, h("i", { style: "width:" + Math.min(100, ep / w.total * 100) + "%" })) : null) : null,
      mine ? h("div", {}, delArm === "wv" ? h("button", { class: "link", type: "button", style: "color:var(--s-dropei)", onclick: () => { delArm = null; removeItem(w); } }, "Tirar mesmo?")
        : h("button", { class: "link", type: "button", onclick: () => { delArm = "wv"; render(); setTimeout(() => { if (delArm === "wv") { delArm = null; render(); } }, 3000); } }, "Tirar da minha lista")) : null);
  } else mineBox = h("div", { class: "mine-box" }, h("h3", {}, "Quer marcar esta obra?"), h("div", {}, h("button", { class: "btn", type: "button", "data-login": true }, "Entrar ou criar conta")));

  const tabs = h("nav", { class: "wv-tabs" }, [["detalhes", "Detalhes"], ["galera", "Galera (" + s.who.length + ")"], ["stats", "Estatísticas"], ["coment", "Comentários (" + commentCount(w.id) + ")"]].map(([id, l]) =>
    h("button", { type: "button", "aria-selected": wvTab === id, onclick: () => { if (id === "coment") { openChat(w); return; } wvTab = id; render(); } }, l)));

  let body;
  if (wvTab === "detalhes") {
    body = [score, mineBox,
      h("div", { class: "syn" }, h("h3", {}, "Sinopse"), h("p", {}, w.synopsis || "Ainda não tem sinopse." + (canEdit() ? " Você pode escrever uma em “Editar informações”." : ""))),
      w.genres ? h("div", { class: "chips" }, w.genres.split(/\s*,\s*/).map(g => h("span", {}, g))) : null,
      canEdit() ? h("div", {}, h("button", { class: "link", type: "button", onclick: () => { wvEdit = !wvEdit; wvEditImg = null; render(); } }, wvEdit ? "Fechar edição" : "Editar informações")) : null,
      wvEdit && canEdit() ? editForm(w, U) : null,
      canEdit() && !w.anilist_id ? alLinkBox(w) : null,
      w.auto ? h("p", { class: "note" }, "Informações trazidas do AniList pela atualização diária. Qualquer pessoa logada pode corrigir.") : null];
  } else if (wvTab === "galera") {
    const ws2 = [...s.who].sort((a, b) => ST.indexOf(a.status) - ST.indexOf(b.status));
    body = [ws2.length ? h("ul", { class: "gl" }, ws2.map(i => h("li", {}, avEl(i.user_id), h("b", {}, pName(i.user_id)),
      h("span", { class: "mine-tag s-" + i.status }, stLabel(i.status, k) + (i.progress ? " · " + U[1] + " " + i.progress : "")),
      i.score ? h("span", { class: "score" }, i.score) : h("span", { class: "meta" }, "—"))))
      : h("div", { class: "empty" }, h("strong", {}, "Ninguém marcou ainda"), "Seja o primeiro.")];
  } else {
    const d = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(n => [n, s.who.filter(i => i.score === n).length]); const mx = Math.max(1, ...d.map(x => x[1]));
    body = [h("div", { class: "scorebox" }, ...ST.map(st => h("div", { class: "sc-stats", style: "flex:0 0 auto" }, h("div", {}, h("small", {}, stLabel(st, k)), h("b", {}, cnt(st)))))),
      h("div", { class: "dist", "aria-label": "Distribuição das notas" }, h("h3", { style: "margin:0 0 6px;font-size:15px" }, "Distribuição das notas"),
        ...d.map(([n, c]) => h("div", {}, h("span", {}, "★" + n), h("span", {}, h("i", { style: "width:" + (c / mx * 100) + "%" })), h("span", {}, c))))];
  }
  box.replaceChildren(h("div", { class: "wv-in" },
    h("div", { class: "wv-top" }, h("a", { class: "wv-back", href: homePath(), "data-link": true, style: "text-decoration:none" }, "← " + KINDS[k].label)),
    h("header", { class: "wv-title" }, h("h1", {}, w.title), h("p", {}, cap(KINDS[k].one) + (w.alt_titles ? " · " + w.alt_titles : ""))),
    tabs, h("div", { class: "wv-grid" }, side, h("main", { style: "display:flex;flex-direction:column;gap:14px;min-width:0" }, ...body))));
}
let alLink = null; // { wid, res, err }
function alLinkBox(w) {
  const st = alLink && alLink.wid === w.id ? alLink : null;
  const box = h("div", { class: "syn" }, h("h3", {}, "Completar informações"));
  if (!st) {
    box.append(h("p", { class: "note", style: "margin:0 0 8px" }, "Busca capa, sinopse, ano, episódios ou capítulos e gêneros no AniList. Só preenche o que estiver vazio."),
      h("button", { class: "btn", type: "button", style: "background:var(--wk)", onclick: async () => {
        alLink = { wid: w.id, res: null }; render();
        try { alLink.res = await anilistSearch(w.title, w.kind); } catch { alLink.err = true; }
        render();
      } }, "Buscar no AniList"));
    return box;
  }
  if (st.err) { box.append(h("p", { class: "hint" }, "Não deu para buscar no AniList agora. Tente de novo mais tarde.")); return box; }
  if (!st.res) { box.append(h("p", { class: "hint" }, "Buscando…")); return box; }
  if (!st.res.length) { box.append(h("p", { class: "hint" }, "Não encontrei. Confira se o nome está certo em “Editar informações”.")); return box; }
  box.append(h("p", { class: "note", style: "margin:0 0 8px" }, "Qual destes é a obra?"));
  for (const a of st.res.slice(0, 5)) box.append(h("div", { class: "sg", style: "padding:10px 0" },
    h("div", { class: "sg-head" }, coverEl(a.cover_url, "sm"), h("div", { class: "sg-t" }, h("b", {}, a.title), h("small", {}, alSummary(a))),
      h("button", { class: "btn alt", type: "button", onclick: async () => {
        const patch = {}; for (const k of ["cover_url", "synopsis", "genres", "format", "status", "studio", "source"]) if (!w[k] && a[k]) patch[k] = a[k];
        if (w.total == null && a.total != null) patch.total = a.total;
        if (w.year == null && a.year != null) patch.year = a.year;
        const extra = [a.title, ...String(a.alt_titles || "").split(" · ")].filter(x => x && norm(x) !== norm(w.title) && !norm(w.alt_titles).includes(norm(x)));
        if (extra.length) patch.alt_titles = [w.alt_titles, ...extra].filter(Boolean).join(" · ").slice(0, 600);
        try { const nw = await api.updateWork(w.id, patch); works.set(nw.id, nw); alLink = null; toast("Informações completadas!"); render(); } catch (e) { toast(errMsg(e)); }
      } }, "É este"))));
  box.append(h("button", { class: "link", type: "button", onclick: () => { alLink = null; render(); } }, "Cancelar"));
  return box;
}
function editForm(w, U) {
  const f = (id, label, v, cls, type) => h("label", { class: "field" + (cls ? " " + cls : "") }, label, h("input", { id: "we-" + id, value: v ?? "", type: type || "text" }));
  const cur = wvEditImg ? wvEditImg.url : coverOf(w);
  const save = h("button", { class: "btn", type: "submit", style: "background:var(--wk)" }, "Salvar");
  return h("form", { class: "wv-edit", onsubmit: async e => {
    e.preventDefault(); if (busy) return;
    const g = id => $("we-" + id).value.trim();
    const title = g("title"); if (!title) return;
    const patch = { title, alt_titles: g("alt"), format: g("tipo"), total: g("total") ? Math.max(0, Number(g("total")) || 0) : null, status: g("situ"), year: g("ano") ? Number(g("ano")) || null : null, studio: g("estudio"), source: g("fonte"), genres: g("generos"), synopsis: $("we-syn").value.trim() };
    busy = true; save.disabled = true; save.textContent = "Salvando…";
    try {
      if (wvEditImg && wvEditImg.file) patch.cover_url = await uploadImg(wvEditImg.file);
      const nw = await api.updateWork(w.id, patch); works.set(nw.id, nw); wvEdit = false; wvEditImg = null; toast("Informações salvas");
    } catch (er) { toast(String(er && er.message).match(/tipo|grande/) ? imgError(er) : errMsg(er)); }
    busy = false; render();
  } },
    h("div", { class: "full" }, imgPicker("we-img", cur, file => { wvEditImg = { file, url: URL.createObjectURL(file) }; render(); }, null)),
    f("title", "Nome", w.title, "full"), f("alt", "Outros nomes (separados por vírgula)", w.alt_titles, "full"),
    f("tipo", "Tipo (TV, Filme, Manhwa…)", w.format), f("total", "Total de " + U[0].toLowerCase(), w.total, "", "number"),
    f("situ", "Situação", w.status), f("ano", "Ano", w.year, "", "number"),
    f("estudio", w.kind === "anime" ? "Estúdio" : "Autor", w.studio), f("fonte", "Fonte", w.source),
    f("generos", "Gêneros (separados por vírgula)", w.genres, "full"),
    h("label", { class: "field full" }, "Sinopse", h("textarea", { id: "we-syn" }, w.synopsis || "")),
    h("div", { class: "actions full" }, h("button", { class: "btn alt", type: "button", onclick: () => { wvEdit = false; wvEditImg = null; render(); } }, "Cancelar"), save));
}

/* ---------------- comentários ---------------- */
async function openChat(w) {
  chatWork = w; replyTo = null; chatDel = null; chatMsgs = null;
  $("sheet").hidden = false; $("sheetbg").hidden = false; document.body.style.overflow = "hidden";
  $("composer").hidden = !canEdit(); $("sheetro").hidden = canEdit();
  renderChat(true); paintComposer();
  await loadChat(true);
}
async function loadChat(scrollEnd) {
  if (!chatWork) return;
  const wid = chatWork.id;
  try { const rows = await api.loadComments(wid); if (!chatWork || chatWork.id !== wid) return; chatMsgs = rows; }
  catch (e) { chatMsgs = chatMsgs || []; toast(errMsg(e)); }
  renderChat(scrollEnd);
}
function closeChat() { chatWork = null; replyTo = null; $("sheet").hidden = true; $("sheetbg").hidden = true; document.body.style.overflow = ""; render(); }
function msgEl(m, isReply) {
  const mine = m.user_id === myId();
  const text = h("p", { class: "m-text" + (m.gone ? " gone" : "") });
  if (m.gone) text.textContent = "Mensagem apagada";
  else { if (m.reply_to_user && isReply) text.append(h("span", { class: "at" }, "@" + pName(m.reply_to_user) + " ")); text.append(m.body || ""); }
  const act = h("div", { class: "m-act" });
  if (canEdit() && !m.gone) act.append(h("button", { type: "button", onclick: () => { replyTo = { root: m.parent_id || m.id, uid: m.user_id }; paintComposer(); $("cmsg").focus(); } }, "Responder"));
  if (mine && !m.gone) act.append(chatDel === m.id
    ? h("button", { class: "danger", type: "button", onclick: () => delMsg(m) }, "Apagar mesmo?")
    : h("button", { type: "button", onclick: () => { chatDel = m.id; renderChat(); setTimeout(() => { if (chatDel === m.id) { chatDel = null; renderChat(); } }, 3000); } }, "Apagar"));
  const t = Date.parse(m.created_at);
  return h("div", { class: "msg" + (mine ? " mine" : "") + (chatFlash === m.id ? " flash" : "") },
    m.gone ? h("span", { class: "ava", style: "background:var(--line)" }, "") : avEl(m.user_id),
    h("div", {}, h("div", { class: "m-head" }, h("b", {}, m.gone ? "—" : pName(m.user_id)), t ? h("time", { datetime: m.created_at, title: new Date(t).toLocaleString("pt-BR") }, ago(t)) : null),
      text, m.image_url ? (() => { const im = h("img", { class: "m-img", src: m.image_url, alt: "Imagem enviada", loading: "lazy" }); im.addEventListener("error", () => im.remove()); return im; })() : null,
      act.childNodes.length ? act : null));
}
function renderChat(scrollEnd) {
  if (!chatWork) return;
  const w = works.get(chatWork.id) || chatWork, box = $("chat");
  const msgs = chatMsgs || [];
  if (msgs.length) { const mx = Math.max(...msgs.map(m => Date.parse(m.created_at))); if (mx > (seen[w.id] || 0)) { seen[w.id] = mx; lsSet("comentariosVistos", seen); } }
  $("sheethead").replaceChildren(coverEl(coverOf(w)),
    h("div", {}, h("h2", { id: "sheet-title" }, w.title),
      h("small", {}, h("span", { class: "kindtag", style: "--kc:var(--c-" + w.kind + ")" }, KINDS[w.kind].one), " · " + msgs.length + (msgs.length === 1 ? " comentário" : " comentários"))),
    h("button", { class: "icon", type: "button", "aria-label": "Fechar", onclick: closeChat }, svg(I_X)));
  if (chatMsgs === null) { box.replaceChildren(h("div", { class: "empty" }, h("strong", {}, "Carregando…"), "")); return; }
  const roots = new Map(), reps = new Map();
  for (const m of msgs) { if (m.parent_id) { if (!reps.has(m.parent_id)) reps.set(m.parent_id, []); reps.get(m.parent_id).push(m); } else roots.set(m.id, m); }
  for (const id of reps.keys()) if (!roots.has(id)) roots.set(id, { id, gone: true, created_at: reps.get(id)[0].created_at });
  const threads = [...roots.values()].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const nearEnd = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  if (!threads.length) { box.replaceChildren(h("div", { class: "empty" }, h("strong", {}, "Nenhum comentário ainda"), canEdit() ? "Seja o primeiro a comentar sobre " + w.title + "." : "Quando alguém comentar, aparece aqui.")); return; }
  box.replaceChildren(...threads.map(r => h("article", { class: "thread" }, msgEl(r, false),
    reps.has(r.id) ? h("div", { class: "replies" }, reps.get(r.id).map(x => msgEl(x, true))) : null)));
  if (scrollEnd || nearEnd) box.scrollTop = box.scrollHeight;
}
async function delMsg(m) {
  chatDel = null;
  try { await api.deleteComment(m.id); chatMsgs = chatMsgs.filter(x => x.id !== m.id); comments = comments.filter(x => x.id !== m.id); renderChat(); render(); toast("Mensagem apagada"); }
  catch (e) { toast(errMsg(e)); }
}
function paintComposer() {
  const r = $("replying");
  if (replyTo) { r.hidden = false; r.replaceChildren("Respondendo a ", h("b", {}, pName(replyTo.uid)), h("button", { type: "button", onclick: () => { replyTo = null; paintComposer(); } }, "✕ cancelar")); }
  else r.hidden = true;
  const p = $("cpreview");
  if (chatFile) { p.hidden = false; p.replaceChildren(h("img", { src: chatFile.url, alt: "Prévia" }), "Imagem anexada", h("button", { type: "button", onclick: () => { chatFile = null; $("cimg").value = ""; paintComposer(); } }, "✕ remover")); }
  else p.hidden = true;
  $("csend").disabled = chatBusy || (!$("cmsg").value.trim() && !chatFile);
}
function autosize() { const t = $("cmsg"); t.style.height = "auto"; t.style.height = Math.min(140, t.scrollHeight) + "px"; }
$("cmsg").addEventListener("input", () => { autosize(); paintComposer(); });
$("cmsg").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing && window.matchMedia("(pointer:fine)").matches) { e.preventDefault(); $("composer").requestSubmit(); } });
$("cimg").addEventListener("change", e => { const f = e.target.files && e.target.files[0]; if (f) { chatFile = { file: f, url: URL.createObjectURL(f) }; paintComposer(); } });
$("composer").addEventListener("submit", async e => {
  e.preventDefault(); if (chatBusy || !canEdit() || !chatWork) return;
  const body = $("cmsg").value.trim().slice(0, 1000);
  if (!body && !chatFile) return;
  chatBusy = true; paintComposer();
  try {
    const image_url = chatFile ? await uploadImg(chatFile.file) : null;
    const row = await api.insertComment({ work_id: chatWork.id, user_id: me.id, body, image_url, parent_id: replyTo ? replyTo.root : null, reply_to_user: replyTo ? replyTo.uid : null });
    const wasReply = !!replyTo;
    $("cmsg").value = ""; autosize(); chatFile = null; $("cimg").value = ""; replyTo = null;
    chatMsgs = (chatMsgs || []).filter(m => m.id !== row.id).concat([row]); chatFlash = row.id;
    if (!comments.some(c => c.id === row.id)) comments.push({ id: row.id, work_id: row.work_id, user_id: row.user_id, created_at: row.created_at });
    renderChat(!wasReply); render(); setTimeout(() => { chatFlash = null; }, 600);
  } catch (er) { toast(String(er && er.message).match(/tipo|grande/) ? imgError(er) : errMsg(er)); }
  chatBusy = false; paintComposer();
});
$("sheetbg").addEventListener("click", closeChat);
document.addEventListener("keydown", e => { if (e.key === "Escape") { if (!$("gate").hidden) closeLogin(); else if (chatWork) closeChat(); } });

/* ---------------- login ---------------- */
let loginMode = "entrar";
function openLogin() {
  if (!api) { toast("O site ainda não foi ligado ao banco de dados."); return; }
  const g = $("gate"); g.hidden = false; paintLogin();
  setTimeout(() => { const el = $("lg-email"); if (el) el.focus(); });
}
function closeLogin() { $("gate").hidden = true; }
function paintLogin() {
  const g = $("gate"), C = window.CONFIG || {};
  const err = h("p", { class: "gate-err", id: "lg-err", role: "alert" });
  const isUp = loginMode === "criar", isReset = loginMode === "senha";
  const btn = h("button", { class: "gbtn main", type: "submit" }, isUp ? "Criar conta" : isReset ? "Mandar link para trocar a senha" : "Entrar");
  g.replaceChildren(h("form", { class: "gate-card", onsubmit: async e => {
    e.preventDefault(); err.textContent = "";
    const email = $("lg-email").value.trim(), pass = $("lg-pass") ? $("lg-pass").value : "";
    btn.disabled = true;
    try {
      if (isReset) { await api.resetPassword(email); err.textContent = "Pronto! Veja seu e-mail para trocar a senha."; btn.disabled = false; return; }
      if (isUp) {
        const nick = $("lg-nick").value.trim().slice(0, 40);
        if (!nick) { err.textContent = "Escolha um nome para a galera ver."; btn.disabled = false; return; }
        const r = await api.signUp(email, pass, nick);
        if (!r.session) { err.textContent = "Conta criada! Confirme pelo link que chegou no seu e-mail e depois entre."; btn.disabled = false; return; }
      } else await api.signIn(email, pass);
      closeLogin(); toast("Bem-vindo!");
    } catch (er) { err.textContent = errMsg(er); btn.disabled = false; }
  } },
    h("button", { class: "icon gate-x", type: "button", "aria-label": "Fechar", onclick: closeLogin }, svg(I_X)),
    h("p", { class: "eyebrow" }, "ベトロちゃん"),
    h("h2", {}, isUp ? "Criar conta" : isReset ? "Esqueci a senha" : "Entrar"),
    C.GOOGLE_LOGIN && !isReset ? h("button", { class: "gbtn", type: "button", onclick: async () => { try { await api.google(); } catch (er) { err.textContent = errMsg(er); } } }, "Entrar com Google") : null,
    C.GOOGLE_LOGIN && !isReset ? h("div", { class: "or" }, "ou") : null,
    isUp ? h("label", { class: "field" }, "Seu nome na lista", h("input", { id: "lg-nick", maxlength: "40", placeholder: "Ex.: Betoro", autocomplete: "nickname" })) : null,
    h("label", { class: "field" }, "E-mail", h("input", { id: "lg-email", type: "email", required: true, autocomplete: "email" })),
    isReset ? null : h("label", { class: "field" }, "Senha", h("input", { id: "lg-pass", type: "password", required: true, minlength: "6", autocomplete: isUp ? "new-password" : "current-password" })),
    err, btn,
    h("div", { style: "display:flex;justify-content:center;gap:14px;flex-wrap:wrap;font-size:14px" },
      loginMode !== "entrar" ? h("button", { class: "link", type: "button", onclick: () => { loginMode = "entrar"; paintLogin(); } }, "Já tenho conta") : null,
      loginMode !== "criar" ? h("button", { class: "link", type: "button", onclick: () => { loginMode = "criar"; paintLogin(); } }, "Criar conta") : null,
      loginMode === "entrar" ? h("button", { class: "link", type: "button", onclick: () => { loginMode = "senha"; paintLogin(); } }, "Esqueci a senha") : null)));
}
$("gate").addEventListener("click", e => { if (e.target === $("gate")) closeLogin(); });

/* ---------------- ao vivo ---------------- */
const pending = new Set(); let pendT = null;
function onChange(table, payload) {
  // aplica direto quando dá, recarrega a tabela quando não
  const n = payload && payload.new, o = payload && payload.old, ev = payload && payload.eventType;
  if (table === "works" && n && n.id) { if (ev === "DELETE") works.delete(o.id); else works.set(n.id, n); }
  else if (table === "profiles" && n && n.id) profiles.set(n.id, n);
  else if (table === "comments" && ev === "INSERT" && n) { if (!comments.some(c => c.id === n.id)) comments.push({ id: n.id, work_id: n.work_id, user_id: n.user_id, created_at: n.created_at }); if (chatWork && chatWork.id === n.work_id && chatMsgs && !chatMsgs.some(m => m.id === n.id)) chatMsgs.push(n); }
  else { pending.add(table); clearTimeout(pendT); pendT = setTimeout(flush, 400); }
  scheduleRender();
}
async function flush() {
  const ts = [...pending]; pending.clear();
  for (const t of ts) {
    try {
      const rows = await api.loadTable(t);
      if (t === "list_items") items = rows; else if (t === "comments") { comments = rows; if (chatWork) loadChat(false); }
      else if (t === "works") works = new Map(rows.map(r => [r.id, r]));
    } catch {}
  }
  scheduleRender();
}
let rT = null; function scheduleRender() { clearTimeout(rT); rT = setTimeout(render, 60); }

/* ---------------- início ---------------- */
(async function boot() {
  const p = new URLSearchParams(location.search).get("p"); // vindo do 404.html
  if (p && p.startsWith("/")) history.replaceState(null, "", p);
  if (!api) { route = parseRoute(location.pathname); render(); return; }
  me = await api.session().catch(() => null);
  api.onAuth(u => { const changed = (u && u.id) !== (me && me.id); me = u; if (changed) { if (!me && mode === "minha") go(KINDS[cat].path + "/catalogo", true); else render(); if (chatWork) { $("composer").hidden = !canEdit(); $("sheetro").hidden = canEdit(); } } });
  route = parseRoute(location.pathname);
  if (location.pathname === "/" || location.pathname === "") history.replaceState(null, "", me ? "/animes" : "/animes/catalogo");
  if (!me && route.view === "home" && route.mode === "minha") history.replaceState(null, "", KINDS[route.kind].path + "/catalogo");
  applyRoute();
  try {
    const d = await api.loadAll();
    works = new Map(d.works.map(w => [w.id, w])); items = d.items; profiles = new Map(d.profiles.map(x => [x.id, x])); comments = d.comments;
  } catch (e) { toast("Não deu para carregar a lista. " + errMsg(e)); }
  ready = true; render();
  try { api.subscribe(onChange); } catch {}
  setInterval(() => { if (chatWork) renderChat(false); }, 60000);
})();
