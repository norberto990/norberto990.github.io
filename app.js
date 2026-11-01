/* =====================================================================
   Lista de Animes do Betoro-chan — site (versão 2)
   Dados no Supabase. Lançamentos atualizados pelo robô (scripts/sync.mjs).
   ===================================================================== */
"use strict";

/* ---------------- idioma ---------------- */
let lang = lsGet("idioma", "pt") === "en" ? "en" : "pt";
const L = (pt, en) => (lang === "en" ? en : pt);
const locale = () => (lang === "en" ? "en-US" : "pt-BR");
function setLang(l) {
  lang = l === "en" ? "en" : "pt"; lsSet("idioma", lang);
  document.documentElement.lang = lang === "en" ? "en" : "pt-BR";
  render(); renderStatic(); if (chatWork) { renderChat(false); paintComposer(); }
  if (!$("gate").hidden) paintLogin();
}

const KINDS = {
  anime: { path: "/animes", label: () => L("Animes", "Anime"), one: () => "anime" },
  manga: { path: "/mangas", label: () => L("Mangás", "Manga"), one: () => L("mangá", "manga") },
  novel: { path: "/novels", label: () => "Novels", one: () => "novel" },
};
const UNIT = {
  anime: () => [L("Episódios", "Episodes"), "Ep."],
  manga: () => [L("Capítulos", "Chapters"), L("Cap.", "Ch.")],
  novel: () => [L("Volumes", "Volumes"), "Vol."],
};
const ST = ["assistindo", "visto", "quero", "dropei"];
function stLabel(s, k) {
  const read = k !== "anime";
  return ({
    assistindo: read ? L("Lendo", "Reading") : L("Assistindo", "Watching"),
    visto: read ? L("Li", "Read") : L("Vi", "Watched"),
    quero: read ? L("Quero ler", "Plan to read") : L("Quero ver", "Plan to watch"),
    dropei: L("Dropei", "Dropped"),
  })[s] || s;
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

// valores guardados em português, mostrados no idioma escolhido
const VAL_EN = {
  "Finalizado": "Finished", "Em lançamento": "Releasing", "Ainda não lançado": "Not yet released", "Cancelado": "Cancelled", "Em hiato": "On hiatus",
  "TV (curto)": "TV short", "Filme": "Movie", "Especial": "Special", "Mangá": "Manga", "Jogo": "Video game", "Web mangá": "Web manga", "Outro": "Other",
  "Ação": "Action", "Aventura": "Adventure", "Comédia": "Comedy", "Fantasia": "Fantasy", "Terror": "Horror", "Música": "Music", "Mistério": "Mystery",
  "Psicológico": "Psychological", "Ficção científica": "Sci-Fi", "Slice of life": "Slice of Life", "Esportes": "Sports", "Sobrenatural": "Supernatural",
  "Suspense": "Thriller", "Escolar": "School",
};
const VAL_PT = Object.fromEntries(Object.entries(VAL_EN).map(([a, b]) => [b, a]));
const tv = v => { const s = String(v ?? ""); return lang === "en" ? (VAL_EN[s] || s) : (VAL_PT[s] || s); };
const tvList = v => String(v || "").split(/\s*,\s*/).filter(Boolean).map(tv);

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
  for (const [k, v] of Object.entries({ viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2.2", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" })) s.setAttribute(k, v);
  s.innerHTML = path; return s;
}
const I_IMG = '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>';
const I_CHAT = '<path d="M4 5h16v11H9l-5 4z"/>';
const I_OPEN = '<path d="M9 6h9v9M18 6 6 18"/>';
const I_DEL = '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>';
const I_X = '<path d="M6 6l12 12M18 6 6 18"/>';
const I_EXT = '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>';
const norm = t => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const slugify = t => norm(t).replace(/[^a-z0-9 ]/g, "").trim().replace(/ +/g, "-").slice(0, 100) || "obra";
const fmt = n => (Math.round(n * 10) / 10).toLocaleString(locale());
const numTxt = n => (Number.isInteger(Number(n)) ? String(Number(n)) : Number(n).toLocaleString(locale()));
function ago(t) {
  const d = (Date.now() - t) / 1000;
  if (d < 60) return L("agora", "just now");
  if (d < 3600) { const n = Math.floor(d / 60); return L(`há ${n} min`, `${n} min ago`); }
  if (d < 86400) { const n = Math.floor(d / 3600); return L(`há ${n} h`, `${n} h ago`); }
  const dd = Math.floor(d / 86400); if (dd < 30) return L(`há ${dd} ${dd === 1 ? "dia" : "dias"}`, `${dd} ${dd === 1 ? "day" : "days"} ago`);
  const mm = Math.floor(dd / 30); if (mm < 12) return L(`há ${mm} ${mm === 1 ? "mês" : "meses"}`, `${mm} ${mm === 1 ? "month" : "months"} ago`);
  const yy = Math.floor(dd / 365); return L(`há ${yy} ${yy === 1 ? "ano" : "anos"}`, `${yy} ${yy === 1 ? "year" : "years"} ago`);
}
function countdown(ms) {
  const m = Math.max(0, Math.round(ms / 60000)), d = Math.floor(m / 1440), hh = Math.floor((m % 1440) / 60), mi = m % 60;
  const s = d ? `${d}d ${hh}h` : hh ? `${hh}h ${mi}min` : `${mi}min`;
  return L(`em ${s}`, `in ${s}`);
}
const when = t => new Date(t).toLocaleString(locale(), { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
function toast(msg, kind) {
  const t = $("toast");
  t.className = "toast" + (kind === "ok" ? " ok" : kind === "err" ? " err" : "");
  t.replaceChildren(kind === "ok" ? h("b", { "aria-hidden": "true" }, "✓ ") : kind === "err" ? h("b", { "aria-hidden": "true" }, "! ") : "", msg);
  t.setAttribute("role", kind === "err" ? "alert" : "status");
  t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, kind === "err" ? 5000 : 2800);
}
const ok = m => toast(m, "ok"), fail = m => toast(m, "err");
function lsGet(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
function errMsg(e) {
  const m = String((e && (e.message || e.error_description)) || e || "");
  if (/Invalid login/i.test(m)) return L("E-mail ou senha errados.", "Wrong e-mail or password.");
  if (/already registered/i.test(m)) return L("Esse e-mail já tem conta. Use “Entrar”.", "This e-mail already has an account. Use “Sign in”.");
  if (/Password should be/i.test(m)) return L("A senha precisa ter pelo menos 6 caracteres.", "The password needs at least 6 characters.");
  if (/Email not confirmed/i.test(m)) return L("Confirme seu e-mail antes de entrar (veja sua caixa de entrada).", "Confirm your e-mail before signing in (check your inbox).");
  if (/rate limit/i.test(m)) return L("Muitas tentativas seguidas. Espere um pouco e tente de novo.", "Too many attempts. Wait a little and try again.");
  if (/duplicate key|unique/i.test(m)) return L("Essa obra já está no site.", "This title is already on the site.");
  if (/row-level security|permission|violates/i.test(m)) return L("Você não tem permissão para isso. Entre na sua conta (algumas ações são só do ADM).", "You don't have permission for that. Sign in (some actions are admin-only).");
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return L("Sem conexão. Verifique a internet e tente de novo.", "No connection. Check your internet and try again.");
  return L("Algo deu errado. Tente de novo.", "Something went wrong. Please try again.");
}

/* ---------------- acesso aos dados ---------------- */
function realApi() {
  const C = window.CONFIG || {};
  if (!C.SUPABASE_URL || /COLE_AQUI/.test(C.SUPABASE_URL) || !window.supabase) return null;
  const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
  const okr = r => { if (r.error) throw r.error; return r.data; };
  async function all(table, cols) {
    let out = [], from = 0;
    for (;;) { const d = okr(await sb.from(table).select(cols || "*").range(from, from + 999)); out = out.concat(d); if (d.length < 1000) return out; from += 1000; }
  }
  return {
    async loadAll() {
      const [works, items, profiles, comments] = await Promise.all([all("works"), all("list_items"), all("profiles"), all("comments", "id,work_id,user_id,created_at")]);
      return { works, items, profiles, comments };
    },
    loadTable: t => all(t, t === "comments" ? "id,work_id,user_id,created_at" : "*"),
    loadComments: async wid => okr(await sb.from("comments").select("*").eq("work_id", wid).order("created_at")),
    insertWork: async w => okr(await sb.from("works").insert(w).select().single()),
    updateWork: async (id, p) => okr(await sb.from("works").update(p).eq("id", id).select().single()),
    deleteWork: async id => okr(await sb.from("works").delete().eq("id", id)),
    upsertItem: async it => okr(await sb.from("list_items").upsert(it).select().single()),
    deleteItem: async (uid, wid) => okr(await sb.from("list_items").delete().eq("user_id", uid).eq("work_id", wid)),
    insertComment: async c => okr(await sb.from("comments").insert(c).select().single()),
    deleteComment: async id => okr(await sb.from("comments").delete().eq("id", id)),
    updateNick: async (uid, nick) => okr(await sb.from("profiles").upsert({ id: uid, nick }).select().single()),
    async upload(uid, blob) {
      const ext = (blob.type.split("/")[1] || "png").replace("jpeg", "jpg");
      const path = uid + "/" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7) + "." + ext;
      okr(await sb.storage.from("imagens").upload(path, blob, { contentType: blob.type, upsert: false }));
      return sb.storage.from("imagens").getPublicUrl(path).data.publicUrl;
    },
    async session() { const { data } = await sb.auth.getSession(); return data.session ? data.session.user : null; },
    onAuth: cb => sb.auth.onAuthStateChange((_e, s) => cb(s ? s.user : null)),
    signIn: async (email, password) => okr(await sb.auth.signInWithPassword({ email, password })),
    signUp: async (email, password, nick) => okr(await sb.auth.signUp({ email, password, options: { data: { nick }, emailRedirectTo: location.origin + "/" } })),
    signOut: async () => { await sb.auth.signOut(); },
    resetPassword: async email => okr(await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + "/" })),
    subscribe(cb) {
      const ch = sb.channel("tudo");
      for (const t of ["works", "list_items", "comments", "profiles"]) ch.on("postgres_changes", { event: "*", schema: "public", table: t }, p => cb(t, p));
      ch.subscribe();
    },
  };
}
const api = window.__MOCK_API || realApi();

/* ---------------- estado ---------------- */
let me = null;
let works = new Map(), items = [], profiles = new Map(), comments = [];
let ready = false;
let cat = "anime", mode = "minha", stFilter = "todos", person = "todos", sortBy = "lancou", shown = 40;
const PAGE = 40;
let route = { view: "home" };
let draft = null, quick = null, delArm = null, suggOpen = false, busy = false, nickEdit = false, flash = null;
let wvTab = "detalhes", wvPanel = null, wvEditImg = null;
let chatWork = null, chatMsgs = [], replyTo = null, chatFile = null, chatBusy = false, chatDel = null, chatFlash = null;
let seen = lsGet("comentariosVistos", {});

const canEdit = () => !!(api && me);
const isAdm = () => !!(me && (profiles.get(me.id) || {}).is_admin);
const myId = () => (me ? me.id : null);
const itemsOf = uid => items.filter(i => i.user_id === uid);
const myItems = () => (me ? itemsOf(me.id) : []);
const myItem = wid => (me ? items.find(i => i.user_id === me.id && i.work_id === wid) : null);
const workHref = w => "/" + w.kind + "/" + w.slug;

