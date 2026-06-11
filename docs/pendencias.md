# Pendências — Evolução do Painel de Implantação

> Backlog vivo dos assuntos em aberto (estratégia de automação, arquitetura e próximos passos).
> Digite **"Pendências"** a qualquer momento para ver esta lista. — Atualizado em 2026-06-10.

## 🔑 Decisão que destrava a arquitetura
- [x] **Onde os dados moram?** → **DECIDIDO: rede INTERNA** (servidor na rede; app agnóstico de
  banco — SQLite agora, Postgres/nuvem depois trocando só a conexão). *(2026-06-10)*

## 🏗️ Tela "Projetos por Cliente" (espinha dorsal — o "Dossiê vivo")
- [x] **Fase 1 feita:** banco SQLite/SQLAlchemy (agnóstico) + carteira (status/etapa) + ficha CRUD por cliente + modo servidor interno (`PAINEL_HOST=0.0.0.0`).
- [ ] Status por etapa com **gates** dos documentos obrigatórios (campo de etapa já existe; falta o gate).
- [ ] Documentos gerados anexados ao projeto (versionados) + links Drive/SICLA/RNS.
- [ ] Timeline/histórico por projeto (auditoria + passagem de bastão).
- [ ] Contatos/stakeholders por cliente (campo texto já existe; estruturar depois).
- [ ] Botão "Gerar tudo a partir do projeto" (Levantamento → Projeto → Check List → Termo, anexando ao cliente).
- [ ] Perfis/permissões (Coordenação vê a carteira; Consultor vê os seus).
- [ ] Painel do CEO: carteira (no prazo/atrasados, ocupação, time-to-value).
- [ ] `Iniciar_Servidor.bat` (seta `PAINEL_HOST=0.0.0.0` + `PAINEL_DB` na pasta de rede) para subir o servidor interno.

## ✉️ E-mail interno ("comunicação registrada")
- [ ] Conta SMTP da Rech + credencial guardada com segurança (igual à chave da IA).
- [ ] Templates: encaminhamento, encerramento, compartilhamento do cronograma.
- [ ] Disparo por evento (gerou Projeto → e-mail; critério de saída → encerramento).
- [ ] Log de cada e-mail na timeline do projeto.

## 🤖 Frentes de automação (roadmap)
- [ ] **Cronograma automático** (fecha a tríade obrigatória) — *quick win*.
- [ ] Integração **SICLA + RNS** (abrir/atualizar RNS(I), atividades 12/13/84). *Depende de API/banco.*
- [ ] **Dossiê vivo + Painel de portfólio** (= a própria tela Projetos por Cliente).
- [ ] **Copiloto do Consultor (IA)**: redigir rotinas, sugerir próximo passo, rascunhar e-mails, apontar riscos (RAID).
- [ ] **Pipeline de Conversão + gate de virada** (reconciliação origem×destino, SIT/UAT, pendências, docs obrigatórios).
- [ ] **Disparadores de fim de fluxo** (critério de saída do hypercare → Termo + e-mails + RNS para manutenção).
- [ ] Alertas proativos (SLA de 5 dias em risco, hypercare vencendo, pendências paradas).

## ⚙️ Dependências / pré-requisitos honestos
- [ ] Acesso ao SICLA/SIGER (API ou banco) para a integração.
- [ ] Chave da API da IA + teto de custo definido.
- [ ] Estruturar dados que hoje estão soltos (YAMLs por cliente).

## ▶️ Próximo passo combinado
- [ ] Decidir "onde os dados moram" → **começar pelo Hub "Projetos por Cliente" com banco**.

---
## 🟢 Resolvidos (histórico)
- Levantamento passa a **preencher o modelo real** (não reconstrói do zero) — 2026-06-10.
- Tela "Criação dos Templates" (abas) · Mapa mental do setor · espaçamento 1.15 — 2026-06-10.
- Modo IA (reconferência verbal + ortografia) e Conversões com "horas" automático — 2026-06-10.
