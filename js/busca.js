/* =====================================================================
   Lista de Animes do Betoro-chan — busca
   Semelhança de nomes, AniList, marcar/adicionar obras, sugestões e página de resultados.
   ===================================================================== */
"use strict";

/* ---------------- busca por semelhança ---------------- */
function grams(s) {
  const p = "  " + s + " ";
  const g = new Set();
  for (let i = 0; i < p.length - 2; i++) g.add(p.slice(i, i + 3));
  return g;
}
function tri(a, b) {
  const A = grams(a),
    B = grams(b);
  let n = 0;
  for (const x of A) if (B.has(x)) n++;
  return n / (A.size + B.size - n);
}
function sim(q, w) {
  const names = [w.title, ...String(w.alt_titles || "").split(/\s*[·,;\/|\n]\s*/)].map(norm).filter(Boolean);
  let best = 0;
  for (const n of names) {
    if (n === q) return 1;
    if (n.startsWith(q)) best = Math.max(best, 0.92);
    else if (n.includes(q)) best = Math.max(best, 0.82);
    else {
      const qw = q.split(" ").filter(x => x.length > 1),
        nw = n.split(" ");
      const hit = qw.filter(x => nw.some(y => y.startsWith(x))).length;
      if (hit && qw.length) best = Math.max(best, 0.4 + (0.4 * hit) / qw.length);
      if (q.length >= 3) {
        best = Math.max(best, tri(q, n) * 1.15);
        if (qw.length === 1) for (const y of nw) if (y.length >= 4) best = Math.max(best, tri(q, y) * 1.05);
      }
    }
  }
  return best;
}
// obras do site com nome parecido, da mais parecida para a menos (empate: a mais marcada)
const parecidos = q =>
  [...works.values()]
    .filter(w => w.kind === cat)
    .map(w => ({ w, sc: sim(q, w) }))
    .filter(x => x.sc >= SIMILAR_MIN)
    .sort((a, b) => b.sc - a.sc || stats(b.w.id).who.length - stats(a.w.id).who.length);

/* ---------------- AniList (busca do site) ---------------- */
// as tabelas e a conversão de obra do AniList ficam no comum.js (o robô usa as mesmas)
async function anilistPagina(q, kind, pagina, porPagina) {
  const k = AL_KINDS[kind];
  const r = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      query: `query($q: String, $type: MediaType, $f: [MediaFormat], $p: Int, $n: Int) { Page(page: $p, perPage: $n) { pageInfo { hasNextPage } media(search: $q, type: $type, format_in: $f, isAdult: false, sort: [SEARCH_MATCH, POPULARITY_DESC]) { ${AL_FIELDS} } } }`,
      variables: { q, type: k.type, f: k.formats, p: pagina, n: porPagina },
    }),
  });
  if (!r.ok) throw new Error("anilist " + r.status);
  const j = await r.json();
  const pg = (j.data && j.data.Page) || {};
  return {
    items: (pg.media || []).filter(m => !m.isAdult).map(m => alToWork(m, kind)),
    hasNext: !!(pg.pageInfo && pg.pageInfo.hasNextPage),
  };
}
// sugestões enquanto digita: 6 resultados, guardados para não repetir o pedido
const alCache = new Map();
function anilistSearch(q, kind) {
  const key = kind + ":" + norm(q);
  if (!alCache.has(key)) {
    const p = anilistPagina(q, kind, 1, 6).then(r => r.items);
    alCache.set(key, p);
    p.catch(() => alCache.delete(key));
  }
  return alCache.get(key);
}
function alSummary(a) {
  return [tv(a.format), a.year, a.total ? a.total + " " + UNIT[a.kind]()[0].toLowerCase() : null, tv(a.status)].filter(Boolean).join(" · ");
}

