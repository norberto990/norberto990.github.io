/* =====================================================================
   Lista de Animes do Betoro-chan — páginas
   Rotas, textos fixos, cabeçalho, listas, cartões, "adicionar à mão" e página 404.
   ===================================================================== */
"use strict";

/* ---------------- rotas ---------------- */
function parseRoute(path) {
  const p = path.replace(/\/+$/, "") || "/";
  let m;
  if (p === "/") return { view: "home", kind: "anime", mode: me ? "minha" : "catalogo" };
  if (p === "/buscar") {
    const sp = new URLSearchParams(location.search);
    const k = sp.get("tipo");
    return { view: "search", kind: KINDS[k] ? k : cat, q: (sp.get("q") || "").slice(0, 100) };
  }
  if ((m = p.match(/^\/(anime|manga|novel)\/([a-z0-9-]+)$/))) return { view: "work", kind: m[1], slug: m[2] };
  if ((m = p.match(/^\/(animes|mangas|novels)(?:\/(galera|catalogo))?$/)))
    return { view: "home", kind: m[1].slice(0, -1), mode: m[2] || "minha" };
  return { view: "notfound", kind: cat };
}
function go(path, replace) {
  if (replace) history.replaceState(null, "", path);
  else history.pushState(null, "", path);
  applyRoute();
  window.scrollTo({ top: 0 });
}
function applyRoute() {
  route = parseRoute(location.pathname);
  if (route.view === "home") {
    if (route.kind !== cat) {
      stFilter = "todos";
      person = "todos";
      shown = PAGE;
    }
    cat = route.kind;
    mode = route.mode;
    if (mode === "minha" && !me) {
      mode = "catalogo";
      history.replaceState(null, "", KINDS[cat].path + "/catalogo");
    }
  } else if (route.view === "search") {
    cat = route.kind;
  } else if (route.view === "work") {
    cat = route.kind;
    wvTab = "detalhes";
    wvPanel = null;
    wvEditImg = null;
  }
  closeSearch();
  if (route.view === "search") $("q").value = route.q;
  draft = null;
  renderNew();
  render();
  renderFooter();
}
const homePath = () => KINDS[cat].path + (mode === "minha" ? "" : "/" + mode);
document.addEventListener("click", e => {
  const a = e.target.closest("a[data-link]");
  if (a && !e.ctrlKey && !e.metaKey && !e.shiftKey && a.origin === location.origin) {
    e.preventDefault();
    go(a.pathname + a.search);
  }
  if (e.target.closest("[data-login]")) openLogin();
});
// botão Voltar do navegador/celular: primeiro fecha o que estiver aberto por cima da página
window.addEventListener("popstate", () => {
  const st = history.state || {};
  if (voltarIgnorado) {
    voltarIgnorado = false;
    return;
  }
  if (!$("gate").hidden) closeLogin();
  if (chatWork && !st.chat) {
    closeChat(true);
    if (location.pathname + location.search === lastRouteKey) return; // só fechou os comentários
  }
  if (st.chat && !chatWork && works.has(st.chat)) {
    openChat(works.get(st.chat), true);
    return;
  }
  applyRoute();
});

