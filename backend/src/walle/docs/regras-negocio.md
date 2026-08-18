# Regras de negócio — módulo Wall-e

1. **Fonte somente leitura (inegociável).** `R:\GRM\CHAT_WALLE\` é fonte oficial: o módulo
   lê/indexa/pesquisa/consome e NUNCA cria, altera, exclui, renomeia, move ou sobrescreve
   nada lá — nem cache, log, índice, embedding ou temporário. Todo derivado vive nas
   tabelas `walle_*`. Testes usam fixtures em `mkdtemp`, jamais o share real.
2. **O acervo não é o Wall-e inteiro.** É o espelho documental dos chats que produziram ou
   receberam arquivos; a conversa completa vive no Oracle do SICLA. Por isso a resposta
   vazia usa a frase exata: *"Não foi localizado material relevante no acervo documental
   consultado."* — nunca "não existe conhecimento sobre isso". A `cobertura` acompanha
   toda resposta.
3. **Não inventar (anti-alucinação).** A síntese por IA responde só com base nos trechos;
   sem evidência devolve a frase-contrato *"Não foi localizada evidência suficiente nas
   fontes consultadas."*. Toda resposta é rastreável: fontes numeradas com arquivo, chat e
   caminho de origem; cada card lista as evidências que o trouxeram.
4. **Privacidade (§21-A.10).** O acervo cita clientes, logs e dados de produção — a
   finalidade IA `walle` é SÓ-LOCAL (`FINALIDADES_SO_LOCAL`): provedor externo é recusado
   na configuração e não existe failover para fora da rede.
5. **Semântica nunca supera o literal.** Expansão por sinônimo pesa 0,5 e um documento que
   só bateu por expansão vai para "Também pode ser útil", nunca para os resultados.
   Resultado de confiança baixa nunca lidera; quando não há correspondência direta, o
   resumo avisa "trate os resultados como pistas".
6. **SQL é documento.** SQLs encontrados aparecem com objetivo/tabelas/operações e NUNCA
   são executados a partir do módulo — não existe rota de execução.
7. **Produzido × insumo (§38).** Log e imagem chegam como insumo; `.md`/`.sql` são
   entregas do bot (assinatura "Elaborado por Wall-e" confirma); o resto fica
   indeterminado — um log recebido nunca é apresentado como conclusão do Wall-e.
8. **Removido não é apagado.** Arquivo que some da fonte vira `removido = true`: sai da
   busca, mas o histórico indexado permanece e a tela avisa "removido da fonte".
9. **Permissões.** `consulta` pesquisa e abre tudo; `alteracao` (ADM por padrão) habilita
   só o "Atualizar acervo" (reindexação). Comercial fica de fora por padrão.