/* ---------------- ações ---------------- */
async function setItem(w, patch) {
  if (!canEdit()) {
    openLogin();
    return false;
  }
  const old = myItem(w.id);
  if ("progress" in patch) patch = { ...patch, progress: Math.max(0, Math.min(PROGRESSO_MAX, Math.floor(Number(patch.progress) || 0))) };
  const row = {
    user_id: me.id,
    work_id: w.id,
    status: (old && old.status) || "visto",
    score: old ? old.score : null,
    progress: old ? old.progress : 0,
    image_url: old ? old.image_url : null,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  if (row.status === "visto" && w.total && !("progress" in patch) && (!old || old.status !== "visto")) row.progress = w.total;
  items = items.filter(i => !(i.user_id === me.id && i.work_id === w.id)).concat([row]);
  flash = w.id;
  render();
  try {
    const saved = await api.upsertItem(row);
    items = items.filter(i => !(i.user_id === me.id && i.work_id === w.id)).concat([saved]);
    return true;
  } catch (e) {
    items = items.filter(i => !(i.user_id === me.id && i.work_id === w.id)).concat(old ? [old] : []);
    render();
    fail(errMsg(e));
    return false;
  }
}
async function removeItem(w) {
  const old = myItem(w.id);
  if (!old) return;
  items = items.filter(i => i !== old);
  render();
  try {
    await api.deleteItem(me.id, w.id);
    ok(L("Tirado da sua lista: ", "Removed from your list: ") + w.title);
  } catch (e) {
    items.push(old);
    render();
    fail(errMsg(e));
  }
}
function freeSlug(kind, title) {
  let slug = slugify(title),
    n = 2;
  const taken = new Set([...works.values()].filter(w => w.kind === kind).map(w => w.slug));
  while (taken.has(slug)) slug = slugify(title).slice(0, 95) + "-" + n++;
  return slug;
}
// tradução gratuita na hora, com no máximo 9 segundos de espera (se não der, o robô traduz depois)
async function traduzirRapido(texto) {
  if (!texto) return "";
  const limite = new Promise((_, rej) => setTimeout(() => rej(new Error("tempo")), 9000));
  try {
    return await Promise.race([traduzir(texto, { juntos: true, tempo: 6000 }), limite]);
  } catch {
    return "";
  }
}
// qualquer pessoa logada adiciona obras do AniList; o banco limpa o que não vem do AniList
// e o robô confere tudo em até 15 minutos. Só o ADM edita ou apaga.
const adicionando = new Map(); // anilist_id → pedido em andamento (o clique duplo espera o mesmo pedido)
async function addFromAnilist(a, status) {
  if (!canEdit()) {
    openLogin();
    return null;
  }
  let w = [...works.values()].find(x => x.anilist_id === a.anilist_id);
  if (!w) {
    if (!adicionando.has(a.anilist_id)) {
      const pedido = inserirDoAnilist(a).finally(() => {
        adicionando.delete(a.anilist_id);
        render();
      });
      adicionando.set(a.anilist_id, pedido);
      render();
    }
    try {
      w = await adicionando.get(a.anilist_id);
    } catch (e) {
      fail(errMsg(e));
      return null;
    }
  }
  if (status && (await setItem(w, { status }))) ok(w.title + ": " + stLabel(status, w.kind));
  render();
  return w;
}
async function inserirDoAnilist(a) {
  toast(L("Adicionando “", "Adding “") + a.title + L("” ao site…", "” to the site…"), null, 15000);
  const row = { ...a, slug: freeSlug(a.kind, a.title), created_by: me.id };
  const pt = await traduzirRapido(a.synopsis_en);
  if (pt) {
    row.synopsis = pt;
    row.syn_src = "gratis";
  }
  let w;
  try {
    w = await api.insertWork(row);
  } catch (e) {
    const m = String(e && e.message);
    if (/works_anilist_id_key/.test(m)) {
      // outra pessoa adicionou a mesma obra no mesmo instante: usa a dela
      works = new Map((await api.loadTable("works")).map(r => [r.id, r]));
      w = [...works.values()].find(x => x.anilist_id === a.anilist_id);
      if (w) return w;
    }
    if (!/works_kind_slug_key/.test(m)) throw e;
    // outra obra pegou o mesmo endereço no mesmo instante: tenta com outro
    row.slug = row.slug.slice(0, 110) + "-" + Math.random().toString(36).slice(2, 6);
    w = await api.insertWork(row);
  }
  works.set(w.id, w);
  ok(L("Adicionado ao site: ", "Added to the site: ") + w.title);
  return w;
}
const findWork = (kind, title) => {
  const k = norm(title);
  return [...works.values()].find(w => w.kind === kind && norm(w.title) === k);
};

/* ---------------- busca e sugestões ---------------- */
let alQ = "",
  alRes = null,
  alErr = false,
  alT = null;
function queueAnilist(q) {
  const key = cat + "|" + q;
  if (key === alQ) return;
  alQ = key;
  alRes = null;
  alErr = false;
  clearTimeout(alT);
  if (q.length < 2) return;
  alT = setTimeout(async () => {
    const mine = key,
      kind = cat;
    try {
      const r = await anilistSearch(q, kind);
      if (alQ === mine) {
        alRes = r;
        if (suggOpen) renderSugg();
      }
    } catch {
      if (alQ === mine) {
        alErr = true;
        if (suggOpen) renderSugg();
      }
    }
  }, 450);
}
function renderSugg() {
  const box = $("sugg"),
    raw = $("q").value,
    q = norm(raw);
  if (!suggOpen || !q) {
    box.hidden = true;
    return;
  }
  const res = parecidos(q).slice(0, 6);
  const kids = res.map(({ w }) => {
    const m = myItem(w.id),
      s = stats(w.id),
      r = release(w);
    return h(
      "div",
      { class: "sg" },
      h(
        "div",
        { class: "sg-head" },
        coverEl(coverOf(w), "sm"),
        h(
          "div",
          { class: "sg-t" },
          titleLink(w),
          h(
            "small",
            {},
            [r.num != null ? relTxt(w, r) : null, w.alt_titles || [tv(w.format), w.year].filter(Boolean).join(" · ")]
              .filter(Boolean)
              .join(" · "),
          ),
        ),
        m ? h("span", { class: "mine-tag s-" + m.status }, L("Na sua lista: ", "On your list: ") + stLabel(m.status, w.kind)) : null,
      ),
      s.who.length ? h("div", { class: "who" }, whoChips(s.who, w.kind, 4)) : null,
      canEdit()
        ? h(
            "div",
            { class: "sts" },
            ST.map(st =>
              h(
                "button",
                {
                  class: "st s-" + st + (m && m.status === st ? " on" : ""),
                  type: "button",
                  onclick: async () => {
                    closeSearch();
                    if (await setItem(w, { status: st })) ok(w.title + ": " + stLabel(st, w.kind));
                  },
                },
                stLabel(st, w.kind),
              ),
            ),
            h("a", { class: "link", href: workHref(w), "data-link": true }, L("Ver página", "Open page")),
          )
        : null,
    );
  });
  if (!res.length) kids.push(h("p", { class: "hint" }, L("Ainda não está no site.", "Not on the site yet.")));
  if (canEdit() && raw.trim().length < 2) {
    kids.push(
      h("p", { class: "sg-sec" }, L("Do AniList · marque e a obra entra no site", "From AniList · mark it and it joins the site")),
      h("p", { class: "hint" }, L("Digite pelo menos 2 letras para buscar no AniList.", "Type at least 2 letters to search AniList.")),
    );
  } else if (canEdit()) {
    queueAnilist(raw.trim());
    const shownIds = new Set(res.map(x => x.w.anilist_id).filter(Boolean));
    const onSite = new Map([...works.values()].filter(w => w.anilist_id).map(w => [w.anilist_id, w]));
    kids.push(h("p", { class: "sg-sec" }, L("Do AniList · marque e a obra entra no site", "From AniList · mark it and it joins the site")));
    if (alErr)
      kids.push(
        h(
          "p",
          { class: "hint" },
          L("Não deu para buscar no AniList agora. Tente de novo em instantes.", "Couldn't search AniList right now. Try again shortly."),
        ),
      );
    else if (!alRes) kids.push(h("p", { class: "hint" }, L("Buscando…", "Searching…")));
    else {
      const al = alRes.filter(a => !shownIds.has(a.anilist_id)).slice(0, 5);
      if (!al.length) kids.push(h("p", { class: "hint" }, L("Nada novo encontrado.", "Nothing new found.")));
      for (const a of al) {
        const there = onSite.get(a.anilist_id);
        kids.push(
          h(
            "div",
            { class: "sg" },
            h(
              "div",
              { class: "sg-head" },
              coverEl(a.cover_url, "sm"),
              h(
                "div",
                { class: "sg-t" },
                h("b", {}, a.title),
                h("small", {}, alSummary(a)),
                a.alt_titles ? h("small", {}, a.alt_titles) : null,
              ),
              there ? h("span", { class: "autotag" }, L("já no site", "on site")) : null,
            ),
            botoesAniList(a, closeSearch),
          ),
        );
      }
    }
    if (isAdm())
      kids.push(
        h(
          "button",
          {
            class: "new",
            type: "button",
            onclick: () => {
              draft = { t: raw.trim(), k: cat, s: "visto" };
              closeSearch();
              renderNew();
              setTimeout(() => {
                const el = $("nf-sub");
                if (el) el.focus();
              });
            },
          },
          L("+ Não achei: adicionar “", "+ Not found: add “") + raw.trim() + L("” à mão", "” manually"),
        ),
      );
  }
  if (!canEdit())
    kids.push(
      h(
        "p",
        { class: "hint" },
        h("button", { class: "link", type: "button", "data-login": true }, L("Entre na sua conta", "Sign in")),
        L(" para marcar e adicionar obras.", " to mark and add titles."),
      ),
    );
  kids.push(
    h(
      "button",
      { class: "new all", type: "button", onclick: searchAll },
      L("Ver todos os resultados para “", "See all results for “") + raw.trim() + L("” (Enter)", "” (Enter)"),
    ),
  );
  box.replaceChildren(...kids);
  box.hidden = false;
}
function closeSearch() {
  suggOpen = false;
  $("q").value = "";
  $("sugg").hidden = true;
}
$("q").addEventListener("input", () => {
  suggOpen = true;
  renderSugg();
});
$("q").addEventListener("focus", () => {
  if ($("q").value) {
    suggOpen = true;
    renderSugg();
  }
});
function searchAll() {
  const q = $("q").value.trim();
  if (!q) return;
  $("q").blur();
  go("/buscar?q=" + encodeURIComponent(q) + "&tipo=" + cat);
}
$("q").addEventListener("keydown", e => {
  if (e.key === "Escape") {
    closeSearch();
    $("q").blur();
  } else if (e.key === "Enter" && !e.isComposing) {
    e.preventDefault();
    searchAll();
  }
});
$("searchbox").addEventListener("submit", e => {
  e.preventDefault();
  searchAll();
});
document.addEventListener("pointerdown", e => {
  if (suggOpen && !$("searchbox").contains(e.target)) {
    suggOpen = false;
    $("sugg").hidden = true;
  }
});

/* ---------------- página com todos os resultados ---------------- */
let srch = { key: "", items: [], page: 0, hasNext: false, loading: false, err: false };
async function loadSearchPage() {
  const key = cat + "|" + norm(route.q);
  if (srch.key !== key) srch = { key, items: [], page: 0, hasNext: false, loading: false, err: false };
  if (srch.loading || (srch.page && !srch.hasNext)) return;
  srch.loading = true;
  srch.err = false;
  render();
  try {
    const r = await anilistPagina(route.q, cat, srch.page + 1, 25);
    if (srch.key !== key) return;
    const seenIds = new Set(srch.items.map(a => a.anilist_id));
    srch.items = srch.items.concat(r.items.filter(a => !seenIds.has(a.anilist_id)));
    srch.page++;
    srch.hasNext = r.hasNext;
  } catch {
    if (srch.key === key) srch.err = true;
  }
  if (srch.key === key) {
    srch.loading = false;
    render();
  }
}
// botões de uma obra do AniList (enquanto ela entra no site, mostra "Adicionando…" no lugar)
function botoesAniList(a, antes) {
  if (adicionando.has(a.anilist_id)) return h("p", { class: "hint", role: "status" }, L("Adicionando ao site…", "Adding to the site…"));
  const clique = async status => {
    if (antes) antes();
    const w = await addFromAnilist(a, status);
    if (w && !status) go(workHref(w));
  };
  return h(
    "div",
    { class: "sts" },
    ST.map(st => h("button", { class: "st s-" + st, type: "button", onclick: () => clique(st) }, stLabel(st, a.kind))),
    h("button", { class: "link", type: "button", onclick: () => clique(null) }, L("Ver página", "Open page")),
  );
}
function alCard(a) {
  const there = [...works.values()].find(w => w.anilist_id === a.anilist_id);
  if (there) return workCard(there, stats(there.id));
  return h(
    "li",
    { class: "card s-quero" },
    h(
      "div",
      { class: "c-top" },
      coverEl(a.cover_url),
      h(
        "div",
        { class: "c-name" },
        h("b", {}, a.title),
        h("small", { class: "alt" }, alSummary(a)),
        a.alt_titles ? h("small", { class: "alt" }, a.alt_titles) : null,
      ),
      h("div", { class: "meta col" }, h("span", { class: "autotag" }, "AniList")),
    ),
    canEdit()
      ? botoesAniList(a)
      : h("div", {}, h("button", { class: "link", type: "button", "data-login": true }, L("Entre para marcar", "Sign in to mark"))),
  );
}
function renderSearchPage() {
  const ul = $("list"),
    more = $("morebox");
  more.replaceChildren();
  const key = cat + "|" + norm(route.q);
  if (!route.q) {
    ul.replaceChildren(empty(L("Digite algo na busca", "Type something to search")));
    return;
  }
  if (srch.key !== key && !srch.loading) setTimeout(loadSearchPage);
  const q = norm(route.q);
  const site = parecidos(q);
  const siteIds = new Set(site.map(x => x.w.anilist_id).filter(Boolean));
  const al = srch.key === key ? srch.items.filter(a => !siteIds.has(a.anilist_id)) : [];
  const out = [
    h("li", { class: "sec-title" }, h("h2", {}, L("Resultados para “", "Results for “") + route.q + "” · " + KINDS[cat].label())),
  ];
  if (site.length) {
    out.push(h("li", { class: "sg-sec" }, L("Já no site", "Already on the site") + " (" + site.length + ")"));
    site.forEach(x => out.push(workCard(x.w, stats(x.w.id))));
  }
  out.push(
    h("li", { class: "sg-sec" }, L("No AniList", "On AniList") + (al.length ? " (" + al.length + (srch.hasNext ? "+" : "") + ")" : "")),
  );
  if (srch.key === key && srch.err)
    out.push(
      empty(
        L("Não deu para buscar no AniList agora", "Couldn't search AniList right now"),
        h(
          "button",
          {
            class: "btn alt",
            type: "button",
            onclick: () => {
              srch.key = "";
              loadSearchPage();
            },
          },
          L("Tentar de novo", "Try again"),
        ),
      ),
    );
  else if (srch.key !== key || (srch.loading && !srch.items.length)) out.push(empty(L("Buscando…", "Searching…")));
  else if (!al.length)
    out.push(
      empty(
        L("Nada a mais no AniList", "Nothing else on AniList"),
        L("Confira a grafia ou tente outra aba (Animes, Mangás, Novels).", "Check the spelling or try another tab (Anime, Manga, Novels)."),
      ),
    );
  al.forEach(a => out.push(alCard(a)));
  ul.replaceChildren(...out);
  if (srch.key === key && srch.hasNext)
    more.replaceChildren(
      h(
        "button",
        { class: "btn alt", type: "button", disabled: srch.loading, onclick: loadSearchPage },
        srch.loading ? L("Carregando…", "Loading…") : L("Carregar mais", "Load more"),
      ),
    );
}
