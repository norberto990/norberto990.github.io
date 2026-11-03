# Lista de Animes do Betoro-chan: versão 3

Tudo aqui é **grátis**: GitHub, Supabase, AniList, MANGA Plus, Webtoon e a tradução da sinopse. Não precisa de cartão.

## O que mudou na versão 3 (correções da revisão)

- **Segurança do banco:**
  - Quem não é ADM continua adicionando obras pela busca do AniList, mas o banco limpa tudo o que não vem do AniList: links, capítulo, horários e fonte automática.
  - Em até 15 minutos o robô confere a obra no AniList e traz os dados oficiais. Obra inventada, +18 ou do tipo errado sai do site sozinha.
  - Nenhum link que não comece com `https://` é gravado nem aparece no site.
  - Imagens de comentários e da lista só podem vir do envio do próprio site. Ninguém escolhe a data do comentário nem a própria foto de perfil.
- **Limites contra abuso:**
  - até 20 obras por hora por pessoa;
  - até 6 comentários por minuto e 300 por dia;
  - até 20 imagens por hora e 300 no total.

  O Storage grátis tem 1 GB.
- **Robô:**
  - cada pedido tem tempo limite, então um site que não responde não trava mais a atualização;
  - salva cada obra assim que termina;
  - lê mais de 1000 obras;
  - nunca acessa fontes fora da lista oficial;
  - não salva de novo links que não mudaram.
- **Site:**
  - O comentário sempre vai para a obra certa, mesmo se você trocar de obra enquanto a imagem é enviada.
  - O clique duplo em "Assistindo" adiciona uma vez só.
  - Apagar sem querer o número de episódios não zera mais o progresso.
  - As mensagens de erro dizem o problema certo, e não "sem permissão".
  - A busca com 1 letra explica que precisa de 2.
  - O botão Voltar do celular fecha os comentários.
  - Um link estranho (`?p=//…`) não quebra mais a página.
  - Os campos do ADM avisam quando passam do limite.
  - O topo da página não mostra mais a palavra "null" para quem não é ADM.
- **Código:**
  - O `app.js` virou 6 arquivos na pasta `js/`, um por assunto.
  - O que o site e o robô usam igual fica num só lugar: `comum.js`.
  - A biblioteca do Supabase agora fica no próprio site (`vendor/`), em vez de vir de outro servidor.
  - Uma regra de segurança no `index.html` impede o navegador de rodar código de fora.
- **Testes:** pasta `tests/`. O GitHub roda todos sozinho a cada envio (aba **Actions > Testes**).

---

## Como atualizar (você já tem a versão 2 no ar)

### 1. Banco de dados (Supabase)
1. Abra **SQL Editor > New query**.
2. Copie **todo** o arquivo `supabase/schema.sql` desta pasta, cole e clique em **Run**. Tem que aparecer "Success".
   - Pode rodar sem medo: não apaga listas, obras nem comentários. Só limpa links que não são `https://` e imagens de fora.
   - As obras que já estão no site contam como conferidas.

### 2. Arquivos do site (GitHub)
1. No repositório `norberto990.github.io`, clique em **Add file > Upload files**.
2. Arraste **tudo** desta pasta, menos a pasta `.github`:
   - os arquivos `index.html`, `404.html`, `comum.js`, `style.css`, `config.js`, `favicon.svg`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `og.png`, `site.webmanifest`, `.prettierrc.json` e `LEIAME.md`;
   - as pastas `js`, `vendor`, `scripts`, `supabase` e `tests`.
3. Clique em **Commit changes**.
4. Apague o arquivo antigo **`app.js`**: abra-o no repositório, clique nos **três pontinhos (…) > Delete file** e depois em **Commit changes**. Ele não é mais usado.

### 3. Tarefas automáticas (pasta .github)
1. No repositório, abra **.github > workflows > atualizar.yml**, clique no **lápis**, apague todo o texto, cole o conteúdo do `atualizar.yml` desta pasta e clique em **Commit changes**.
2. Ainda em **.github/workflows**, clique em **Add file > Create new file**:
   - nome: `testes.yml`;
   - conteúdo: o do arquivo `.github/workflows/testes.yml` desta pasta.

   Clique em **Commit changes**.
