/* =====================================================================
   Lista de Animes do Betoro-chan — base
   Idioma, utilidades, acesso ao banco, estado, lançamentos, pessoas e imagens.
   ===================================================================== */
"use strict";

// código que o site divide com o robô (arquivo comum.js, carregado antes deste)
const { AL_KINDS, AL_FIELDS, alToWork, feedFromUrl, feedLabel, feedToUrl, linkSeguro, traduzir } = window.Comum;

/* ---------------- idioma ---------------- */
let lang = lsGet("idioma", "pt") === "en" ? "en" : "pt";
const L = (pt, en) => (lang === "en" ? en : pt);
const locale = () => (lang === "en" ? "en-US" : "pt-BR");
function setLang(l) {
  lang = l === "en" ? "en" : "pt";
  lsSet("idioma", lang);
  document.documentElement.lang = lang === "en" ? "en" : "pt-BR";
  render();
  renderStatic();
  if (chatWork) {
    renderChat(false);
    paintComposer();
  }
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
// "episódio", "capítulo" ou "volume", conforme o tipo da obra
const umDe = kind => (kind === "anime" ? L("episódio", "episode") : kind === "manga" ? L("capítulo", "chapter") : L("volume", "volume"));
const ST = ["assistindo", "visto", "quero", "dropei"];
function stLabel(s, k) {
  const read = k !== "anime";
  return (
    {
      assistindo: read ? L("Lendo", "Reading") : L("Assistindo", "Watching"),
      visto: read ? L("Li", "Read") : L("Vi", "Watched"),
      quero: read ? L("Quero ler", "Plan to read") : L("Quero ver", "Plan to watch"),
      dropei: L("Dropei", "Dropped"),
    }[s] || s
  );
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

// valores guardados em português, mostrados no idioma escolhido
const VAL_EN = {
  Finalizado: "Finished",
  "Em lançamento": "Releasing",
  "Ainda não lançado": "Not yet released",
  Cancelado: "Cancelled",
  "Em hiato": "On hiatus",
  "TV (curto)": "TV short",
  Filme: "Movie",
  Especial: "Special",
  Mangá: "Manga",
  Jogo: "Video game",
  "Web mangá": "Web manga",
  Outro: "Other",
  Ação: "Action",
  Aventura: "Adventure",
  Comédia: "Comedy",
  Fantasia: "Fantasy",
  Terror: "Horror",
  Música: "Music",
  Mistério: "Mystery",
  Psicológico: "Psychological",
  "Ficção científica": "Sci-Fi",
  "Slice of life": "Slice of Life",
  Esportes: "Sports",
  Sobrenatural: "Supernatural",
  Suspense: "Thriller",
  Escolar: "School",
};
const VAL_PT = Object.fromEntries(Object.entries(VAL_EN).map(([a, b]) => [b, a]));
const tv = v => {
  const s = String(v ?? "");
  return lang === "en" ? VAL_EN[s] || s : VAL_PT[s] || s;
};
const tvList = v =>
  String(v || "")
    .split(/\s*,\s*/)
    .filter(Boolean)
    .map(tv);

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
  for (const [k, v] of Object.entries({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "2.2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
  }))
    s.setAttribute(k, v);
  s.innerHTML = path;
  return s;
}
const I_IMG = '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>';
const I_CHAT = '<path d="M4 5h16v11H9l-5 4z"/>';
const I_OPEN = '<path d="M9 6h9v9M18 6 6 18"/>';
const I_DEL = '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>';
const I_X = '<path d="M6 6l12 12M18 6 6 18"/>';
const I_EXT = '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>';
const norm = t =>
  String(t || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const slugify = t =>
  norm(t)
    .replace(/[^a-z0-9 ]/g, "")
    .trim()
    .replace(/ +/g, "-")
    .slice(0, 100) || "obra";
const fmt = n => (Math.round(n * 10) / 10).toLocaleString(locale());
const numTxt = n => (Number.isInteger(Number(n)) ? String(Number(n)) : Number(n).toLocaleString(locale()));
function ago(t) {
  const d = (Date.now() - t) / 1000;
  if (d < 60) return L("agora", "just now");
  if (d < 3600) {
    const n = Math.floor(d / 60);
    return L(`há ${n} min`, `${n} min ago`);
  }
  if (d < 86400) {
    const n = Math.floor(d / 3600);
    return L(`há ${n} h`, `${n} h ago`);
  }
  const dd = Math.floor(d / 86400);
  if (dd < 30) return L(`há ${dd} ${dd === 1 ? "dia" : "dias"}`, `${dd} ${dd === 1 ? "day" : "days"} ago`);
  const mm = Math.floor(dd / 30);
  if (mm < 12) return L(`há ${mm} ${mm === 1 ? "mês" : "meses"}`, `${mm} ${mm === 1 ? "month" : "months"} ago`);
  const yy = Math.floor(dd / 365);
  return L(`há ${yy} ${yy === 1 ? "ano" : "anos"}`, `${yy} ${yy === 1 ? "year" : "years"} ago`);
}
function countdown(ms) {
  const m = Math.max(0, Math.round(ms / 60000)),
    d = Math.floor(m / 1440),
    hh = Math.floor((m % 1440) / 60),
    mi = m % 60;
  const s = d ? `${d}d ${hh}h` : hh ? `${hh}h ${mi}min` : `${mi}min`;
  return L(`em ${s}`, `in ${s}`);
}
// textos de tempo que o relógio do site atualiza sozinho a cada minuto (veja js/inicio.js)
const agoEl = (t, cls) => h("span", { class: cls == null ? "meta" : cls, "data-desde": t }, ago(t));
const countEl = (t, cls) => h("span", { class: cls == null ? "count" : cls, "data-ate": t }, countdown(t - Date.now()));
const when = t =>
  new Date(t).toLocaleString(locale(), { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
// mensagem no rodapé da tela; "ms" muda quanto tempo ela fica (padrão: 2,8 s; erro: 5 s)
function toast(msg, kind, ms) {
  const t = $("toast");
  t.className = "toast" + (kind === "ok" ? " ok" : kind === "err" ? " err" : "");
  t.replaceChildren(
    kind === "ok" ? h("b", { "aria-hidden": "true" }, "✓ ") : kind === "err" ? h("b", { "aria-hidden": "true" }, "! ") : "",
    msg,
  );
  t.setAttribute("role", kind === "err" ? "alert" : "status");
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.hidden = true), ms || (kind === "err" ? 5000 : 2800));
}
const ok = m => toast(m, "ok"),
  fail = m => toast(m, "err");
function lsGet(k, d) {
  try {
    const v = localStorage.getItem(k);
    return v == null ? d : JSON.parse(v);
  } catch {
    return d;
  }
}
function lsSet(k, v) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
}

// transforma o erro do banco ou da internet numa frase que a pessoa entende
const ERROS = [
  [/Invalid login/i, "E-mail ou senha errados.", "Wrong e-mail or password."],
  [/already registered/i, "Esse e-mail já tem conta. Use “Entrar”.", "This e-mail already has an account. Use “Sign in”."],
  [/Password should be/i, "A senha precisa ter pelo menos 6 caracteres.", "The password needs at least 6 characters."],
  [
    /Email not confirmed/i,
    "Confirme seu e-mail antes de entrar (veja sua caixa de entrada).",
    "Confirm your e-mail before signing in (check your inbox).",
  ],
  [/rate limit/i, "Muitas tentativas seguidas. Espere um pouco e tente de novo.", "Too many attempts. Wait a little and try again."],
  // travas do banco (supabase/schema.sql)
  [
    /limite_obras/,
    "Você adicionou muitas obras na última hora. Espere um pouco e tente de novo.",
    "You added too many titles in the last hour. Wait a bit and try again.",
  ],
  [
    /limite_comentarios/,
    "Muitos comentários seguidos. Espere um minuto e tente de novo.",
    "Too many comments in a row. Wait a minute and try again.",
  ],
  [
    /resposta_apagada/,
    "O comentário que você respondia foi apagado. Seu texto continua na caixa: envie como comentário novo.",
    "The comment you were replying to was deleted. Your text is still in the box: send it as a new comment.",
  ],
  [
    /resposta_outra_obra/,
    "Essa resposta é de outra obra. Feche os comentários e abra de novo.",
    "That reply belongs to another title. Close the comments and open them again.",
  ],
  [/imagem_invalida/, "A imagem precisa ser enviada pelo botão de anexar.", "The image must be sent with the attach button."],
  [
    /progress_check/,
    "O número de episódios ou capítulos precisa ficar entre 0 e 100000.",
    "The episode or chapter number must be between 0 and 100000.",
  ],
  [/title_check/, "O nome pode ter no máximo 160 letras.", "The title can have at most 160 characters."],
  [
    /check constraint/i,
    "Algum campo passou do limite. Confira os números e o tamanho dos textos.",
    "A field is over the limit. Check the numbers and text lengths.",
  ],
  [/invalid input syntax for type (integer|numeric)/i, "Use só números inteiros, sem vírgula.", "Use whole numbers only."],
  [
    /foreign key/i,
    "Isso não existe mais (alguém apagou). Recarregue a página.",
    "That no longer exists (someone deleted it). Reload the page.",
  ],
  [/works_anilist_id_key|works_kind_slug_key/, "Essa obra já está no site.", "This title is already on the site."],
  [/duplicate key|unique/i, "Isso já existe no site.", "That already exists on the site."],
  [
    /row-level security|permission denied/i,
    "Você não tem permissão para isso. Entre na sua conta (algumas ações são só do ADM).",
    "You don't have permission for that. Sign in (some actions are admin-only).",
  ],
  [
    /Failed to fetch|NetworkError|Load failed/i,
    "Sem conexão. Verifique a internet e tente de novo.",
    "No connection. Check your internet and try again.",
  ],
];
function errMsg(e) {
  const m = String((e && (e.message || e.error_description)) || e || "");
  const achado = ERROS.find(([re]) => re.test(m));
  return achado ? L(achado[1], achado[2]) : L("Algo deu errado. Tente de novo.", "Something went wrong. Please try again.");
}

/* ---------------- acesso aos dados ---------------- */
function realApi() {
  const C = window.CONFIG || {};
  if (!C.SUPABASE_URL || /COLE_AQUI/.test(C.SUPABASE_URL) || !window.supabase) return null;
  const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
  const okr = r => {
    if (r.error) throw r.error;
    return r.data;
  };
  async function all(table, cols) {
    let out = [],
      from = 0;
    for (;;) {
      const d = okr(
        await sb
          .from(table)
          .select(cols || "*")
          .range(from, from + 999),
      );
      out = out.concat(d);
      if (d.length < 1000) return out;
      from += 1000;
    }
  }
  return {
    async loadAll() {
      const [works, items, profiles, comments] = await Promise.all([
        all("works"),
        all("list_items"),
        all("profiles"),
        all("comments", "id,work_id,user_id,created_at"),
      ]);
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
    async session() {
      const { data } = await sb.auth.getSession();
      return data.session ? data.session.user : null;
    },
    onAuth: cb => sb.auth.onAuthStateChange((_e, s) => cb(s ? s.user : null)),
    signIn: async (email, password) => okr(await sb.auth.signInWithPassword({ email, password })),
    signUp: async (email, password, nick) =>
      okr(await sb.auth.signUp({ email, password, options: { data: { nick }, emailRedirectTo: location.origin + "/" } })),
    signOut: async () => {
      await sb.auth.signOut();
    },
    resetPassword: async email => okr(await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + "/" })),
    subscribe(cb) {
      const ch = sb.channel("tudo");
      for (const t of ["works", "list_items", "comments", "profiles"])
        ch.on("postgres_changes", { event: "*", schema: "public", table: t }, p => cb(t, p));
      ch.subscribe();
    },
  };
}
const api = window.__MOCK_API || realApi();

