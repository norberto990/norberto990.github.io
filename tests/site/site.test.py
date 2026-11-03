# =====================================================================
#  Testes do site num navegador de verdade (Chromium), sem internet.
#  O banco é o falso de tests/site/mock-api.js; AniList e tradutor são respondidos aqui.
#  Rodar:  python3 tests/site/site.test.py
#  Precisa de:  pip install playwright  e  python -m playwright install chromium
# =====================================================================
import json, os, socket, subprocess, sys, time
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parents[2]
AQUI = Path(__file__).resolve().parent
MOCK = (AQUI / "mock-api.js").read_text(encoding="utf-8")
CHROMIUM = os.environ.get("CHROMIUM") or ("/opt/pw-browsers/chromium" if os.path.exists("/opt/pw-browsers/chromium") else None)

# ---------- o que o AniList "responde" ----------
def media(i, romaji, fmt="TV", eps=12, status="RELEASING", nxt=None, links=None, desc="A hero rises."):
    return {"id": i, "idMal": i + 1, "type": "ANIME", "format": fmt, "status": status, "episodes": eps, "chapters": None, "volumes": None, "source": "MANGA", "isAdult": False,
            "title": {"romaji": romaji, "english": None, "native": None}, "synonyms": [], "startDate": {"year": 2024}, "genres": ["Action", "Fantasy"],
            "coverImage": {"extraLarge": None, "large": None}, "description": desc, "studios": {"nodes": [{"name": "MAPPA"}]}, "staff": {"edges": []},
            "nextAiringEpisode": nxt, "externalLinks": links or []}
KAIJU = media(777, "Kaiju No. 8 Season 3", nxt={"episode": 4, "airingAt": int(time.time()) + 86400},
              links=[{"site": "Crunchyroll", "url": "https://www.crunchyroll.com/x", "type": "STREAMING", "language": "Portuguese"}, {"site": "Twitter", "url": "https://twitter.com/x", "type": "SOCIAL", "language": None}])
DANDADAN = media(888, "Dandadan", desc="Momo meets Okarun. They fight ghosts.")
def anilist(v):
    q, n, pg = (v.get("q") or "").lower(), v.get("n", 6), v.get("p", 1)
    if "jojo" in q:
        if n == 25:
            itens = [media(1000 + pg * 100 + i, f"JoJo no Kimyou na Bouken Parte {pg * 25 + i}", "MOVIE" if i % 5 == 0 else "TV", status="FINISHED") for i in range(25 if pg < 2 else 8)]
            return itens, pg < 2
        return [media(1, "JoJo no Kimyou na Bouken", status="FINISHED")], False
    if "kaiju" in q: return [KAIJU], False
    if "dandadan" in q: return [DANDADAN], False
    return [], False
def rota(r):
    u = r.request.url
    if "graphql.anilist.co" in u:
        itens, mais = anilist(json.loads(r.request.post_data)["variables"])
        r.fulfill(status=200, headers={"access-control-allow-origin": "*"}, content_type="application/json",
                  body=json.dumps({"data": {"Page": {"pageInfo": {"hasNextPage": mais}, "media": itens}}}))
    elif "mymemory" in u:
        q = parse_qs(urlparse(u).query)["q"][0]
        r.fulfill(status=200, headers={"access-control-allow-origin": "*"}, content_type="application/json", body=json.dumps({"responseStatus": 200, "responseData": {"translatedText": "[PT] " + q}}))
    elif "localhost" in u: r.continue_()
    else: r.abort()

# guarda as mensagens (toasts) e qualquer bloqueio das regras de segurança (CSP)
ESPIAO = """
window.__toasts = []; window.__csp = [];
document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI));
addEventListener('DOMContentLoaded', () => new MutationObserver(() => { const t = document.getElementById('toast'); if (t && !t.hidden) window.__toasts.push(t.className + '|' + t.textContent); })
  .observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true }));
"""
TRADUTOR_LENTO = """(() => { const f = window.fetch; window.fetch = async (u, o) => { if (String(u).includes('mymemory')) { await new Promise(r => setTimeout(r, 2500)); return new Response(JSON.stringify({responseStatus:200,responseData:{translatedText:'[PT] ok'}})); } return f(u, o); }; })();"""
ENVIO_LENTO = """addEventListener('DOMContentLoaded', () => { const A = window.__MOCK_API, up = A.upload; A.upload = async (u, b) => { await new Promise(r => setTimeout(r, 1500)); return up(u, b); }; });"""
PNG = AQUI / "pixel.png"