function stats(wid) {
  const who = items.filter(i => i.work_id === wid);
  const sc = who.map(i => i.score).filter(Boolean);
  return { who, avg: sc.length ? sc.reduce((a, b) => a + b, 0) / sc.length : null, nScores: sc.length };
}
const small = url => (url && /anilist\.co\/.*\/cover\/(extraLarge|large)\//.test(url) ? url.replace(/\/cover\/(extraLarge|large)\//, "/cover/medium/") : url);
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

/* ---------------- lançamentos ---------------- */
// último lançado + próximo (anime vira "saiu" na hora oficial, mesmo antes do robô passar)
function release(w) {
  let num = w.rel_num != null ? Number(w.rel_num) : null, at = w.rel_at ? Date.parse(w.rel_at) : null, url = w.rel_url || null, label = w.rel_label || "";
  let next = w.next_num != null && w.next_at ? { num: Number(w.next_num), at: Date.parse(w.next_at) } : null;
  if (next && next.at <= Date.now()) {
    if (num == null || next.num > num) { num = next.num; at = next.at; url = null; label = ""; }
    next = null;
  }
  if (next && num != null && next.num <= num) next = null;   // ADM já passou na frente
  return { num, at, url, label, next, fresh: !!(at && Date.now() - at < 48 * 3600e3), src: w.rel_src || "" };
}
function relTxt(w, r) {
  if (r.num == null) return "";
  if (r.label && (r.src === "webtoon" || r.src === "jumpplus" || r.src === "adm")) return r.label;
  return UNIT[w.kind]()[1] + " " + numTxt(r.num);
}
function behind(w, it, r) {
  if (!w || !it || r.num == null || it.status === "visto" || it.status === "dropei") return 0;
  return Math.max(0, Math.floor(r.num - (it.progress || 0)));
}

/* ---------------- pessoas ---------------- */
function pName(uid) {
  const p = profiles.get(uid); const n = p && p.nick ? p.nick.trim() : "";
  return uid === myId() ? (n || L("Você", "You")) : (n || L("Alguém", "Someone"));
}
function colorOf(uid) { let x = 0; for (const c of String(uid)) x = (x * 31 + c.charCodeAt(0)) >>> 0; return "hsl(" + (x % 360) + " 62% 42%)"; }
function initials(uid) { return h("span", { class: "ava", style: "background:" + colorOf(uid), "aria-hidden": "true" }, (pName(uid)).charAt(0).toUpperCase()); }
function avEl(uid) {
  const p = profiles.get(uid);
  if (p && p.avatar_url) { const im = h("img", { src: p.avatar_url, alt: "", class: "ava", referrerpolicy: "no-referrer", width: 22, height: 22 }); im.onerror = () => im.replaceWith(initials(uid)); return im; }
  return initials(uid);
}
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
  const big = /\bbig\b/.test(cls || "");
  const im = h("img", { class: "cover " + (cls || ""), src: big ? url : small(url), alt: "", loading: "lazy", decoding: "async", width: big ? 84 : 56, height: big ? 118 : 78 });
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
    let b = await new Promise(res => c.toBlob(res, "image/webp", 0.82));
    if (!b || b.type !== "image/webp") b = await new Promise(res => c.toBlob(res, "image/jpeg", 0.85));
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
  return m === "tipo" ? L("Formato não aceito. Use PNG, JPG, GIF ou WebP.", "Format not accepted. Use PNG, JPG, GIF or WebP.")
    : m === "grande" ? L("Imagem grande demais (máx. 5 MB).", "Image too large (max 5 MB).")
    : L("Não deu para enviar a imagem. ", "Couldn't upload the image. ") + errMsg(e);
}
const anyErr = e => (/^(tipo|grande)$/.test(String(e && e.message)) ? imgError(e) : errMsg(e));
function imgPicker(id, current, onpick, onclear) {
  const input = h("input", { type: "file", id, accept: "image/png,image/jpeg,image/gif,image/webp", class: "sr", onchange: e => { const f = e.target.files && e.target.files[0]; if (f) onpick(f); } });
  const prev = current ? h("img", { class: "cover big", src: current, alt: L("Prévia", "Preview"), width: 84, height: 118 }) : h("div", { class: "cover big none", "aria-hidden": "true" }, svg(I_IMG));
  return h("div", { class: "imgpick" }, prev,
    h("div", { class: "imgbtns" },
      h("label", { class: "btn alt", for: id }, current ? L("Trocar imagem", "Change image") : L("Anexar imagem", "Attach image")), input,
      current && onclear ? h("button", { class: "link", type: "button", onclick: onclear }, L("Remover imagem", "Remove image")) : null,
      h("small", {}, L("Opcional. PNG, JPG, GIF ou WebP.", "Optional. PNG, JPG, GIF or WebP."))));
}

/* ---------------- busca por semelhança ---------------- */
function grams(s) { const p = "  " + s + " "; const g = new Set(); for (let i = 0; i < p.length - 2; i++) g.add(p.slice(i, i + 3)); return g; }
function tri(a, b) { const A = grams(a), B = grams(b); let n = 0; for (const x of A) if (B.has(x)) n++; return n / (A.size + B.size - n); }
function sim(q, w) {
  const names = [w.title, ...String(w.alt_titles || "").split(/\s*[·,;\/|\n]\s*/)].map(norm).filter(Boolean);
  let best = 0;
  for (const n of names) {
    if (n === q) return 1;
    if (n.startsWith(q)) best = Math.max(best, 0.92);
    else if (n.includes(q)) best = Math.max(best, 0.82);
    else {
      const qw = q.split(" ").filter(x => x.length > 1), nw = n.split(" ");
      const hit = qw.filter(x => nw.some(y => y.startsWith(x))).length;
      if (hit && qw.length) best = Math.max(best, 0.4 + 0.4 * hit / qw.length);
      if (q.length >= 3) {
        best = Math.max(best, tri(q, n) * 1.15);
        if (qw.length === 1) for (const y of nw) if (y.length >= 4) best = Math.max(best, tri(q, y) * 1.05);
      }
    }
  }
  return best;
}

/* ---------------- AniList (só o ADM usa para adicionar) ---------------- */
const AL_KINDS = {
  anime: { type: "ANIME", formats: ["TV", "TV_SHORT", "MOVIE", "ONA", "OVA", "SPECIAL"] },
  manga: { type: "MANGA", formats: ["MANGA", "ONE_SHOT"] },
  novel: { type: "MANGA", formats: ["NOVEL"] },
};
const AL_FORMAT = { TV: "TV", TV_SHORT: "TV (curto)", MOVIE: "Filme", ONA: "ONA", OVA: "OVA", SPECIAL: "Especial", MANGA: "Mangá", ONE_SHOT: "One-shot", NOVEL: "Light novel" };
const AL_STATUS = { FINISHED: "Finalizado", RELEASING: "Em lançamento", NOT_YET_RELEASED: "Ainda não lançado", CANCELLED: "Cancelado", HIATUS: "Em hiato" };
const AL_SOURCE = { ORIGINAL: "Original", MANGA: "Mangá", LIGHT_NOVEL: "Light novel", WEB_NOVEL: "Web novel", NOVEL: "Novel", VISUAL_NOVEL: "Visual novel", VIDEO_GAME: "Jogo", GAME: "Jogo", WEB_MANGA: "Web mangá", OTHER: "Outro" };
const AL_GENRE = { Action: "Ação", Adventure: "Aventura", Comedy: "Comédia", Fantasy: "Fantasia", Horror: "Terror", Music: "Música", Mystery: "Mistério", Psychological: "Psicológico", "Sci-Fi": "Ficção científica", "Slice of Life": "Slice of life", Sports: "Esportes", Supernatural: "Sobrenatural", Thriller: "Suspense" };
const AL_FIELDS = `id idMal format status episodes chapters volumes source isAdult
  title { romaji english native } synonyms startDate { year }
  genres coverImage { extraLarge large } description(asHtml: false)
  studios(isMain: true) { nodes { name } }
  staff(perPage: 3, sort: RELEVANCE) { edges { role node { name { full } } } }
  nextAiringEpisode { episode airingAt }
  externalLinks { site url type language }`;
const LANG_CODE = { Portuguese: "PT", English: "EN", Japanese: "JP", Spanish: "ES", French: "FR", German: "DE", Italian: "IT", Korean: "KO", Chinese: "ZH" };
function pickLinks(ext) {
  const all = (ext || []).filter(l => l && l.url && /^https?:\/\//.test(l.url));
  let list = all.filter(l => l.type === "STREAMING");
  if (!list.length) list = all.filter(l => l.type === "INFO" && !/twitter|^x$|instagram|youtube|tiktok|facebook|discord|wikipedia/i.test(l.site || ""));
  const rank = l => (/portug/i.test(l.language || "") ? 0 : !l.language ? 1 : /english/i.test(l.language || "") ? 2 : 3);
  const out = [], seenSite = new Set();
  for (const l of list.slice().sort((a, b) => rank(a) - rank(b))) {
    const k = String(l.site || "").toLowerCase(); if (seenSite.has(k)) continue;
    seenSite.add(k); out.push({ site: String(l.site || "Site oficial").slice(0, 40), url: l.url, lang: LANG_CODE[l.language] || "" });
    if (out.length === 3) break;
  }
  return out;
}
function feedFromUrl(url) {
  let m;
  if ((m = String(url).match(/mangaplus\.shueisha\.co\.jp\/titles\/(\d+)/))) return "mangaplus:" + m[1];
  if ((m = String(url).match(/webtoons\.com\/([a-z-]+)\/([^/?#]+)\/([^/?#]+)\/(?:list|rss)\?title_no=(\d+)/i)))
    return "webtoon:https://www.webtoons.com/" + m[1] + "/" + m[2] + "/" + m[3] + "/rss?title_no=" + m[4];
  if ((m = String(url).match(/^https?:\/\/(?:www\.)?(?:shonenjumpplus\.com|tonarinoyj\.jp|comic-days\.com|comic-action\.com|comicborder\.com|comic-gardo\.com|kuragebunch\.com|magcomi\.com|comic-zenon\.com|comic-trail\.com|comic-ogyaaa\.com|viewer\.heros-web\.com|comic-earthstar\.com|comicbushi-web\.com|ichicomi\.com)\/(?:episode|rss\/series|series)\/\d+/i)))
    return "gigaviewer:" + m[0].replace(/^http:/, "https:");
  return "";
}
function feedFromLinks(ext) {
  const all = (ext || []).filter(l => l && l.url);
  const mp = all.filter(l => /mangaplus\.shueisha/.test(l.url)).sort((a, b) => (/english/i.test(a.language || "") ? 0 : 1) - (/english/i.test(b.language || "") ? 0 : 1));
  for (const l of [...mp, ...all]) { const f = feedFromUrl(l.url); if (f) return f; }
  return "";
}
const feedLabel = f => (f.startsWith("mangaplus:") ? "MANGA Plus" : f.startsWith("webtoon:") ? "WEBTOON" : f.startsWith("gigaviewer:") ? (/shonenjumpplus/.test(f) ? "Shonen Jump+" : f.slice(11).split("/")[2]) : "");
const feedToUrl = f => (f.startsWith("mangaplus:") ? "https://mangaplus.shueisha.co.jp/titles/" + f.slice(10) : f.startsWith("webtoon:") ? f.slice(8).replace("/rss?", "/list?") : f.startsWith("gigaviewer:") ? f.slice(11) : "");
const alCache = new Map();
async function anilistSearch(q, kind) {
  const key = kind + ":" + norm(q);
  if (alCache.has(key)) return alCache.get(key);
  const k = AL_KINDS[kind];
  const p = fetch("https://graphql.anilist.co", {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: `query($q: String, $type: MediaType, $f: [MediaFormat]) { Page(perPage: 6) { media(search: $q, type: $type, format_in: $f, isAdult: false, sort: SEARCH_MATCH) { ${AL_FIELDS} } } }`, variables: { q, type: k.type, f: k.formats } }),
  }).then(r => (r.ok ? r.json() : Promise.reject(new Error("anilist " + r.status))))
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
  const syn = String(m.description || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#0?39;/g, "'").replace(/\n{3,}/g, "\n\n").trim().slice(0, 5900);
  const total = kind === "anime" ? (m.episodes ?? null) : kind === "novel" ? (m.volumes ?? m.chapters ?? null) : (m.chapters ?? null);
  const w = {
    kind, title: title.slice(0, 160), alt_titles: alt,
    cover_url: (m.coverImage && (m.coverImage.extraLarge || m.coverImage.large)) || null,
    synopsis: "", synopsis_en: syn, genres: (m.genres || []).map(g => AL_GENRE[g] || g).join(", ").slice(0, 300),
    format: AL_FORMAT[m.format] || m.format || "", total,
    status: AL_STATUS[m.status] || "", year: (m.startDate && m.startDate.year) || null,
    studio: author.slice(0, 200), source: AL_SOURCE[m.source] || "",
    anilist_id: m.id, mal_id: m.idMal ?? null,
    links: pickLinks(m.externalLinks), feed: feedFromLinks(m.externalLinks),
  };
  if (kind === "anime") {
    const n = m.nextAiringEpisode;
    if (n) { w.next_num = n.episode; w.next_at = new Date(n.airingAt * 1000).toISOString(); if (n.episode > 1) { w.rel_num = n.episode - 1; w.rel_src = "anilist"; } }
    else if (m.status === "FINISHED" && m.episodes) { w.rel_num = m.episodes; w.rel_src = "anilist"; }
  }
  return w;
}
function alSummary(a) {
  return [tv(a.format), a.year, a.total ? a.total + " " + UNIT[a.kind]()[0].toLowerCase() : null, tv(a.status)].filter(Boolean).join(" · ");
}

/* ---------------- ações ---------------- */
async function setItem(w, patch) {
  if (!canEdit()) { openLogin(); return false; }
  const old = myItem(w.id);
  const row = { user_id: me.id, work_id: w.id, status: (old && old.status) || "visto", score: old ? old.score : null, progress: old ? old.progress : 0, image_url: old ? old.image_url : null, ...patch, updated_at: new Date().toISOString() };
  if (row.status === "visto" && w.total && !("progress" in patch) && (!old || old.status !== "visto")) row.progress = w.total;
  items = items.filter(i => !(i.user_id === me.id && i.work_id === w.id)).concat([row]);
  flash = w.id; render();
  try { const saved = await api.upsertItem(row); items = items.filter(i => !(i.user_id === me.id && i.work_id === w.id)).concat([saved]); return true; }
  catch (e) { items = items.filter(i => !(i.user_id === me.id && i.work_id === w.id)).concat(old ? [old] : []); render(); fail(errMsg(e)); return false; }
}
async function removeItem(w) {
  const old = myItem(w.id); if (!old) return;
  items = items.filter(i => i !== old); render();
  try { await api.deleteItem(me.id, w.id); ok(L("Tirado da sua lista: ", "Removed from your list: ") + w.title); }
  catch (e) { items.push(old); render(); fail(errMsg(e)); }
}
function freeSlug(kind, title) {
  let slug = slugify(title), n = 2;
  const taken = new Set([...works.values()].filter(w => w.kind === kind).map(w => w.slug));
  while (taken.has(slug)) slug = slugify(title).slice(0, 95) + "-" + (n++);
  return slug;
}
// tradução gratuita na hora (se falhar, o robô traduz depois)
async function translateNow(text) {
  if (!text) return "";
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("tempo")), ms))]);
  const parts = [];
  for (const para of text.split(/\n{2,}/)) {
    let cur = "";
    for (const s of (para.replace(/\n/g, " ").match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [para])) {
      if ((cur + s).length > 450 && cur) { parts.push(cur.trim()); cur = ""; }
      cur += s;
    }
    if (cur.trim()) parts.push(cur.trim());
    parts.push("\n\n");
  }
  parts.pop();
  const one = async c => {
    try {
      const j = await withTimeout(fetch("https://api.mymemory.translated.net/get?q=" + encodeURIComponent(c.slice(0, 480)) + "&langpair=en|pt-BR").then(r => r.json()), 6000);
      const t = j && j.responseData && j.responseData.translatedText;
      if (Number(j.responseStatus) === 200 && t && !/MYMEMORY WARNING|LIMIT|INVALID/i.test(t)) return t;
    } catch {}
    const j = await withTimeout(fetch("https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=pt&dt=t&q=" + encodeURIComponent(c)).then(r => r.json()), 6000);
    return j[0].map(x => x[0]).join("");
  };
  let out = "";
  for (const c of parts) out += c === "\n\n" ? "\n\n" : (await one(c)).trim() + " ";
  return out.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").trim().slice(0, 5900);
}
// qualquer pessoa logada adiciona obras do AniList (dados oficiais); só o ADM edita ou apaga
async function addFromAnilist(a, status) {
  if (!canEdit()) { openLogin(); return null; }
  try {
    let w = [...works.values()].find(x => x.anilist_id === a.anilist_id);
    if (!w) {
      toast(L("Adicionando “", "Adding “") + a.title + L("” ao site…", "” to the site…"));
      const row = { ...a, slug: freeSlug(a.kind, a.title), created_by: me.id };
      try { const pt = await translateNow(a.synopsis_en); if (pt) { row.synopsis = pt; row.syn_src = "gratis"; } } catch {}
      w = await api.insertWork(row); works.set(w.id, w);
      ok(L("Adicionado ao site: ", "Added to the site: ") + w.title);
    }
    if (status) { if (await setItem(w, { status })) ok(w.title + ": " + stLabel(status, w.kind)); }
    render();
    return w;
  } catch (e) { fail(errMsg(e)); return null; }
}
const findWork = (kind, title) => { const k = norm(title); return [...works.values()].find(w => w.kind === kind && norm(w.title) === k); };

