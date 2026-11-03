/* =====================================================================
   Lista de Animes do Betoro-chan — início
   Login, atualização ao vivo, relógio e partida do site.
   ===================================================================== */
"use strict";

/* ---------------- login ---------------- */
let loginMode = "entrar";
function openLogin() {
  if (!api) {
    fail(L("O site ainda não foi ligado ao banco de dados.", "The site is not connected to the database yet."));
    return;
  }
  $("gate").hidden = false;
  paintLogin();
  setTimeout(() => {
    const el = $("lg-nick") || $("lg-email");
    if (el) el.focus();
  });
}
function closeLogin() {
  $("gate").hidden = true;
}
function paintLogin() {
  const g = $("gate");
  const err = h("p", { class: "gate-err", id: "lg-err", role: "alert" });
  const isUp = loginMode === "criar",
    isReset = loginMode === "senha";
  const btn = h(
    "button",
    { class: "gbtn main", type: "submit" },
    isUp
      ? L("Criar conta", "Create account")
      : isReset
        ? L("Mandar link para trocar a senha", "Send password reset link")
        : L("Entrar", "Sign in"),
  );
  g.replaceChildren(
    h(
      "form",
      {
        class: "gate-card",
        "aria-labelledby": "lg-title",
        onsubmit: async e => {
          e.preventDefault();
          err.textContent = "";
          err.className = "gate-err";
          const email = $("lg-email").value.trim(),
            pass = $("lg-pass") ? $("lg-pass").value : "";
          btn.disabled = true;
          try {
            if (isReset) {
              await api.resetPassword(email);
              err.className = "gate-ok";
              err.textContent = L("Pronto! Veja seu e-mail para trocar a senha.", "Done! Check your e-mail to reset your password.");
              btn.disabled = false;
              return;
            }
            if (isUp) {
              const nick = $("lg-nick").value.trim().slice(0, 40);
              if (!nick) {
                err.textContent = L("Escolha um nome para a galera ver.", "Pick a name for your friends to see.");
                btn.disabled = false;
                return;
              }
              if (pass !== $("lg-pass2").value) {
                err.textContent = L(
                  "As senhas não são iguais. Digite a mesma senha nos dois campos.",
                  "The passwords don't match. Type the same password in both fields.",
                );
                btn.disabled = false;
                $("lg-pass2").focus();
                return;
              }
              const r = await api.signUp(email, pass, nick);
              if (!r.session) {
                err.className = "gate-ok";
                err.textContent = L(
                  "Conta criada! Confirme pelo link que chegou no seu e-mail e depois entre.",
                  "Account created! Confirm with the link sent to your e-mail, then sign in.",
                );
                btn.disabled = false;
                return;
              }
            } else await api.signIn(email, pass);
            closeLogin();
            ok(isUp ? L("Conta criada. Bem-vindo!", "Account created. Welcome!") : L("Bem-vindo de volta!", "Welcome back!"));
          } catch (er) {
            err.textContent = errMsg(er);
            btn.disabled = false;
          }
        },
      },
      h("button", { class: "icon gate-x", type: "button", "aria-label": L("Fechar", "Close"), onclick: closeLogin }, svg(I_X)),
      h("p", { class: "eyebrow" }, "ベトロちゃん"),
      h(
        "h2",
        { id: "lg-title" },
        isUp ? L("Criar conta", "Create account") : isReset ? L("Esqueci a senha", "Forgot password") : L("Entrar", "Sign in"),
      ),
      isUp
        ? h(
            "label",
            { class: "field" },
            L("Seu nome na lista", "Your name on the list"),
            h("input", { id: "lg-nick", maxlength: "40", autocomplete: "nickname", required: true }),
          )
        : null,
      h(
        "label",
        { class: "field" },
        "E-mail",
        h("input", { id: "lg-email", type: "email", required: true, autocomplete: "email", inputmode: "email" }),
      ),
      isReset
        ? null
        : h(
            "label",
            { class: "field" },
            L("Senha", "Password"),
            h("input", {
              id: "lg-pass",
              type: "password",
              required: true,
              minlength: "6",
              autocomplete: isUp ? "new-password" : "current-password",
            }),
          ),
      isUp
        ? h(
            "label",
            { class: "field" },
            L("Confirme a senha", "Confirm password"),
            h("input", { id: "lg-pass2", type: "password", required: true, minlength: "6", autocomplete: "new-password" }),
          )
        : null,
      isUp ? h("small", { class: "note" }, L("Mínimo de 6 caracteres.", "At least 6 characters.")) : null,
      err,
      btn,
      h(
        "div",
        { class: "gate-links" },
        loginMode !== "entrar"
          ? h(
              "button",
              {
                class: "link",
                type: "button",
                onclick: () => {
                  loginMode = "entrar";
                  paintLogin();
                },
              },
              L("Já tenho conta", "I have an account"),
            )
          : null,
        loginMode !== "criar"
          ? h(
              "button",
              {
                class: "link",
                type: "button",
                onclick: () => {
                  loginMode = "criar";
                  paintLogin();
                },
              },
              L("Criar conta", "Create account"),
            )
          : null,
        loginMode === "entrar"
          ? h(
              "button",
              {
                class: "link",
                type: "button",
                onclick: () => {
                  loginMode = "senha";
                  paintLogin();
                },
              },
              L("Esqueci a senha", "Forgot password"),
            )
          : null,
      ),
    ),
  );
}
$("gate").addEventListener("click", e => {
  if (e.target === $("gate")) closeLogin();
});