/* ---------------- textos fixos da página ---------------- */
function renderStatic() {
  $("h1pre").textContent = L("Lista de Animes do", "The anime list of");
  $("q").setAttribute("aria-label", L("Buscar", "Search"));
  $("addbtn").textContent = L("+ Adicionar à mão", "+ Add manually");
  $("cimgbtn").title = L("Anexar imagem", "Attach image");
  $("cmsg").placeholder = L("Escreva um comentário…", "Write a comment…");
  $("cmsg").setAttribute("aria-label", L("Mensagem", "Message"));
  $("csend").setAttribute("aria-label", L("Enviar", "Send"));
  $("sheetro").replaceChildren(
    L("Para comentar, ", "To comment, "),
    h("button", { class: "link", type: "button", "data-login": true }, L("entre na sua conta", "sign in")),
    ".",
  );
  $("cats").setAttribute("aria-label", L("Categoria", "Category"));
  $("seg").setAttribute("aria-label", L("Visão", "View"));
  $("langs").setAttribute("aria-label", L("Idioma", "Language"));
  for (const b of document.querySelectorAll("#langs button")) b.setAttribute("aria-pressed", b.dataset.lang === lang);
  renderFooter();
}
function renderFooter() {
  const f = $("footer"),
    y = new Date().getFullYear();
  f.replaceChildren(
    h(
      "nav",
      { class: "foot-links", "aria-label": L("Seções", "Sections") },
      ...Object.entries(KINDS).map(([, v]) => h("a", { href: v.path + (me ? "" : "/catalogo"), "data-link": true }, v.label())),
      h("a", { href: KINDS[cat].path + "/galera", "data-link": true }, L("Galera", "Friends")),
      h("a", { href: KINDS[cat].path + "/catalogo", "data-link": true }, L("Catálogo", "Catalog")),
    ),
    h(
      "p",
      {},
      L("Lançamentos e links oficiais: ", "Releases and official links: "),
      h("a", { href: "https://anilist.co", target: "_blank", rel: "noopener" }, "AniList"),
      " · ",
      h("a", { href: "https://mangaplus.shueisha.co.jp", target: "_blank", rel: "noopener" }, "MANGA Plus"),
      " · ",
      h("a", { href: "https://www.webtoons.com", target: "_blank", rel: "noopener" }, "WEBTOON"),
      " · ",
      h("a", { href: "https://shonenjumpplus.com", target: "_blank", rel: "noopener" }, "Shonen Jump+"),
      ". ",
      L("Só indicamos sites oficiais.", "We only point to official sites."),
    ),
    h("p", {}, "© " + y + " " + L("Lista de Animes do Betoro-chan", "Betoro-chan's Anime List")),
  );
}

