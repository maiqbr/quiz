# Guia do projeto — QuizArena

> **Documento central de manutenção.** Leia primeiro a seção [Onde mexer](#onde-mexer) e depois a seção da função que pretende alterar. Atualize este guia **no mesmo commit de toda mudança** de código, conteúdo, design, infraestrutura ou comportamento. Registre o que mudou, onde, por quê e como foi conferido em [Registro de mudanças](#registro-de-mudanças). Última revisão: 15/10/2026.

## Índice

1. [O que é o projeto](#o-que-é-o-projeto)
2. [Onde mexer](#onde-mexer)
3. [Como as partes se conectam](#como-as-partes-se-conectam)
4. [Experiência de jogo](#experiência-de-jogo)
5. [Catálogo e regras editoriais](#catálogo-e-regras-editoriais)
6. [Identidade visual](#identidade-visual)
7. [Ranking, login e dados](#ranking-login-e-dados)
8. [Desenvolvimento e publicação](#desenvolvimento-e-publicação)
9. [Segurança, privacidade e licenças](#segurança-privacidade-e-licenças)
10. [Como manter este guia atualizado](#como-manter-este-guia-atualizado)
11. [Registro de mudanças](#registro-de-mudanças)

## O que é o projeto

QuizArena é um quiz em português, disponível em [quiz.maiq.dev.br](https://quiz.maiq.dev.br). O foco é escolher um tema e começar a jogar sem obstáculos. Há 17 categorias e um modo misto. O site tem três experiências:

- **Solo:** jogo local, sem conta, com resultado e histórico no navegador.
- **Apresentar com placar:** jogo em uma tela compartilhada, com pontos manuais para pessoas ou equipes.
- **Ranqueado:** jogo online com Discord, perguntas conferidas pelo servidor e resultados salvos no Cloudflare D1.

O navegador carrega os arquivos estáticos por um Cloudflare Worker. As perguntas ficam versionadas em `content.js`; não há API de trivia consultada durante a partida. As imagens externas são usadas em categorias específicas. O repositório é público; segredos ficam fora dele.

## Onde mexer

| Quero mudar... | Abra primeiro | Confira também |
| --- | --- | --- |
| Uma pergunta, resposta, alternativa, fonte ou contagem | `content.js` | `scripts/validate-content.mjs`, catálogo ranqueado gerado |
| Uma categoria ou formato de pergunta | `content.js` e `index.html` | `scripts/build-ranked-questions.mjs`, `ranking.js`, ícone, `sw.js`, `scripts/build-worker-assets.mjs` |
| A tela inicial, partida local, apresentação ou resumo | `index.html` | `visual.css`, `ranking.js` se houver elementos compartilhados |
| O ranking, perfil ou partida ranqueada no navegador | `ranking.js` e marcação em `index.html` | `visual.css`, API do Worker |
| Regra de pontuação, tempo, login ou placar online | `worker/src/index.mjs` | `ranking.js`, `worker/migrations/`, perguntas geradas |
| Cores, cartões, botões ou responsividade | `visual.css` | CSS antigo embutido em `index.html`; prevalecem as regras posteriores |
| Ícones e logo | `category-icons/*.png`, `icon-*.png`, `favicon.png` | `manifest.json`, `sw.js`, HTML |
| Mapa | `maps/world-land.js`, `index.html` (`drawWorldMap`, `renderMap`) | CSS `.g-map-card`; manter proporção 2:1 |
| Imagens e créditos | `content.js` (`media`) | `scripts/build-credits.mjs`, `NOTICE.md`, `/creditos` |
| Arquivos publicados ou rota do domínio | `worker/wrangler.jsonc` e `scripts/build-worker-assets.mjs` | `worker/src/index.mjs`, `sw.js` |
| Banco de dados | `worker/migrations/` | Consultas em `worker/src/index.mjs` |
| Uso de dados, atribuição ou licença | `PRIVACY.md`, `NOTICE.md`, `LICENSE` | `content.js`, `creditos.html` gerado |

Outros documentos: [README](README.md) é a apresentação e o começo rápido; [CONTRIBUTING](CONTRIBUTING.md) é a orientação para contribuições; [FONTES-E-EXPANSAO](FONTES-E-EXPANSAO.md) registra avaliação de fontes e possibilidades futuras. Este guia descreve o estado **atual** e as decisões que devem orientar as próximas mudanças.

## Como as partes se conectam

```text
content.js ────────────────→ index.html (solo e apresentação)
    │                            ↑ visual.css + ícones + mapa
    ├→ build-ranked-questions ─→ worker/src/questions.mjs
    └→ build-credits ──────────→ creditos.html

scripts/build-worker-assets.mjs ─→ worker/public/ (cópia publicada)
                                     ↑
Navegador ←→ Worker (assets, /auth/*, /api/*) ←→ D1
                   │
                   └→ Discord OAuth para identificar o jogador
```

`index.html` contém a marcação e a lógica da partida local; `visual.css` complementa e sobrescreve estilos antigos embutidos no HTML. `ranking.js` controla ranking, perfil e partida ranqueada no navegador. `worker/src/index.mjs` é a API e a autoridade sobre as partidas online. `worker/src/questions.mjs` é gerado a partir de `content.js` e **não deve ser editado à mão**. `worker/public/` é resultado temporário do build, ignorado pelo Git. `creditos.html` é gerado a partir dos metadados das imagens e é versionado.

O Worker atende `/api/*` e `/auth/*`, redireciona `/index.html` para `/` e `/creditos.html` para `/creditos`, e entrega os demais arquivos estáticos. A interface principal e o perfil são telas dentro de `/`; `ranking.html` é apenas um endereço antigo que redireciona. A troca de tela não precisa manter `#ranking` na URL.

`sw.js` implementa a PWA: páginas navegadas priorizam a rede com fallback offline; arquivos locais usam cache. Ao mudar arquivos do aplicativo, revise a lista de assets e aumente a versão de `CACHE_NAME` quando for necessário renovar o cache já instalado.

## Experiência de jogo

| Experiência | Como entra | Duração | Estado e resultado |
| --- | --- | --- | --- |
| Solo | Switch na página inicial; clique no tema ou em Misto | Rápida até 10, Casual até 50, Treino até 100 | Perguntas sem repetição na partida; histórico local, limitado a 100 registros |
| Apresentar com placar | Mesmo switch; aparece uma explicação ao selecionar | Percorre o conjunto escolhido; tempo por pergunta opcional | Placar de pessoas/equipes ajustado manualmente; histórico local |
| Ranqueado | Área de ranking da página inicial; Discord para participar | Rápida até 10, Casual até 50, Treino até 100 | Ordem e resultado validados pelo Worker; histórico e recordes no D1 |

Se um tema tem menos itens do que o limite da duração, a partida usa todos os disponíveis. O modo misto reúne todas as categorias. Fácil usa quatro alternativas; difícil pede resposta digitada. O jogo local e uma nova partida começam em **Fácil**. O mapa local tem interação por pontos; linha do tempo pede ordenação; país e capital pede associação. No ranqueado, esses três formatos são transformados em perguntas de resposta única por `scripts/build-ranked-questions.mjs`.

No solo, o limite padrão é Rápida. A apresentação tem painel lateral de pontuação, controle de tempo livre/30/60/90 segundos e resumo. O resumo mostra acertos, tempo e respostas; na apresentação, mostra o placar. O histórico da página inicial mostra cinco partidas recentes do modo selecionado; o perfil mostra histórico local paginado em 10. Dados locais ficam **apenas no navegador/dispositivo**.

O tema escuro é o padrão e há switch para claro. A preferência de tema, modo de jogo e duração solo fica em `localStorage` nas chaves `quizTheme`, `quizPlayMode` e `quizSoloLength`. O histórico usa `quizHistory`. Alterar nomes ou estrutura dessas chaves exige considerar dados de visitas anteriores.

## Catálogo e regras editoriais

`content.js` define os conjuntos e o array `QUIZZES`. Cada definição tem `id`, título, descrição, etiquetas, `getPool()` e, conforme o tipo, `getText()`, `loadImage()` ou `kind` (`map`, `timeline`, `match`). A contagem da primeira etiqueta é atualizada a partir de `getPool('all')` ao carregar, e o validador verifica sua coerência. A tabela é o retrato de 15/10/2026; o número vigente é o que `node scripts/validate-content.mjs` imprime.

| Categoria (`id`) | Itens | Formato local | Origem visual/textual principal |
| --- | ---: | --- | --- |
| `bandeiras` | 139 | Imagem | Bandeira FlagCDN; seleção por todos, futebol ou continente |
| `capitais` | 83 | Imagem | Bandeira FlagCDN, sem nome do país na pergunta |
| `lingua-paises` | 62 | Texto | Pergunta editorial |
| `linguas-frases` | 74 | Texto | Frase de idioma |
| `animais` | 89 | Imagem | Arquivo selecionado da Wikimedia Commons |
| `arte` | 37 | Imagem | Arquivo selecionado da Wikimedia Commons |
| `monumentos` | 52 | Imagem | Arquivo selecionado da Wikimedia Commons |
| `comidas` | 37 | Texto | Pergunta sobre prato e tradição |
| `instrumentos` | 39 | Texto | Pergunta sobre características; sem áudio |
| `anime` | 75 | Texto | Pergunta editorial |
| `super-herois` | 75 | Texto | Pergunta editorial |
| `mapa` | 35 | Mapa | Ponto geográfico e cartografia Natural Earth |
| `linha-do-tempo` | 30 | Ordenação | Quatro acontecimentos por rodada |
| `associacoes` | 20 | Associação | Quatro pares país/capital por rodada |
| `ciencias` | 100 | Texto | Ciência e natureza |
| `historia-geral` | 100 | Texto | História geral |
| `conhecimentos-gerais` | 100 | Texto | Esportes, cinema, literatura, tecnologia cotidiana e raciocínio |

**Ao criar ou revisar perguntas:**

1. Escreva pergunta clara, resposta `name` inequívoca, três distratores plausíveis (`distractors`) quando aplicável, variantes aceitas em `a`, explicação (`explanation`) e URL da fonte (`source`) para quizzes textuais. Confira fatos e grafias na fonte. O validador rejeita respostas ambíguas dentro da mesma categoria.
2. Preserve o recorte da categoria. `conhecimentos-gerais` deve tratar assuntos variados sem reaproveitar perguntas próprias de bandeiras, capitais, idiomas, animais, arte, monumentos, pratos, instrumentos, anime/heróis, mapa, história ou ciência. Evite trivia que só muda o enunciado de uma pergunta existente.
3. Nos quizzes de imagem, mantenha apenas imagens verificadas. `animais`, `arte` e `monumentos` só entram no jogo quando `media.status === 'selected'`. Registre `file`, `src`, `fileUrl`, `author`, `license` e `reviewed`; confira se a imagem mostra claramente o objeto certo. Os dados de licença e origem geram a página de créditos. Bandeiras e capitais usam código de país e FlagCDN.
4. Não mostre dicas que entreguem a resposta junto da imagem, como primeira letra, nome do país ou link do arquivo. Os créditos ficam em `/creditos`, acessível pelo rodapé, e não na pergunta. Se a imagem necessária faltar, retire ou corrija o item antes de publicar.
5. Para mapa, valide latitude/longitude e mantenha a projeção e a área visual na proporção 2:1. Para linha do tempo, quatro eventos com anos em ordem; para associação, quatro pares sem repetição. O validador conhece essas regras.
6. Execute `node scripts/validate-content.mjs`; depois gere o catálogo ranqueado pelo build e confira o diff de `worker/src/questions.mjs`. Alterar o texto que forma o ID de uma pergunta pode invalidar uma partida ranqueada ainda aberta; o Worker a encerra e pede uma nova.

As comparações de fontes externas, ferramentas de curadoria e ideias de expansão estão em [FONTES-E-EXPANSAO.md](FONTES-E-EXPANSAO.md). Uma fonte nova não entra automaticamente: revisar precisão, licença, manutenção, disponibilidade e encaixe editorial antes de incorporá-la ao catálogo local.

## Identidade visual

**Direção:** interface rica e clara para jogar, coerente com os projetos maiq/TCG/GDI mencionados na evolução do site. A ação principal é escolher um quiz; ranking e login têm destaque na mesma página, sem criar uma etapa extra para começar. Use cartões com hierarquia visível, bordas e sombras moderadas, bastante contraste e leitura confortável na tela compartilhada. Evite emojis e aparência genérica de componentes padrão.

**Cores finais de referência em `visual.css`:** roxo é a cor principal; dourado marca ações e destaques. O fundo claro é `#f4eefb`, painel claro `#fffaff`, roxo claro `#7041b7` e dourado claro `#a56b1e`. No escuro, fundo `#130d1b`, painel `#241832`, roxo `#9866e9` e dourado `#e2b75d`. Estes são os tokens finais em `:root` e `[data-theme="dark"]` perto do fim do arquivo; há definições antigas anteriores que são sobrescritas. Em modo escuro, botões de ação importantes usam dourado. Verde e vermelho indicam acerto/erro; não dependem só de cor para comunicar o resultado.

**Tipografia e componentes:** textos corridos usam a família padrão do navegador/sistema; títulos e títulos de cartão usam `Georgia, serif` nas regras atuais. As telas principais ficam em `index.html` (`#home`, `#game`, `#ranked`, `#profile`); os controles precisam funcionar com mouse, toque e teclado. Switches servem às escolhas binárias e de duração; selects restantes devem receber o estilo do site. Preserve estados de foco, seleção, carregamento, erro e resultado.

**Imagens de identidade:** o logo, favicon e ícones de categoria são PNGs; não substitua por emoji ou SVG genérico. Os ícones precisam combinar entre si e com roxo/dourado. Se gerar ou alterar um PNG, confira fundo transparente quando o elemento pede transparência, legibilidade em tamanho pequeno e os dois temas. Para nova categoria, adicione `category-icons/<id>.png` e inclua o arquivo no build e no cache da PWA. O mapa deve manter forma e posição dos pontos em celular, tablet e desktop.

## Ranking, login e dados

`ranking.js` mostra placares, perfil e jogo ranqueado. `worker/src/index.mjs` expõe:

| Rota | Papel |
| --- | --- |
| `GET /auth/discord/start`, `GET /auth/discord/callback` | OAuth Discord com escopo `identify` |
| `GET /api/me`, `POST /api/logout` | Sessão atual e saída |
| `GET /api/rankings` | Placar por categoria, duração, dificuldade e página |
| `POST /api/run/start`, `POST /api/run/answer`, `GET /api/run/current` | Criar, responder e retomar partida |
| `GET /api/profile` | Estatísticas, recordes/posições e histórico paginado |
| `GET /api/history` | Histórico recente; a tela de perfil usa `/api/profile` |

O banco D1 é definido por migrações em `worker/migrations/`. As tabelas são `users`, `sessions`, `runs` e `run_answers`. `runs` guarda a sequência sorteada, posição, acertos, duração, dificuldade, horários e encerramento. `run_answers` registra cada resposta. Novas colunas exigem **nova migração**; não reescreva migração já aplicada.

**Regras que não podem regredir:** a conta precisa de sessão válida; o cliente envia só categoria/duração/dificuldade ao iniciar e resposta ao jogar, nunca pontos ou tempo. O Worker sorteia sem repetição, conhece a resposta correta e calcula acertos e tempo. A sequência deve ser respondida inteira: até 10, 50 ou 100 itens conforme duração e tamanho real da categoria. Cada resposta avança no máximo uma posição, com atualização condicional no banco. Há 45 segundos por pergunta, sessão Discord de 7 dias, partida ativa por até 24 horas, até 20 inícios por dia e intervalo mínimo de 60 segundos entre inícios. O Worker confere origem em POST, limita corpo JSON a 1 KiB, usa consultas preparadas e cookie de sessão `HttpOnly`, `SameSite=Lax` e `Secure` em produção. O token armazenado no D1 é hash SHA-256.

Placares são separados por **categoria (inclusive Misto), duração e dificuldade**. Um jogador aparece com seu melhor resultado em cada combinação; a ordem é acertos decrescentes e depois menor tempo, com desempates estáveis. Placares, histórico online e histórico local no perfil mostram 10 itens por página. Resultados antigos ou com quantidade de questões incompatível com o catálogo atual ficam fora dos placares vigentes. A API aceita a partida ativa após recarregar a página, desde que o catálogo ainda contenha seus IDs.

**Limite real de integridade:** essas medidas impedem fabricar pontuação ou tempo com uma simples chamada de console, mas o catálogo e as respostas estão em um repositório público. Automação e consulta das respostas continuam possíveis; o ranking não serve para competições com prêmio sem novas proteções, como questões privadas, moderação e detecção de abuso.

## Desenvolvimento e publicação

**Rodar a interface local:** na raiz, `python -m http.server 8765`; abrir `http://localhost:8765`. As chamadas de ranking exigem o Worker e D1, portanto o servidor estático é suficiente para conferir solo, apresentação, conteúdo e visual, mas não a integração online.

**Validações e build:**

```powershell
node scripts/validate-content.mjs
cd worker
npm install
npm run build
```

O build chama `scripts/build-ranked-questions.mjs` e `scripts/build-credits.mjs`, depois copia os assets para `worker/public/`. Confira os arquivos gerados versionados (`worker/src/questions.mjs` e `creditos.html`) antes de commitar. `worker/public/`, `node_modules/`, estado do Wrangler, variáveis de ambiente e artefatos de QA ficam fora do Git por `.gitignore`. Scripts auxiliares em `scripts/` auditam URLs de imagem, fazem curadoria e limpam metadados de mídia; examine o diff após usá-los.

**Publicar por comando, após validar:** na pasta `worker/`, aplique novas migrações com `npx wrangler d1 migrations apply quizarena --remote` e execute `npm run deploy`. O deploy já executa o build. `worker/wrangler.jsonc` contém nome do Worker, rota do domínio, origem, Client ID público, binding de assets e D1. `DISCORD_CLIENT_SECRET` deve ser Secret da Cloudflare, nunca arquivo versionado. A Redirect URI cadastrada no Discord precisa corresponder exatamente a `https://quiz.maiq.dev.br/auth/discord/callback`. Após deploy, confira o fluxo afetado no endereço público; para alterações só em documentação, não há asset novo a publicar no Worker.

**Ao acrescentar categoria:** altere `content.js`; crie ícone; atualize `scripts/build-worker-assets.mjs` e `sw.js`; confira UI local, opções de ranking, geração de perguntas, créditos se houver imagem, contagens e este guia. **Ao alterar regra ranqueada:** revise API, migração, cliente, elegibilidade de placar e partidas abertas. **Ao alterar visual:** confira pelo menos desktop e celular, temas claro/escuro, partida em andamento, resultado, perfil e ranking.

## Segurança, privacidade e licenças

O repositório é público. Nunca versione Client Secret do Discord, tokens Cloudflare, `.env`, dados pessoais de jogadores, dumps D1 ou logs sensíveis. O Client ID e o ID do banco em `worker/wrangler.jsonc` são identificadores públicos, não credenciais. `PRIVACY.md` descreve dados de conta e partidas; `NOTICE.md` cobre mídia e atribuição; `LICENSE` aplica MIT ao código e elementos originais, sem transferir licença de terceiros. O fato de o site não gerar renda não substitui os termos das imagens. Consulte esses documentos antes de mudar coleta de dados, login, exibição de créditos ou uso de imagens.

## Como manter este guia atualizado

Em **cada mudança**, faça as três ações abaixo no mesmo commit:

1. Atualize a seção que explica a função afetada. Se criou arquivo, rota, categoria, dado, regra, visual ou dependência, acrescente-o ao mapa ou à seção correspondente. Remova descrição obsoleta. Evite escrever apenas “foi alterado”; descreva o comportamento atual.
2. Acrescente uma linha ao [Registro de mudanças](#registro-de-mudanças) com data, mudança, arquivos decisivos e verificação. Para muitas alterações relacionadas no mesmo trabalho, uma linha agrupada é suficiente se enumera o escopo real.
3. Verifique links, comandos, números e nomes. Atualize também README, CONTRIBUTING, FONTES-E-EXPANSAO, PRIVACY ou NOTICE quando o assunto deles mudar. O guia é o índice e o modelo mental; detalhes legais continuam nos documentos próprios.

Uma revisão curta antes de entregar: **o usuário percebe a mudança?** Então descreva fluxo e visual. **Mudou conteúdo?** Atualize catálogo e curadoria. **Mudou servidor ou dados?** Atualize rota, segurança, migração e publicação. **Mudou arquivo ou comando?** Atualize “Onde mexer” e passos de desenvolvimento. Isso vale também para correções pequenas.

## Registro de mudanças

| Data | Mudança e motivo | Arquivos decisivos | Verificação |
| --- | --- | --- | --- |
| 15/10/2026 | Criado este guia central para localizar funções, manter o escopo visual/editorial e registrar futuras mudanças. README e contribuição passam a apontá-lo; instrução do repositório torna sua atualização obrigatória. Nenhum comportamento do site foi alterado. | `GUIA-DO-PROJETO.md`, `README.md`, `CONTRIBUTING.md`, `AGENTS.md` | Leitura do código/configuração e `node scripts/validate-content.mjs` |

Para o histórico anterior à criação deste registro, consulte os commits do Git e [FONTES-E-EXPANSAO.md](FONTES-E-EXPANSAO.md). A partir daqui, registre as mudanças novas nesta tabela.
