# Pendências — Evolução do Painel de Implantação

> Backlog vivo dos assuntos em aberto (estratégia de automação, arquitetura e próximos passos).
> Digite **"Pendências"** a qualquer momento para ver esta lista. — Atualizado em 2026-06-10.

## 🔑 Decisão que destrava a arquitetura
- [ ] **Onde os dados moram?** Só na máquina (local) × **compartilhado pela equipe** (pasta de
  rede `R:\` com banco SQLite) × servidor interno (painel numa máquina, todos pelo navegador) ×
  cloud. *Define toda a arquitetura do hub de Projetos por Cliente.*

## 🏗️ Tela "Projetos por Cliente" (espinha dorsal — o "Dossiê vivo")
- [ ] Banco real (SQLite) em vez de YAMLs soltos; dados salvos por cliente.
- [ ] Status por etapa com **gates** dos documentos obrigatórios (Projeto/Cronograma/Termo).
- [ ] Documentos gerados anexados ao projeto (versionados) + links Drive/SICLA/RNS.
- [ ] Timeline/histórico por projeto (auditoria + passagem de bastão).
- [ ] Contatos/stakeholders por cliente.
- [ ] Importar/anexar de uma vez Levantamento → Projeto → Check List → Termo.
- [ ] Perfis/permissões (Coordenação vê a carteira; Consultor vê os seus).
- [ ] Painel do CEO: carteira (no prazo/atrasados, ocupação, time-to-value).

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
