/* =====================================================================
   Lista de Animes do Betoro-chan — comentários
   Janela de comentários com respostas e imagens.
   ===================================================================== */
"use strict";

/* ---------------- comentários ---------------- */
// abrir os comentários cria um passo no histórico: o botão Voltar do celular fecha a janela
let voltarIgnorado = false;
async function openChat(w, semHistorico) {
  if (!semHistorico) {
    if (history.state && history.state.chat) history.replaceState({ chat: w.id }, "");
    else history.pushState({ chat: w.id }, "");
  }
  chatWork = w;
  replyTo = null;
  chatDel = null;
  chatMsgs = null;
  $("sheet").hidden = false;
  $("sheetbg").hidden = false;
  document.body.classList.add("noscroll");
  $("composer").hidden = !canEdit();
  $("sheetro").hidden = canEdit();
  renderChat(true);
  paintComposer();
  setTimeout(() => {
    const b = $("sheet").querySelector(".sheet-head .icon");
    if (b) b.focus();
  });
  await loadChat(true);
}
async function loadChat(scrollEnd) {
  if (!chatWork) return;
  const wid = chatWork.id;
  try {
    const rows = await api.loadComments(wid);
    if (!chatWork || chatWork.id !== wid) return;
    chatMsgs = rows;
  } catch (e) {
    chatMsgs = chatMsgs || [];
    fail(errMsg(e));
  }
  renderChat(scrollEnd);
}
function closeChat(peloVoltar) {
  if (!chatWork) return;
  chatWork = null;
  replyTo = null;
  $("sheet").hidden = true;
  $("sheetbg").hidden = true;
  document.body.classList.remove("noscroll");
  render();
  // fechou pelo X, Esc ou clicando fora: tira o passo que a janela criou no histórico
  if (!peloVoltar && history.state && history.state.chat) {
    voltarIgnorado = true;
    history.back();
  }
}
function msgEl(m, isReply) {
  const mine = m.user_id === myId();
  const text = h("p", { class: "m-text" + (m.gone ? " gone" : "") });
  if (m.gone) text.textContent = L("Mensagem apagada", "Deleted message");
  else {
    if (m.reply_to_user && isReply) text.append(h("span", { class: "at" }, "@" + pName(m.reply_to_user) + " "));
    text.append(m.body || "");
  }
  const act = h("div", { class: "m-act" });
  if (canEdit() && !m.gone)
    act.append(
      h(
        "button",
        {
          type: "button",
          onclick: () => {
            replyTo = { root: m.parent_id || m.id, uid: m.user_id };
            paintComposer();
            $("cmsg").focus();
          },
        },
        L("Responder", "Reply"),
      ),
    );
  if ((mine || isAdm()) && !m.gone)
    act.append(
      chatDel === m.id
        ? h("button", { class: "danger", type: "button", onclick: () => delMsg(m) }, L("Apagar mesmo?", "Really delete?"))
        : h(
            "button",
            {
              type: "button",
              onclick: () => {
                chatDel = m.id;
                renderChat();
                setTimeout(() => {
                  if (chatDel === m.id) {
                    chatDel = null;
                    renderChat();
                  }
                }, 3000);
              },
            },
            mine ? L("Apagar", "Delete") : L("Apagar (ADM)", "Delete (admin)"),
          ),
    );
  const t = Date.parse(m.created_at);
  return h(
    "div",
    { class: "msg" + (mine ? " mine" : "") + (chatFlash === m.id ? " flash" : "") },
    m.gone ? h("span", { class: "ava", style: "background:var(--line)" }, "") : avEl(m.user_id),
    h(
      "div",
      {},
      h(
        "div",
        { class: "m-head" },
        h("b", {}, m.gone ? "—" : pName(m.user_id)),
        (profiles.get(m.user_id) || {}).is_admin && !m.gone ? h("span", { class: "admtag" }, "ADM") : null,
        t ? h("time", { datetime: m.created_at, title: new Date(t).toLocaleString(locale()), "data-desde": t }, ago(t)) : null,
      ),
      text,
      m.image_url
        ? (() => {
            const im = h("img", {
              class: "m-img",
              src: m.image_url,
              alt: L("Imagem enviada", "Attached image"),
              loading: "lazy",
              decoding: "async",
            });
            im.addEventListener("error", () => im.remove());
            return im;
          })()
        : null,
      act.childNodes.length ? act : null,
    ),
  );
}
function renderChat(scrollEnd) {
  if (!chatWork) return;
  const w = works.get(chatWork.id) || chatWork,
    box = $("chat");
  const msgs = chatMsgs || [];
  if (msgs.length) {
    const mx = Math.max(...msgs.map(m => Date.parse(m.created_at)));
    if (mx > (seen[w.id] || 0)) {
      seen[w.id] = mx;
      lsSet("comentariosVistos", seen);
    }
  }
  $("sheethead").replaceChildren(
    coverEl(coverOf(w)),
    h(
      "div",
      {},
      h("h2", { id: "sheet-title" }, w.title),
      h(
        "small",
        {},
        h("span", { class: "kindtag", style: "--kc:var(--c-" + w.kind + ")" }, KINDS[w.kind].one()),
        " · " + msgs.length + " " + L(msgs.length === 1 ? "comentário" : "comentários", msgs.length === 1 ? "comment" : "comments"),
      ),
    ),
    h("button", { class: "icon", type: "button", "aria-label": L("Fechar", "Close"), onclick: closeChat }, svg(I_X)),
  );
  if (chatMsgs === null) {
    box.replaceChildren(h("div", { class: "empty" }, h("strong", {}, L("Carregando…", "Loading…"))));
    return;
  }
  const roots = new Map(),
    reps = new Map();
  for (const m of msgs) {
    if (m.parent_id) {
      if (!reps.has(m.parent_id)) reps.set(m.parent_id, []);
      reps.get(m.parent_id).push(m);
    } else roots.set(m.id, m);
  }
  for (const id of reps.keys()) if (!roots.has(id)) roots.set(id, { id, gone: true, created_at: reps.get(id)[0].created_at });
  const threads = [...roots.values()].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const nearEnd = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  if (!threads.length) {
    box.replaceChildren(
      h(
        "div",
        { class: "empty" },
        h("strong", {}, L("Nenhum comentário ainda", "No comments yet")),
        canEdit()
          ? L("Seja o primeiro a comentar sobre ", "Be the first to comment on ") + w.title + "."
          : L("Quando alguém comentar, aparece aqui.", "Comments will show up here."),
      ),
    );
    return;
  }
  box.replaceChildren(
    ...threads.map(r =>
      h(
        "article",
        { class: "thread" },
        msgEl(r, false),
        reps.has(r.id)
          ? h(
              "div",
              { class: "replies" },
              reps.get(r.id).map(x => msgEl(x, true)),
            )
          : null,
      ),
    ),
  );
  if (scrollEnd || nearEnd) box.scrollTop = box.scrollHeight;
}
async function delMsg(m) {
  chatDel = null;
  try {
    await api.deleteComment(m.id);
    chatMsgs = chatMsgs.filter(x => x.id !== m.id);
    comments = comments.filter(x => x.id !== m.id);
    renderChat();
    render();
    ok(L("Mensagem apagada.", "Message deleted."));
  } catch (e) {
    fail(errMsg(e));
  }
}
function paintComposer() {
  const r = $("replying");
  if (replyTo) {
    r.hidden = false;
    r.replaceChildren(
      L("Respondendo a ", "Replying to "),
      h("b", {}, pName(replyTo.uid)),
      h(
        "button",
        {
          type: "button",
          onclick: () => {
            replyTo = null;
            paintComposer();
          },
        },
        L("✕ cancelar", "✕ cancel"),
      ),
    );
  } else r.hidden = true;
  const p = $("cpreview");
  if (chatFile) {
    p.hidden = false;
    p.replaceChildren(
      h("img", { src: chatFile.url, alt: L("Prévia", "Preview") }),
      L("Imagem anexada", "Image attached"),
      h(
        "button",
        {
          type: "button",
          onclick: () => {
            chatFile = null;
            $("cimg").value = "";
            paintComposer();
          },
        },
        L("✕ remover", "✕ remove"),
      ),
    );
  } else p.hidden = true;
  $("csend").disabled = chatBusy || (!$("cmsg").value.trim() && !chatFile);
}
function autosize() {
  const t = $("cmsg");
  t.style.height = "auto";
  t.style.height = Math.min(140, t.scrollHeight) + "px";
}
$("cmsg").addEventListener("input", () => {
  autosize();
  paintComposer();
});
$("cmsg").addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing && window.matchMedia("(pointer:fine)").matches) {
    e.preventDefault();
    $("composer").requestSubmit();
  }
});
$("cimg").addEventListener("change", e => {
  const f = e.target.files && e.target.files[0];
  if (f) {
    chatFile = { file: f, url: URL.createObjectURL(f) };
    paintComposer();
  }
});
$("composer").addEventListener("submit", async e => {
  e.preventDefault();
  if (chatBusy || !canEdit() || !chatWork) return;
  const body = $("cmsg").value.trim().slice(0, 1000);
  if (!body && !chatFile) return;
  // guarda a obra e a resposta agora: se a pessoa trocar de obra durante o envio da imagem,
  // o comentário continua indo para a obra certa
  const alvo = chatWork,
    resposta = replyTo,
    arquivo = chatFile;
  chatBusy = true;
  paintComposer();
  try {
    const image_url = arquivo ? await uploadImg(arquivo.file) : null;
    const row = await api.insertComment({
      work_id: alvo.id,
      user_id: me.id,
      body,
      image_url,
      parent_id: resposta ? resposta.root : null,
      reply_to_user: resposta ? resposta.uid : null,
    });
    $("cmsg").value = "";
    autosize();
    if (chatFile === arquivo) {
      chatFile = null;
      $("cimg").value = "";
    }
    if (replyTo === resposta) replyTo = null;
    if (!comments.some(c => c.id === row.id))
      comments.push({ id: row.id, work_id: row.work_id, user_id: row.user_id, created_at: row.created_at });
    const aberta = chatWork && chatWork.id === alvo.id;
    if (aberta) {
      chatMsgs = (chatMsgs || []).filter(m => m.id !== row.id).concat([row]);
      chatFlash = row.id;
      renderChat(!resposta);
      setTimeout(() => {
        chatFlash = null;
      }, 600);
    }
    render();
    ok(aberta ? L("Comentário enviado.", "Comment posted.") : L("Comentário enviado em “", "Comment posted on “") + alvo.title + "”.");
  } catch (er) {
    if (/resposta_apagada/.test(String(er && er.message)) && replyTo === resposta) replyTo = null; // o texto fica na caixa
    fail(anyErr(er));
  }
  chatBusy = false;
  paintComposer();
});
$("sheetbg").addEventListener("click", closeChat);
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    if (!$("gate").hidden) closeLogin();
    else if (chatWork) closeChat();
  }
});
