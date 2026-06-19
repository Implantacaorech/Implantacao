# entrada_ia/ — anexos para a IA analisar

Use esta pasta para **colocar arquivos que a IA precisa analisar**, em vez de colá-los direto no chat.
Assim a IA lê do workspace, sem inflar o contexto com conteúdo pesado.

## Como usar
- **Coloque aqui** PDFs, DOCX, XLSX, imagens, exports ou textos que precisam ser analisados.
- **Não cole arquivos longos** diretamente no chat.
- **Não envie relatórios inteiros** sem necessidade.
- **Quando possível, converta o trecho útil** para `.txt` ou `.md` (a IA lê isso de forma barata).
- **Arquivos grandes devem ser resumidos** antes de entrar no contexto principal.
- A IA deve **pedir que os arquivos sejam colocados nesta pasta** antes de analisá-los.

## Regras de contexto (.cloudignore)
Para economizar tokens, o `.cloudignore` faz a IA **ignorar binários e arquivos pesados** desta
pasta e carregar **apenas textos leves**: `.txt`, `.md`, `.csv`, `.json`, `.yaml`/`.yml`.
Os arquivos binários (PDF/DOCX/XLSX/imagens) ficam aqui apenas como **fonte**; a IA os processa
**só quando explicitamente solicitado** e, de preferência, a partir de um resumo em texto.

## Fluxo recomendado
1. Coloque o arquivo original em `entrada_ia/`.
2. Se for grande/binário, extraia o trecho relevante para um `.md`/`.txt` ao lado.
3. Diga à IA qual arquivo analisar e o objetivo.
4. A IA trabalha sobre o texto leve; o binário só é aberto se for indispensável.

> Conteúdo de clientes é sensível: não versione dados confidenciais. Veja o `.gitignore`.
