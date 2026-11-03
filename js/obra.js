/* =====================================================================
   Lista de Animes do Betoro-chan — página da obra
   Detalhes, lançamentos, minha lista e ferramentas do ADM.
   ===================================================================== */
"use strict";

/* ---------------- página da obra ---------------- */
const currentWork = () => [...works.values()].find(w => w.kind === route.kind && w.slug === route.slug);
function renderWork() {
  const box = $("wv"),
    w = currentWork();
  if (!w) {
    document.title = (ready ? L("Obra não encontrada", "Title not found") : L("Carregando…", "Loading…")) + " · Betoro-chan";
    box.replaceChildren(
      h(
        "div",
        { class: "wv-in" },
        h(
          "div",
          { class: "empty notfound" },
          h("strong", {}, ready ? L("Obra não encontrada", "Title not found") : L("Carregando…", "Loading…")),
          ready ? h("p", {}, L("Talvez ela tenha sido removida pelo ADM.", "Maybe the admin removed it.")) : null,
          ready
            ? h("a", { class: "btn", href: KINDS[route.kind].path, "data-link": true }, L("Voltar para a lista", "Back to the list"))
            : null,
        ),
      ),
    );
    return;
  }
  document.title = w.title + " · " + L("Lista de Animes do Betoro-chan", "Betoro-chan's Anime List");
  const s = stats(w.id),
    r = release(w),
    pos = posicoes(w);
  box.style.setProperty("--wk", "var(--c-" + w.kind + ")");
  const corpo = wvTab === "galera" ? abaGalera(w, s) : wvTab === "stats" ? abaEstatisticas(w, s) : abaDetalhes(w, s, r, pos);
  box.replaceChildren(
    h(
      "div",
      { class: "wv-in" },
      h("div", { class: "wv-top" }, h("a", { class: "wv-back", href: homePath(), "data-link": true }, "← " + KINDS[w.kind].label())),
      h(
        "header",
        { class: "wv-title" },
        h("h1", {}, w.title),
        h("p", {}, cap(KINDS[w.kind].one()) + (w.alt_titles ? " · " + w.alt_titles : "")),
      ),
      abasDaObra(w, s),
      h("div", { class: "wv-grid" }, lateral(w, s, pos), h("main", { class: "wv-main" }, ...corpo)),
    ),
  );
}
// posição da obra no ranking de notas e de popularidade da galera
function posicoes(w) {
  const doTipo = [...works.values()].filter(x => x.kind === w.kind).map(x => ({ x, s: stats(x.id) }));
  const notas = doTipo.filter(o => o.s.avg != null).sort((a, b) => b.s.avg - a.s.avg || b.s.who.length - a.s.who.length);
  const populares = doTipo.filter(o => o.s.who.length).sort((a, b) => b.s.who.length - a.s.who.length);
  return { rank: notas.findIndex(o => o.x.id === w.id) + 1, popr: populares.findIndex(o => o.x.id === w.id) + 1 };
}
const nVotos = n => n + " " + L(n === 1 ? "nota" : "notas", n === 1 ? "vote" : "votes");
const nPessoas = n => n + " " + L(n === 1 ? "pessoa" : "pessoas", n === 1 ? "person" : "people");
function lateral(w, s, { rank, popr }) {
  const k = w.kind,
    U = UNIT[k](),
    r = release(w),
    cov = coverOf(w);
  const totalTxt = w.total
    ? String(w.total)
    : r.num != null
      ? numTxt(r.num) + "+ " + L("(em lançamento)", "(ongoing)")
      : L("ainda sem dados", "no data yet");
  const info = [
    [L("Tipo", "Type"), tv(w.format)],
    [U[0], totalTxt],
    [L("Situação", "Status"), tv(w.status)],
    [L("Ano", "Year"), w.year],
    [k === "anime" ? L("Estúdio", "Studio") : L("Autor", "Author"), w.studio],
    [L("Fonte", "Source"), tv(w.source)],
    [L("Gêneros", "Genres"), tvList(w.genres).join(", ")],
  ].filter(x => x[1]);
  const alPath = k === "anime" ? "anime" : "manga";
  return h(
    "aside",
    { class: "wv-side" },
    cov
      ? h("img", { class: "wv-cover", src: cov, alt: L("Capa de ", "Cover of ") + w.title, decoding: "async" })
      : h("div", { class: "wv-cover" }, svg(I_IMG)),
    w.alt_titles
      ? h(
          "div",
          { class: "blk" },
          h("h3", {}, L("Outros nomes", "Other titles")),
          h(
            "ul",
            { class: "plain" },
            ...w.alt_titles
              .split(/\s*·\s*/)
              .filter(Boolean)
              .map(n => h("li", {}, n)),
          ),
        )
      : null,
    h(
      "div",
      { class: "blk" },
      h("h3", {}, L("Informações", "Information")),
      h("dl", {}, ...info.flatMap(([a, b]) => [h("dt", {}, a), h("dd", {}, String(b))])),
    ),
    h(
      "div",
      { class: "blk" },
      h("h3", {}, L("Estatísticas da galera", "Friends' stats")),
      h(
        "dl",
        {},
        h("dt", {}, L("Nota", "Score")),
        h("dd", {}, s.avg != null ? fmt(s.avg) + " (" + nVotos(s.nScores) + ")" : "—"),
        h("dt", {}, L("Ranking", "Ranked")),
        h("dd", {}, rank ? "#" + rank : "—"),
        h("dt", {}, L("Popularidade", "Popularity")),
        h("dd", {}, popr ? "#" + popr : "—"),
        h("dt", {}, L("Na lista de", "On lists of")),
        h("dd", {}, nPessoas(s.who.length)),
        h("dt", {}, L("Comentários", "Comments")),
        h("dd", {}, String(commentCount(w.id))),
      ),
    ),
    w.anilist_id
      ? h(
          "div",
          { class: "blk" },
          h("h3", {}, L("Mais informações", "More info")),
          h(
            "ul",
            { class: "plain" },
            h(
              "li",
              {},
              h("a", { href: "https://anilist.co/" + alPath + "/" + w.anilist_id, target: "_blank", rel: "noopener" }, "AniList"),
            ),
            w.mal_id
              ? h(
                  "li",
                  {},
                  h("a", { href: "https://myanimelist.net/" + alPath + "/" + w.mal_id, target: "_blank", rel: "noopener" }, "MyAnimeList"),
                )
              : null,
          ),
        )
      : null,
  );
}
function abasDaObra(w, s) {
  const abas = [
    ["detalhes", L("Detalhes", "Details")],
    ["galera", L("Galera", "Friends") + " (" + s.who.length + ")"],
    ["stats", L("Estatísticas", "Stats")],
    ["coment", L("Comentários", "Comments") + " (" + commentCount(w.id) + ")"],
  ];
  return h(
    "nav",
    { class: "wv-tabs", "aria-label": L("Seções da obra", "Title sections") },
    abas.map(([id, l]) =>
      h(
        "button",
        {
          type: "button",
          "aria-selected": wvTab === id,
          onclick: () => {
            if (id === "coment") {
              openChat(w);
              return;
            }
            wvTab = id;
            render();
          },
        },
        l,
      ),
    ),
  );
}
const contaStatus = (s, st) => s.who.filter(i => i.status === st).length;
function quadroNota(w, s, { rank, popr }) {
  return h(
    "div",
    { class: "scorebox" },
    h(
      "div",
      { class: "sc-main" },
      h("small", {}, L("Nota", "Score")),
      h("b", {}, s.avg != null ? fmt(s.avg) : "—"),
      h("span", {}, nVotos(s.nScores)),
    ),
    h(
      "div",
      { class: "sc-stats" },
      h("div", {}, h("small", {}, L("Ranking", "Ranked")), h("b", {}, rank ? "#" + rank : "—")),
      h("div", {}, h("small", {}, L("Popularidade", "Popularity")), h("b", {}, popr ? "#" + popr : "—")),
      h("div", {}, h("small", {}, L("Membros", "Members")), h("b", {}, s.who.length)),
      h("div", {}, h("small", {}, stLabel("visto", w.kind)), h("b", {}, contaStatus(s, "visto"))),
    ),
  );
}
function abaDetalhes(w, s, r, pos) {
  const synPt = w.synopsis,
    synEn = w.synopsis_en;
  const synTxt = lang === "en" ? synEn || synPt : synPt || synEn;
  const traducaoChegando = lang === "pt" && !synPt && synEn;
  return [
    quadroNota(w, s, pos),
    releaseBox(w, r),
    minhaLista(w, r),
    h(
      "div",
      { class: "syn" },
      h("h3", {}, L("Sinopse", "Synopsis")),
      traducaoChegando ? h("p", { class: "note" }, L("A tradução automática chega em alguns minutos. Por enquanto, em inglês:", "")) : null,
      h("p", { lang: (lang === "en" ? !!synEn : !synPt) ? "en" : "pt-BR" }, synTxt || L("Ainda não tem sinopse.", "No synopsis yet.")),
      lang === "pt" && w.syn_src === "gratis" ? h("p", { class: "note" }, "Tradução automática gratuita.") : null,
    ),
    w.genres
      ? h(
          "div",
          { class: "chips" },
          tvList(w.genres).map(g => h("span", {}, g)),
        )
      : null,
    isAdm() ? admPanel(w, r) : null,
  ];
}
function abaGalera(w, s) {
  const U = UNIT[w.kind](),
    quem = [...s.who].sort((a, b) => ST.indexOf(a.status) - ST.indexOf(b.status));
  if (!quem.length)
    return [
      h(
        "div",
        { class: "empty" },
        h("strong", {}, L("Ninguém marcou ainda", "Nobody has marked it yet")),
        L("Seja o primeiro.", "Be the first."),
      ),
    ];
  return [
    h(
      "ul",
      { class: "gl" },
      quem.map(i =>
        h(
          "li",
          {},
          avEl(i.user_id),
          h("b", {}, pName(i.user_id)),
          h(
            "span",
            { class: "mine-tag s-" + i.status },
            stLabel(i.status, w.kind) + (i.progress ? " · " + U[1].toLowerCase() + " " + i.progress : ""),
          ),
          i.score ? h("span", { class: "score" }, i.score) : h("span", { class: "meta" }, "—"),
        ),
      ),
    ),
  ];
}
function abaEstatisticas(w, s) {
  const d = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(n => [n, s.who.filter(i => i.score === n).length]),
    mx = Math.max(1, ...d.map(x => x[1]));
  return [
    h(
      "div",
      { class: "scorebox" },
      ...ST.map(st =>
        h(
          "div",
          { class: "sc-stats", style: "flex:0 0 auto" },
          h("div", {}, h("small", {}, stLabel(st, w.kind)), h("b", {}, contaStatus(s, st))),
        ),
      ),
    ),
    h(
      "div",
      { class: "dist", role: "img", "aria-label": L("Distribuição das notas", "Score distribution") },
      h("h3", {}, L("Distribuição das notas", "Score distribution")),
      ...d.map(([n, c]) =>
        h("div", {}, h("span", {}, "★" + n), h("span", {}, h("i", { style: "width:" + (c / mx) * 100 + "%" })), h("span", {}, c)),
      ),
    ),
  ];
}