/* ---------------- estado ---------------- */
let me = null;
let works = new Map(),
  items = [],
  profiles = new Map(),
  comments = [];
let ready = false;
let cat = "anime",
  mode = "minha",
  stFilter = "todos",
  person = "todos",
  sortBy = "lancou",
  shown = 40;
const PAGE = 40;
let route = { view: "home" };
let draft = null,
  quick = null,
  delArm = null,
  suggOpen = false,
  busy = false,
  nickEdit = false,
  flash = null;
let wvTab = "detalhes",
  wvPanel = null,
  wvEditImg = null;
let chatWork = null,
  chatMsgs = [],
  replyTo = null,
  chatFile = null,
  chatBusy = false,
  chatDel = null,
  chatFlash = null;
let seen = lsGet("comentariosVistos", {});

const PROGRESSO_MAX = 100000; // mesmo limite do banco
const SIMILAR_MIN = 0.34; // semelhança mínima para um nome aparecer na busca

const canEdit = () => !!(api && me);
const isAdm = () => !!(me && (profiles.get(me.id) || {}).is_admin);
const myId = () => (me ? me.id : null);
const itemsOf = uid => items.filter(i => i.user_id === uid);
const myItems = () => (me ? itemsOf(me.id) : []);
const myItem = wid => (me ? items.find(i => i.user_id === me.id && i.work_id === wid) : null);
const workHref = w => "/" + w.kind + "/" + w.slug;