/* ---------------- render geral ---------------- */
let lastRouteKey = "";
function render() {
  const routeKey = location.pathname + location.search;
  const samePage = routeKey === lastRouteKey;
  lastRouteKey = routeKey;
  const keep = {};
  if (samePage)
    for (const el of document.querySelectorAll(
      "#list input:not([type=file]), #wv input:not([type=file]), #wv textarea, #me input, #newform input:not([type=file])",
    ))
      if (el.id) keep[el.id] = el.value;
  const ae = document.activeElement,
    fid = ae && ae.id,
    caret = ae && ae.selectionStart;
  $("app").dataset.cat = cat;
  renderMe();
  renderNote();
  const isWork = route.view === "work",
    is404 = route.view === "notfound";
  $("home").hidden = isWork || is404;
  $("wv").hidden = !isWork && !is404;
  $("app").classList.toggle("wide", isWork);
  if (is404) renderNotFound();
  else if (isWork) renderWork();
  else {
    $("q").placeholder = canEdit()
      ? L("Buscar ou adicionar ", "Search or add ") + KINDS[cat].one() + "…"
      : L("Buscar ", "Search ") + KINDS[cat].one() + "…";
    $("addbtn").hidden = !isAdm();
    const isSearch = route.view === "search";
    $("seg").parentElement.hidden = isSearch;
    $("filters").hidden = isSearch;
    renderCats();
    if (isSearch) renderSearchPage();
    else {
      renderSeg();
      renderFilters();
      renderList();
    }
    if (suggOpen) renderSugg();
    document.title =
      (isSearch ? L("Busca: ", "Search: ") + route.q : KINDS[cat].label()) +
      " · " +
      L("Lista de Animes do Betoro-chan", "Betoro-chan's Anime List");
  }
  if (chatWork) renderChat(false);
  for (const [id, v] of Object.entries(keep)) {
    const el = $(id);
    if (el && el.value !== v) el.value = v;
  }
  if (samePage && fid && fid !== "q") {
    const el = $(fid);
    if (el && el !== document.activeElement) {
      el.focus();
      try {
        if (caret != null) el.setSelectionRange(caret, caret);
      } catch {}
    }
  }
  flash = null;
}
function renderNote() {
  $("note").textContent = !api
    ? L(
        "O site ainda não foi ligado ao banco de dados. Preencha o arquivo config.js (veja o passo a passo).",
        "The site is not connected to the database yet. Fill in config.js (see the guide).",
      )
    : !ready
      ? L("Carregando…", "Loading…")
      : "";
}
function renderMe() {
  const box = $("me");
  if (!api) {
    box.replaceChildren();
    return;
  }
  if (!me) {
    box.replaceChildren(
      h("span", {}, L("Você está só olhando.", "You're just browsing.")),
      h("button", { class: "btn", type: "button", onclick: () => openLogin() }, L("Entrar ou criar conta", "Sign in or sign up")),
    );
    return;
  }
  if (nickEdit) {
    box.replaceChildren(
      h(
        "form",
        {
          class: "nickform",
          onsubmit: async e => {
            e.preventDefault();
            const v = $("nick").value.trim().slice(0, 40);
            if (!v) {
              fail(L("Escreva um nome.", "Type a name."));
              return;
            }
            nickEdit = false;
            try {
              const p = await api.updateNick(me.id, v);
              profiles.set(me.id, p);
              ok(L("Agora você aparece como ", "You now appear as ") + v);
            } catch (er) {
              fail(errMsg(er));
            }
            render();
          },
        },
        h("label", { for: "nick" }, L("Seu nome:", "Your name:")),
        h("input", { id: "nick", maxlength: "40", value: (profiles.get(me.id) || {}).nick || "", autocomplete: "nickname" }),
        h("button", { class: "link", type: "submit" }, L("Salvar", "Save")),
        h(
          "button",
          {
            class: "link",
            type: "button",
            onclick: () => {
              nickEdit = false;
              render();
            },
          },
          L("Cancelar", "Cancel"),
        ),
      ),
    );
    setTimeout(() => {
      const el = $("nick");
      if (el && document.activeElement !== el) el.focus();
    });
    return;
  }
  box.replaceChildren(
    avEl(me.id),
    L("Você aparece como ", "You appear as "),
    h("b", {}, pName(me.id)),
    isAdm() ? h("span", { class: "admtag", title: L("Administrador do site", "Site administrator") }, "ADM") : "",
    h(
      "button",
      {
        class: "link",
        type: "button",
        onclick: () => {
          nickEdit = true;
          render();
        },
      },
      L("trocar nome", "change name"),
    ),
    h("span", { "aria-hidden": "true" }, "·"),
    h(
      "button",
      {
        class: "link",
        type: "button",
        onclick: async () => {
          await api.signOut();
          ok(L("Você saiu da conta.", "You signed out."));
        },
      },
      L("Sair", "Sign out"),
    ),
  );
}
function renderCats() {
  $("cats").replaceChildren(
    ...Object.entries(KINDS).map(([k, v]) => {
      const n = me
        ? myItems().filter(i => (works.get(i.work_id) || {}).kind === k).length
        : [...works.values()].filter(w => w.kind === k).length;
      const fresh =
        me &&
        myItems().some(i => {
          const w = works.get(i.work_id);
          return w && w.kind === k && behind(w, i, release(w)) > 0;
        });
      const href =
        route.view === "search" ? "/buscar?q=" + encodeURIComponent(route.q) + "&tipo=" + k : v.path + (mode === "minha" ? "" : "/" + mode);
      return h(
        "a",
        { class: "cat", role: "tab", "data-k": k, "aria-selected": cat === k, href, "data-link": true },
        v.label(),
        h("small", {}, n + " " + (me ? L("na sua lista", "on your list") : L(n === 1 ? "obra" : "obras", n === 1 ? "title" : "titles"))),
        fresh ? h("span", { class: "dot", title: L("Tem lançamento novo", "New release available") }) : null,
      );
    }),
  );
}
function renderSeg() {
  const tabs = [
    ["minha", L("Minha lista", "My list")],
    ["galera", L("Galera", "Friends")],
    ["catalogo", L("Catálogo", "Catalog")],
  ].filter(t => me || t[0] !== "minha");
  $("seg").replaceChildren(
    ...tabs.map(([m, l]) =>
      h("a", { role: "tab", "aria-selected": mode === m, href: KINDS[cat].path + (m === "minha" ? "" : "/" + m), "data-link": true }, l),
    ),
  );
}
function renderFilters() {
  const f = $("filters");
  const chip = (pressed, label, onclick, extra) =>
    h("button", { class: "fchip" + (extra || ""), "aria-pressed": pressed, type: "button", onclick }, label);
  if (mode === "minha") {
    const its = myItems().filter(i => (works.get(i.work_id) || {}).kind === cat);
    if (!its.length) {
      f.replaceChildren();
      return;
    }
    f.replaceChildren(
      ...["todos", ...ST]
        .map(s => {
          const n = s === "todos" ? its.length : its.filter(i => i.status === s).length;
          if (s !== "todos" && !n) return null;
          return chip(
            stFilter === s,
            (s === "todos" ? L("Todos", "All") : stLabel(s, cat)) + " · " + n,
            () => {
              stFilter = s;
              render();
            },
            s !== "todos" ? " s-" + s : "",
          );
        })
        .filter(Boolean),
    );
  } else if (mode === "galera") {
    const ids = [...new Set(items.filter(i => (works.get(i.work_id) || {}).kind === cat).map(i => i.user_id))];
    if (ids.length < 2) {
      f.replaceChildren();
      return;
    }
    f.replaceChildren(
      chip(person === "todos", L("Todo mundo", "Everyone"), () => {
        person = "todos";
        render();
      }),
      ...ids.map(id => {
        const b = chip(person === id, "", () => {
          person = id;
          render();
        });
        b.replaceChildren(avEl(id), pName(id));
        return b;
      }),
    );
  } else {
    f.replaceChildren(
      ...[
        ["lancou", L("Lançou agora", "Just released")],
        ["populares", L("Mais populares na galera", "Most popular")],
        ["nota", L("Melhor nota", "Top rated")],
        ["az", "A–Z"],
      ].map(([k, l]) =>
        chip(sortBy === k, l, () => {
          sortBy = k;
          shown = PAGE;
          render();
        }),
      ),
    );
  }
}
const empty = (title, ...text) => h("li", { class: "empty" }, h("strong", {}, title), ...text);