// quadro "Na sua lista": situação, nota e até onde a pessoa viu
function minhaLista(w, r) {
  const k = w.kind,
    U = UNIT[k](),
    mine = myItem(w.id);
  if (!canEdit())
    return h(
      "div",
      { class: "mine-box" },
      h("h3", {}, L("Quer marcar esta obra?", "Want to track this title?")),
      h("div", {}, h("button", { class: "btn", type: "button", "data-login": true }, L("Entrar ou criar conta", "Sign in or sign up"))),
    );
  const ep = mine ? mine.progress || 0 : 0,
    max = w.total || PROGRESSO_MAX;
  const setEp = async n => {
    n = Math.max(0, Math.min(max, Math.floor(n)));
    const p = { progress: n };
    if (w.total && n >= w.total) p.status = "visto";
    else if (n > 0 && (!mine || mine.status === "quero")) p.status = "assistindo";
    if ((await setItem(w, p)) && p.status === "visto") ok(L("Terminou! Marcado como ", "Finished! Marked as ") + stLabel("visto", k));
  };
  // campo vazio, texto ou número fora do limite: avisa e volta ao número salvo (nunca zera sem querer)
  const aoMudar = e => {
    const el = e.target,
      v = el.value.trim(),
      n = Number(v);
    if (el.validity.badInput || v === "" || !isFinite(n)) {
      el.value = ep;
      fail(L(`Digite só o número do ${umDe(k)}.`, `Type only the ${umDe(k)} number.`));
      return;
    }
    if (n < 0) {
      el.value = ep;
      fail(L("O número não pode ser negativo.", "The number can't be negative."));
      return;
    }
    if (!w.total && n > PROGRESSO_MAX) {
      el.value = ep;
      fail(L(`O limite é ${PROGRESSO_MAX}.`, `The limit is ${PROGRESSO_MAX}.`));
      return;
    }
    setEp(n);
  };
  const botoes = h(
    "div",
    { class: "sts" },
    ST.map(st =>
      h(
        "button",
        {
          class: "st s-" + st + (mine && mine.status === st ? " on" : ""),
          type: "button",
          "aria-pressed": !!(mine && mine.status === st),
          onclick: async () => {
            if (await setItem(w, { status: st })) ok(w.title + ": " + stLabel(st, k));
          },
        },
        stLabel(st, k),
      ),
    ),
  );
  const progresso = mine
    ? h(
        "div",
        { class: "prog" },
        notaSelect("wv-nota-" + w.id, mine.score, e => setItem(w, { score: e.target.value ? Number(e.target.value) : null })),
        h("label", { for: "wv-ep-" + w.id }, U[0] + ":"),
        h("input", {
          id: "wv-ep-" + w.id,
          type: "number",
          min: "0",
          max: String(max),
          step: "1",
          inputmode: "numeric",
          value: ep,
          onchange: aoMudar,
          onkeydown: e => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.target.blur();
            }
          },
        }),
        h("span", {}, "/ " + (w.total || "?")),
        h("button", { type: "button", onclick: () => setEp(ep + 1) }, "+1"),
        r.num != null && ep < r.num && mine.status !== "visto"
          ? h("span", { class: "behind" }, L(`já saiu até o ${numTxt(r.num)}`, `out up to ${numTxt(r.num)}`))
          : null,
        w.total
          ? h(
              "div",
              { class: "bar-p", role: "progressbar", "aria-valuemin": 0, "aria-valuemax": w.total, "aria-valuenow": ep },
              h("i", { style: "width:" + Math.min(100, (ep / w.total) * 100) + "%" }),
            )
          : null,
      )
    : null;
  const tirar = mine
    ? h(
        "div",
        {},
        delArm === "wv"
          ? h(
              "button",
              {
                class: "link danger",
                type: "button",
                onclick: () => {
                  delArm = null;
                  removeItem(w);
                },
              },
              L("Tirar mesmo?", "Really remove?"),
            )
          : h(
              "button",
              {
                class: "link",
                type: "button",
                onclick: () => {
                  delArm = "wv";
                  render();
                  setTimeout(() => {
                    if (delArm === "wv") {
                      delArm = null;
                      render();
                    }
                  }, 3000);
                },
              },
              L("Tirar da minha lista", "Remove from my list"),
            ),
      )
    : null;
  return h(
    "div",
    { class: "mine-box" },
    h("h3", {}, mine ? L("Na sua lista", "On your list") : L("Adicionar à minha lista", "Add to my list")),
    botoes,
    progresso,
    tirar,
  );
}