/* ---------------- rotas ---------------- */
function parseRoute(path) {
  const p = path.replace(/\/+$/, "") || "/";
  let m;
  if (p === "/") return { view: "home", kind: "anime", mode: me ? "minha" : "catalogo" };
  if ((m = p.match(/^\/(anime|manga|novel)\/([a-z0-9-]+)$/))) return { view: "work", kind: m[1], slug: m[2] };
  if ((m = p.match(/^\/(animes|mangas|novels)(?:\/(galera|catalogo))?$/))) return { view: "home", kind: m[1].slice(0, -1), mode: m[2] || "minha" };
  return { view: "notfound", kind: cat };
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
    if (mode === "minha" && !me) { mode = "catalogo"; history.replaceState(null, "", KINDS[cat].path + "/catalogo"); }
  } else if (route.view === "work") { cat = route.kind; wvTab = "detalhes"; wvPanel = null; wvEditImg = null; }
  closeSearch(); draft = null; renderNew(); render(); renderFooter();
}
const homePath = () => KINDS[cat].path + (mode === "minha" ? "" : "/" + mode);
document.addEventListener("click", e => {
  const a = e.target.closest("a[data-link]");
  if (a && !e.ctrlKey && !e.metaKey && !e.shiftKey && a.origin === location.origin) { e.preventDefault(); go(a.pathname); }
  if (e.target.closest("[data-login]")) openLogin();
});
window.addEventListener("popstate", applyRoute);

/* ---------------- textos fixos da página ---------------- */
function renderStatic() {
  $("h1pre").textContent = L("Lista de Animes do", "The anime list of");
  $("q").setAttribute("aria-label", L("Buscar", "Search"));
  $("addbtn").textContent = L("+ Adicionar à mão", "+ Add manually");
  $("cimgbtn").title = L("Anexar imagem", "Attach image");
  $("cmsg").placeholder = L("Escreva um comentário…", "Write a comment…");
  $("cmsg").setAttribute("aria-label", L("Mensagem", "Message"));
  $("csend").setAttribute("aria-label", L("Enviar", "Send"));
  $("sheetro").replaceChildren(L("Para comentar, ", "To comment, "), h("button", { class: "link", type: "button", "data-login": true }, L("entre na sua conta", "sign in")), ".");
  $("cats").setAttribute("aria-label", L("Categoria", "Category"));
  $("seg").setAttribute("aria-label", L("Visão", "View"));
  $("langs").setAttribute("aria-label", L("Idioma", "Language"));
  for (const b of document.querySelectorAll("#langs button")) b.setAttribute("aria-pressed", b.dataset.lang === lang);
  renderFooter();
}
function renderFooter() {
  const f = $("footer"), y = new Date().getFullYear();
  f.replaceChildren(
    h("nav", { class: "foot-links", "aria-label": L("Seções", "Sections") },
      ...Object.entries(KINDS).map(([, v]) => h("a", { href: v.path + (me ? "" : "/catalogo"), "data-link": true }, v.label())),
      h("a", { href: KINDS[cat].path + "/galera", "data-link": true }, L("Galera", "Friends")),
      h("a", { href: KINDS[cat].path + "/catalogo", "data-link": true }, L("Catálogo", "Catalog"))),
    h("p", {}, L("Lançamentos e links oficiais: ", "Releases and official links: "),
      h("a", { href: "https://anilist.co", target: "_blank", rel: "noopener" }, "AniList"), " · ",
      h("a", { href: "https://mangaplus.shueisha.co.jp", target: "_blank", rel: "noopener" }, "MANGA Plus"), " · ",
      h("a", { href: "https://www.webtoons.com", target: "_blank", rel: "noopener" }, "WEBTOON"), " · ",
      h("a", { href: "https://shonenjumpplus.com", target: "_blank", rel: "noopener" }, "Shonen Jump+"), ". ",
      L("Só indicamos sites oficiais.", "We only point to official sites.")),
    h("p", {}, "© " + y + " " + L("Lista de Animes do Betoro-chan", "Betoro-chan's Anime List")));
}

/* ---------------- render geral ---------------- */
function render() {
  const keep = {}; for (const el of document.querySelectorAll("#list input:not([type=file]), #wv input:not([type=file]), #wv textarea, #me input, #newform input:not([type=file])")) if (el.id) keep[el.id] = el.value;
  const ae = document.activeElement, fid = ae && ae.id, caret = ae && ae.selectionStart;
  $("app").dataset.cat = cat;
  renderMe(); renderNote();
  const isWork = route.view === "work", is404 = route.view === "notfound";
  $("home").hidden = isWork || is404; $("wv").hidden = !isWork && !is404; $("app").classList.toggle("wide", isWork);
  if (is404) renderNotFound();
  else if (isWork) renderWork();
  else {
    $("q").placeholder = canEdit() ? L("Buscar ou adicionar ", "Search or add ") + KINDS[cat].one() + "…" : L("Buscar ", "Search ") + KINDS[cat].one() + "…";
    $("addbtn").hidden = !isAdm();
    renderCats(); renderSeg(); renderFilters(); renderList(); if (suggOpen) renderSugg();
    document.title = KINDS[cat].label() + " · " + L("Lista de Animes do Betoro-chan", "Betoro-chan's Anime List");
  }
  if (chatWork) renderChat(false);
  for (const [id, v] of Object.entries(keep)) { const el = $(id); if (el && el.value !== v) el.value = v; }
  if (fid && fid !== "q") { const el = $(fid); if (el && el !== document.activeElement) { el.focus(); try { if (caret != null) el.setSelectionRange(caret, caret); } catch {} } }
  flash = null;
}
function renderNote() {
  $("note").textContent = !api ? L("O site ainda não foi ligado ao banco de dados. Preencha o arquivo config.js (veja o passo a passo).", "The site is not connected to the database yet. Fill in config.js (see the guide).") : !ready ? L("Carregando…", "Loading…") : "";
}
function renderMe() {
  const box = $("me");
  if (!api) { box.replaceChildren(); return; }
  if (!me) {
    box.replaceChildren(h("span", {}, L("Você está só olhando.", "You're just browsing.")), h("button", { class: "btn", type: "button", onclick: () => openLogin() }, L("Entrar ou criar conta", "Sign in or sign up")));
    return;
  }
  if (nickEdit) {
    box.replaceChildren(h("form", { class: "nickform", onsubmit: async e => {
      e.preventDefault(); const v = $("nick").value.trim().slice(0, 40); if (!v) { fail(L("Escreva um nome.", "Type a name.")); return; }
      nickEdit = false;
      try { const p = await api.updateNick(me.id, v); profiles.set(me.id, p); ok(L("Agora você aparece como ", "You now appear as ") + v); } catch (er) { fail(errMsg(er)); }
      render();
    } }, h("label", { for: "nick" }, L("Seu nome:", "Your name:")), h("input", { id: "nick", maxlength: "40", value: (profiles.get(me.id) || {}).nick || "", autocomplete: "nickname" }),
      h("button", { class: "link", type: "submit" }, L("Salvar", "Save")), h("button", { class: "link", type: "button", onclick: () => { nickEdit = false; render(); } }, L("Cancelar", "Cancel"))));
    setTimeout(() => { const el = $("nick"); if (el && document.activeElement !== el) el.focus(); });
    return;
  }
  box.replaceChildren(avEl(me.id), L("Você aparece como ", "You appear as "), h("b", {}, pName(me.id)),
    isAdm() ? h("span", { class: "admtag", title: L("Administrador do site", "Site administrator") }, "ADM") : null,
    h("button", { class: "link", type: "button", onclick: () => { nickEdit = true; render(); } }, L("trocar nome", "change name")),
    h("span", { "aria-hidden": "true" }, "·"),
    h("button", { class: "link", type: "button", onclick: async () => { await api.signOut(); ok(L("Você saiu da conta.", "You signed out.")); } }, L("Sair", "Sign out")));
}
function renderCats() {
  $("cats").replaceChildren(...Object.entries(KINDS).map(([k, v]) => {
    const n = me ? myItems().filter(i => (works.get(i.work_id) || {}).kind === k).length : [...works.values()].filter(w => w.kind === k).length;
    const fresh = me && myItems().some(i => { const w = works.get(i.work_id); return w && w.kind === k && behind(w, i, release(w)) > 0; });
    return h("a", { class: "cat", role: "tab", "data-k": k, "aria-selected": cat === k, href: v.path + (mode === "minha" ? "" : "/" + mode), "data-link": true },
      v.label(), h("small", {}, n + " " + (me ? L("na sua lista", "on your list") : L(n === 1 ? "obra" : "obras", n === 1 ? "title" : "titles"))),
      fresh ? h("span", { class: "dot", title: L("Tem lançamento novo", "New release available") }) : null);
  }));
}
function renderSeg() {
  const tabs = [["minha", L("Minha lista", "My list")], ["galera", L("Galera", "Friends")], ["catalogo", L("Catálogo", "Catalog")]].filter(t => me || t[0] !== "minha");
  $("seg").replaceChildren(...tabs.map(([m, l]) => h("a", { role: "tab", "aria-selected": mode === m, href: KINDS[cat].path + (m === "minha" ? "" : "/" + m), "data-link": true }, l)));
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
      return chip(stFilter === s, (s === "todos" ? L("Todos", "All") : stLabel(s, cat)) + " · " + n, () => { stFilter = s; render(); }, s !== "todos" ? " s-" + s : "");
    }).filter(Boolean));
  } else if (mode === "galera") {
    const ids = [...new Set(items.filter(i => (works.get(i.work_id) || {}).kind === cat).map(i => i.user_id))];
    if (ids.length < 2) { f.replaceChildren(); return; }
    f.replaceChildren(chip(person === "todos", L("Todo mundo", "Everyone"), () => { person = "todos"; render(); }),
      ...ids.map(id => { const b = chip(person === id, "", () => { person = id; render(); }); b.replaceChildren(avEl(id), pName(id)); return b; }));
  } else {
    f.replaceChildren(...[["lancou", L("Lançou agora", "Just released")], ["populares", L("Mais populares na galera", "Most popular")], ["nota", L("Melhor nota", "Top rated")], ["az", "A–Z"]]
      .map(([k, l]) => chip(sortBy === k, l, () => { sortBy = k; shown = PAGE; render(); })));
  }
}
const empty = (title, ...text) => h("li", { class: "empty" }, h("strong", {}, title), ...text);