3. Os segredos continuam os mesmos (**Settings > Secrets and variables > Actions**):
   - `SUPABASE_URL`;
   - `SUPABASE_SERVICE_KEY` (a chave **secret**; nunca coloque no `config.js`);
   - opcional: `MYMEMORY_EMAIL`.

Espere 1 ou 2 minutos e recarregue o site com **Ctrl+F5**.

### 4. (Opcional) Limite de cadastros no Supabase
Em **Authentication > Rate Limits**, deixe "Sign ups and sign-ins" baixo, por exemplo 30 a cada 5 minutos. Isso segura robôs criando contas em massa.

---

## Como usar como ADM

- **Adicionar obra (qualquer pessoa com conta):** digite pelo menos 2 letras na busca. Na parte **"Do AniList"**, clique em **Vi / Assistindo / …** e a obra entra no site já marcada na sua lista, ou clique em **Ver página**.
  - Quando o ADM adiciona, a obra entra completa.
  - Quando um amigo adiciona, os sites oficiais e o último episódio chegam em até 15 minutos.
- **Obra que não está no AniList:** use **+ Adicionar à mão**. Se ela estiver no MANGA Plus, WEBTOON ou Shonen Jump+, cole o link no campo indicado e os capítulos passam a atualizar sozinhos.
- **Na página de cada obra** (só você vê o quadro **ADM**):
  - **Atualizar lançamento:** para obras sem fonte automática ou para corrigir.
  - **Editar informações:** nome, sinopse em português e inglês, capa, sites oficiais (até 3, sempre `https://`) e o link do MANGA Plus, WEBTOON ou Shonen Jump+.
  - **Completar com o AniList:** para obras adicionadas à mão.
  - **Apagar obra:** pede confirmação, porque apaga também das listas e os comentários.
- **Comentários:** você vê **Apagar (ADM)** em qualquer comentário. As respostas de um comentário apagado continuam lá, embaixo de "Mensagem apagada".

## Testes

- Para ver o resultado, vá na aba **Actions > Testes** e clique na última execução.
  - ✅ verde: tudo certo.
  - ❌ vermelho: clique na parte com ❌ e leia as linhas com "✘ FALHOU".
- Os testes não mexem no site de verdade e não usam a internet:
  - `tests/robo.test.mjs`: o robô e o `comum.js`;
  - `tests/banco/`: as regras e travas do banco;
  - `tests/site/`: o site num navegador, com um banco falso.

## Bom saber

- Só indicamos **sites oficiais**: os links vêm do AniList, que só aceita fontes oficiais, ou de você.
- O GitHub às vezes atrasa a tarefa agendada em alguns minutos quando está cheio.
- O Supabase grátis pausa projetos parados por uma semana. Como a atualização roda a cada 15 minutos, isso não acontece.
- Se o GitHub desligar a tarefa agendada (ele avisa por e-mail), abra a aba **Actions** e clique em **Enable workflow**. O próprio robô também avisa o GitHub uma vez por dia que a tarefa está em uso.
- A tradução gratuita tem cota diária. Se acabar, as sinopses continuam em inglês até o dia seguinte, e o robô tenta de novo sozinho.

## Se algo der errado

- **Não aparece "ADM" ao lado do seu nome:** no SQL Editor, rode a linha abaixo trocando `SEU-EMAIL` pelo e-mail da sua conta no site.

  ```sql
  update public.profiles set is_admin = true where id = (select id from auth.users where email = 'SEU-EMAIL');
  ```
- **"Você não tem permissão para isso":** só o ADM edita obras ou adiciona à mão. Amigos adicionam pela busca do AniList.
- **A página ficou em branco depois de atualizar:** confira se a pasta `js` e a pasta `vendor` foram enviadas, e recarregue com **Ctrl+F5**.
- **A atualização falhou:** aba **Actions**, clique na execução com ❌ e leia o final. Quase sempre é:
  - um segredo com o nome errado; ou
  - o `comum.js` que não foi enviado (o robô também usa esse arquivo).
- **O site mostra "ainda não foi ligado ao banco de dados":** o `config.js` enviado está sem as chaves. Envie o desta pasta.