/* ---------------- ao vivo ---------------- */
const tabelasPendentes = new Set();
let pendT = null;
function onChange(table, payload) {
  const n = payload && payload.new,
    o = payload && payload.old,
    ev = payload && payload.eventType;
  if (table === "works" && ev === "DELETE" && o && o.id) works.delete(o.id);
  else if (table === "works" && n && n.id) works.set(n.id, n);
  else if (table === "profiles" && n && n.id) profiles.set(n.id, n);
  else if (table === "comments" && ev === "INSERT" && n) {
    if (!comments.some(c => c.id === n.id)) comments.push({ id: n.id, work_id: n.work_id, user_id: n.user_id, created_at: n.created_at });
    if (chatWork && chatWork.id === n.work_id && chatMsgs && !chatMsgs.some(m => m.id === n.id)) chatMsgs.push(n);
  } else {
    tabelasPendentes.add(table);
    clearTimeout(pendT);
    pendT = setTimeout(flush, 400);
  }
  scheduleRender();
}
async function flush() {
  const ts = [...tabelasPendentes];
  tabelasPendentes.clear();
  for (const t of ts) {
    try {
      const rows = await api.loadTable(t);
      if (t === "list_items") items = rows;
      else if (t === "comments") {
        comments = rows;
        if (chatWork) loadChat(false);
      } else if (t === "works") works = new Map(rows.map(r => [r.id, r]));
    } catch {}
  }
  scheduleRender();
}
let rT = null;
function scheduleRender() {
  clearTimeout(rT);
  rT = setTimeout(render, 60);
}

// relógio: a cada minuto atualiza só os textos de tempo ("há 5 min", "em 2h 10min").
// A página inteira só é redesenhada quando um episódio chega na hora oficial ("saiu!").
let ultimoTique = Date.now();
function renderQuandoPuder() {
  const a = document.activeElement;
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) {
    setTimeout(renderQuandoPuder, 5000);
    return;
  } // não atrapalha quem está digitando
  render();
}
setInterval(() => {
  if (document.visibilityState !== "visible") return;
  for (const el of document.querySelectorAll("[data-desde]")) el.textContent = ago(Number(el.dataset.desde));
  for (const el of document.querySelectorAll("[data-ate]")) el.textContent = countdown(Number(el.dataset.ate) - Date.now());
  const agora = Date.now();
  const saiu = [...works.values()].some(w => {
    const t = w.next_at ? Date.parse(w.next_at) : 0;
    return t > ultimoTique && t <= agora;
  });
  ultimoTique = agora;
  if (saiu) renderQuandoPuder();
}, 60000);

/* ---------------- início ---------------- */
document.querySelectorAll("#langs button").forEach(b => b.addEventListener("click", () => setLang(b.dataset.lang)));
(async function boot() {
  document.documentElement.lang = lang === "en" ? "en" : "pt-BR";
  // vindo do 404.html: só aceita endereço deste mesmo site (?p=//outro-site é ignorado)
  const p = new URLSearchParams(location.search).get("p");
  if (p) {
    let destino = "/";
    try {
      const u = new URL(p, location.origin);
      if (u.origin === location.origin) destino = u.pathname + u.search + u.hash;
    } catch {}
    history.replaceState(null, "", destino);
  }
  renderStatic();
  if (!api) {
    route = parseRoute(location.pathname);
    render();
    return;
  }
  me = await api.session().catch(() => null);
  api.onAuth(u => {
    const changed = (u && u.id) !== (me && me.id);
    me = u;
    if (!changed) return;
    if (!me && mode === "minha" && route.view === "home") go(KINDS[cat].path + "/catalogo", true);
    else render();
    renderStatic();
    if (chatWork) {
      $("composer").hidden = !canEdit();
      $("sheetro").hidden = canEdit();
      renderChat(false);
    }
  });
  if (location.pathname === "/" || location.pathname === "") history.replaceState(null, "", me ? "/animes" : "/animes/catalogo");
  route = parseRoute(location.pathname);
  if (!me && route.view === "home" && route.mode === "minha") history.replaceState(null, "", KINDS[route.kind].path + "/catalogo");
  applyRoute();
  try {
    const d = await api.loadAll();
    works = new Map(d.works.map(w => [w.id, w]));
    items = d.items;
    profiles = new Map(d.profiles.map(x => [x.id, x]));
    comments = d.comments;
  } catch (e) {
    fail(L("Não deu para carregar a lista. ", "Couldn't load the list. ") + errMsg(e));
  }
  ready = true;
  render();
  renderStatic();
  try {
    api.subscribe(onChange);
  } catch {}
})();