function renderList() {
  const ul = $("list"), more = $("morebox"); more.replaceChildren();
  if (!ready) { ul.replaceChildren(empty(L("Carregando…", "Loading…"))); return; }
  const ofCat = [...works.values()].filter(w => w.kind === cat);
  if (mode === "minha") {
    let its = myItems().filter(i => (works.get(i.work_id) || {}).kind === cat);
    const total = its.length;
    if (stFilter !== "todos") its = its.filter(i => i.status === stFilter);
    const nb = i => { const w = works.get(i.work_id); return behind(w, i, release(w)) > 0 ? 0 : 1; };
    its.sort((a, b) => ST.indexOf(a.status) - ST.indexOf(b.status) || nb(a) - nb(b) || Date.parse(b.updated_at) - Date.parse(a.updated_at));
    if (!its.length) {
      ul.replaceChildren(total ? empty(L("Nada nesse filtro", "Nothing in this filter"), L("Troque o filtro acima.", "Change the filter above."))
        : empty(L("Sua lista está vazia", "Your list is empty"), L("Use a busca lá em cima ou abra o ", "Use the search above or open the "),
          h("a", { href: KINDS[cat].path + "/catalogo", "data-link": true }, L("Catálogo", "Catalog")), L(" para marcar o que você já viu.", " to mark what you've seen.")));
      return;
    }
    ul.replaceChildren(...its.map(i => myCard(works.get(i.work_id), i)));
    return;
  }
  let ws;
  if (mode === "galera") {
    ws = ofCat.map(w => ({ w, s: stats(w.id) })).filter(x => x.s.who.length);
    if (person !== "todos") ws = ws.filter(x => x.s.who.some(i => i.user_id === person));
    ws.sort((a, b) => Math.max(...b.s.who.map(i => Date.parse(i.updated_at))) - Math.max(...a.s.who.map(i => Date.parse(i.updated_at))));
    if (!ws.length) { ul.replaceChildren(empty(L("Ninguém marcou ", "Nobody has marked any ") + KINDS[cat].label().toLowerCase() + L(" ainda", " yet"), L("Veja o Catálogo e seja o primeiro.", "Check the Catalog and be the first."))); return; }
  } else {
    ws = ofCat.map(w => ({ w, s: stats(w.id), r: release(w) }));
    const by = {
      lancou: (a, b) => (b.r.at || 0) - (a.r.at || 0) || Date.parse(b.w.created_at) - Date.parse(a.w.created_at),
      populares: (a, b) => b.s.who.length - a.s.who.length || (b.s.avg || 0) - (a.s.avg || 0),
      nota: (a, b) => (b.s.avg ?? -1) - (a.s.avg ?? -1) || b.s.nScores - a.s.nScores,
      az: (a, b) => a.w.title.localeCompare(b.w.title, locale()),
    };
    ws.sort(by[sortBy] || by.lancou);
    if (!ws.length) { ul.replaceChildren(empty(L("O catálogo está vazio", "The catalog is empty"), L("Use a busca lá em cima: ao marcar uma obra, ela entra no site.", "Use the search above: marking a title adds it to the site."))); return; }
  }
  ul.replaceChildren(...ws.slice(0, shown).map(x => workCard(x.w, x.s)));
  if (ws.length > shown) more.replaceChildren(h("button", { class: "btn alt", type: "button", onclick: () => { shown += PAGE; render(); } }, L("Mostrar mais", "Show more") + " (" + (ws.length - shown) + ")"));
}

function chatBtn(w) {
  const n = commentCount(w.id), u = unread(w.id);
  return h("button", { class: "icon chatb" + (u ? " new" : ""), type: "button", title: L("Comentários", "Comments"), "aria-label": L("Comentários sobre ", "Comments about ") + w.title + " (" + n + ")", onclick: () => openChat(w) }, svg(I_CHAT), n ? h("span", { class: "cnt" }, n) : null);
}
function notaSelect(id, val, onchange) {
  const s = h("select", { id, class: "nota" + (val ? " has" : ""), "aria-label": L("Nota", "Score"), onchange });
  s.append(h("option", { value: "" }, L("★ nota", "★ score")));
  for (let n = 10; n >= 1; n--) s.append(h("option", { value: n, selected: val === n }, "★ " + n));
  return s;
}
const titleLink = w => h("a", { href: workHref(w), "data-link": true, class: "tlink" }, h("b", {}, w.title));
function relLine(w, it) {
  const r = release(w); if (r.num == null && !r.next) return null;
  const n = behind(w, it, r);
  return h("span", { class: "relline" },
    r.num != null ? h("span", { class: r.fresh ? "newtag" : "reltag" }, relTxt(w, r) + (r.fresh ? " · " + L("novo", "new") : "")) : null,
    r.num != null && r.at ? h("span", { class: "meta" }, ago(r.at)) : null,
    n > 0 ? h("span", { class: "behind" }, L(`você está ${n} atrás`, `you're ${n} behind`)) : null,
    r.num == null && r.next ? h("span", { class: "meta" }, UNIT[w.kind]()[1] + " " + r.next.num + " " + countdown(r.next.at - Date.now())) : null);
}

function myCard(w, i) {
  if (!w) return null;
  const s = stats(w.id), others = s.who.filter(x => x.user_id !== me.id), kid = w.id.slice(0, 8);
  const ctl = h("div", { class: "c-ctl" },
    (() => { const sel = h("select", { id: "st-" + kid, class: "pill s-" + i.status, "aria-label": L("Situação", "Status"), onchange: e => setItem(w, { status: e.target.value }) });
      ST.forEach(x => sel.append(h("option", { value: x, selected: x === i.status }, stLabel(x, w.kind)))); return sel; })(),
    notaSelect("nt-" + kid, i.score, e => setItem(w, { score: e.target.value ? Number(e.target.value) : null })),
    chatBtn(w),
    h("a", { class: "icon", href: workHref(w), "data-link": true, title: L("Abrir página da obra", "Open title page"), "aria-label": L("Abrir ", "Open ") + w.title }, svg(I_OPEN)),
    delArm === w.id
      ? h("button", { class: "icon warn", type: "button", onclick: () => { delArm = null; removeItem(w); } }, L("Tirar?", "Remove?"))
      : h("button", { class: "icon", type: "button", title: L("Tirar da minha lista", "Remove from my list"), "aria-label": L("Tirar ", "Remove ") + w.title + L(" da lista", " from list"), onclick: () => { delArm = w.id; render(); setTimeout(() => { if (delArm === w.id) { delArm = null; render(); } }, 3000); } }, svg(I_DEL)));
  const prog = i.progress ? h("span", { class: "meta" }, L("Você: ", "You: ") + UNIT[w.kind]()[1].toLowerCase() + " " + i.progress + (w.total ? " / " + w.total : "")) : null;
  return h("li", { class: "card s-" + i.status + (flash === w.id ? " flash" : "") },
    h("div", { class: "c-top" }, coverEl(i.image_url || coverOf(w)),
      h("div", { class: "c-name" }, titleLink(w), w.alt_titles ? h("small", { class: "alt" }, w.alt_titles) : null, relLine(w, i), prog,
        others.length ? h("div", { class: "who", style: "margin-top:6px" }, whoChips(others, w.kind, 3)) : null), ctl));
}
function workCard(w, s) {
  const mine = myItem(w.id);
  const card = h("li", { class: "card s-" + (mine ? mine.status : s.who[0] ? s.who[0].status : "quero") + (flash === w.id ? " flash" : "") },
    h("div", { class: "c-top" }, coverEl(coverOf(w)),
      h("div", { class: "c-name" }, titleLink(w),
        h("small", { class: "alt" }, [tv(w.format), w.year, tv(w.status)].filter(Boolean).join(" · ") || w.alt_titles || ""),
        relLine(w, mine),
        s.who.length ? h("div", { class: "who", style: "margin-top:6px" }, whoChips(s.who, w.kind)) : null),
      h("div", { class: "meta col" }, s.avg != null ? h("span", { class: "score" }, fmt(s.avg)) : null, h("span", {}, s.who.length + " " + L(s.who.length === 1 ? "pessoa" : "pessoas", s.who.length === 1 ? "person" : "people")), chatBtn(w))));
  if (mine) card.append(h("div", { class: "meta" }, L("Você: ", "You: "), h("span", { class: "mine-tag s-" + mine.status }, stLabel(mine.status, w.kind)), mine.score ? h("span", { class: "score" }, mine.score) : null));
  else if (canEdit()) {
    if (quick === w.id) card.append(h("div", { class: "sts" }, ST.map(st => h("button", { class: "st s-" + st, type: "button", onclick: async () => { quick = null; if (await setItem(w, { status: st })) ok(w.title + ": " + stLabel(st, w.kind)); } }, stLabel(st, w.kind)))));
    else card.append(h("div", {}, h("button", { class: "link", type: "button", onclick: () => { quick = w.id; render(); } }, L("+ Marcar na minha lista", "+ Add to my list"))));
  }
  return card;
}