// quem marcou cada obra e a nota média. Calcula para todas de uma vez e só refaz quando a lista muda.
let statsCache = { de: null, n: -1, mapa: new Map() };
const SEM_STATS = Object.freeze({ who: [], avg: null, nScores: 0 });
function stats(wid) {
  if (statsCache.de !== items || statsCache.n !== items.length) {
    const mapa = new Map();
    for (const i of items) {
      let s = mapa.get(i.work_id);
      if (!s) mapa.set(i.work_id, (s = { who: [], soma: 0, nScores: 0, avg: null }));
      s.who.push(i);
      if (i.score) {
        s.soma += i.score;
        s.nScores++;
      }
    }
    for (const s of mapa.values()) s.avg = s.nScores ? s.soma / s.nScores : null;
    statsCache = { de: items, n: items.length, mapa };
  }
  return statsCache.mapa.get(wid) || SEM_STATS;
}
const small = url =>
  url && /anilist\.co\/.*\/cover\/(extraLarge|large)\//.test(url) ? url.replace(/\/cover\/(extraLarge|large)\//, "/cover/medium/") : url;
function coverOf(w) {
  if (w.cover_url) return w.cover_url;
  const mine = myItem(w.id);
  if (mine && mine.image_url) return mine.image_url;
  const any = items.find(i => i.work_id === w.id && i.image_url);
  return any ? any.image_url : null;
}
const commentCount = wid => comments.reduce((n, c) => n + (c.work_id === wid ? 1 : 0), 0);
function unread(wid) {
  const t = seen[wid] || 0;
  return comments.some(c => c.work_id === wid && c.user_id !== myId() && Date.parse(c.created_at) > t);
}

