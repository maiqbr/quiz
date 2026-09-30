# Fontes e expansão do QuizArena

Revisado em 30/09/2026.

## Decisão editorial

O jogo usa um **catálogo local revisado** para que solo, apresentação e ranking tenham as mesmas perguntas, respostas e totais, mesmo quando uma API pública estiver indisponível. Novos fatos podem ser pesquisados em fontes externas, mas entram no site somente depois de revisão em português, alternativas sem ambiguidade, explicação e URL da fonte. `node scripts/validate-content.mjs` verifica a estrutura; uma revisão humana continua necessária para a correção factual e a qualidade da pergunta.

| Fonte examinada | Conclusão para o QuizArena |
| --- | --- |
| [The Trivia API](https://the-trivia-api.com/) do [post original](https://www.reddit.com/r/trivia/comments/lj22qd/i_created_an_open_trivia_api_with_4000_approved/) | Oferece perguntas prontas e acesso público gratuito para uso não comercial sob CC BY-NC. A documentação também mostra chave de API e planos com recursos extras; não há promessa de requisições ilimitadas. Pode servir para pesquisa ou importação revisada com crédito, não como dependência ao vivo do ranking. |
| [Open-trivia-database](https://github.com/el-cms/Open-trivia-database) | Arquivos em inglês e francês, com respostas e fonte por pergunta. O README pede crédito; seria preciso revisar tradução, alternativas e a origem dos enunciados antes de incorporar. |
| [Wikidata](https://www.wikidata.org/wiki/Wikidata:Data_access) | Dados estruturados sob [CC0](https://www.wikidata.org/wiki/Wikidata:Licensing), úteis para gerar rascunhos e conferir fatos. As consultas públicas têm políticas de uso e limites operacionais; um script de atualização pontual e snapshot local é melhor do que consultar o serviço a cada partida. |
| [QuizAPI Web da Mirai](https://github.com/miraidevelopment/quizapi-web) | Projeto em português, licença Apache 2.0 para o código, mas o repositório não estabelece uma garantia de disponibilidade ou ausência de limites para uma API hospedada. É uma referência de implementação, não uma dependência de produção. |

## Mídia e mapa

| Conteúdo | Origem e tratamento | Limite conhecido |
| --- | --- | --- |
| Bandeiras e capitais | [FlagCDN](https://flagcdn.com/) por código de país; a imagem é a única pista visual antes da resposta | Dependem da disponibilidade da FlagCDN. |
| Animais, arte e monumentos | Arquivo fixo da Wikimedia Commons por pergunta, com autor, licença, página e revisão em `content.js` | Só entram itens com imagem selecionada: 89 animais, 37 obras e 52 monumentos. A seleção visual ainda precisa de conferência editorial contínua. |
| Mapa | Dados públicos [Natural Earth 1:110m](https://www.naturalearthdata.com/about/terms-of-use/) em `maps/world-land.js`, desenhados localmente em proporção 2:1; pontos vêm das coordenadas em `content.js` | Precisão visual é adequada ao jogo, não a navegação ou georreferenciamento profissional. |
| Perguntas textuais | Conteúdo local em português, com explicação e URL de referência por item novo ou convertido | Fontes podem mudar; revisar periodicamente. |
| Ranking | Cloudflare Worker + D1 + Discord OAuth | O banco de respostas público permite automação; o placar é casual. |

`node scripts/curate-media.mjs` refaz a consulta das três categorias fotográficas à Wikimedia; **revise o diff antes de publicar**, pois uma consulta nova pode trocar os arquivos. `node scripts/prune-unused-media.mjs` mantém apenas metadados dessas categorias. Licenças de foto CC BY, CC BY-SA, CC0 e domínio público não desaparecem porque o site não gera receita; veja [reutilização no Wikimedia Commons](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia/technical) e [NOTICE.md](NOTICE.md).

## Próximas expansões

1. Expandir Ciência e Natureza, História Geral e Conhecimentos Gerais além das atuais 50, 50 e 80 perguntas, mantendo fontes por item e explicações úteis após a resposta.
2. Adicionar um importador editorial que produza rascunhos a partir de Wikidata ou de um banco de trivia, sem publicar automaticamente nem depender de API durante as partidas.
3. Revisar as 178 fotografias selecionadas no navegador e substituir arquivos que deixarem de carregar; novas perguntas visuais só entram com imagem e crédito válidos.
4. Refinar os formatos de mapa, cronologia e associação também no ranking sem abrir espaço para pontuação enviada pelo cliente.

Solo e apresentação mantêm histórico local. O modo de apresentação permite pontuação manual durante transmissão de tela; aparelhos separados exigiriam salas e sincronização em um backend.