function releaseBox(w, r) {
  const U = UNIT[w.kind]();
  const where =
    w.kind === "anime" ? L("Onde assistir (oficial)", "Where to watch (official)") : L("Onde ler (oficial)", "Where to read (official)");
  const links = (w.links || []).filter(l => l && linkSeguro(l.url)).slice(0, 3);
  const src = { anilist: "AniList", mangaplus: "MANGA Plus", webtoon: "WEBTOON", jumpplus: "Shonen Jump+", adm: "ADM" }[r.src] || "";
  const conferido = w.rel_checked_at ? Date.parse(w.rel_checked_at) : null;
  // obra que um amigo acabou de adicionar: o robô traz links e lançamentos em até 15 minutos
  const chegando = w.anilist_id && !w.verificado_em;
  return h(
    "section",
    { class: "relbox", "aria-label": L("Lançamentos", "Releases") },
    h("h3", {}, L("Lançamentos", "Releases")),
    r.num != null
      ? h(
          "p",
          { class: "rel-now" + (r.fresh ? " fresh" : "") },
          h("b", {}, relTxt(w, r)),
          " ",
          r.fresh ? h("span", { class: "newtag" }, w.kind === "anime" ? L("saiu!", "out now!") : L("novo!", "new!")) : null,
          r.at ? h("span", { class: "meta" }, " · ", agoEl(r.at, ""), " (" + when(r.at) + ")") : null,
          r.url
            ? h(
                "a",
                { class: "btn small", href: r.url, target: "_blank", rel: "noopener" },
                w.kind === "anime" ? L("Assistir", "Watch") : L("Ler", "Read"),
                svg(I_EXT),
              )
            : null,
        )
      : h(
          "p",
          { class: "meta" },
          chegando
            ? L(`O último ${umDe(w.kind)} aparece aqui em até 15 minutos.`, `The latest ${umDe(w.kind)} shows up here within 15 minutes.`)
            : L(`Ainda sem informação do último ${umDe(w.kind)}.`, `No info yet about the latest ${umDe(w.kind)}.`),
        ),
    r.next
      ? h(
          "p",
          { class: "rel-next" },
          L("Próximo: ", "Next: "),
          h("b", {}, U[1] + " " + r.next.num),
          " · " + when(r.next.at) + " · ",
          countEl(r.next.at),
        )
      : null,
    links.length
      ? h(
          "div",
          { class: "where" },
          h("small", {}, where),
          h(
            "div",
            { class: "where-links" },
            links.map(l =>
              h(
                "a",
                { class: "site", href: l.url, target: "_blank", rel: "noopener" },
                l.site,
                l.lang ? h("span", { class: "lang" }, l.lang) : null,
                svg(I_EXT),
              ),
            ),
          ),
        )
      : h(
          "p",
          { class: "meta" },
          chegando
            ? L(
                "Os sites oficiais chegam em até 15 minutos (o robô confere no AniList).",
                "Official sites arrive within 15 minutes (the robot checks AniList).",
              )
            : L("Nenhum site oficial cadastrado ainda.", "No official site listed yet."),
        ),
    src || conferido
      ? h(
          "p",
          { class: "note" },
          src ? L("Fonte: ", "Source: ") + src : null,
          src && conferido ? " · " : null,
          conferido ? L("conferido ", "checked ") : null,
          conferido ? agoEl(conferido, "") : null,
        )
      : null,
  );
}