/* ---------------- lançamentos ---------------- */
// último lançado + próximo (anime vira "saiu" na hora oficial, mesmo antes do robô passar)
function release(w) {
  let num = w.rel_num != null ? Number(w.rel_num) : null,
    at = w.rel_at ? Date.parse(w.rel_at) : null,
    url = linkSeguro(w.rel_url),
    label = w.rel_label || "";
  let next = w.next_num != null && w.next_at ? { num: Number(w.next_num), at: Date.parse(w.next_at) } : null;
  if (next && next.at <= Date.now()) {
    if (num == null || next.num > num) {
      num = next.num;
      at = next.at;
      url = null;
      label = "";
    }
    next = null;
  }
  if (next && num != null && next.num <= num) next = null; // ADM já passou na frente
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
  const p = profiles.get(uid);
  const n = p && p.nick ? p.nick.trim() : "";
  return uid === myId() ? n || L("Você", "You") : n || L("Alguém", "Someone");
}
function colorOf(uid) {
  let x = 0;
  for (const c of String(uid)) x = (x * 31 + c.charCodeAt(0)) >>> 0;
  return "hsl(" + (x % 360) + " 62% 42%)";
}
function initials(uid) {
  return h("span", { class: "ava", style: "background:" + colorOf(uid), "aria-hidden": "true" }, pName(uid).charAt(0).toUpperCase());
}
function avEl(uid) {
  const p = profiles.get(uid);
  if (p && p.avatar_url) {
    const im = h("img", { src: p.avatar_url, alt: "", class: "ava", referrerpolicy: "no-referrer", width: 22, height: 22 });
    im.onerror = () => im.replaceWith(initials(uid));
    return im;
  }
  return initials(uid);
}
function whoChips(who, k, max) {
  const list = who.slice(0, max || who.length);
  const out = list.map(i =>
    h(
      "span",
      { class: "av s-" + i.status, title: pName(i.user_id) + ": " + stLabel(i.status, k) },
      avEl(i.user_id),
      pName(i.user_id),
      h("i", {}),
    ),
  );
  if (max && who.length > max) out.push(h("span", { class: "av" }, "+" + (who.length - max)));
  return out;
}

