# QuizArena

Quiz de 15 temas para jogar sozinho ou apresentar em uma tela compartilhada. [Site publicado](https://quiz.maiq.dev.br), servido por Cloudflare Workers com D1 para o ranking.

O modo solo percorre **todas** as perguntas do tema. O switch **Rápida** limita a partida a até 10 perguntas. Há também uma partida mista com todas as categorias; no modo completo, ela percorre todo o catálogo. O modo de apresentação mantém um placar manual para pessoas ou equipes, tempo opcional por pergunta, resumo e histórico no navegador. Os dois modos funcionam sem conta. O tema escuro é o padrão; há um switch para o modo claro.

## Rodar e verificar

O jogo local é estático. Sirva a raiz com `python -m http.server 8765` e abra `http://localhost:8765`. Execute `node scripts/validate-content.mjs` para validar as 15 coleções. `content.js` contém perguntas, respostas e curadoria de mídia; `visual.css` contém a identidade visual. `category-icons/` e `icon-*.png` contêm os ícones raster originais usados na interface e na PWA. Os trechos de `audio/` são cópias locais dos arquivos creditados em `content.js`; `node scripts/download-audio.mjs` pode atualizar essas cópias.

As coleções atuais têm: bandeiras 139, capitais 83, língua do país 62, línguas do mundo 74, animais 95, arte 47, monumentos 54, pratos 37, instrumentos 39, anime e mangá 75, heróis e vilões 75, mapa 35, linha do tempo 30, associação país/capital 20 e áudio de instrumentos 10.

## Ranking online

O ranking **casual** aparece na página inicial, junto dos quizzes. O login Discord fica no topo; depois de entrar, o botão de perfil mostra histórico online paginado, recordes e posição em cada placar. Há ranking para as **15 categorias** e para **Misto (875)**. Cada partida ranqueada percorre o conjunto inteiro da categoria; Misto percorre todas as 875 perguntas. Fácil usa quatro opções; difícil exige digitar. Os formatos de mapa, linha do tempo e associação são adaptados para perguntas de resposta única no ranking. Os placares são independentes por tema e dificuldade, ordenados por acertos e depois por tempo. Resultados anteriores à ampliação continuam no histórico, mas só partidas com o total atual entram nos placares. O endereço antigo `ranking.html` redireciona para a página inicial.

O Worker cria a sequência e calcula os acertos e o tempo. Ele não aceita pontuação enviada pelo cliente, confere respostas uma vez por posição, limita partidas por conta e guarda a sessão em cookie HttpOnly. **Isso impede alterar o resultado por um simples `fetch` no console, mas não torna o ranking imune a automação**: perguntas e respostas do quiz estão no repositório público e podem ser consultadas. O ranking não deve ser usado como competição com prêmio. Para resistência maior seriam necessários um banco privado de questões inéditas, detecção de abuso e moderação.

Para reproduzir a instalação em outra conta:

1. Crie uma aplicação no [Discord Developer Portal](https://discord.com/developers/applications) e registre `https://SEU-DOMINIO/auth/discord/callback` como Redirect URI. Use apenas o escopo `identify`.
2. Crie um D1 chamado `quizarena`, coloque seu `database_id` em `worker/wrangler.jsonc` e configure domínio e Client ID nesse arquivo.
3. Na pasta `worker/`, rode `npm install`, `npm run build` e `npx wrangler d1 migrations apply quizarena --remote`. Salve `DISCORD_CLIENT_SECRET` com `npx wrangler secret put DISCORD_CLIENT_SECRET` ou no painel como Secret. Não coloque segredos no Git.
4. Publique com `npm run deploy`. A rota `quiz.maiq.dev.br/*` existente no projeto usa o registro DNS já intermediado pela Cloudflare. O Worker serve os arquivos estáticos e as rotas `/auth/*` e `/api/*` na mesma origem.

`scripts/build-worker-assets.mjs` gera a cópia estática ignorada em `worker/public/` e atualiza `worker/src/questions.mjs`. O ranking local foi verificado com D1, respostas obrigatórias, separação de dificuldade, rejeição de origem externa e tentativa de enviar pontuação e tempo falsos. No domínio público foram verificados assets, APIs e início do OAuth; a conclusão do login deve ser conferida com uma conta Discord.

## Repositório público e mídia

O `.gitignore` exclui `node_modules`, variáveis de ambiente, estado local do Wrangler, build e arquivos de QA. Os arquivos versionáveis necessários são o código, conteúdo, documentos, ícones e migrações. O ID do D1 e o Client ID do Discord não são senhas; o Client Secret fica apenas no Cloudflare. Os PNGs do logo têm transparência real na área exterior, preservando as cores do desenho. Confira [Fontes e expansão](FONTES-E-EXPANSAO.md), [Privacidade](PRIVACY.md), [Mídia e atribuição](NOTICE.md), [Contribuição](CONTRIBUTING.md) e a [licença MIT](LICENSE).
