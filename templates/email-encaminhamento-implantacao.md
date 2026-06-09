# Template — E-mail de encaminhamento (Implantação)

**Quem envia:** Setor Adm · **Para:** consultor(es) designado(s) · **Etapa:** 3.1.1
**Registro:** SICLA tipo 13

---

**Assunto:** Encaminhamento de Implantação — {{CLIENTE}}

Bom dia!

Consultor(es) **{{CONSULTOR_X}}** e **{{CONSULTOR_Y}}**!

Essa implantação ficará com você.

Por gentileza, proceder com nossa documentação padrão e aguardar a instalação para marcar a
visita inicial com o cliente.

> Lembramos que o prazo para elaboração do **Projeto**, **Cronograma** e comunicação ao ADM é
> de **no máximo 5 dias úteis** após o envio deste e-mail.

- **Levantamento de processos** realizado por {{RESPONSAVEL_LEVANTAMENTO}}:
  `Mapeamento levantamento de processos_{{CLIENTE}}.docx`
- **Projeto** realizado por {{RESPONSAVEL_PROJETO}}.
- **Cronograma** (compartilhar com o cliente via SharePoint).
- Enviar o **e-mail de boas-vindas** com os links dos tutoriais padrões.

**RNS de implantação:** {{RNS_I}}
**Protocolo:** {{PROTOCOLO}}
**RNS para criação do BI externo:** {{RNS_BI}}-01

**RNS de Conversão** (ajustar conforme a necessidade do cliente):

| Conversão | RNS ORC | RNS COB |
|-----------|---------|---------|
| Cadastros de Clientes/Fornecedores | {{ORC_CADCF}} | {{COB_CADCF}} |
| Cadastros de Produtos | {{ORC_PROD}} | {{COB_PROD}} |
| Financeiro a Pagar e Receber (em aberto) | {{ORC_FIN}} | {{COB_FIN}} |
| Notas Fiscais já emitidas | {{ORC_NF}} | {{COB_NF}} |

**Contato no cliente:** {{NOME_CONTATO}} — Fone: {{FONE_CONTATO}}

Atenciosamente,
Adm

---

> **Nota:** as RNS COB de conversão devem ser ajustadas às particularidades do cliente, com os
> tempos de envolvimento apontados. Devem ser dadas como **"Entregues"** quando finalizadas no
> uso oficial (responsabilidade do consultor da implantação).
