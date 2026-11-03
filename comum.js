/* =====================================================================
   Lista de Animes do Betoro-chan — código usado pelo SITE e pelo ROBÔ.
   O site carrega este arquivo pelo index.html e o robô (scripts/sync.mjs)
   importa o mesmo arquivo. Mude aqui uma vez só: os dois lados seguem a
   mesma regra.
   ===================================================================== */
(function (raiz, fabrica) {
  const comum = fabrica();
  if (typeof module === "object" && module.exports)
    module.exports = comum; // robô (Node)
  else raiz.Comum = comum; // site (navegador)
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* ---------------- AniList: tipos e traduções dos valores ---------------- */
  const AL_KINDS = {
    anime: { type: "ANIME", formats: ["TV", "TV_SHORT", "MOVIE", "ONA", "OVA", "SPECIAL"] },
    manga: { type: "MANGA", formats: ["MANGA", "ONE_SHOT"] },
    novel: { type: "MANGA", formats: ["NOVEL"] },
  };
  const AL_FORMAT = {
    TV: "TV",
    TV_SHORT: "TV (curto)",
    MOVIE: "Filme",
    ONA: "ONA",
    OVA: "OVA",
    SPECIAL: "Especial",
    MANGA: "Mangá",
    ONE_SHOT: "One-shot",
    NOVEL: "Light novel",
  };
  const AL_STATUS = {
    FINISHED: "Finalizado",
    RELEASING: "Em lançamento",
    NOT_YET_RELEASED: "Ainda não lançado",
    CANCELLED: "Cancelado",
    HIATUS: "Em hiato",
  };
  const AL_SOURCE = {
    ORIGINAL: "Original",
    MANGA: "Mangá",
    LIGHT_NOVEL: "Light novel",
    WEB_NOVEL: "Web novel",
    NOVEL: "Novel",
    VISUAL_NOVEL: "Visual novel",
    VIDEO_GAME: "Jogo",
    GAME: "Jogo",
    WEB_MANGA: "Web mangá",
    OTHER: "Outro",
  };
  const AL_GENRE = {
    Action: "Ação",
    Adventure: "Aventura",
    Comedy: "Comédia",
    Fantasy: "Fantasia",
    Horror: "Terror",
    Music: "Música",
    Mystery: "Mistério",
    Psychological: "Psicológico",
    "Sci-Fi": "Ficção científica",
    "Slice of Life": "Slice of life",
    Sports: "Esportes",
    Supernatural: "Sobrenatural",
    Thriller: "Suspense",
  };
  const LANG_CODE = {
    Portuguese: "PT",
    English: "EN",
    Japanese: "JP",
    Spanish: "ES",
    French: "FR",
    German: "DE",
    Italian: "IT",
    Korean: "KO",
    Chinese: "ZH",
  };
  // campos pedidos ao AniList (a busca do site e o robô pedem os mesmos)
  const AL_FIELDS = `id idMal type format status episodes chapters volumes source isAdult
  title { romaji english native } synonyms startDate { year }
  genres coverImage { extraLarge large } description(asHtml: false)
  studios(isMain: true) { nodes { name } }
  staff(perPage: 3, sort: RELEVANCE) { edges { role node { name { full } } } }
  nextAiringEpisode { episode airingAt }
  externalLinks { site url type language }`;

  /* ---------------- links: só https:// ---------------- */
  // devolve o endereço só se for https:// (nunca javascript:, data:, http:)
  function linkSeguro(url) {
    const s = String(url || "").trim();
    return /^https:\/\/[^\s"'<>]+$/i.test(s) ? s : null;
  }
  const paraHttps = url =>
    String(url || "")
      .trim()
      .replace(/^http:\/\//i, "https://");
  const REDES_SOCIAIS = /twitter|^x$|instagram|youtube|tiktok|facebook|discord|wikipedia/i;

  // até 3 sites oficiais: português primeiro, depois sem idioma (valem no mundo todo), depois inglês
  function pickLinks(ext) {
    const todos = (ext || []).filter(l => l && linkSeguro(paraHttps(l.url)));
    let lista = todos.filter(l => l.type === "STREAMING");
    if (!lista.length) lista = todos.filter(l => l.type === "INFO" && !REDES_SOCIAIS.test(l.site || ""));
    const ordem = l => (/portug/i.test(l.language || "") ? 0 : !l.language ? 1 : /english/i.test(l.language || "") ? 2 : 3);
    const out = [],
      vistos = new Set();
    for (const l of lista.slice().sort((a, b) => ordem(a) - ordem(b))) {
      const chave = String(l.site || "").toLowerCase();
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      out.push({ site: String(l.site || "Site oficial").slice(0, 40), url: paraHttps(l.url), lang: LANG_CODE[l.language] || "" });
      if (out.length === 3) break;
    }
    return out;
  }

  /* ---------------- fontes automáticas de capítulos ---------------- */
  // sites oficiais que o robô sabe ler (Shonen Jump+ e os parecidos usam o mesmo sistema, o GigaViewer)
  const GIGA_SITES =
    "shonenjumpplus\\.com|tonarinoyj\\.jp|comic-days\\.com|comic-action\\.com|comicborder\\.com|comic-gardo\\.com|kuragebunch\\.com|magcomi\\.com|comic-zenon\\.com|comic-trail\\.com|comic-ogyaaa\\.com|viewer\\.heros-web\\.com|comic-earthstar\\.com|comicbushi-web\\.com|ichicomi\\.com";
  const GIGA = new RegExp("^https?:\\/\\/(?:www\\.)?(?:" + GIGA_SITES + ")\\/(?:episode|rss\\/series|series)\\/\\d+", "i");
  const GIGA_SALVO = new RegExp("^gigaviewer:https:\\/\\/(?:www\\.)?(?:" + GIGA_SITES + ")\\/(?:episode|rss\\/series|series)\\/\\d+$", "i");
  const WEBTOON_SALVO = /^webtoon:https:\/\/www\.webtoons\.com\/[a-z-]+\/[^/?#\s]+\/[^/?#\s]+\/rss\?title_no=\d+$/i;

  // transforma o link de uma página oficial na "fonte" que o robô lê
  function feedFromUrl(url) {
    let m;
    const u = String(url || "");
    if ((m = u.match(/^https?:\/\/mangaplus\.shueisha\.co\.jp\/titles\/(\d{1,9})/))) return "mangaplus:" + m[1];
    if ((m = u.match(/^https?:\/\/(?:www\.|m\.)?webtoons\.com\/([a-z-]+)\/([^/?#\s]+)\/([^/?#\s]+)\/(?:list|rss)\?title_no=(\d+)/i)))
      return "webtoon:https://www.webtoons.com/" + m[1] + "/" + m[2] + "/" + m[3] + "/rss?title_no=" + m[4];
    if ((m = u.match(GIGA))) return "gigaviewer:" + m[0].replace(/^http:/i, "https:");
    return "";
  }
  function feedFromLinks(ext) {
    const todos = (ext || []).filter(l => l && l.url);
    const mp = todos
      .filter(l => /mangaplus\.shueisha/.test(l.url))
      .sort((a, b) => (/english/i.test(a.language || "") ? 0 : 1) - (/english/i.test(b.language || "") ? 0 : 1));
    for (const l of [...mp, ...todos]) {
      const f = feedFromUrl(l.url);
      if (f) return f;
    }
    return "";
  }
  // confere uma fonte já salva no banco (o robô nunca acessa nada fora desta lista)
  function feedSeguro(feed) {
    const f = String(feed || "");
    return /^mangaplus:\d{1,9}$/.test(f) || WEBTOON_SALVO.test(f) || GIGA_SALVO.test(f) ? f : "";
  }
  const feedLabel = f =>
    f.startsWith("mangaplus:")
      ? "MANGA Plus"
      : f.startsWith("webtoon:")
        ? "WEBTOON"
        : f.startsWith("gigaviewer:")
          ? /shonenjumpplus/.test(f)
            ? "Shonen Jump+"
            : f.slice(11).split("/")[2]
          : "";
  const feedToUrl = f =>
    f.startsWith("mangaplus:")
      ? "https://mangaplus.shueisha.co.jp/titles/" + f.slice(10)
      : f.startsWith("webtoon:")
        ? f.slice(8).replace("/rss?", "/list?")
        : f.startsWith("gigaviewer:")
          ? f.slice(11)
          : "";

  /* ---------------- sinopse ---------------- */
  const decodeEnt = s =>
    String(s)
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
  const cleanSyn = s =>
    decodeEnt(
      String(s || "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, ""),
    )
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, 5900);

  /* ---------------- obra do AniList → obra do site ---------------- */
  function alToWork(m, kind) {
    const title = m.title.romaji || m.title.english || m.title.native;
    const alts = [m.title.english, m.title.native, ...(m.synonyms || [])]
      .filter(Boolean)
      .filter((v, i, a) => v !== title && a.indexOf(v) === i);
    let alt = "";
    for (const a of alts) {
      if ((alt + " · " + a).length > 590) break;
      alt = alt ? alt + " · " + a : a;
    }
    const author =
      kind === "anime"
        ? ((m.studios && m.studios.nodes) || []).map(x => x.name).join(", ")
        : ((m.staff && m.staff.edges) || [])
            .filter(e => /story|original|art/i.test(e.role))
            .map(e => e.node.name.full)
            .filter((v, i, a) => a.indexOf(v) === i)
            .join(", ");
    const total = kind === "anime" ? (m.episodes ?? null) : kind === "novel" ? (m.volumes ?? m.chapters ?? null) : (m.chapters ?? null);
    const w = {
      kind,
      title: title.slice(0, 160),
      alt_titles: alt,
      cover_url: linkSeguro(m.coverImage && (m.coverImage.extraLarge || m.coverImage.large)),
      synopsis: "",
      synopsis_en: cleanSyn(m.description),
      genres: (m.genres || [])
        .map(g => AL_GENRE[g] || g)
        .join(", ")
        .slice(0, 300),
      format: AL_FORMAT[m.format] || m.format || "",
      total,
      status: AL_STATUS[m.status] || "",
      year: (m.startDate && m.startDate.year) || null,
      studio: author.slice(0, 200),
      source: AL_SOURCE[m.source] || "",
      anilist_id: m.id,
      mal_id: m.idMal ?? null,
      links: pickLinks(m.externalLinks),
      feed: feedFromLinks(m.externalLinks),
    };
    if (kind === "anime") {
      const n = m.nextAiringEpisode;
      if (n) {
        w.next_num = n.episode;
        w.next_at = new Date(n.airingAt * 1000).toISOString();
        if (n.episode > 1) {
          w.rel_num = n.episode - 1;
          w.rel_src = "anilist";
        }
      } else if (m.status === "FINISHED" && m.episodes) {
        w.rel_num = m.episodes;
        w.rel_src = "anilist";
      }
    }
    return w;
  }
  // a obra do AniList combina com a aba do site? (anime com anime, novel com novel…)
  function tipoConfere(m, kind) {
    const k = AL_KINDS[kind];
    return !!k && (!m.type || m.type === k.type) && (!m.format || k.formats.includes(m.format));
  }

  /* ---------------- tradução gratuita (MyMemory; reserva: Google Tradutor público) ---------------- */
  // divide em trechos de até 450 letras, sem cortar frases quando dá
  function chunks(text, max = 450) {
    const out = [];
    for (const para of String(text || "").split(/\n{2,}/)) {
      const frases = para.replace(/\n/g, " ").match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [para];
      let cur = "";
      for (let s of frases) {
        while (s.length > max) {
          if (cur) {
            out.push(cur.trim());
            cur = "";
          }
          out.push(s.slice(0, max));
          s = s.slice(max);
        }
        if ((cur + s).length > max && cur) {
          out.push(cur.trim());
          cur = "";
        }
        cur += s;
      }
      if (cur.trim()) out.push(cur.trim());
      out.push("\n\n");
    }
    out.pop();
    return out.filter(c => c === "\n\n" || c.trim());
  }
  const tempoLimite = ms => (typeof AbortSignal !== "undefined" && AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined);
  async function traduzirTrecho(trecho, o) {
    try {
      const url =
        "https://api.mymemory.translated.net/get?q=" +
        encodeURIComponent(trecho) +
        "&langpair=en|pt-BR" +
        (o.email ? "&de=" + encodeURIComponent(o.email) : "");
      const r = await fetch(url, { signal: tempoLimite(o.tempo) });
      const j = await r.json();
      const t = j && j.responseData && j.responseData.translatedText;
      if (r.ok && Number(j.responseStatus) === 200 && t && !/MYMEMORY WARNING|LIMIT|INVALID/i.test(t)) return decodeEnt(t).trim();
    } catch (e) {
      /* tenta o tradutor reserva */
    }
    const r = await fetch(
      "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=pt&dt=t&q=" + encodeURIComponent(trecho),
      { signal: tempoLimite(o.tempo) },
    );
    const j = await r.json().catch(() => null);
    if (!r.ok || !Array.isArray(j) || !Array.isArray(j[0])) throw new Error("tradutores sem resposta (" + r.status + ")");
    return decodeEnt(j[0].map(x => x[0]).join("")).trim();
  }
  // opções: tempo (ms por trecho), juntos (todos os trechos ao mesmo tempo), pausa (ms entre trechos), email (MyMemory)
  async function traduzir(text, opcoes) {
    const o = Object.assign({ tempo: 8000, juntos: false, pausa: 0, email: "" }, opcoes);
    const partes = chunks(text);
    let feitos;
    if (o.juntos) feitos = await Promise.all(partes.map(c => (c === "\n\n" ? c : traduzirTrecho(c, o))));
    else {
      feitos = [];
      for (const c of partes) {
        feitos.push(c === "\n\n" ? c : await traduzirTrecho(c, o));
        if (o.pausa && c !== "\n\n") await new Promise(r => setTimeout(r, o.pausa));
      }
    }
    let out = "";
    for (const t of feitos) out = t === "\n\n" ? out.trimEnd() + "\n\n" : out + t + " ";
    return out.trim().slice(0, 5900);
  }

  /* ---------------- comparação que não liga para a ordem das chaves ---------------- */
  // o banco devolve {"url","lang","site"} e o código monta {"site","url","lang"}: são iguais
  function canonico(v) {
    if (Array.isArray(v)) return "[" + v.map(canonico).join(",") + "]";
    if (v && typeof v === "object")
      return (
        "{" +
        Object.keys(v)
          .sort()
          .map(k => JSON.stringify(k) + ":" + canonico(v[k]))
          .join(",") +
        "}"
      );
    return JSON.stringify(v ?? null);
  }
  const igual = (a, b) => canonico(a) === canonico(b);

  return {
    AL_KINDS,
    AL_FORMAT,
    AL_STATUS,
    AL_SOURCE,
    AL_GENRE,
    AL_FIELDS,
    LANG_CODE,
    linkSeguro,
    pickLinks,
    feedFromUrl,
    feedFromLinks,
    feedSeguro,
    feedLabel,
    feedToUrl,
    decodeEnt,
    cleanSyn,
    alToWork,
    tipoConfere,
    chunks,
    traduzir,
    igual,
  };
});