/* ---------------- busca e sugestões ---------------- */
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
function renderSugg() {
  const box = $("sugg"), raw = $("q").value, q = norm(raw);
  if (!suggOpen || !q) { box.hidden = true; return; }
  const res = [...works.values()].filter(w => w.kind === cat).map(w => ({ w, sc: sim(q, w) })).filter(x => x.sc >= 0.34).sort((a, b) => b.sc - a.sc || stats(b.w.id).who.length - stats(a.w.id).who.length).slice(0, 6);
  const kids = res.map(({ w }) => {
    const m = myItem(w.id), s = stats(w.id), r = release(w);
    return h("div", { class: "sg" },
      h("div", { class: "sg-head" }, coverEl(coverOf(w), "sm"),
        h("div", { class: "sg-t" }, titleLink(w), h("small", {}, [r.num != null ? relTxt(w, r) : null, w.alt_titles || [tv(w.format), w.year].filter(Boolean).join(" · ")].filter(Boolean).join(" · "))),
        m ? h("span", { class: "mine-tag s-" + m.status }, L("Na sua lista: ", "On your list: ") + stLabel(m.status, w.kind)) : null),
      s.who.length ? h("div", { class: "who" }, whoChips(s.who, w.kind, 4)) : null,
      canEdit() ? h("div", { class: "sts" }, ST.map(st => h("button", { class: "st s-" + st + (m && m.status === st ? " on" : ""), type: "button", onclick: async () => { closeSearch(); if (await setItem(w, { status: st })) ok(w.title + ": " + stLabel(st, w.kind)); } }, stLabel(st, w.kind))),
        h("a", { class: "link", href: workHref(w), "data-link": true }, L("Ver página", "Open page"))) : null);
  });
  if (!res.length) kids.push(h("p", { class: "hint" }, L("Ainda não está no site.", "Not on the site yet.")));
  if (canEdit()) {
    queueAnilist(raw.trim());
    const shownIds = new Set(res.map(x => x.w.anilist_id).filter(Boolean));
    const onSite = new Map([...works.values()].filter(w => w.anilist_id).map(w => [w.anilist_id, w]));
    kids.push(h("p", { class: "sg-sec" }, L("Do AniList · marque e a obra entra no site", "From AniList · mark it and it joins the site")));
    if (alErr) kids.push(h("p", { class: "hint" }, L("Não deu para buscar no AniList agora. Tente de novo em instantes.", "Couldn't search AniList right now. Try again shortly.")));
    else if (!alRes) kids.push(h("p", { class: "hint" }, L("Buscando…", "Searching…")));
    else {
      const al = alRes.filter(a => !shownIds.has(a.anilist_id)).slice(0, 5);
      if (!al.length) kids.push(h("p", { class: "hint" }, L("Nada novo encontrado.", "Nothing new found.")));
      for (const a of al) {
        const there = onSite.get(a.anilist_id);
        kids.push(h("div", { class: "sg" },
          h("div", { class: "sg-head" }, coverEl(a.cover_url, "sm"),
            h("div", { class: "sg-t" }, h("b", {}, a.title), h("small", {}, alSummary(a)), a.alt_titles ? h("small", {}, a.alt_titles) : null),
            there ? h("span", { class: "autotag" }, L("já no site", "on site")) : null),
          h("div", { class: "sts" },
            ...ST.map(st => h("button", { class: "st s-" + st, type: "button", onclick: async () => { closeSearch(); await addFromAnilist(a, st); } }, stLabel(st, a.kind))),
            h("button", { class: "link", type: "button", onclick: async () => { closeSearch(); const w = await addFromAnilist(a, null); if (w) go(workHref(w)); } }, L("Ver página", "Open page")))));
      }
    }
    if (isAdm()) kids.push(h("button", { class: "new", type: "button", onclick: () => {
      draft = { t: raw.trim(), k: cat, s: "visto" }; closeSearch(); renderNew();
      setTimeout(() => { const el = $("nf-sub"); if (el) el.focus(); });
    } }, L("+ Não achei: adicionar “", "+ Not found: add “") + raw.trim() + L("” à mão", "” manually")));
  }
  if (!canEdit()) kids.push(h("p", { class: "hint" }, h("button", { class: "link", type: "button", "data-login": true }, L("Entre na sua conta", "Sign in")), L(" para marcar e adicionar obras.", " to mark and add titles.")));
  box.replaceChildren(...kids); box.hidden = false;
}
function closeSearch() { suggOpen = false; $("q").value = ""; $("sugg").hidden = true; }
$("q").addEventListener("input", () => { suggOpen = true; renderSugg(); });
$("q").addEventListener("focus", () => { if ($("q").value) { suggOpen = true; renderSugg(); } });
$("q").addEventListener("keydown", e => { if (e.key === "Escape") { closeSearch(); $("q").blur(); } });
document.addEventListener("pointerdown", e => { if (suggOpen && !$("searchbox").contains(e.target)) { suggOpen = false; $("sugg").hidden = true; } });

/* ---------------- adicionar à mão (ADM) ---------------- */
function renderNew() {
  const box = $("newform");
  if (!draft || !isAdm()) { box.replaceChildren(); return; }
  const stRow = h("div", { class: "sts" }), kindRow = h("div", { class: "kinds", role: "radiogroup", "aria-label": L("Tipo", "Type") }), imgBox = h("div", {}), title = h("h2", {});
  const paintImg = () => imgBox.replaceChildren(imgPicker("nf-img", draft.preview || null,
    f => { draft.file = f; draft.preview = URL.createObjectURL(f); paintImg(); },
    () => { draft.file = null; draft.preview = null; paintImg(); }));
  const paint = () => {
    title.textContent = L("Nova obra (à mão): ", "New title (manual): ") + KINDS[draft.k].one();
    if (box.firstChild) box.firstChild.dataset.k = draft.k;
    kindRow.replaceChildren(...Object.entries(KINDS).map(([k, v]) => h("button", { class: "kind", type: "button", role: "radio", "data-k": k, "aria-checked": draft.k === k, onclick: () => { draft.k = k; paint(); } }, cap(v.one()))));
    stRow.replaceChildren(...ST.map(s => h("button", { class: "st s-" + s + (draft.s === s ? " on" : ""), type: "button", "aria-pressed": draft.s === s, onclick: () => { draft.s = draft.s === s ? null : s; paint(); } }, stLabel(s, draft.k))));
  };
  const save = h("button", { class: "btn", type: "submit" }, L("Salvar", "Save"));
  box.replaceChildren(h("form", { class: "newform", onsubmit: async e => {
    e.preventDefault(); if (busy) return;
    const t = $("nf-t").value.trim(); if (!t) { fail(L("Escreva o nome da obra.", "Type the title.")); return; }
    const kind = draft.k;
    if (findWork(kind, t)) { fail(L("Essa obra já está no site.", "This title is already on the site.")); return; }
    const feedIn = $("nf-feed").value.trim(), feed = feedIn ? feedFromUrl(feedIn) : "";
    if (feedIn && !feed) { fail(L("Esse link não é do MANGA Plus, WEBTOON nem Shonen Jump+.", "That link isn't from MANGA Plus, WEBTOON or Shonen Jump+.")); return; }
    busy = true; save.disabled = true; save.textContent = L("Salvando…", "Saving…");
    try {
      const cover = draft.file ? await uploadImg(draft.file) : null;
      const w = await api.insertWork({ kind, title: t.slice(0, 160), slug: freeSlug(kind, t), alt_titles: $("nf-sub").value.trim().slice(0, 600), cover_url: cover, feed, created_by: me.id });
      works.set(w.id, w);
      const st = draft.s, score = $("nf-n").value ? Number($("nf-n").value) : null;
      draft = null; renderNew();
      if (st) await setItem(w, { status: st, score });
      ok(L("Adicionado ao site: ", "Added to the site: ") + t);
      go(workHref(w));
    } catch (er) { fail(anyErr(er)); save.disabled = false; save.textContent = L("Salvar", "Save"); }
    busy = false;
  } },
    title,
    h("p", { class: "note" }, L("Dica: prefira a busca do AniList, que já traz capa, sinopse e sites oficiais. Use isto só para obras que não estão lá.", "Tip: prefer the AniList search, which brings cover, synopsis and official sites. Use this only for titles missing there.")),
    h("div", { class: "field" }, L("É um…", "It's a…"), kindRow),
    h("label", { class: "field" }, L("Nome", "Title"), h("input", { id: "nf-t", value: draft.t || "", maxlength: "160", required: true })),
    h("label", { class: "field" }, L("Outros nomes (opcional)", "Other titles (optional)"), h("input", { id: "nf-sub", maxlength: "600" })),
    h("label", { class: "field" }, L("Link do MANGA Plus, WEBTOON ou Shonen Jump+ (opcional, para atualizar sozinho)", "MANGA Plus, WEBTOON or Shonen Jump+ link (optional, for automatic updates)"), h("input", { id: "nf-feed", type: "url", inputmode: "url", placeholder: "https://mangaplus.shueisha.co.jp/titles/…" })),
    imgBox, h("div", { class: "field" }, L("Marcar na minha lista (opcional)", "Mark on my list (optional)"), stRow),
    h("div", { class: "row2" }, notaSelect("nf-n", null, e => e.target.classList.toggle("has", !!e.target.value)),
      h("div", { class: "actions" }, h("button", { class: "btn alt", type: "button", onclick: () => { draft = null; renderNew(); } }, L("Cancelar", "Cancel")), save))));
  paint(); paintImg();
}
$("addbtn").addEventListener("click", () => {
  if (!isAdm()) return;
  draft = { t: $("q").value.trim(), k: cat, s: "visto" }; closeSearch(); renderNew();
  setTimeout(() => { const el = $("nf-t"); if (el) { el.focus(); el.scrollIntoView({ block: "center", behavior: "smooth" }); } });
});

/* ---------------- página não encontrada ---------------- */
function renderNotFound() {
  document.title = L("Página não encontrada", "Page not found") + " · Betoro-chan";
  $("wv").replaceChildren(h("div", { class: "wv-in" }, h("div", { class: "empty notfound" },
    h("strong", {}, "404"),
    h("p", {}, L("Essa página não existe ou mudou de endereço.", "This page doesn't exist or has moved.")),
    h("a", { class: "btn", href: "/", "data-link": true }, L("Voltar para o início", "Back to the start")))));
}

