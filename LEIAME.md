# Lista de Animes do Betoro-chan: como colocar no ar

Leva uns 20 minutos e é tudo grátis. Você vai criar duas contas:

- **Supabase**: guarda as listas, os comentários, as imagens e cuida do login.
- **GitHub**: hospeda o site e roda a atualização das 9:30 todo dia.

No fim, o site fica em `https://SEUUSUARIO.github.io`.

---

## Parte 1: Supabase (banco de dados)

1. Entre em **supabase.com** e crie uma conta (pode ser com o GitHub).
2. Clique em **New project**.
   - Nome: `betoro-chan`
   - Senha do banco: invente uma e guarde.
   - Região: **South America (São Paulo)**.
   - Clique em **Create new project** e espere uns 2 minutos.
3. No menu da esquerda, abra **SQL Editor** e clique em **New query**.
4. Abra o arquivo `supabase/schema.sql` desta pasta, copie **tudo**, cole lá e clique em **Run**.
   Tem que aparecer "Success. No rows returned".
5. Abra **Authentication > Sign In / Providers > Email**.
   - Deixe **Enable Email provider** ligado.
   - **Desligue "Confirm email"** e salve. O e-mail grátis do Supabase só manda poucas mensagens por hora, então sem isso seus amigos podem ficar sem conseguir entrar.
6. Abra **Project Settings > API Keys** e anote três coisas:
   - **Project URL** (aparece também em **Project Settings > Data API**), algo como `https://abcdefgh.supabase.co`
   - a chave **publishable** (ou **anon public**, na aba "Legacy API keys"). Essa é pública.
   - a chave **secret** (ou **service_role**, na aba "Legacy API keys"). Essa é **secreta**: só vai no GitHub, no passo 12. Nunca coloque no `config.js`.

## Parte 2: ligar o site ao banco

7. Abra o arquivo `config.js` em um editor de texto (o Bloco de Notas serve) e troque:
   - `COLE_AQUI_A_PROJECT_URL` pela Project URL
   - `COLE_AQUI_A_CHAVE_ANON_PUBLIC` pela chave publishable (ou anon)

   Salve o arquivo.

## Parte 3: GitHub (site no ar)

8. Entre em **github.com** e crie uma conta. O nome de usuário vira o endereço do site, então escolha bem (ex.: `betorochan` dá `betorochan.github.io`).
9. Clique em **+ > New repository**.
   - Repository name: **exatamente** `SEUUSUARIO.github.io` (troque pelo seu usuário, tudo minúsculo).
   - Deixe **Public**.
   - Clique em **Create repository**.
10. Na página do repositório, clique em **uploading an existing file**. Arraste **estes arquivos**:
    `index.html`, `404.html`, `style.css`, `app.js`, `config.js` e as pastas `scripts` e `supabase`.
    Clique em **Commit changes**.
11. Agora crie o arquivo da atualização diária. A pasta dele começa com ponto e costuma ficar escondida, então é mais fácil criar pelo site:
    - Clique em **Add file > Create new file**.
    - No nome, digite exatamente: `.github/workflows/atualizar.yml`
    - Abra o arquivo `.github/workflows/atualizar.yml` desta pasta, copie tudo e cole.
    - Clique em **Commit changes**.
12. Coloque as chaves secretas: **Settings > Secrets and variables > Actions > New repository secret**. Crie dois:
    - Nome `SUPABASE_URL`, valor: a Project URL
    - Nome `SUPABASE_SERVICE_KEY`, valor: a chave **secret** (ou service_role)
13. Ligue o site: **Settings > Pages**. Em "Build and deployment", escolha **Deploy from a branch**, branch **main**, pasta **/(root)** e clique em **Save**.
    Em 1 ou 2 minutos o site abre em `https://SEUUSUARIO.github.io`.

## Parte 4: últimos ajustes

14. No Supabase, abra **Authentication > URL Configuration**:
    - **Site URL**: `https://SEUUSUARIO.github.io`
    - Em **Redirect URLs**, adicione `https://SEUUSUARIO.github.io/**`

    Sem isso, o link de "Esqueci a senha" não volta para o site.
15. Rode a primeira atualização sem esperar até as 9:30: no GitHub, abra a aba **Actions**, clique em **Atualizar obras (todo dia 9:30)**, depois em **Run workflow** e confirme.
    Em 1 ou 2 minutos, o **Catálogo** do site fica cheio de novidades.
16. Abra o site, clique em **Entrar ou criar conta > Criar conta**, e mande o link para a galera.

---

## Como funciona a atualização das 9:30

Todo dia às 9:30 (horário de Brasília), o GitHub roda o arquivo `scripts/sync.mjs`. Ele faz três coisas:

1. Busca no **AniList** os animes, mangás e novels que começaram nos últimos 45 dias e adiciona os mais populares ao Catálogo, com capa, sinopse, gêneros e número de episódios ou capítulos.
2. Atualiza a situação e o total de episódios das obras que ainda estão saindo.
3. Completa as obras que a galera cadastrou na mão (até 15 por dia): procura a obra no AniList e preenche o que estiver vazio, sem apagar o que alguém escreveu.

Bom saber:
- A **sinopse vem em inglês**, porque é assim que o AniList fornece. Qualquer pessoa logada pode trocar por uma em português em "Editar informações".
- O GitHub às vezes atrasa a tarefa agendada em alguns minutos.
- **Se o repositório ficar 60 dias sem nenhuma mudança, o GitHub pausa a tarefa** e manda um e-mail avisando. Para religar, é só abrir a aba Actions e clicar em "Enable workflow".
- Para mudar quantas obras entram por dia, edite os números no começo de `scripts/sync.mjs` (`LIMIT_ANIME`, `LIMIT_MANGA`, `LIMIT_NOVEL`).

## Opcional: login com Google

Exige criar credenciais no Google Cloud, então só vale se a galera pedir. No Supabase, abra **Authentication > Sign In / Providers > Google** e siga as instruções da própria página. Depois, mude `GOOGLE_LOGIN: false` para `true` no `config.js` e envie o arquivo de novo para o GitHub.

## Opcional: domínio próprio (ex.: betorochan.com.br)

1. Compre o domínio no registro.br.
2. No GitHub: **Settings > Pages > Custom domain**, digite o domínio e salve.
3. No registro.br, configure o DNS seguindo a ajuda do GitHub ("Managing a custom domain for your GitHub Pages site").
4. No Supabase, troque a **Site URL** e as **Redirect URLs** do passo 14 pelo domínio novo.

## Se algo der errado

- **O site mostra "ainda não foi ligado ao banco de dados"**: o `config.js` não foi preenchido, ou o arquivo enviado ao GitHub é a versão antiga.
- **"Você precisa entrar na sua conta para fazer isso"** mesmo logado: o `schema.sql` não rodou inteiro. Rode de novo (pode rodar quantas vezes quiser).
- **A atualização falhou**: abra a aba Actions, clique na execução com ❌ e leia o fim do registro. Quase sempre é um segredo com o nome errado no passo 12.
