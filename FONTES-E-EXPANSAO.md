# Fontes e expansão do QuizArena

Revisado em 29/09/2026.

## Fontes e limites

| Conteúdo | Origem e tratamento | Limite conhecido |
| --- | --- | --- |
| Bandeiras | FlagCDN por código de país; respostas locais | Exige conexão e disponibilidade da FlagCDN. |
| Fotos | Arquivo fixo da Wikimedia Commons por pergunta em `content.js`, com autor, licença, página e data de revisão | 250 imagens selecionadas; 172 itens usam pista textual porque não foi encontrada imagem livre adequada automaticamente. A seleção ainda precisa de revisão visual/editorial individual. |
| Áudios | Quatro arquivos da Wikimedia Commons com créditos em `content.js` | A disponibilidade e a adequação do trecho dependem da origem. |
| Frases, respostas, mapa | Dados editoriais locais; o mapa é esquemático | A validação estrutural não prova a correção factual de cada entrada. |
| Ranking | Cloudflare Worker + D1 + Discord OAuth em `quiz.maiq.dev.br` | Respostas públicas permitem automação; placar casual. |

`node scripts/validate-content.mjs` verifica estrutura, contagens, coordenadas e créditos. `node scripts/curate-media.mjs` refaz a consulta à Wikimedia; **não rode sem revisar o diff**, pois uma nova consulta pode trocar os arquivos escolhidos. A curação usa licenças CC BY, CC BY-SA, CC0 e domínio público. O uso sem fins lucrativos não dispensa atribuição. Veja [orientação do Wikimedia Commons](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia/technical) e [MediaWiki API](https://www.mediawiki.org/wiki/API:Imageinfo).

## Formatos e partidas

Há linha do tempo, associação país/capital, áudio de instrumentos, mapa, texto, bandeiras e imagens. Solo e apresentação têm resumo e histórico local. O modo de apresentação permite pontuação manual de equipes durante a transmissão da tela. O ranking online foi iniciado com os dois temas textuais/estruturados que têm gabarito inequívoco: capitais e idiomas. Cada um usa o conjunto completo; Misto reúne ambos.

Próximas expansões úteis:

1. Revisar visualmente cada arquivo curado e substituir pistas textuais por imagens adequadas quando existir uma opção reutilizável.
2. Ampliar áudios com trechos curtos e licença conferida, e adicionar mais sequências históricas e associações.
3. Levar os demais temas ao ranking com bancos de perguntas específicos por formato, sem reduzir o conteúdo a pistas que revelem a resposta. Para competição séria, criar um conjunto de perguntas privado diferente do catálogo aberto.
4. Criar salas sincronizadas somente se houver demanda por jogadores em aparelhos separados; a apresentação na mesma tela já cobre o uso em grupo atual.

Para novos dados de países, a [REST Countries](https://restcountries.com/) pode auxiliar uma geração de snapshot revisado; respostas do jogo não devem depender de uma API em tempo real.