/* ---------------- página da obra ---------------- */
const currentWork = () => [...works.values()].find(w => w.kind === route.kind && w.slug === route.slug);
function renderWork() {
  const box = $("wv"), w = currentWork();
  if (!w) {
    document.title = (ready ? L("Obra não encontrada", "Title not found") : L("Carregando…", "Loading…")) + " · Betoro-chan";
    box.replaceChildren(h("div", { class: "wv-in" }, h("div", { class: "empty notfound" }, h("strong", {}, ready ? L("Obra não encontrada", "Title not found") : L("Carregando…", "Loading…")),
      ready ? h("p", {}, L("Talvez ela tenha sido removida pelo ADM.", "Maybe the admin removed it.")) : null,
      ready ? h("a", { class: "btn", href: KINDS[route.kind].path, "data-link": true }, L("Voltar para a lista", "Back to the list")) : null)));
    return;
  }
  document.title = w.title + " · " + L("Lista de Animes do Betoro-chan", "Betoro-chan's Anime List");
  const k = w.kind, U = UNIT[k](), s = stats(w.id), mine = myItem(w.id), r = release(w);
  const ofKind = [...works.values()].filter(x => x.kind === k).map(x => ({ x, s: stats(x.id) }));
  const ranked = ofKind.filter(o => o.s.avg != null).sort((a, b) => b.s.avg - a.s.avg || b.s.who.length - a.s.who.length);
  const pop = ofKind.filter(o => o.s.who.length).sort((a, b) => b.s.who.length - a.s.who.length);
  const rank = ranked.findIndex(o => o.x.id === w.id) + 1, popr = pop.findIndex(o => o.x.id === w.id) + 1;
  box.style.setProperty("--wk", "var(--c-" + k + ")");
  const cnt = st => s.who.filter(i => i.status === st).length;
  const cov = coverOf(w);
  const info = [[L("Tipo", "Type"), tv(w.format)], [U[0], w.total || "?"], [L("Situação", "Status"), tv(w.status)], [L("Ano", "Year"), w.year], [k === "anime" ? L("Estúdio", "Studio") : L("Autor", "Author"), w.studio], [L("Fonte", "Source"), tv(w.source)], [L("Gêneros", "Genres"), tvList(w.genres).join(", ")]].filter(x => x[1]);
  const side = h("aside", { class: "wv-side" },
    cov ? h("img", { class: "wv-cover", src: cov, alt: L("Capa de ", "Cover of ") + w.title, decoding: "async" }) : h("div", { class: "wv-cover" }, svg(I_IMG)),
    w.alt_titles ? h("div", { class: "blk" }, h("h3", {}, L("Outros nomes", "Other titles")), h("ul", { class: "plain" }, ...w.alt_titles.split(/\s*·\s*/).filter(Boolean).map(n => h("li", {}, n)))) : null,
    h("div", { class: "blk" }, h("h3", {}, L("Informações", "Information")), h("dl", {}, ...info.flatMap(([a, b]) => [h("dt", {}, a), h("dd", {}, String(b))]))),
    h("div", { class: "blk" }, h("h3", {}, L("Estatísticas da galera", "Friends' stats")), h("dl", {},
      h("dt", {}, L("Nota", "Score")), h("dd", {}, s.avg != null ? fmt(s.avg) + " (" + s.nScores + " " + L(s.nScores === 1 ? "nota" : "notas", s.nScores === 1 ? "vote" : "votes") + ")" : "—"),
      h("dt", {}, L("Ranking", "Ranked")), h("dd", {}, rank ? "#" + rank : "—"),
      h("dt", {}, L("Popularidade", "Popularity")), h("dd", {}, popr ? "#" + popr : "—"),
      h("dt", {}, L("Na lista de", "On lists of")), h("dd", {}, s.who.length + " " + L(s.who.length === 1 ? "pessoa" : "pessoas", s.who.length === 1 ? "person" : "people")),
      h("dt", {}, L("Comentários", "Comments")), h("dd", {}, String(commentCount(w.id))))),
    w.anilist_id ? h("div", { class: "blk" }, h("h3", {}, L("Mais informações", "More info")), h("ul", { class: "plain" },
      h("li", {}, h("a", { href: "https://anilist.co/" + (k === "anime" ? "anime" : "manga") + "/" + w.anilist_id, target: "_blank", rel: "noopener" }, "AniList")),
      w.mal_id ? h("li", {}, h("a", { href: "https://myanimelist.net/" + (k === "anime" ? "anime" : "manga") + "/" + w.mal_id, target: "_blank", rel: "noopener" }, "MyAnimeList")) : null)) : null);

  const score = h("div", { class: "scorebox" },
    h("div", { class: "sc-main" }, h("small", {}, L("Nota", "Score")), h("b", {}, s.avg != null ? fmt(s.avg) : "—"), h("span", {}, s.nScores + " " + L(s.nScores === 1 ? "nota" : "notas", s.nScores === 1 ? "vote" : "votes"))),
    h("div", { class: "sc-stats" },
      h("div", {}, h("small", {}, L("Ranking", "Ranked")), h("b", {}, rank ? "#" + rank : "—")),
      h("div", {}, h("small", {}, L("Popularidade", "Popularity")), h("b", {}, popr ? "#" + popr : "—")),
      h("div", {}, h("small", {}, L("Membros", "Members")), h("b", {}, s.who.length)),
      h("div", {}, h("small", {}, stLabel("visto", k)), h("b", {}, cnt("visto")))));

  let mineBox;
  if (canEdit()) {
    const ep = mine ? mine.progress || 0 : 0;
    const setEp = async n => {
      n = Math.max(0, w.total ? Math.min(w.total, n) : n); const p = { progress: n };
      if (w.total && n >= w.total) p.status = "visto";
      else if (n > 0 && (!mine || mine.status === "quero")) p.status = "assistindo";
      if (await setItem(w, p) && p.status === "visto") ok(L("Terminou! Marcado como ", "Finished! Marked as ") + stLabel("visto", k));
    };
    mineBox = h("div", { class: "mine-box" }, h("h3", {}, mine ? L("Na sua lista", "On your list") : L("Adicionar à minha lista", "Add to my list")),
      h("div", { class: "sts" }, ST.map(st => h("button", { class: "st s-" + st + (mine && mine.status === st ? " on" : ""), type: "button", "aria-pressed": !!(mine && mine.status === st), onclick: async () => { if (await setItem(w, { status: st })) ok(w.title + ": " + stLabel(st, k)); } }, stLabel(st, k)))),
      mine ? h("div", { class: "prog" }, notaSelect("wv-nota", mine.score, e => setItem(w, { score: e.target.value ? Number(e.target.value) : null })),
        h("label", { for: "wv-ep" }, U[0] + ":"), h("input", { id: "wv-ep", type: "number", min: "0", inputmode: "numeric", value: ep, onchange: e => setEp(Number(e.target.value) || 0) }),
        h("span", {}, "/ " + (w.total || "?")), h("button", { type: "button", onclick: () => setEp(ep + 1) }, "+1"),
        r.num != null && ep < r.num && mine.status !== "visto" ? h("span", { class: "behind" }, L(`já saiu até o ${numTxt(r.num)}`, `out up to ${numTxt(r.num)}`)) : null,
        w.total ? h("div", { class: "bar-p", role: "progressbar", "aria-valuemin": 0, "aria-valuemax": w.total, "aria-valuenow": ep }, h("i", { style: "width:" + Math.min(100, ep / w.total * 100) + "%" })) : null) : null,
      mine ? h("div", {}, delArm === "wv" ? h("button", { class: "link danger", type: "button", onclick: () => { delArm = null; removeItem(w); } }, L("Tirar mesmo?", "Really remove?"))
        : h("button", { class: "link", type: "button", onclick: () => { delArm = "wv"; render(); setTimeout(() => { if (delArm === "wv") { delArm = null; render(); } }, 3000); } }, L("Tirar da minha lista", "Remove from my list"))) : null);
  } else mineBox = h("div", { class: "mine-box" }, h("h3", {}, L("Quer marcar esta obra?", "Want to track this title?")), h("div", {}, h("button", { class: "btn", type: "button", "data-login": true }, L("Entrar ou criar conta", "Sign in or sign up"))));

  const tabs = h("nav", { class: "wv-tabs", "aria-label": L("Seções da obra", "Title sections") }, [["detalhes", L("Detalhes", "Details")], ["galera", L("Galera", "Friends") + " (" + s.who.length + ")"], ["stats", L("Estatísticas", "Stats")], ["coment", L("Comentários", "Comments") + " (" + commentCount(w.id) + ")"]].map(([id, l]) =>
    h("button", { type: "button", "aria-selected": wvTab === id, onclick: () => { if (id === "coment") { openChat(w); return; } wvTab = id; render(); } }, l)));

  let body;
  if (wvTab === "detalhes") {
    const synPt = w.synopsis, synEn = w.synopsis_en;
    const synTxt = lang === "en" ? (synEn || synPt) : (synPt || synEn);
    const pending = lang === "pt" && !synPt && synEn;
    body = [score, releaseBox(w, r), mineBox,
      h("div", { class: "syn" }, h("h3", {}, L("Sinopse", "Synopsis")),
        pending ? h("p", { class: "note" }, L("A tradução automática chega em alguns minutos. Por enquanto, em inglês:", "")) : null,
        h("p", { lang: (lang === "en" ? !!synEn : !synPt) ? "en" : "pt-BR" }, synTxt || L("Ainda não tem sinopse.", "No synopsis yet.")),
        lang === "pt" && w.syn_src === "gratis" ? h("p", { class: "note" }, "Tradução automática gratuita.") : null),
      w.genres ? h("div", { class: "chips" }, tvList(w.genres).map(g => h("span", {}, g))) : null,
      isAdm() ? admPanel(w, r) : null];
  } else if (wvTab === "galera") {
    const ws2 = [...s.who].sort((a, b) => ST.indexOf(a.status) - ST.indexOf(b.status));
    body = [ws2.length ? h("ul", { class: "gl" }, ws2.map(i => h("li", {}, avEl(i.user_id), h("b", {}, pName(i.user_id)),
      h("span", { class: "mine-tag s-" + i.status }, stLabel(i.status, k) + (i.progress ? " · " + U[1].toLowerCase() + " " + i.progress : "")),
      i.score ? h("span", { class: "score" }, i.score) : h("span", { class: "meta" }, "—"))))
      : h("div", { class: "empty" }, h("strong", {}, L("Ninguém marcou ainda", "Nobody has marked it yet")), L("Seja o primeiro.", "Be the first."))];
  } else {
    const d = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(n => [n, s.who.filter(i => i.score === n).length]); const mx = Math.max(1, ...d.map(x => x[1]));
    body = [h("div", { class: "scorebox" }, ...ST.map(st => h("div", { class: "sc-stats", style: "flex:0 0 auto" }, h("div", {}, h("small", {}, stLabel(st, k)), h("b", {}, cnt(st)))))),
      h("div", { class: "dist", role: "img", "aria-label": L("Distribuição das notas", "Score distribution") }, h("h3", {}, L("Distribuição das notas", "Score distribution")),
        ...d.map(([n, c]) => h("div", {}, h("span", {}, "★" + n), h("span", {}, h("i", { style: "width:" + (c / mx * 100) + "%" })), h("span", {}, c))))];
  }
  box.replaceChildren(h("div", { class: "wv-in" },
    h("div", { class: "wv-top" }, h("a", { class: "wv-back", href: homePath(), "data-link": true }, "← " + KINDS[k].label())),
    h("header", { class: "wv-title" }, h("h1", {}, w.title), h("p", {}, cap(KINDS[k].one()) + (w.alt_titles ? " · " + w.alt_titles : ""))),
    tabs, h("div", { class: "wv-grid" }, side, h("main", { class: "wv-main" }, ...body))));
}

function releaseBox(w, r) {
  const U = UNIT[w.kind]();
  const one = w.kind === "anime" ? L("episódio", "episode") : w.kind === "manga" ? L("capítulo", "chapter") : L("volume", "volume");
  const where = w.kind === "anime" ? L("Onde assistir (oficial)", "Where to watch (official)") : L("Onde ler (oficial)", "Where to read (official)");
  const links = (w.links || []).slice(0, 3);
  const src = { anilist: "AniList", mangaplus: "MANGA Plus", webtoon: "WEBTOON", jumpplus: "Shonen Jump+", adm: "ADM" }[r.src] || "";
  return h("section", { class: "relbox", "aria-label": L("Lançamentos", "Releases") },
    h("h3", {}, L("Lançamentos", "Releases")),
    r.num != null
      ? h("p", { class: "rel-now" + (r.fresh ? " fresh" : "") },
        h("b", {}, relTxt(w, r)), " ", r.fresh ? h("span", { class: "newtag" }, w.kind === "anime" ? L("saiu!", "out now!") : L("novo!", "new!")) : null,
        r.at ? h("span", { class: "meta" }, " · " + ago(r.at) + " (" + when(r.at) + ")") : null,
        r.url ? h("a", { class: "btn small", href: r.url, target: "_blank", rel: "noopener" }, w.kind === "anime" ? L("Assistir", "Watch") : L("Ler", "Read"), svg(I_EXT)) : null)
      : h("p", { class: "meta" }, L(`Ainda sem informação do último ${one}.`, `No info yet about the latest ${one}.`)),
    r.next ? h("p", { class: "rel-next" }, L("Próximo: ", "Next: "), h("b", {}, U[1] + " " + r.next.num), " · " + when(r.next.at) + " · ", h("span", { class: "count" }, countdown(r.next.at - Date.now()))) : null,
    links.length ? h("div", { class: "where" }, h("small", {}, where),
      h("div", { class: "where-links" }, links.map(l => h("a", { class: "site", href: l.url, target: "_blank", rel: "noopener" }, l.site, l.lang ? h("span", { class: "lang" }, l.lang) : null, svg(I_EXT)))))
      : h("p", { class: "meta" }, L("Nenhum site oficial cadastrado ainda.", "No official site listed yet.")),
    src || w.rel_checked_at ? h("p", { class: "note" }, [src ? L("Fonte: ", "Source: ") + src : null, w.rel_checked_at ? L("conferido ", "checked ") + ago(Date.parse(w.rel_checked_at)) : null].filter(Boolean).join(" · ")) : null);
}