/* ---------------- imagens ---------------- */
function coverEl(url, cls) {
  const ph = () => h("div", { class: "cover none " + (cls || ""), "aria-hidden": "true" }, svg(I_IMG));
  if (!url) return ph();
  const big = /\bbig\b/.test(cls || "");
  const im = h("img", {
    class: "cover " + (cls || ""),
    src: big ? url : small(url),
    alt: "",
    loading: "lazy",
    decoding: "async",
    width: big ? 84 : 56,
    height: big ? 118 : 78,
  });
  im.addEventListener("error", () => im.replaceWith(ph()));
  return im;
}
async function shrink(file) {
  if (file.type === "image/gif") return file;
  try {
    const bmp = await createImageBitmap(file);
    const r = Math.min(1, 900 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(bmp.width * r));
    c.height = Math.max(1, Math.round(bmp.height * r));
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    let b = await new Promise(res => c.toBlob(res, "image/webp", 0.82));
    if (!b || b.type !== "image/webp") b = await new Promise(res => c.toBlob(res, "image/jpeg", 0.85));
    return b || file;
  } catch {
    return file;
  }
}
async function uploadImg(file) {
  if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type)) throw new Error("tipo");
  const blob = await shrink(file);
  if (blob.size > 5 * 1024 * 1024) throw new Error("grande");
  try {
    return await api.upload(me.id, blob);
  } catch (e) {
    // o banco recusa quem passou de 20 imagens na última hora (ou 300 no total)
    if (/row-level security/i.test(String(e && e.message))) throw new Error("limite");
    throw e;
  }
}
function imgError(e) {
  const m = String(e && e.message);
  return m === "tipo"
    ? L("Formato não aceito. Use PNG, JPG, GIF ou WebP.", "Format not accepted. Use PNG, JPG, GIF or WebP.")
    : m === "grande"
      ? L("Imagem grande demais (máx. 5 MB).", "Image too large (max 5 MB).")
      : m === "limite"
        ? L("Você enviou imagens demais. Espere uma hora e tente de novo.", "You uploaded too many images. Wait an hour and try again.")
        : L("Não deu para enviar a imagem. ", "Couldn't upload the image. ") + errMsg(e);
}
const anyErr = e => (/^(tipo|grande|limite)$/.test(String(e && e.message)) ? imgError(e) : errMsg(e));
function imgPicker(id, current, onpick, onclear) {
  const input = h("input", {
    type: "file",
    id,
    accept: "image/png,image/jpeg,image/gif,image/webp",
    class: "sr",
    onchange: e => {
      const f = e.target.files && e.target.files[0];
      if (f) onpick(f);
    },
  });
  const prev = current
    ? h("img", { class: "cover big", src: current, alt: L("Prévia", "Preview"), width: 84, height: 118 })
    : h("div", { class: "cover big none", "aria-hidden": "true" }, svg(I_IMG));
  return h(
    "div",
    { class: "imgpick" },
    prev,
    h(
      "div",
      { class: "imgbtns" },
      h("label", { class: "btn alt", for: id }, current ? L("Trocar imagem", "Change image") : L("Anexar imagem", "Attach image")),
      input,
      current && onclear ? h("button", { class: "link", type: "button", onclick: onclear }, L("Remover imagem", "Remove image")) : null,
      h("small", {}, L("Opcional. PNG, JPG, GIF ou WebP.", "Optional. PNG, JPG, GIF or WebP.")),
    ),
  );
}
