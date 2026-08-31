# Regras de negócio — Consultor SIGER

1. **`F:\SIGER` é somente leitura, inegociável.** O Painel não acessa a fonte — só a base
   derivada, aberta em `readonly`. Quem lê a fonte é o indexador externo, que tem guarda de
   escrita própria (audit hook) e testes de bloqueio.
2. **Anti-invenção estrutural:** a resposta é extrativa — cada item é trecho real da fonte
   com `arquivo:linha`. Sem evidência ⇒ "Não foi localizada evidência suficiente na fonte
   do SIGER" com `confianca: nao_confirmado`.
3. **Confiança honesta:** `alta` exige cobertura ≥ 75% dos termos originais da pergunta +
   ≥ 2 tipos de evidência direta + ≥ 8 achados; `media` afrouxa um degrau; cobertura < 50%
   força aviso de resultado parcial. Inferência nunca vira fato.
4. **Intenção muda a régua:** diagnóstico prioriza mensagens/validações; configuração
   prioriza parâmetros; cadastros prioriza tabelas `TIPO_TABELA=CADASTRO`; a detecção de
   diagnóstico vence a de configuração ("por que não consigo configurar X" é problema).
5. **Programas específicos de cliente** (NOT/TOP/TOA/ETG/FTC/LPR/EXP) são despriorizados —
   layout da Nokxeller não é regra geral do SIGER.
6. **Instruções internas do programa de menus** ("o 3º caractere corresponde…") não são
   opções de menu e são filtradas.
7. **Versões declaradas:** a base atual mistura COBOL 23.10b (ACL bloqueia ≥ 23.10c) com
   telas/helps 26.20a — cada evidência carrega sua versão para o consultor saber de onde
   veio. Liberada a leitura do `fon` oficial, reindexa-se e as constantes mudam.
8. **Feedback** (👍/👎) é registrado fora da fonte e não requer nível `alteracao` — avaliar
   resposta é parte do uso.