/* ---------------- ferramentas do ADM na página da obra ---------------- */
function admPanel(w, r) {
  const btn = (id, label) => h("button", { class: "btn alt small" + (wvPanel === id ? " on" : ""), type: "button", "aria-expanded": wvPanel === id, onclick: () => { wvPanel = wvPanel === id ? null : id; wvEditImg = null; render(); } }, label);
  return h("section", { class: "adm", "aria-label": L("Ferramentas do ADM", "Admin tools") },
    h("h3", {}, h("span", { class: "admtag" }, "ADM"), " ", L("Ferramentas da obra", "Title tools")),
    h("div", { class: "adm-btns" },
      btn("rel", L("Atualizar lançamento", "Update release")),
      btn("edit", L("Editar informações", "Edit information")),
      !w.anilist_id ? btn("al", L("Completar com o AniList", "Fill from AniList")) : null,
      btn("del", L("Apagar obra", "Delete title"))),
    wvPanel === "rel" ? relForm(w, r) : null,
    wvPanel === "edit" ? editForm(w) : null,
    wvPanel === "al" ? alLinkBox(w) : null,
    wvPanel === "del" ? delBox(w) : null);
}
function relForm(w, r) {
  const U = UNIT[w.kind]();
  const one = w.kind === "anime" ? L("episódio", "episode") : w.kind === "manga" ? L("capítulo", "chapter") : L("volume", "volume");
  const save = h("button", { class: "btn", type: "submit" }, L("Salvar", "Save"));
  return h("form", { class: "wv-edit", onsubmit: async e => {
    e.preventDefault();
    const raw = $("rf-num").value, n = Number(raw);
    if (raw === "" || !isFinite(n) || n < 0) { fail(L("Escreva o número do último lançamento.", "Type the number of the latest release.")); return; }
    const url = $("rf-url").value.trim();
    if (url && !/^https?:\/\//.test(url)) { fail(L("O link precisa começar com https://", "The link must start with https://")); return; }
    save.disabled = true;
    try {
      const patch = { rel_num: n, rel_label: $("rf-label").value.trim().slice(0, 80), rel_url: url || null, rel_src: "adm", rel_at: new Date().toISOString(), rel_checked_at: new Date().toISOString() };
      if (w.rel_at && (w.rel_num == null || n > Number(w.rel_num))) patch.rel_prev_at = w.rel_at;
      const nw = await api.updateWork(w.id, patch); works.set(nw.id, nw); wvPanel = null; ok(L("Lançamento atualizado: ", "Release updated: ") + U[1] + " " + numTxt(n));
    } catch (er) { fail(errMsg(er)); save.disabled = false; }
    render();
  } },
    h("p", { class: "note full" }, w.feed ? L("Esta obra já atualiza sozinha pelo ", "This title updates automatically from ") + feedLabel(w.feed) + L(". Use isto só para corrigir.", ". Use this only to fix it.")
      : w.kind === "anime" && w.anilist_id ? L("Animes atualizam sozinhos pelo horário oficial do AniList. Use isto só para corrigir.", "Anime update automatically from AniList's official schedule. Use this only to fix it.")
      : L("Esta obra não tem fonte automática gratuita. Atualize aqui quando sair um novo.", "This title has no free automatic source. Update it here when a new one comes out.")),
    h("label", { class: "field" }, L(`Último ${one} lançado (número)`, `Latest ${one} released (number)`), h("input", { id: "rf-num", type: "number", min: "0", step: "any", inputmode: "decimal", value: r.num ?? "", required: true })),
    h("label", { class: "field" }, L("Nome (opcional, ex.: Vol. 3 Cap. 20)", "Label (optional, e.g. Vol. 3 Ch. 20)"), h("input", { id: "rf-label", maxlength: "80", value: w.rel_src === "adm" ? w.rel_label || "" : "" })),
    h("label", { class: "field full" }, L("Link oficial para ler/assistir (opcional)", "Official link to read/watch (optional)"), h("input", { id: "rf-url", type: "url", inputmode: "url", value: w.rel_url || "", placeholder: "https://" })),
    h("div", { class: "actions full" }, h("button", { class: "btn alt", type: "button", onclick: () => { wvPanel = null; render(); } }, L("Cancelar", "Cancel")), save));
}
function editForm(w) {
  const U = UNIT[w.kind]();
  const f = (id, label, v, cls, type) => h("label", { class: "field" + (cls ? " " + cls : "") }, label, h("input", { id: "we-" + id, value: v ?? "", type: type || "text" }));
  const cur = wvEditImg ? wvEditImg.url : coverOf(w);
  const links = (w.links || []).slice(0, 3);
  const save = h("button", { class: "btn", type: "submit" }, L("Salvar", "Save"));
  return h("form", { class: "wv-edit", onsubmit: async e => {
    e.preventDefault(); if (busy) return;
    const g = id => $("we-" + id).value.trim();
    const title = g("title"); if (!title) { fail(L("O nome não pode ficar vazio.", "The title can't be empty.")); return; }
    const newLinks = [0, 1, 2].map(i => ({ site: g("ls" + i), url: g("lu" + i) })).filter(l => l.site || l.url);
    if (newLinks.some(l => !/^https?:\/\//.test(l.url) || !l.site)) { fail(L("Cada site oficial precisa de nome e de um link começando com https://", "Each official site needs a name and a link starting with https://")); return; }
    const feedIn = g("feed"); const feed = feedIn ? feedFromUrl(feedIn) : "";
    if (feedIn && !feed) { fail(L("Esse link não é do MANGA Plus, WEBTOON nem Shonen Jump+.", "That link isn't from MANGA Plus, WEBTOON or Shonen Jump+.")); return; }
    const linksChanged = JSON.stringify(newLinks.map(l => [l.site, l.url])) !== JSON.stringify(links.map(l => [l.site, l.url]));
    const patch = {
      title, alt_titles: g("alt"), format: g("tipo"), total: g("total") ? Math.max(0, Number(g("total")) || 0) : null, status: g("situ"),
      year: g("ano") ? Number(g("ano")) || null : null, studio: g("estudio"), source: g("fonte"), genres: g("generos"),
      synopsis: $("we-syn").value.trim(), synopsis_en: $("we-synen").value.trim(), feed,
    };
    if (patch.synopsis !== (w.synopsis || "")) patch.syn_src = "adm";
    if (linksChanged) patch.links = newLinks.map(l => ({ site: l.site.slice(0, 40), url: l.url, lang: "", adm: true }));
    busy = true; save.disabled = true; save.textContent = L("Salvando…", "Saving…");
    try {
      if (wvEditImg && wvEditImg.file) patch.cover_url = await uploadImg(wvEditImg.file);
      const nw = await api.updateWork(w.id, patch); works.set(nw.id, nw); wvPanel = null; wvEditImg = null; ok(L("Informações salvas.", "Information saved."));
    } catch (er) { fail(anyErr(er)); }
    busy = false; render();
  } },
    h("div", { class: "full" }, imgPicker("we-img", cur, file => { wvEditImg = { file, url: URL.createObjectURL(file) }; render(); }, null)),
    f("title", L("Nome", "Title"), w.title, "full"), f("alt", L("Outros nomes (separados por · )", "Other titles (separated by · )"), w.alt_titles, "full"),
    f("tipo", L("Tipo (TV, Filme, Manhwa…)", "Type (TV, Movie, Manhwa…)"), w.format), f("total", L("Total de ", "Total ") + U[0].toLowerCase(), w.total, "", "number"),
    f("situ", L("Situação", "Status"), w.status), f("ano", L("Ano", "Year"), w.year, "", "number"),
    f("estudio", w.kind === "anime" ? L("Estúdio", "Studio") : L("Autor", "Author"), w.studio), f("fonte", L("Fonte", "Source"), w.source),
    f("generos", L("Gêneros (separados por vírgula)", "Genres (comma separated)"), w.genres, "full"),
    h("label", { class: "field full" }, L("Sinopse em português", "Synopsis in Portuguese"), h("textarea", { id: "we-syn" }, w.synopsis || "")),
    h("label", { class: "field full" }, L("Sinopse em inglês", "Synopsis in English"), h("textarea", { id: "we-synen" }, w.synopsis_en || "")),
    f("feed", L("Link do MANGA Plus, WEBTOON ou Shonen Jump+ (atualiza o capítulo sozinho)", "MANGA Plus, WEBTOON or Shonen Jump+ link (updates chapters automatically)"), w.feed ? feedToUrl(w.feed) : "", "full", "url"),
    h("fieldset", { class: "full links-edit" }, h("legend", {}, L("Sites oficiais (até 3)", "Official sites (up to 3)")),
      h("p", { class: "note" }, L("Se você mudar estes links, a atualização automática não troca mais.", "If you change these links, the automatic update won't replace them.")),
      ...[0, 1, 2].map(i => h("div", { class: "linkrow" },
        h("input", { id: "we-ls" + i, value: (links[i] || {}).site || "", placeholder: L("Nome (ex.: Crunchyroll)", "Name (e.g. Crunchyroll)"), "aria-label": L("Nome do site ", "Site name ") + (i + 1), maxlength: "40" }),
        h("input", { id: "we-lu" + i, value: (links[i] || {}).url || "", placeholder: "https://", type: "url", inputmode: "url", "aria-label": L("Link do site ", "Site link ") + (i + 1) })))),
    h("div", { class: "actions full" }, h("button", { class: "btn alt", type: "button", onclick: () => { wvPanel = null; wvEditImg = null; render(); } }, L("Cancelar", "Cancel")), save));
}
let alLink = null;
function alLinkBox(w) {
  const st = alLink && alLink.wid === w.id ? alLink : null;
  const box = h("div", { class: "syn" });
  if (!st) {
    box.append(h("p", { class: "note" }, L("Busca capa, sinopse, ano, episódios ou capítulos, sites oficiais e a fonte automática no AniList. Só preenche o que estiver vazio.", "Looks up cover, synopsis, year, episodes or chapters, official sites and the automatic source on AniList. Only fills empty fields.")),
      h("button", { class: "btn", type: "button", onclick: async () => {
        alLink = { wid: w.id, res: null }; render();
        try { alLink.res = await anilistSearch(w.title, w.kind); } catch { alLink.err = true; }
        render();
      } }, L("Buscar no AniList", "Search AniList")));
    return box;
  }
  if (st.err) { box.append(h("p", { class: "hint" }, L("Não deu para buscar no AniList agora. Tente de novo mais tarde.", "Couldn't search AniList right now. Try again later."))); return box; }
  if (!st.res) { box.append(h("p", { class: "hint" }, L("Buscando…", "Searching…"))); return box; }
  if (!st.res.length) { box.append(h("p", { class: "hint" }, L("Não encontrei. Confira se o nome está certo em “Editar informações”.", "Not found. Check the title in “Edit information”."))); return box; }
  box.append(h("p", { class: "note" }, L("Qual destes é a obra?", "Which one is it?")));
  const taken = new Set([...works.values()].map(x => x.anilist_id).filter(Boolean));
  for (const a of st.res.slice(0, 5)) box.append(h("div", { class: "sg", style: "padding:10px 0" },
    h("div", { class: "sg-head" }, coverEl(a.cover_url, "sm"), h("div", { class: "sg-t" }, h("b", {}, a.title), h("small", {}, alSummary(a))),
      taken.has(a.anilist_id) ? h("span", { class: "autotag" }, L("já é outra obra do site", "already another title")) :
      h("button", { class: "btn alt small", type: "button", onclick: async () => {
        const patch = { anilist_id: a.anilist_id, mal_id: a.mal_id };
        for (const key of ["cover_url", "synopsis_en", "genres", "format", "status", "studio", "source", "feed"]) if (!w[key] && a[key]) patch[key] = a[key];
        if (w.total == null && a.total != null) patch.total = a.total;
        if (w.year == null && a.year != null) patch.year = a.year;
        if (!(w.links || []).length && a.links.length) patch.links = a.links;
        if (w.kind === "anime") for (const key of ["next_num", "next_at"]) if (a[key] != null) patch[key] = a[key];
        if (w.rel_num == null && a.rel_num != null) { patch.rel_num = a.rel_num; patch.rel_src = "anilist"; }
        const extra = [a.title, ...String(a.alt_titles || "").split(" · ")].filter(x => x && norm(x) !== norm(w.title) && !norm(w.alt_titles).includes(norm(x)));
        if (extra.length) patch.alt_titles = [w.alt_titles, ...extra].filter(Boolean).join(" · ").slice(0, 600);
        try { const nw = await api.updateWork(w.id, patch); works.set(nw.id, nw); alLink = null; wvPanel = null; ok(L("Informações completadas!", "Information filled in!")); render(); } catch (e) { fail(errMsg(e)); }
      } }, L("É este", "This one")))));
  box.append(h("button", { class: "link", type: "button", onclick: () => { alLink = null; render(); } }, L("Cancelar", "Cancel")));
  return box;
}
function delBox(w) {
  const n = stats(w.id).who.length, c = commentCount(w.id);
  return h("div", { class: "syn danger-box" },
    h("p", {}, L(`Apagar “${w.title}” tira a obra do site, de ${n} ${n === 1 ? "lista" : "listas"} e apaga ${c} ${c === 1 ? "comentário" : "comentários"}. Não dá para desfazer.`,
      `Deleting “${w.title}” removes it from the site, from ${n} ${n === 1 ? "list" : "lists"} and deletes ${c} ${c === 1 ? "comment" : "comments"}. This can't be undone.`)),
    h("div", { class: "actions" },
      h("button", { class: "btn alt", type: "button", onclick: () => { wvPanel = null; render(); } }, L("Cancelar", "Cancel")),
      h("button", { class: "btn danger", type: "button", onclick: async () => {
        try { await api.deleteWork(w.id); works.delete(w.id); items = items.filter(i => i.work_id !== w.id); comments = comments.filter(x => x.work_id !== w.id); ok(L("Obra apagada: ", "Title deleted: ") + w.title); go(KINDS[w.kind].path + "/catalogo"); }
        catch (e) { fail(errMsg(e)); }
      } }, L("Apagar de vez", "Delete for good"))));
}

/* ---------------- comentários ---------------- */
async function openChat(w) {
  chatWork = w; replyTo = null; chatDel = null; chatMsgs = null;
  $("sheet").hidden = false; $("sheetbg").hidden = false; document.body.classList.add("noscroll");
  $("composer").hidden = !canEdit(); $("sheetro").hidden = canEdit();
  renderChat(true); paintComposer();
  setTimeout(() => { const b = $("sheet").querySelector(".sheet-head .icon"); if (b) b.focus(); });
  await loadChat(true);
}
async function loadChat(scrollEnd) {
  if (!chatWork) return;
  const wid = chatWork.id;
  try { const rows = await api.loadComments(wid); if (!chatWork || chatWork.id !== wid) return; chatMsgs = rows; }
  catch (e) { chatMsgs = chatMsgs || []; fail(errMsg(e)); }
  renderChat(scrollEnd);
}
function closeChat() { chatWork = null; replyTo = null; $("sheet").hidden = true; $("sheetbg").hidden = true; document.body.classList.remove("noscroll"); render(); }
function msgEl(m, isReply) {
  const mine = m.user_id === myId();
  const text = h("p", { class: "m-text" + (m.gone ? " gone" : "") });
  if (m.gone) text.textContent = L("Mensagem apagada", "Deleted message");
  else { if (m.reply_to_user && isReply) text.append(h("span", { class: "at" }, "@" + pName(m.reply_to_user) + " ")); text.append(m.body || ""); }
  const act = h("div", { class: "m-act" });
  if (canEdit() && !m.gone) act.append(h("button", { type: "button", onclick: () => { replyTo = { root: m.parent_id || m.id, uid: m.user_id }; paintComposer(); $("cmsg").focus(); } }, L("Responder", "Reply")));
  if ((mine || isAdm()) && !m.gone) act.append(chatDel === m.id
    ? h("button", { class: "danger", type: "button", onclick: () => delMsg(m) }, L("Apagar mesmo?", "Really delete?"))
    : h("button", { type: "button", onclick: () => { chatDel = m.id; renderChat(); setTimeout(() => { if (chatDel === m.id) { chatDel = null; renderChat(); } }, 3000); } }, mine ? L("Apagar", "Delete") : L("Apagar (ADM)", "Delete (admin)")));
  const t = Date.parse(m.created_at);
  return h("div", { class: "msg" + (mine ? " mine" : "") + (chatFlash === m.id ? " flash" : "") },
    m.gone ? h("span", { class: "ava", style: "background:var(--line)" }, "") : avEl(m.user_id),
    h("div", {}, h("div", { class: "m-head" }, h("b", {}, m.gone ? "—" : pName(m.user_id)), (profiles.get(m.user_id) || {}).is_admin && !m.gone ? h("span", { class: "admtag" }, "ADM") : null, t ? h("time", { datetime: m.created_at, title: new Date(t).toLocaleString(locale()) }, ago(t)) : null),
      text, m.image_url ? (() => { const im = h("img", { class: "m-img", src: m.image_url, alt: L("Imagem enviada", "Attached image"), loading: "lazy", decoding: "async" }); im.addEventListener("error", () => im.remove()); return im; })() : null,
      act.childNodes.length ? act : null));
}
function renderChat(scrollEnd) {
  if (!chatWork) return;
  const w = works.get(chatWork.id) || chatWork, box = $("chat");
  const msgs = chatMsgs || [];
  if (msgs.length) { const mx = Math.max(...msgs.map(m => Date.parse(m.created_at))); if (mx > (seen[w.id] || 0)) { seen[w.id] = mx; lsSet("comentariosVistos", seen); } }
  $("sheethead").replaceChildren(coverEl(coverOf(w)),
    h("div", {}, h("h2", { id: "sheet-title" }, w.title),
      h("small", {}, h("span", { class: "kindtag", style: "--kc:var(--c-" + w.kind + ")" }, KINDS[w.kind].one()), " · " + msgs.length + " " + L(msgs.length === 1 ? "comentário" : "comentários", msgs.length === 1 ? "comment" : "comments"))),
    h("button", { class: "icon", type: "button", "aria-label": L("Fechar", "Close"), onclick: closeChat }, svg(I_X)));
  if (chatMsgs === null) { box.replaceChildren(h("div", { class: "empty" }, h("strong", {}, L("Carregando…", "Loading…")))); return; }
  const roots = new Map(), reps = new Map();
  for (const m of msgs) { if (m.parent_id) { if (!reps.has(m.parent_id)) reps.set(m.parent_id, []); reps.get(m.parent_id).push(m); } else roots.set(m.id, m); }
  for (const id of reps.keys()) if (!roots.has(id)) roots.set(id, { id, gone: true, created_at: reps.get(id)[0].created_at });
  const threads = [...roots.values()].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const nearEnd = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  if (!threads.length) { box.replaceChildren(h("div", { class: "empty" }, h("strong", {}, L("Nenhum comentário ainda", "No comments yet")), canEdit() ? L("Seja o primeiro a comentar sobre ", "Be the first to comment on ") + w.title + "." : L("Quando alguém comentar, aparece aqui.", "Comments will show up here."))); return; }
  box.replaceChildren(...threads.map(r => h("article", { class: "thread" }, msgEl(r, false),
    reps.has(r.id) ? h("div", { class: "replies" }, reps.get(r.id).map(x => msgEl(x, true))) : null)));
  if (scrollEnd || nearEnd) box.scrollTop = box.scrollHeight;
}
async function delMsg(m) {
  chatDel = null;
  try { await api.deleteComment(m.id); chatMsgs = chatMsgs.filter(x => x.id !== m.id); comments = comments.filter(x => x.id !== m.id); renderChat(); render(); ok(L("Mensagem apagada.", "Message deleted.")); }
  catch (e) { fail(errMsg(e)); }
}
function paintComposer() {
  const r = $("replying");
  if (replyTo) { r.hidden = false; r.replaceChildren(L("Respondendo a ", "Replying to "), h("b", {}, pName(replyTo.uid)), h("button", { type: "button", onclick: () => { replyTo = null; paintComposer(); } }, L("✕ cancelar", "✕ cancel"))); }
  else r.hidden = true;
  const p = $("cpreview");
  if (chatFile) { p.hidden = false; p.replaceChildren(h("img", { src: chatFile.url, alt: L("Prévia", "Preview") }), L("Imagem anexada", "Image attached"), h("button", { type: "button", onclick: () => { chatFile = null; $("cimg").value = ""; paintComposer(); } }, L("✕ remover", "✕ remove"))); }
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
    renderChat(!wasReply); render(); ok(L("Comentário enviado.", "Comment posted.")); setTimeout(() => { chatFlash = null; }, 600);
  } catch (er) { fail(anyErr(er)); }
  chatBusy = false; paintComposer();
});
$("sheetbg").addEventListener("click", closeChat);
document.addEventListener("keydown", e => { if (e.key === "Escape") { if (!$("gate").hidden) closeLogin(); else if (chatWork) closeChat(); } });

/* ---------------- login ---------------- */
let loginMode = "entrar";
function openLogin() {
  if (!api) { fail(L("O site ainda não foi ligado ao banco de dados.", "The site is not connected to the database yet.")); return; }
  $("gate").hidden = false; paintLogin();
  setTimeout(() => { const el = $("lg-nick") || $("lg-email"); if (el) el.focus(); });
}
function closeLogin() { $("gate").hidden = true; }
function paintLogin() {
  const g = $("gate");
  const err = h("p", { class: "gate-err", id: "lg-err", role: "alert" });
  const isUp = loginMode === "criar", isReset = loginMode === "senha";
  const btn = h("button", { class: "gbtn main", type: "submit" }, isUp ? L("Criar conta", "Create account") : isReset ? L("Mandar link para trocar a senha", "Send password reset link") : L("Entrar", "Sign in"));
  g.replaceChildren(h("form", { class: "gate-card", "aria-labelledby": "lg-title", onsubmit: async e => {
    e.preventDefault(); err.textContent = ""; err.className = "gate-err";
    const email = $("lg-email").value.trim(), pass = $("lg-pass") ? $("lg-pass").value : "";
    btn.disabled = true;
    try {
      if (isReset) { await api.resetPassword(email); err.className = "gate-ok"; err.textContent = L("Pronto! Veja seu e-mail para trocar a senha.", "Done! Check your e-mail to reset your password."); btn.disabled = false; return; }
      if (isUp) {
        const nick = $("lg-nick").value.trim().slice(0, 40);
        if (!nick) { err.textContent = L("Escolha um nome para a galera ver.", "Pick a name for your friends to see."); btn.disabled = false; return; }
        const r = await api.signUp(email, pass, nick);
        if (!r.session) { err.className = "gate-ok"; err.textContent = L("Conta criada! Confirme pelo link que chegou no seu e-mail e depois entre.", "Account created! Confirm with the link sent to your e-mail, then sign in."); btn.disabled = false; return; }
      } else await api.signIn(email, pass);
      closeLogin(); ok(isUp ? L("Conta criada. Bem-vindo!", "Account created. Welcome!") : L("Bem-vindo de volta!", "Welcome back!"));
    } catch (er) { err.textContent = errMsg(er); btn.disabled = false; }
  } },
    h("button", { class: "icon gate-x", type: "button", "aria-label": L("Fechar", "Close"), onclick: closeLogin }, svg(I_X)),
    h("p", { class: "eyebrow" }, "ベトロちゃん"),
    h("h2", { id: "lg-title" }, isUp ? L("Criar conta", "Create account") : isReset ? L("Esqueci a senha", "Forgot password") : L("Entrar", "Sign in")),
    isUp ? h("label", { class: "field" }, L("Seu nome na lista", "Your name on the list"), h("input", { id: "lg-nick", maxlength: "40", autocomplete: "nickname", required: true })) : null,
    h("label", { class: "field" }, "E-mail", h("input", { id: "lg-email", type: "email", required: true, autocomplete: "email", inputmode: "email" })),
    isReset ? null : h("label", { class: "field" }, L("Senha", "Password"), h("input", { id: "lg-pass", type: "password", required: true, minlength: "6", autocomplete: isUp ? "new-password" : "current-password" })),
    isUp ? h("small", { class: "note" }, L("Mínimo de 6 caracteres.", "At least 6 characters.")) : null,
    err, btn,
    h("div", { class: "gate-links" },
      loginMode !== "entrar" ? h("button", { class: "link", type: "button", onclick: () => { loginMode = "entrar"; paintLogin(); } }, L("Já tenho conta", "I have an account")) : null,
      loginMode !== "criar" ? h("button", { class: "link", type: "button", onclick: () => { loginMode = "criar"; paintLogin(); } }, L("Criar conta", "Create account")) : null,
      loginMode === "entrar" ? h("button", { class: "link", type: "button", onclick: () => { loginMode = "senha"; paintLogin(); } }, L("Esqueci a senha", "Forgot password")) : null)));
}
$("gate").addEventListener("click", e => { if (e.target === $("gate")) closeLogin(); });

/* ---------------- ao vivo ---------------- */
const pending = new Set(); let pendT = null;
function onChange(table, payload) {
  const n = payload && payload.new, o = payload && payload.old, ev = payload && payload.eventType;
  if (table === "works" && ev === "DELETE" && o && o.id) works.delete(o.id);
  else if (table === "works" && n && n.id) works.set(n.id, n);
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
      if (t === "list_items") items = rows;
      else if (t === "comments") { comments = rows; if (chatWork) loadChat(false); }
      else if (t === "works") works = new Map(rows.map(r => [r.id, r]));
    } catch {}
  }
  scheduleRender();
}
let rT = null; function scheduleRender() { clearTimeout(rT); rT = setTimeout(render, 60); }

