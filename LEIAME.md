# Lista de Animes do Betoro-chan: versão 2

Tudo aqui é **grátis**: GitHub, Supabase, AniList, MANGA Plus, Webtoon e a tradução da sinopse. Não precisa de cartão.

## O que mudou

- **Lançamentos:** cada obra mostra o último episódio ou capítulo e até 3 sites oficiais onde assistir ou ler. A atualização roda a cada 15 minutos.
  - **Animes:** horário oficial de exibição (AniList). Na hora exata, o site mostra "Ep. X saiu!" e a contagem para o próximo.
  - **Mangás da Shueisha** (One Piece, Jujutsu Kaisen etc.): capítulo pelo MANGA Plus oficial, com link direto para o capítulo.
  - **Webtoons:** pelo feed oficial do WEBTOON.
  - **O resto:** você, como ADM, atualiza à mão na página da obra ("Atualizar lançamento").
- **Sinopse em português:** tradução automática gratuita, poucos minutos depois de adicionar a obra. Dá para corrigir em "Editar informações".
- **Botão PT / EN:** troca o site inteiro.
- **ADM:** só você adiciona, edita e apaga obras e pode apagar qualquer comentário. Os outros marcam a lista deles, dão nota e comentam.
- **Para quem está na sua lista:** aparece "você está 2 atrás" quando já saiu episódio ou capítulo que a pessoa ainda não viu.
- **As 20 correções do vídeo:** página 404, rodapé com o ano, favicon, ícone para a tela inicial do celular, imagem de prévia ao compartilhar o link, mensagens de sucesso (verde) e de erro (vermelho), sem rolagem lateral no celular e botões maiores para o toque, entre outras.

---

## Como atualizar (você já tem a versão 1 no ar)

### 1. Banco de dados (Supabase)
1. Abra **SQL Editor > New query**.
2. Copie **todo** o arquivo `supabase/schema.sql` desta pasta, cole e clique em **Run**. Tem que aparecer "Success".
   - Pode rodar sem medo: não apaga listas, obras nem comentários.

### 2. Tornar você o ADM
1. Abra o site e **crie sua conta**, se ainda não criou.
2. No Supabase, em **SQL Editor > New query**, cole a linha abaixo trocando `SEU-EMAIL` pelo e-mail que você usou no site:

   ```sql
   update public.profiles set is_admin = true where id = (select id from auth.users where email = 'SEU-EMAIL');
   ```
3. Clique em **Run**. Tem que aparecer "Success. 1 row affected" (ou parecido).
4. Recarregue o site: ao lado do seu nome aparece a etiqueta vermelha **ADM**.

### 3. Arquivos do site (GitHub)
1. No repositório `norberto990.github.io`, clique em **Add file > Upload files**.
2. Arraste **tudo** desta pasta, menos a pasta `.github`: `index.html`, `404.html`, `app.js`, `style.css`, `config.js`, `favicon.svg`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `og.png`, `site.webmanifest`, `LEIAME.md` e as pastas `scripts` e `supabase`.
3. Clique em **Commit changes**. Os arquivos com o mesmo nome são substituídos.

### 4. Atualização a cada 15 minutos
1. No repositório, abra a pasta **.github > workflows** e clique no arquivo **atualizar.yml**.
2. Clique no **lápis** (Edit), apague todo o texto, cole o conteúdo do arquivo `.github/workflows/atualizar.yml` desta pasta e clique em **Commit changes**.
3. Confira as chaves secretas em **Settings > Secrets and variables > Actions**. Precisam existir:
   - `SUPABASE_URL`: a Project URL do Supabase
   - `SUPABASE_SERVICE_KEY`: a chave **secret** do Supabase (nunca coloque essa no `config.js`)
   - Opcional: `MYMEMORY_EMAIL`, com qualquer e-mail seu. Deixa a cota grátis de tradução 10 vezes maior.
4. Rode a primeira vez na mão: aba **Actions > Atualizar lançamentos (a cada 15 min) > Run workflow**.

Espere 1 ou 2 minutos e recarregue o site com **Ctrl+F5**.

---

## Como usar como ADM

- **Adicionar obra:** digite o nome na busca. Aparece a parte **"ADM · adicionar do AniList"**. Clique em **Adicionar ao site**, ou direto em **Vi / Assistindo / …** para adicionar e já marcar na sua lista. A obra entra com capa, sinopse, episódios ou capítulos, sites oficiais e a fonte automática.
- **Obra que não está no AniList:** use **+ Adicionar à mão**. Se ela estiver no MANGA Plus ou no WEBTOON, cole o link no campo indicado, e os capítulos passam a atualizar sozinhos.
- **Na página de cada obra** (só você vê o quadro **ADM**):
  - **Atualizar lançamento:** para obras sem fonte automática, ou para corrigir.
  - **Editar informações:** nome, sinopse em português e inglês, capa, sites oficiais (até 3) e o link do MANGA Plus ou WEBTOON.
  - **Completar com o AniList:** para obras adicionadas à mão.
  - **Apagar obra:** pede confirmação, porque apaga também das listas e os comentários.
- **Comentários:** você vê **Apagar (ADM)** em qualquer comentário.

## Bom saber

- Só indicamos **sites oficiais**: os links vêm do AniList, que só aceita fontes oficiais, ou de você.
- O GitHub às vezes atrasa a tarefa agendada em alguns minutos quando está cheio.
- O Supabase grátis pausa projetos parados por uma semana. Como a atualização roda a cada 15 minutos, isso não acontece.
- Se o GitHub desligar a tarefa agendada (ele avisa por e-mail), abra a aba **Actions** e clique em **Enable workflow**. O próprio robô também avisa o GitHub uma vez por dia que a tarefa está em uso.
- A tradução gratuita tem cota diária. Se acabar, as sinopses continuam em inglês até o dia seguinte, e o robô tenta de novo sozinho.

## Se algo der errado

- **Não aparece "ADM" ao lado do seu nome:** o e-mail do passo 2 tem que ser exatamente o da sua conta no site. Rode a linha de novo.
- **"Você não tem permissão para isso":** só o ADM adiciona ou edita obras. Se for você, faça o passo 2.
- **A atualização falhou:** aba **Actions**, clique na execução com ❌ e leia o final. Quase sempre é um segredo com o nome errado.
- **O site mostra "ainda não foi ligado ao banco de dados":** o `config.js` enviado está sem as chaves. Envie o desta pasta.
