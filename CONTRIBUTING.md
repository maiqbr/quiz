# Contribuindo

Correções de respostas, acessibilidade, interface e novas perguntas são bem-vindas. Abra uma issue ou pull request com a mudança e a fonte usada para conferir fatos ou grafias.

Para acrescentar perguntas, edite `content.js`, atualize a contagem do cartão correspondente e rode `node scripts/validate-content.mjs`. Prefira respostas sem ambiguidade, inclua grafias alternativas úteis e teste a pergunta nos modos de digitação e múltipla escolha. Para imagens, registre arquivo, autor, licença, página de origem e data de revisão; não adicione arquivos de terceiros ao repositório sem direito de distribuição. Mantenha a interface sem emojis.

O jogo local é estático e não requer dependências para rodar ou validar o catálogo. O ranking opcional usa `worker/` e Cloudflare D1. Não inclua senhas, chaves de API, dados pessoais ou arquivos de teste temporários em commits. Alterações no ranking devem preservar a pontuação calculada no servidor e a separação por dificuldade.