// a cada minuto: contagem regressiva e "saiu!" na hora oficial
setInterval(() => {
  if (document.visibilityState !== "visible") return;
  const a = document.activeElement;
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
  render();
}, 60000);

/* ---------------- início ---------------- */
document.querySelectorAll("#langs button").forEach(b => b.addEventListener("click", () => setLang(b.dataset.lang)));
(async function boot() {
  document.documentElement.lang = lang === "en" ? "en" : "pt-BR";
  const p = new URLSearchParams(location.search).get("p"); // vindo do 404.html
  if (p && p.startsWith("/")) history.replaceState(null, "", p);
  renderStatic();
  if (!api) { route = parseRoute(location.pathname); render(); return; }
  me = await api.session().catch(() => null);
  api.onAuth(u => {
    const changed = (u && u.id) !== (me && me.id); me = u;
    if (!changed) return;
    if (!me && mode === "minha" && route.view === "home") go(KINDS[cat].path + "/catalogo", true); else render();
    renderStatic();
    if (chatWork) { $("composer").hidden = !canEdit(); $("sheetro").hidden = canEdit(); renderChat(false); }
  });
  if (location.pathname === "/" || location.pathname === "") history.replaceState(null, "", me ? "/animes" : "/animes/catalogo");
  route = parseRoute(location.pathname);
  if (!me && route.view === "home" && route.mode === "minha") history.replaceState(null, "", KINDS[route.kind].path + "/catalogo");
  applyRoute();
  try {
    const d = await api.loadAll();
    works = new Map(d.works.map(w => [w.id, w])); items = d.items; profiles = new Map(d.profiles.map(x => [x.id, x])); comments = d.comments;
  } catch (e) { fail(L("Não deu para carregar a lista. ", "Couldn't load the list. ") + errMsg(e)); }
  ready = true; render(); renderStatic();
  try { api.subscribe(onChange); } catch {}
})();