/* ---------------- ferramentas do ADM na página da obra ---------------- */
function admPanel(w, r) {
  const btn = (id, label) =>
    h(
      "button",
      {
        class: "btn alt small" + (wvPanel === id ? " on" : ""),
        type: "button",
        "aria-expanded": wvPanel === id,
        onclick: () => {
          wvPanel = wvPanel === id ? null : id;
          wvEditImg = null;
          render();
        },
      },
      label,
    );
  return h(
    "section",
    { class: "adm", "aria-label": L("Ferramentas do ADM", "Admin tools") },
    h("h3", {}, h("span", { class: "admtag" }, "ADM"), " ", L("Ferramentas da obra", "Title tools")),
    h(
      "div",
      { class: "adm-btns" },
      btn("rel", L("Atualizar lançamento", "Update release")),
      btn("edit", L("Editar informações", "Edit information")),
      !w.anilist_id ? btn("al", L("Completar com o AniList", "Fill from AniList")) : null,
      btn("del", L("Apagar obra", "Delete title")),
    ),
    wvPanel === "rel" ? relForm(w, r) : null,
    wvPanel === "edit" ? editForm(w) : null,
    wvPanel === "al" ? alLinkBox(w) : null,
    wvPanel === "del" ? delBox(w) : null,
  );
}
function relForm(w, r) {
  const U = UNIT[w.kind](),
    um = umDe(w.kind);
  const save = h("button", { class: "btn", type: "submit" }, L("Salvar", "Save"));
  return h(
    "form",
    {
      class: "wv-edit",
      onsubmit: async e => {
        e.preventDefault();
        const el = $("rf-num"),
          raw = el.value.trim(),
          n = Number(raw);
        if (el.validity.badInput || raw === "" || !isFinite(n) || n < 0 || n > 1e6) {
          fail(
            L("Escreva o número do último lançamento (ex.: 1166 ou 10.5).", "Type the number of the latest release (e.g. 1166 or 10.5)."),
          );
          return;
        }
        const url = $("rf-url").value.trim();
        if (url && !linkSeguro(url)) {
          fail(L("O link precisa começar com https://", "The link must start with https://"));
          return;
        }
        save.disabled = true;
        try {
          const patch = {
            rel_num: n,
            rel_label: $("rf-label").value.trim().slice(0, 80),
            rel_url: url || null,
            rel_src: "adm",
            rel_at: new Date().toISOString(),
            rel_checked_at: new Date().toISOString(),
          };
          if (w.rel_at && (w.rel_num == null || n > Number(w.rel_num))) patch.rel_prev_at = w.rel_at;
          const nw = await api.updateWork(w.id, patch);
          works.set(nw.id, nw);
          wvPanel = null;
          ok(L("Lançamento atualizado: ", "Release updated: ") + U[1] + " " + numTxt(n));
        } catch (er) {
          fail(errMsg(er));
          save.disabled = false;
        }
        render();
      },
    },
    h(
      "p",
      { class: "note full" },
      w.feed
        ? L("Esta obra já atualiza sozinha pelo ", "This title updates automatically from ") +
            feedLabel(w.feed) +
            L(". Use isto só para corrigir.", ". Use this only to fix it.")
        : w.kind === "anime" && w.anilist_id
          ? L(
              "Animes atualizam sozinhos pelo horário oficial do AniList. Use isto só para corrigir.",
              "Anime update automatically from AniList's official schedule. Use this only to fix it.",
            )
          : L(
              "Esta obra não tem fonte automática gratuita. Atualize aqui quando sair um novo.",
              "This title has no free automatic source. Update it here when a new one comes out.",
            ),
    ),
    h(
      "label",
      { class: "field" },
      L(`Último ${um} lançado (número)`, `Latest ${um} released (number)`),
      h("input", {
        id: "rf-num",
        type: "number",
        min: "0",
        max: "1000000",
        step: "any",
        inputmode: "decimal",
        value: r.num ?? "",
        required: true,
      }),
    ),
    h(
      "label",
      { class: "field" },
      L("Nome (opcional, ex.: Vol. 3 Cap. 20)", "Label (optional, e.g. Vol. 3 Ch. 20)"),
      h("input", { id: "rf-label", maxlength: "80", value: w.rel_src === "adm" ? w.rel_label || "" : "" }),
    ),
    h(
      "label",
      { class: "field full" },
      L("Link oficial para ler/assistir (opcional)", "Official link to read/watch (optional)"),
      h("input", { id: "rf-url", type: "url", inputmode: "url", value: w.rel_url || "", placeholder: "https://" }),
    ),
    h(
      "div",
      { class: "actions full" },
      h(
        "button",
        {
          class: "btn alt",
          type: "button",
          onclick: () => {
            wvPanel = null;
            render();
          },
        },
        L("Cancelar", "Cancel"),
      ),
      save,
    ),
  );
}
// limites iguais aos do banco (supabase/schema.sql), para o erro aparecer aqui e não depois
const LIMITES = { title: 160, alt: 600, tipo: 60, situ: 60, estudio: 200, fonte: 60, generos: 300, syn: 6000, synen: 6000 };
function editForm(w) {
  const U = UNIT[w.kind]();
  const f = (id, label, v, cls, type) =>
    h(
      "label",
      { class: "field" + (cls ? " " + cls : "") },
      label,
      h("input", { id: "we-" + id, value: v ?? "", type: type || "text", maxlength: LIMITES[id] ? String(LIMITES[id]) : null }),
    );
  const cur = wvEditImg ? wvEditImg.url : coverOf(w);
  const links = (w.links || []).slice(0, 3);
  const save = h("button", { class: "btn", type: "submit" }, L("Salvar", "Save"));
  // número inteiro opcional: vazio = sem dado; texto ou fora do limite = erro (nunca apaga sem avisar)
  const inteiro = (id, nome, min, max) => {
    const el = $("we-" + id),
      v = el.value.trim();
    if (el.validity.badInput) return { erro: L(`${nome}: digite só números.`, `${nome}: numbers only.`) };
    if (v === "") return { v: null };
    const n = Number(v);
    return Number.isInteger(n) && n >= min && n <= max
      ? { v: n }
      : { erro: L(`${nome}: use um número inteiro entre ${min} e ${max}.`, `${nome}: use a whole number between ${min} and ${max}.`) };
  };
  return h(
    "form",
    {
      class: "wv-edit",
      onsubmit: async e => {
        e.preventDefault();
        if (busy) return;
        const g = id => $("we-" + id).value.trim();
        const title = g("title");
        if (!title) {
          fail(L("O nome não pode ficar vazio.", "The title can't be empty."));
          return;
        }
        const longo = Object.entries(LIMITES).find(([id, max]) => g(id).length > max);
        if (longo) {
          fail(
            L(
              `Um dos campos passou de ${longo[1]} letras. Encurte e salve de novo.`,
              `A field is longer than ${longo[1]} characters. Shorten it and save again.`,
            ),
          );
          return;
        }
        const total = inteiro("total", L("Total", "Total"), 0, PROGRESSO_MAX),
          ano = inteiro("ano", L("Ano", "Year"), 1900, 2100);
        if (total.erro || ano.erro) {
          fail(total.erro || ano.erro);
          return;
        }
        const newLinks = [0, 1, 2].map(i => ({ site: g("ls" + i), url: g("lu" + i) })).filter(l => l.site || l.url);
        if (newLinks.some(l => !linkSeguro(l.url) || !l.site)) {
          fail(
            L(
              "Cada site oficial precisa de nome e de um link começando com https://",
              "Each official site needs a name and a link starting with https://",
            ),
          );
          return;
        }
        const feedIn = g("feed");
        const feed = feedIn ? feedFromUrl(feedIn) : "";
        if (feedIn && !feed) {
          fail(L("Esse link não é do MANGA Plus, WEBTOON nem Shonen Jump+.", "That link isn't from MANGA Plus, WEBTOON or Shonen Jump+."));
          return;
        }
        const linksChanged = JSON.stringify(newLinks.map(l => [l.site, l.url])) !== JSON.stringify(links.map(l => [l.site, l.url]));
        const patch = {
          title,
          alt_titles: g("alt"),
          format: g("tipo"),
          total: total.v,
          status: g("situ"),
          year: ano.v,
          studio: g("estudio"),
          source: g("fonte"),
          genres: g("generos"),
          synopsis: g("syn"),
          synopsis_en: g("synen"),
          feed,
        };
        if (patch.synopsis !== (w.synopsis || "")) patch.syn_src = "adm";
        if (linksChanged) patch.links = newLinks.map(l => ({ site: l.site.slice(0, 40), url: l.url, lang: "", adm: true }));
        busy = true;
        save.disabled = true;
        save.textContent = L("Salvando…", "Saving…");
        try {
          if (wvEditImg && wvEditImg.file) patch.cover_url = await uploadImg(wvEditImg.file);
          const nw = await api.updateWork(w.id, patch);
          works.set(nw.id, nw);
          wvPanel = null;
          wvEditImg = null;
          ok(L("Informações salvas.", "Information saved."));
        } catch (er) {
          fail(anyErr(er));
        }
        busy = false;
        render();
      },
    },
    h(
      "div",
      { class: "full" },
      imgPicker(
        "we-img",
        cur,
        file => {
          wvEditImg = { file, url: URL.createObjectURL(file) };
          render();
        },
        null,
      ),
    ),
    f("title", L("Nome", "Title"), w.title, "full"),
    f("alt", L("Outros nomes (separados por · )", "Other titles (separated by · )"), w.alt_titles, "full"),
    f("tipo", L("Tipo (TV, Filme, Manhwa…)", "Type (TV, Movie, Manhwa…)"), w.format),
    f("total", L("Total de ", "Total ") + U[0].toLowerCase(), w.total, "", "number"),
    f("situ", L("Situação", "Status"), w.status),
    f("ano", L("Ano", "Year"), w.year, "", "number"),
    f("estudio", w.kind === "anime" ? L("Estúdio", "Studio") : L("Autor", "Author"), w.studio),
    f("fonte", L("Fonte", "Source"), w.source),
    f("generos", L("Gêneros (separados por vírgula)", "Genres (comma separated)"), w.genres, "full"),
    h(
      "label",
      { class: "field full" },
      L("Sinopse em português", "Synopsis in Portuguese"),
      h("textarea", { id: "we-syn", maxlength: String(LIMITES.syn) }, w.synopsis || ""),
    ),
    h(
      "label",
      { class: "field full" },
      L("Sinopse em inglês", "Synopsis in English"),
      h("textarea", { id: "we-synen", maxlength: String(LIMITES.synen) }, w.synopsis_en || ""),
    ),
    f(
      "feed",
      L(
        "Link do MANGA Plus, WEBTOON ou Shonen Jump+ (atualiza o capítulo sozinho)",
        "MANGA Plus, WEBTOON or Shonen Jump+ link (updates chapters automatically)",
      ),
      w.feed ? feedToUrl(w.feed) : "",
      "full",
      "url",
    ),
    h(
      "fieldset",
      { class: "full links-edit" },
      h("legend", {}, L("Sites oficiais (até 3)", "Official sites (up to 3)")),
      h(
        "p",
        { class: "note" },
        L(
          "Se você mudar estes links, a atualização automática não troca mais.",
          "If you change these links, the automatic update won't replace them.",
        ),
      ),
      ...[0, 1, 2].map(i =>
        h(
          "div",
          { class: "linkrow" },
          h("input", {
            id: "we-ls" + i,
            value: (links[i] || {}).site || "",
            placeholder: L("Nome (ex.: Crunchyroll)", "Name (e.g. Crunchyroll)"),
            "aria-label": L("Nome do site ", "Site name ") + (i + 1),
            maxlength: "40",
          }),
          h("input", {
            id: "we-lu" + i,
            value: (links[i] || {}).url || "",
            placeholder: "https://",
            type: "url",
            inputmode: "url",
            "aria-label": L("Link do site ", "Site link ") + (i + 1),
          }),
        ),
      ),
    ),
    h(
      "div",
      { class: "actions full" },
      h(
        "button",
        {
          class: "btn alt",
          type: "button",
          onclick: () => {
            wvPanel = null;
            wvEditImg = null;
            render();
          },
        },
        L("Cancelar", "Cancel"),
      ),
      save,
    ),
  );
}
let alLink = null;
function alLinkBox(w) {
  const st = alLink && alLink.wid === w.id ? alLink : null;
  const box = h("div", { class: "syn" });
  if (!st) {
    box.append(
      h(
        "p",
        { class: "note" },
        L(
          "Busca capa, sinopse, ano, episódios ou capítulos, sites oficiais e a fonte automática no AniList. Só preenche o que estiver vazio.",
          "Looks up cover, synopsis, year, episodes or chapters, official sites and the automatic source on AniList. Only fills empty fields.",
        ),
      ),
      h(
        "button",
        {
          class: "btn",
          type: "button",
          onclick: async () => {
            alLink = { wid: w.id, res: null };
            render();
            try {
              alLink.res = await anilistSearch(w.title, w.kind);
            } catch {
              alLink.err = true;
            }
            render();
          },
        },
        L("Buscar no AniList", "Search AniList"),
      ),
    );
    return box;
  }
  if (st.err) {
    box.append(
      h(
        "p",
        { class: "hint" },
        L("Não deu para buscar no AniList agora. Tente de novo mais tarde.", "Couldn't search AniList right now. Try again later."),
      ),
    );
    return box;
  }
  if (!st.res) {
    box.append(h("p", { class: "hint" }, L("Buscando…", "Searching…")));
    return box;
  }
  if (!st.res.length) {
    box.append(
      h(
        "p",
        { class: "hint" },
        L("Não encontrei. Confira se o nome está certo em “Editar informações”.", "Not found. Check the title in “Edit information”."),
      ),
    );
    return box;
  }
  box.append(h("p", { class: "note" }, L("Qual destes é a obra?", "Which one is it?")));
  const taken = new Set([...works.values()].map(x => x.anilist_id).filter(Boolean));
  for (const a of st.res.slice(0, 5))
    box.append(
      h(
        "div",
        { class: "sg", style: "padding:10px 0" },
        h(
          "div",
          { class: "sg-head" },
          coverEl(a.cover_url, "sm"),
          h("div", { class: "sg-t" }, h("b", {}, a.title), h("small", {}, alSummary(a))),
          taken.has(a.anilist_id)
            ? h("span", { class: "autotag" }, L("já é outra obra do site", "already another title"))
            : h(
                "button",
                {
                  class: "btn alt small",
                  type: "button",
                  onclick: async () => {
                    const patch = { anilist_id: a.anilist_id, mal_id: a.mal_id };
                    for (const key of ["cover_url", "synopsis_en", "genres", "format", "status", "studio", "source", "feed"])
                      if (!w[key] && a[key]) patch[key] = a[key];
                    if (w.total == null && a.total != null) patch.total = a.total;
                    if (w.year == null && a.year != null) patch.year = a.year;
                    if (!(w.links || []).length && a.links.length) patch.links = a.links;
                    if (w.kind === "anime") for (const key of ["next_num", "next_at"]) if (a[key] != null) patch[key] = a[key];
                    if (w.rel_num == null && a.rel_num != null) {
                      patch.rel_num = a.rel_num;
                      patch.rel_src = "anilist";
                    }
                    const extra = [a.title, ...String(a.alt_titles || "").split(" · ")].filter(
                      x => x && norm(x) !== norm(w.title) && !norm(w.alt_titles).includes(norm(x)),
                    );
                    if (extra.length) patch.alt_titles = [w.alt_titles, ...extra].filter(Boolean).join(" · ").slice(0, 600);
                    try {
                      const nw = await api.updateWork(w.id, patch);
                      works.set(nw.id, nw);
                      alLink = null;
                      wvPanel = null;
                      ok(L("Informações completadas!", "Information filled in!"));
                      render();
                    } catch (e) {
                      fail(errMsg(e));
                    }
                  },
                },
                L("É este", "This one"),
              ),
        ),
      ),
    );
  box.append(
    h(
      "button",
      {
        class: "link",
        type: "button",
        onclick: () => {
          alLink = null;
          render();
        },
      },
      L("Cancelar", "Cancel"),
    ),
  );
  return box;
}
function delBox(w) {
  const n = stats(w.id).who.length,
    c = commentCount(w.id);
  return h(
    "div",
    { class: "syn danger-box" },
    h(
      "p",
      {},
      L(
        `Apagar “${w.title}” tira a obra do site, de ${n} ${n === 1 ? "lista" : "listas"} e apaga ${c} ${c === 1 ? "comentário" : "comentários"}. Não dá para desfazer.`,
        `Deleting “${w.title}” removes it from the site, from ${n} ${n === 1 ? "list" : "lists"} and deletes ${c} ${c === 1 ? "comment" : "comments"}. This can't be undone.`,
      ),
    ),
    h(
      "div",
      { class: "actions" },
      h(
        "button",
        {
          class: "btn alt",
          type: "button",
          onclick: () => {
            wvPanel = null;
            render();
          },
        },
        L("Cancelar", "Cancel"),
      ),
      h(
        "button",
        {
          class: "btn danger",
          type: "button",
          onclick: async () => {
            try {
              await api.deleteWork(w.id);
              works.delete(w.id);
              items = items.filter(i => i.work_id !== w.id);
              comments = comments.filter(x => x.work_id !== w.id);
              ok(L("Obra apagada: ", "Title deleted: ") + w.title);
              go(KINDS[w.kind].path + "/catalogo");
            } catch (e) {
              fail(errMsg(e));
            }
          },
        },
        L("Apagar de vez", "Delete for good"),
      ),
    ),
  );
}