function renderList() {
  const ul = $("list"),
    more = $("morebox");
  more.replaceChildren();
  if (!ready) {
    ul.replaceChildren(empty(L("Carregando…", "Loading…")));
    return;
  }
  const ofCat = [...works.values()].filter(w => w.kind === cat);
  if (mode === "minha") {
    let its = myItems().filter(i => (works.get(i.work_id) || {}).kind === cat);
    const total = its.length;
    if (stFilter !== "todos") its = its.filter(i => i.status === stFilter);
    const nb = i => {
      const w = works.get(i.work_id);
      return behind(w, i, release(w)) > 0 ? 0 : 1;
    };
    its.sort((a, b) => ST.indexOf(a.status) - ST.indexOf(b.status) || nb(a) - nb(b) || Date.parse(b.updated_at) - Date.parse(a.updated_at));
    if (!its.length) {
      ul.replaceChildren(
        total
          ? empty(L("Nada nesse filtro", "Nothing in this filter"), L("Troque o filtro acima.", "Change the filter above."))
          : empty(
              L("Sua lista está vazia", "Your list is empty"),
              L("Use a busca lá em cima ou abra o ", "Use the search above or open the "),
              h("a", { href: KINDS[cat].path + "/catalogo", "data-link": true }, L("Catálogo", "Catalog")),
              L(" para marcar o que você já viu.", " to mark what you've seen."),
            ),
      );
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
    if (!ws.length) {
      ul.replaceChildren(
        empty(
          L("Ninguém marcou ", "Nobody has marked any ") + KINDS[cat].label().toLowerCase() + L(" ainda", " yet"),
          L("Veja o Catálogo e seja o primeiro.", "Check the Catalog and be the first."),
        ),
      );
      return;
    }
  } else {
    ws = ofCat.map(w => ({ w, s: stats(w.id), r: release(w) }));
    const by = {
      lancou: (a, b) => (b.r.at || 0) - (a.r.at || 0) || Date.parse(b.w.created_at) - Date.parse(a.w.created_at),
      populares: (a, b) => b.s.who.length - a.s.who.length || (b.s.avg || 0) - (a.s.avg || 0),
      nota: (a, b) => (b.s.avg ?? -1) - (a.s.avg ?? -1) || b.s.nScores - a.s.nScores,
      az: (a, b) => a.w.title.localeCompare(b.w.title, locale()),
    };
    ws.sort(by[sortBy] || by.lancou);
    if (!ws.length) {
      ul.replaceChildren(
        empty(
          L("O catálogo está vazio", "The catalog is empty"),
          L("Use a busca lá em cima: ao marcar uma obra, ela entra no site.", "Use the search above: marking a title adds it to the site."),
        ),
      );
      return;
    }
  }
  ul.replaceChildren(...ws.slice(0, shown).map(x => workCard(x.w, x.s)));
  if (ws.length > shown)
    more.replaceChildren(
      h(
        "button",
        {
          class: "btn alt",
          type: "button",
          onclick: () => {
            shown += PAGE;
            render();
          },
        },
        L("Mostrar mais", "Show more") + " (" + (ws.length - shown) + ")",
      ),
    );
}

function chatBtn(w) {
  const n = commentCount(w.id),
    u = unread(w.id);
  return h(
    "button",
    {
      class: "icon chatb" + (u ? " new" : ""),
      type: "button",
      title: L("Comentários", "Comments"),
      "aria-label": L("Comentários sobre ", "Comments about ") + w.title + " (" + n + ")",
      onclick: () => openChat(w),
    },
    svg(I_CHAT),
    n ? h("span", { class: "cnt" }, n) : null,
  );
}
function notaSelect(id, val, onchange) {
  const s = h("select", { id, class: "nota" + (val ? " has" : ""), "aria-label": L("Nota", "Score"), onchange });
  s.append(h("option", { value: "" }, L("★ nota", "★ score")));
  for (let n = 10; n >= 1; n--) s.append(h("option", { value: n, selected: val === n }, "★ " + n));
  return s;
}
const titleLink = w => h("a", { href: workHref(w), "data-link": true, class: "tlink" }, h("b", {}, w.title));
function relLine(w, it) {
  const r = release(w);
  if (r.num == null && !r.next) return null;
  const n = behind(w, it, r);
  return h(
    "span",
    { class: "relline" },
    r.num != null ? h("span", { class: r.fresh ? "newtag" : "reltag" }, relTxt(w, r) + (r.fresh ? " · " + L("novo", "new") : "")) : null,
    r.num != null && r.at ? agoEl(r.at) : null,
    n > 0 ? h("span", { class: "behind" }, L(`você está ${n} atrás`, `you're ${n} behind`)) : null,
    r.num == null && r.next ? h("span", { class: "meta" }, UNIT[w.kind]()[1] + " " + r.next.num + " ", countEl(r.next.at, "")) : null,
  );
}

function myCard(w, i) {
  if (!w) return null;
  const s = stats(w.id),
    others = s.who.filter(x => x.user_id !== me.id),
    kid = w.id.slice(0, 8);
  const ctl = h(
    "div",
    { class: "c-ctl" },
    (() => {
      const sel = h("select", {
        id: "st-" + kid,
        class: "pill s-" + i.status,
        "aria-label": L("Situação", "Status"),
        onchange: e => setItem(w, { status: e.target.value }),
      });
      ST.forEach(x => sel.append(h("option", { value: x, selected: x === i.status }, stLabel(x, w.kind))));
      return sel;
    })(),
    notaSelect("nt-" + kid, i.score, e => setItem(w, { score: e.target.value ? Number(e.target.value) : null })),
    chatBtn(w),
    h(
      "a",
      {
        class: "icon",
        href: workHref(w),
        "data-link": true,
        title: L("Abrir página da obra", "Open title page"),
        "aria-label": L("Abrir ", "Open ") + w.title,
      },
      svg(I_OPEN),
    ),
    delArm === w.id
      ? h(
          "button",
          {
            class: "icon warn",
            type: "button",
            onclick: () => {
              delArm = null;
              removeItem(w);
            },
          },
          L("Tirar?", "Remove?"),
        )
      : h(
          "button",
          {
            class: "icon",
            type: "button",
            title: L("Tirar da minha lista", "Remove from my list"),
            "aria-label": L("Tirar ", "Remove ") + w.title + L(" da lista", " from list"),
            onclick: () => {
              delArm = w.id;
              render();
              setTimeout(() => {
                if (delArm === w.id) {
                  delArm = null;
                  render();
                }
              }, 3000);
            },
          },
          svg(I_DEL),
        ),
  );
  const prog = i.progress
    ? h(
        "span",
        { class: "meta" },
        L("Você: ", "You: ") + UNIT[w.kind]()[1].toLowerCase() + " " + i.progress + (w.total ? " / " + w.total : ""),
      )
    : null;
  return h(
    "li",
    { class: "card s-" + i.status + (flash === w.id ? " flash" : "") },
    h(
      "div",
      { class: "c-top" },
      coverEl(i.image_url || coverOf(w)),
      h(
        "div",
        { class: "c-name" },
        titleLink(w),
        w.alt_titles ? h("small", { class: "alt" }, w.alt_titles) : null,
        relLine(w, i),
        prog,
        others.length ? h("div", { class: "who", style: "margin-top:6px" }, whoChips(others, w.kind, 3)) : null,
      ),
      ctl,
    ),
  );
}
function workCard(w, s) {
  const mine = myItem(w.id);
  const card = h(
    "li",
    { class: "card s-" + (mine ? mine.status : s.who[0] ? s.who[0].status : "quero") + (flash === w.id ? " flash" : "") },
    h(
      "div",
      { class: "c-top" },
      coverEl(coverOf(w)),
      h(
        "div",
        { class: "c-name" },
        titleLink(w),
        h("small", { class: "alt" }, [tv(w.format), w.year, tv(w.status)].filter(Boolean).join(" · ") || w.alt_titles || ""),
        relLine(w, mine),
        s.who.length ? h("div", { class: "who", style: "margin-top:6px" }, whoChips(s.who, w.kind)) : null,
      ),
      h(
        "div",
        { class: "meta col" },
        s.avg != null ? h("span", { class: "score" }, fmt(s.avg)) : null,
        h("span", {}, s.who.length + " " + L(s.who.length === 1 ? "pessoa" : "pessoas", s.who.length === 1 ? "person" : "people")),
        chatBtn(w),
      ),
    ),
  );
  if (mine)
    card.append(
      h(
        "div",
        { class: "meta" },
        L("Você: ", "You: "),
        h("span", { class: "mine-tag s-" + mine.status }, stLabel(mine.status, w.kind)),
        mine.score ? h("span", { class: "score" }, mine.score) : null,
      ),
    );
  else if (canEdit()) {
    if (quick === w.id)
      card.append(
        h(
          "div",
          { class: "sts" },
          ST.map(st =>
            h(
              "button",
              {
                class: "st s-" + st,
                type: "button",
                onclick: async () => {
                  quick = null;
                  if (await setItem(w, { status: st })) ok(w.title + ": " + stLabel(st, w.kind));
                },
              },
              stLabel(st, w.kind),
            ),
          ),
        ),
      );
    else
      card.append(
        h(
          "div",
          {},
          h(
            "button",
            {
              class: "link",
              type: "button",
              onclick: () => {
                quick = w.id;
                render();
              },
            },
            L("+ Marcar na minha lista", "+ Add to my list"),
          ),
        ),
      );
  }
  return card;
}

/* ---------------- adicionar à mão (ADM) ---------------- */
function renderNew() {
  const box = $("newform");
  if (!draft || !isAdm()) {
    box.replaceChildren();
    return;
  }
  const stRow = h("div", { class: "sts" }),
    kindRow = h("div", { class: "kinds", role: "radiogroup", "aria-label": L("Tipo", "Type") }),
    imgBox = h("div", {}),
    title = h("h2", {});
  const paintImg = () =>
    imgBox.replaceChildren(
      imgPicker(
        "nf-img",
        draft.preview || null,
        f => {
          draft.file = f;
          draft.preview = URL.createObjectURL(f);
          paintImg();
        },
        () => {
          draft.file = null;
          draft.preview = null;
          paintImg();
        },
      ),
    );
  const paint = () => {
    title.textContent = L("Nova obra (à mão): ", "New title (manual): ") + KINDS[draft.k].one();
    if (box.firstChild) box.firstChild.dataset.k = draft.k;
    kindRow.replaceChildren(
      ...Object.entries(KINDS).map(([k, v]) =>
        h(
          "button",
          {
            class: "kind",
            type: "button",
            role: "radio",
            "data-k": k,
            "aria-checked": draft.k === k,
            onclick: () => {
              draft.k = k;
              paint();
            },
          },
          cap(v.one()),
        ),
      ),
    );
    stRow.replaceChildren(
      ...ST.map(s =>
        h(
          "button",
          {
            class: "st s-" + s + (draft.s === s ? " on" : ""),
            type: "button",
            "aria-pressed": draft.s === s,
            onclick: () => {
              draft.s = draft.s === s ? null : s;
              paint();
            },
          },
          stLabel(s, draft.k),
        ),
      ),
    );
  };
  const save = h("button", { class: "btn", type: "submit" }, L("Salvar", "Save"));
  box.replaceChildren(
    h(
      "form",
      {
        class: "newform",
        onsubmit: async e => {
          e.preventDefault();
          if (busy) return;
          const t = $("nf-t").value.trim();
          if (!t) {
            fail(L("Escreva o nome da obra.", "Type the title."));
            return;
          }
          const kind = draft.k;
          if (findWork(kind, t)) {
            fail(L("Essa obra já está no site.", "This title is already on the site."));
            return;
          }
          const feedIn = $("nf-feed").value.trim(),
            feed = feedIn ? feedFromUrl(feedIn) : "";
          if (feedIn && !feed) {
            fail(
              L("Esse link não é do MANGA Plus, WEBTOON nem Shonen Jump+.", "That link isn't from MANGA Plus, WEBTOON or Shonen Jump+."),
            );
            return;
          }
          busy = true;
          save.disabled = true;
          save.textContent = L("Salvando…", "Saving…");
          try {
            const cover = draft.file ? await uploadImg(draft.file) : null;
            const w = await api.insertWork({
              kind,
              title: t.slice(0, 160),
              slug: freeSlug(kind, t),
              alt_titles: $("nf-sub").value.trim().slice(0, 600),
              cover_url: cover,
              feed,
              created_by: me.id,
            });
            works.set(w.id, w);
            const st = draft.s,
              score = $("nf-n").value ? Number($("nf-n").value) : null;
            draft = null;
            renderNew();
            if (st) await setItem(w, { status: st, score });
            ok(L("Adicionado ao site: ", "Added to the site: ") + t);
            go(workHref(w));
          } catch (er) {
            fail(anyErr(er));
            save.disabled = false;
            save.textContent = L("Salvar", "Save");
          }
          busy = false;
        },
      },
      title,
      h(
        "p",
        { class: "note" },
        L(
          "Dica: prefira a busca do AniList, que já traz capa, sinopse e sites oficiais. Use isto só para obras que não estão lá.",
          "Tip: prefer the AniList search, which brings cover, synopsis and official sites. Use this only for titles missing there.",
        ),
      ),
      h("div", { class: "field" }, L("É um…", "It's a…"), kindRow),
      h(
        "label",
        { class: "field" },
        L("Nome", "Title"),
        h("input", { id: "nf-t", value: draft.t || "", maxlength: "160", required: true }),
      ),
      h(
        "label",
        { class: "field" },
        L("Outros nomes (opcional)", "Other titles (optional)"),
        h("input", { id: "nf-sub", maxlength: "600" }),
      ),
      h(
        "label",
        { class: "field" },
        L(
          "Link do MANGA Plus, WEBTOON ou Shonen Jump+ (opcional, para atualizar sozinho)",
          "MANGA Plus, WEBTOON or Shonen Jump+ link (optional, for automatic updates)",
        ),
        h("input", { id: "nf-feed", type: "url", inputmode: "url", placeholder: "https://mangaplus.shueisha.co.jp/titles/…" }),
      ),
      imgBox,
      h("div", { class: "field" }, L("Marcar na minha lista (opcional)", "Mark on my list (optional)"), stRow),
      h(
        "div",
        { class: "row2" },
        notaSelect("nf-n", null, e => e.target.classList.toggle("has", !!e.target.value)),
        h(
          "div",
          { class: "actions" },
          h(
            "button",
            {
              class: "btn alt",
              type: "button",
              onclick: () => {
                draft = null;
                renderNew();
              },
            },
            L("Cancelar", "Cancel"),
          ),
          save,
        ),
      ),
    ),
  );
  paint();
  paintImg();
}
$("addbtn").addEventListener("click", () => {
  if (!isAdm()) return;
  draft = { t: $("q").value.trim(), k: cat, s: "visto" };
  closeSearch();
  renderNew();
  setTimeout(() => {
    const el = $("nf-t");
    if (el) {
      el.focus();
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  });
});

/* ---------------- página não encontrada ---------------- */
function renderNotFound() {
  document.title = L("Página não encontrada", "Page not found") + " · Betoro-chan";
  $("wv").replaceChildren(
    h(
      "div",
      { class: "wv-in" },
      h(
        "div",
        { class: "empty notfound" },
        h("strong", {}, "404"),
        h("p", {}, L("Essa página não existe ou mudou de endereço.", "This page doesn't exist or has moved.")),
        h("a", { class: "btn", href: "/", "data-link": true }, L("Voltar para o início", "Back to the start")),
      ),
    ),
  );
}