resultados = []
def check(cond, msg, detalhe=""):
    resultados.append(("✔ " if cond else "✘ FALHOU ") + msg + ("" if cond or not detalhe else f"  → {detalhe}"))
def porta_livre():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p

PORTA = porta_livre(); BASE = f"http://localhost:{PORTA}"
servidor = subprocess.Popen([sys.executable, "-m", "http.server", str(PORTA), "-d", str(RAIZ)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
erros_js, bloqueios_csp = [], []

def abrir(b, caminho="/", largura=400, extras=(), mock=True):
    ctx = b.new_context(viewport={"width": largura, "height": 900})
    p = ctx.new_page()
    p.on("pageerror", lambda e: erros_js.append(str(e)))
    p.route("**/*", rota)
    p.add_init_script(ESPIAO)
    if mock: p.add_init_script(MOCK)
    for e in extras: p.add_init_script(e)
    p.goto(BASE + (caminho if caminho.startswith("/?") else "/")); p.wait_for_timeout(500)
    if not caminho.startswith("/?") and caminho != "/": p.evaluate(f"go({json.dumps(caminho)})"); p.wait_for_timeout(300)
    return ctx, p
def fechar(ctx, p):
    try: bloqueios_csp.extend(p.evaluate("window.__csp"))
    except Exception: pass
    ctx.close()
def entrar(p, email):
    p.evaluate("loginMode='entrar'; openLogin()"); p.fill("#lg-email", email); p.fill("#lg-pass", "123456"); p.click("#gate form button[type=submit]"); p.wait_for_timeout(300)
def toasts(p): return p.evaluate("window.__toasts")
def ultimo_toast(p): t = toasts(p); return t[-1] if t else ""
def rolagem_lateral(p): return p.evaluate("document.documentElement.scrollWidth - window.innerWidth")

try:
  with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path=CHROMIUM) if CHROMIUM else pw.chromium.launch()

    print("— Visitante (celular 320px)")
    ctx, p = abrir(b, "/", 320)
    check(p.url.endswith("/animes/catalogo"), 'visitante cai no Catálogo')
    check(p.is_hidden("#addbtn"), 'visitante não vê "Adicionar"')
    check(rolagem_lateral(p) <= 0, "sem rolagem lateral no celular (Catálogo)")
    check(str(time.localtime().tm_year) in p.text_content("#footer"), "rodapé com o ano atual")
    check("Ep. 7" in p.text_content("#list") and "novo" in p.text_content("#list"), 'anime virou "Ep. 7 · novo" na hora oficial')
    p.fill("#q", "solo leveling"); p.wait_for_timeout(300)
    check("Entre na sua conta" in p.text_content("#sugg"), "visitante: busca pede para entrar na conta")
    check("AniList" not in p.text_content("#sugg"), "visitante: não vê busca do AniList")
    p.keyboard.press("Escape")
    p.evaluate("go('/anime/sousou-no-frieren')"); p.wait_for_timeout(300)
    t = p.text_content("#wv")
    check("Crunchyroll" in t and "Netflix" in t and "Prime Video" in t, "página da obra: 3 sites oficiais")
    check("saiu!" in t, 'página da obra: "saiu!"')
    check("Ferramentas da obra" not in t, "visitante não vê ferramentas do ADM")
    check(rolagem_lateral(p) <= 0, "sem rolagem lateral no celular (obra)")
    p.evaluate("go('/qualquer/coisa')"); p.wait_for_timeout(200)
    check("404" in p.text_content("#wv") and "não existe" in p.text_content("#wv"), "página 404")
    p.evaluate("go('/manga/one-piece')"); p.wait_for_timeout(200)
    t = p.text_content("#wv")
    check("Cap. 1166" in t and "MANGA Plus" in t and "Ler" in t, "One Piece: cap. 1166, link oficial, botão Ler")
    check("tradução automática chega" in t.lower(), "sinopse ainda sem tradução avisa que está chegando")
    fechar(ctx, p)

    ctx, p = abrir(b, "/?p=//evil.example/x")
    check(p.evaluate("document.getElementById('cats').children.length") > 0 and p.url.startswith(BASE), "link ?p=//outro-site não quebra o site nem sai dele", p.url)
    fechar(ctx, p)
    ctx, p = abrir(b, "/?p=%2Fmanga%2Fone-piece")
    check(p.url.endswith("/manga/one-piece") and "One Piece" in p.text_content("#wv"), "link vindo do 404.html abre a página certa")
    fechar(ctx, p)

    print("— Usuário comum")
    ctx, p = abrir(b, "/", 320)
    entrar(p, "kenji@x.com")
    check(p.is_visible("#toast.ok"), "mensagem de sucesso verde ao entrar")
    check("null" not in p.text_content("#me"), "topo do usuário comum sem a palavra “null” sobrando", p.text_content("#me"))
    p.evaluate("go('/anime/sousou-no-frieren')"); p.wait_for_timeout(200)
    check("Ferramentas da obra" not in p.text_content("#wv"), "usuário comum não vê ferramentas do ADM")
    p.evaluate("window.__failNext=true"); p.get_by_role("button", name="Quero ver").first.click(); p.wait_for_timeout(300)
    check(p.is_visible("#toast.err") and "conexão" in p.text_content("#toast"), "mensagem de erro vermelha e clara")
    p.click('.wv-tabs button:has-text("Comentários")'); p.wait_for_timeout(300)
    msgs = p.eval_on_selector_all("#chat .msg", "els => els.map(e => [e.querySelector('.m-head b').textContent, [...e.querySelectorAll('.m-act button')].map(b=>b.textContent)])")
    check(any(n.startswith("Kenji") and "Apagar" in a for n, a in msgs) and all("Apagar" not in a for n, a in msgs if n.startswith("Mari")), "usuário comum só apaga o próprio comentário", str(msgs))
    check(rolagem_lateral(p) <= 0, "sem rolagem lateral com comentários abertos")
    p.go_back(); p.wait_for_timeout(400)
    check(p.is_hidden("#sheet") and p.url.endswith("/anime/sousou-no-frieren"), "botão Voltar fecha os comentários e continua na obra", p.url)
    p.click('.wv-tabs button:has-text("Comentários")'); p.wait_for_timeout(300)
    p.keyboard.press("Escape"); p.wait_for_timeout(300)
    check(p.is_hidden("#sheet"), "Esc fecha os comentários")
    p.go_back(); p.wait_for_timeout(400)
    check(not p.url.endswith("/anime/sousou-no-frieren") and p.is_hidden("#sheet"), "depois de fechar com Esc, Voltar volta para a página anterior (sem passo sobrando)", p.url)
    fechar(ctx, p)

    ctx, p = abrir(b, "/animes")
    entrar(p, "kenji@x.com")
    p.fill("#q", "dandadan"); p.wait_for_timeout(900)
    t = p.text_content("#sugg")
    check("Dandadan" in t and "marque e a obra entra" in t, "usuário comum vê resultados do AniList")
    check("à mão" not in t, 'usuário comum não vê "adicionar à mão"')
    p.click('#sugg .sg:has-text("Dandadan") button:has-text("Assistindo")'); p.wait_for_timeout(800)
    t = p.text_content("#list")
    check("Dandadan" in t, "marcou → obra entrou no site e na lista dele")
    syn = p.evaluate("[...works.values()].find(w=>w.anilist_id===888).synopsis")
    check(syn.startswith("[PT]"), "sinopse já entrou traduzida", syn)
    p.evaluate("go('/anime/dandadan')"); p.wait_for_timeout(300)
    t = p.text_content(".relbox")
    check("15 minutos" in t, "obra nova de amigo avisa que sites e episódios chegam em até 15 min", t[:120])
    p.evaluate("go('/animes')"); p.wait_for_timeout(200)
    p.fill("#q", "k"); p.wait_for_timeout(1500)
    t = p.text_content("#sugg")
    check("Buscando" not in t and "2 letras" in t, 'busca de 1 letra explica em vez de ficar "Buscando…"', t[-90:])
    fechar(ctx, p)

    ctx, p = abrir(b, "/manga/one-piece")
    entrar(p, "kenji@x.com"); p.wait_for_timeout(200)
    p.click('.mine-box button:has-text("Lendo")'); p.wait_for_timeout(300)
    ep = lambda: p.locator("input[id^=wv-ep-]")
    ep().fill("50"); ep().press("Enter"); p.wait_for_timeout(300)
    ep().fill(""); ep().press("Enter"); p.wait_for_timeout(300)
    prog = p.evaluate("myItem(currentWork().id).progress")
    check(prog == 50 and "número" in ultimo_toast(p), "apagar o número sem querer não zera o progresso e avisa", f"{prog} | {ultimo_toast(p)}")
    ep().fill("999999"); ep().press("Enter"); p.wait_for_timeout(300)
    t = ultimo_toast(p)
    check("permissão" not in t and "limite" in t.lower() and p.evaluate("myItem(currentWork().id).progress") == 50, "progresso 999999: explica o limite", t)
    p.evaluate("window.__toasts=[]; document.getElementById('toast').hidden=true"); ep().fill("12.7"); ep().press("Enter"); p.wait_for_timeout(300)
    erros = [x for x in toasts(p) if x.startswith("toast err")]
    check(p.evaluate("myItem(currentWork().id).progress") == 12 and not erros, "progresso 12.7: salva 12, sem erro", str(erros))
    fechar(ctx, p)

    ctx, p = abrir(b, "/anime/sousou-no-frieren")
    entrar(p, "kenji@x.com"); p.wait_for_timeout(200)
    p.locator('.prog button:has-text("+1")').click(); p.locator('.prog button:has-text("+1")').click(); p.wait_for_timeout(400)
    check(p.evaluate("myItem('w1-frieren-0001').progress") == 8, "+1 duas vezes rápido soma 2")
    fechar(ctx, p)

    ctx, p = abrir(b, "/buscar?q=dandadan&tipo=anime", extras=[TRADUTOR_LENTO])
    entrar(p, "kenji@x.com"); p.wait_for_timeout(600)
    botao = p.locator('#list li.card:has-text("Dandadan") button:has-text("Assistindo")')
    botao.click(); p.wait_for_timeout(250)
    try: botao.click(timeout=800)
    except Exception: pass
    p.wait_for_timeout(3500)
    erros = [x for x in toasts(p) if x.startswith("toast err")]
    n = p.evaluate("[...works.values()].filter(w=>w.anilist_id===888).length")
    check(not erros and n == 1, "clique duplo em “Assistindo” adiciona uma vez só, sem erro", f"{erros} obras={n}")
    check(p.evaluate("myItem([...works.values()].find(w=>w.anilist_id===888).id).status") == "assistindo", "depois do clique duplo a obra está na lista como Assistindo")
    fechar(ctx, p)

    ctx, p = abrir(b, "/anime/sousou-no-frieren", extras=[ENVIO_LENTO])
    entrar(p, "kenji@x.com"); p.wait_for_timeout(200)
    p.evaluate("openChat(works.get('w1-frieren-0001'))"); p.wait_for_timeout(300)
    p.set_input_files("#cimg", str(PNG)); p.fill("#cmsg", "foto do ep 10 do Frieren"); p.click("#csend")
    p.wait_for_timeout(200); p.evaluate("closeChat()"); p.wait_for_timeout(300); p.evaluate("openChat(works.get('w3-onepiece-003'))"); p.wait_for_timeout(2500)
    onde = p.evaluate("(async()=>({frieren:(await api.loadComments('w1-frieren-0001')).some(c=>c.body.includes('foto do ep')), onepiece:(await api.loadComments('w3-onepiece-003')).some(c=>c.body.includes('foto do ep'))}))()")
    check(onde["frieren"] and not onde["onepiece"], "trocar de obra durante o envio não manda o comentário para a obra errada", str(onde))
    check("Frieren" in ultimo_toast(p), "avisa em qual obra o comentário foi enviado", ultimo_toast(p))
    p.evaluate("closeChat()"); p.wait_for_timeout(300); p.evaluate("openChat(works.get('w1-frieren-0001'))"); p.wait_for_timeout(300)
    p.evaluate("replyTo={root:'apagado',uid:'22222222-bbbb'}; paintComposer()"); p.fill("#cmsg", "respondendo"); p.click("#csend"); p.wait_for_timeout(400)
    t = ultimo_toast(p)
    check("apagado" in t and "permissão" not in t and p.input_value("#cmsg") == "respondendo", "responder a comentário recém-apagado: explica e mantém o texto", t)
    fechar(ctx, p)

    ctx, p = abrir(b, "/animes")
    entrar(p, "kenji@x.com")
    # um usuário comum tenta gravar link perigoso e capítulo falso: o banco limpa
    p.evaluate("""api.insertWork({kind:'manga',title:'Chainsaw Man',slug:'chainsaw-man',anilist_id:105778,created_by:me.id,rel_num:99999,rel_url:'javascript:alert(1)',links:[{site:'MANGA Plus',url:'javascript:alert(1)',adm:true}]}).then(r=>works.set(r.id,r))""")
    p.wait_for_timeout(200); p.evaluate("go('/manga/chainsaw-man')"); p.wait_for_timeout(300)
    t = p.text_content(".relbox")
    check("99999" not in t and p.locator('.relbox a[href^="javascript:"]').count() == 0, "capítulo falso e link javascript: de usuário comum não aparecem", t[:100])
    fechar(ctx, p)

    print("— ADM")
    ctx, p = abrir(b, "/", 1100)
    entrar(p, "adm@x.com")
    p.evaluate("go('/animes')"); p.wait_for_timeout(200)
    check("ADM" in p.text_content("#me"), "ADM aparece no topo")
    check(p.is_visible("#addbtn"), 'ADM vê "Adicionar à mão"')
    check("atrás" in p.text_content("#list"), '"você está N atrás" na minha lista')
    p.fill("#q", "kaiju"); p.wait_for_timeout(900)
    check("Kaiju No. 8 Season 3" in p.text_content("#sugg"), "ADM vê resultados do AniList")
    p.click('#sugg .sg:has-text("Kaiju") button:has-text("Ver página")'); p.wait_for_timeout(600)
    t = p.text_content("#wv")
    check(p.url.endswith("/anime/kaiju-no-8-season-3"), "obra nova abre no próprio link")
    check("Crunchyroll" in t and "Twitter" not in t, "obra nova do ADM já vem com site oficial (sem rede social)")
    check("Próximo" in t and "Ep. 4" in t, "obra nova do ADM já mostra o próximo episódio")
    p.click('.adm-btns button:has-text("Atualizar lançamento")'); p.fill("#rf-num", "5"); p.click(".wv-edit button[type=submit]"); p.wait_for_timeout(300)
    check("Ep. 5" in p.text_content(".relbox"), "ADM atualiza lançamento à mão")
    p.click('.adm-btns button:has-text("Apagar obra")'); p.click('button:has-text("Apagar de vez")'); p.wait_for_timeout(300)
    check(p.url.endswith("/animes/catalogo") and "Kaiju" not in p.text_content("#list"), "ADM apaga obra")
    p.evaluate("go('/anime/sousou-no-frieren')"); p.wait_for_timeout(200)
    p.evaluate("wvPanel='edit'; render()"); p.wait_for_timeout(100)
    check(p.get_attribute("#we-title", "maxlength") == "160", "campo Nome não deixa passar de 160 letras")
    p.evaluate("document.getElementById('we-title').value='A'.repeat(200)"); p.click("form.wv-edit button[type=submit]"); p.wait_for_timeout(300)
    t = ultimo_toast(p)
    check("permissão" not in t and "160" in t, "nome grande demais: mensagem certa", t)
    p.evaluate("document.getElementById('we-title').value='Sousou no Frieren'"); p.fill("#we-total", "200000"); p.click("form.wv-edit button[type=submit]"); p.wait_for_timeout(300)
    t = ultimo_toast(p)
    check("100000" in t and p.evaluate("works.get('w1-frieren-0001').total") == 28, "total fora do limite: avisa e não apaga o total", t)
    p.fill("#we-total", ""); p.fill("#we-lu0", "javascript:alert(1)"); p.click("form.wv-edit button[type=submit]"); p.wait_for_timeout(300)
    check("https://" in ultimo_toast(p), "ADM não consegue salvar link que não começa com https://")
    p.evaluate("wvPanel=null; render()")
    # dado antigo perigoso no banco: o site não mostra
    p.evaluate("api.updateWork('w3-onepiece-003',{links:[{site:'Golpe',url:'javascript:alert(1)'}],rel_url:'javascript:alert(2)'}).then(r=>works.set(r.id,r))"); p.wait_for_timeout(200)
    p.evaluate("go('/manga/one-piece')"); p.wait_for_timeout(300)
    check(p.locator('#wv a[href^="javascript:"]').count() == 0, "link javascript: guardado no banco nunca vira link na página")
    # idioma
    p.click("#langs button[data-lang=en]"); p.wait_for_timeout(200)
    t = p.text_content("body")
    check("Sign out" in t and "Releases" in t, "botão EN troca o site inteiro")
    p.evaluate("go('/animes/catalogo')"); p.wait_for_timeout(200)
    check("Catalog" in p.text_content("body") and "Just released" in p.text_content("body"), "catálogo em inglês")
    p.evaluate("go('/anime/sousou-no-frieren')"); p.wait_for_timeout(200)
    t = p.text_content("#wv")
    check("After defeating the Demon King" in t and "Where to watch" in t and "Adventure" in t, 'em inglês: sinopse, gêneros e "Where to watch"')
    check(p.evaluate("document.documentElement.lang") == "en", "idioma da página muda para en")
    p.click("#langs button[data-lang=pt]"); p.wait_for_timeout(100)
    check("Onde assistir" in p.text_content("#wv"), "volta para português")
    fechar(ctx, p)

    print("— Busca completa")
    ctx, p = abrir(b, "/animes", 360)
    entrar(p, "kenji@x.com"); p.evaluate("go('/animes')"); p.wait_for_timeout(200)
    p.fill("#q", "jojo"); p.wait_for_timeout(700)
    check("Ver todos os resultados" in p.text_content("#sugg"), 'sugestões mostram "Ver todos os resultados"')
    p.press("#q", "Enter"); p.wait_for_timeout(800)
    check("/buscar?q=jojo&tipo=anime" in p.url, "Enter abre a página de resultados")
    n1 = p.locator("#list li.card").count(); check(n1 == 25, f"mostra 25 resultados de uma vez ({n1})")
    p.click("#morebox button"); p.wait_for_timeout(800)
    n2 = p.locator("#list li.card").count(); check(n2 == 33, f'"Carregar mais" traz o resto ({n2})')
    check(p.locator("#morebox button").count() == 0, "botão some quando acabou")
    check(rolagem_lateral(p) <= 0, "sem rolagem lateral no celular")
    titulo = p.locator("#list li.card").nth(3).locator(".c-name b").first.text_content()
    p.locator("#list li.card").nth(3).locator('button:has-text("Assistindo")').click(); p.wait_for_timeout(600)
    card = p.locator("#list li.card", has_text=titulo).first
    check("Você:" in card.text_content() and "Já no site" in p.text_content("#list"), f"marcar na página de resultados adiciona a obra ({titulo})")
    p.click("#cats a[data-k=manga]"); p.wait_for_timeout(700)
    check("tipo=manga" in p.url and "Mangás" in p.text_content("#list .sec-title"), "abas trocam para mangás mantendo a busca")
    p.go_back(); p.wait_for_timeout(500); check("tipo=anime" in p.url, "voltar do navegador funciona")
    fechar(ctx, p)

    print("— Conta")
    ctx, p = abrir(b, "/")
    p.evaluate("loginMode='criar'; openLogin()")
    p.fill("#lg-nick", "Teste"); p.fill("#lg-email", "novo@x.com"); p.fill("#lg-pass", "123456"); p.fill("#lg-pass2", "654321")
    p.click("#gate form button[type=submit]"); p.wait_for_timeout(200)
    check("não são iguais" in p.text_content("#lg-err"), "senhas diferentes: avisa e não cria a conta")
    p.keyboard.press("Escape")
    entrar(p, "adm@x.com")
    p.evaluate("go('/anime/sousou-no-frieren')"); p.wait_for_timeout(300)
    e = p.locator("input[id^=wv-ep-]"); e.fill("9"); e.press("Enter"); p.wait_for_timeout(300)
    p.evaluate("go('/manga/one-piece')"); p.wait_for_timeout(300)
    v = p.locator("input[id^=wv-ep-]").input_value(); check(v == "1166", f"outra obra mantém o próprio número ({v})")
    p.evaluate("go('/anime/sousou-no-frieren')"); p.wait_for_timeout(300)
    v = p.locator("input[id^=wv-ep-]").input_value(); check(v == "9", f"número salvo na obra certa ({v})")
    fechar(ctx, p)

    print("— Sem banco falso (como no site de verdade)")
    ctx, p = abrir(b, "/", mock=False)
    p.wait_for_timeout(800)
    check(p.evaluate("typeof window.supabase") == "object" and p.evaluate("document.getElementById('cats').children.length") > 0, "biblioteca do Supabase local carrega e o site abre")
    fechar(ctx, p)

    b.close()
finally:
    servidor.terminate()

check(not bloqueios_csp, "nenhuma regra de segurança (CSP) bloqueou algo do próprio site", str(bloqueios_csp[:3]))
check(not erros_js, "nenhum erro de JavaScript", str(erros_js[:3]))
print("\n".join(resultados))
falhas = sum(not r.startswith("✔") for r in resultados)
print(f"\n{len(resultados) - falhas} passaram, {falhas} falharam")
sys.exit(1 if falhas else 0)
