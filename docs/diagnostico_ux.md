# Diagnóstico e Reestruturação de UX/UI — Painel de Implantação RECH

Este documento apresenta a análise técnica detalhada da interface atual do Painel de Implantação e a proposta conceitual de reestruturação para transformar o sistema em um verdadeiro orquestrador de processos, mantendo intactas as regras de negócio e os *gates* de qualidade.

## 1. Diagnóstico Atual

A aplicação atual possui uma base tecnológica sólida (Flask + SQLAlchemy) e já evoluiu para um modelo de fluxo governado. No entanto, a experiência do usuário ainda reflete uma arquitetura de dados, não uma jornada de trabalho.

### 1.1 Pontos Positivos da Estrutura Existente
- **Lógica de negócio madura:** A estrutura de 4 etapas (*Levantamento → Projeto → Cronograma e Check-list → Encerramento*) com *gates* obrigatórios de documentos é robusta e não deve ser alterada.
- **Componentes visuais de fundação:** O *stepper* na ficha do projeto, as *badges* de status e a distinção entre Kanban e Tabela na carteira são excelentes padrões que serão aproveitados.
- **Auto-avanço inteligente:** O conceito de avançar a etapa automaticamente quando o documento correspondente é gerado reduz atrito operacional.
- **Indicador de "Próxima Ação":** O bloco destacado na ficha do projeto é uma ótima iniciativa para conduzir o usuário, embora precise de refinamento visual e de fluxo.

### 1.2 Problemas e Gargalos de Usabilidade Identificados

**A. Fragmentação da Ficha do Projeto (`projeto_ficha.html`)**
O projeto é apresentado em abas isoladas (*Resumo, Dados, Documentos, Comunicação, Histórico*). O usuário precisa navegar ativamente entre essas abas para entender o contexto global. A aba "Documentos" mistura ações operacionais críticas (gerar, importar, avançar) com o mero armazenamento de arquivos, criando confusão cognitiva.

**B. Condução Operacional Quebrada**
Apesar de existir o bloco "Próxima ação", a interface não guia o usuário de forma linear. Por exemplo:
- A designação de responsáveis está escondida como um botão na aba "Resumo", levando a uma tela separada (`designar.html`), quebrando o fluxo natural do processo.
- Os *CTAs* (Call to Action) competem entre si: botões de "Gerar Levantamento", "Gerar Cronograma", etc., ficam todos visíveis na aba de documentos, mesmo que a etapa atual não exija alguns deles.

**C. Exposição de Complexidade Técnica**
A interface expõe nomenclaturas e lógicas de sistema que não deveriam onerar o usuário. Expressões como "Gerar pendentes" e "Importar Mapeamento" não refletem o jargão natural do processo de implantação e geram incerteza sobre o resultado da ação.

**D. Navegação Global Desalinhada do Fluxo (`base.html`)**
O menu lateral mistura ações de fluxo ("Fluxo", "Projetos") com dashboards e ferramentas. A hierarquia visual não reflete a prioridade diária do Consultor ou do Coordenador.

### 1.3 Riscos Operacionais
- **Retrabalho por falta de contexto:** A fragmentação em abas pode levar o consultor a preencher dados inconsistentes ou esquecer de comunicar stakeholders, pois a visão geral não está integrada à área de ação.
- **Erro de sequência:** Embora o *backend* proteja contra a geração de documentos fora da etapa (regra *GATES*), a interface mostra botões que induzem ao erro, resultando em frustração quando a ação é bloqueada.

---

## 2. Proposta de Melhoria e Reestruturação

O novo design transformará a "Ficha do Projeto" em um **Workspace de Execução**, onde o foco deixa de ser "gerenciar dados" e passa a ser "completar a etapa atual".

### 2.1 Novo Desenho Conceitual da Página (Workspace)

A `projeto_ficha.html` será reestruturada em um layout de duas colunas (ou áreas de foco claras):

1. **Painel de Contexto Permanente (Esquerda/Topo):**
   - *Stepper* de Fases atualizado e mais orgânico.
   - Resumo crítico do projeto (Cliente, Go-Live, Horas, Responsáveis).
   - KPIs de saúde do projeto atual.

2. **Área de Ação da Etapa Atual (Centro/Direita):**
   - Esta área será dinâmica e mudará completamente dependendo da etapa em que o projeto se encontra.
   - Em vez de abas estáticas, o usuário verá apenas o que importa *agora*.
   - **Exemplo (Fase Projeto):** Mostrará o status do *Levantamento* (concluído), o botão principal "Importar Mapeamento para gerar Projeto", e os campos de dados relevantes para esta fase.

3. **Timeline Unificada (Rodapé/Aba Secundária):**
   - O histórico de eventos, comunicações e documentos anexados será consolidado em um feed único de auditoria, fácil de consultar, mas fora do caminho da ação principal.

### 2.2 Fluxo Operacional Recomendado (Jornada do Usuário)

A interface guiará o usuário rigorosamente pela seguinte sequência lógica, exibindo CTAs primários apenas para a etapa ativa:

1. **Onboarding Automático:** O robô cria o projeto a partir do e-mail.
2. **Etapa 1: Levantamento:**
   - A ficha do projeto exibe como ação principal e única: **"Designar Responsáveis"**.
   - Após designar, a tela atualiza para: **"Preencher Levantamento"** (ou "Avançar para Projeto", confirmando o preenchimento externo).
3. **Etapa 2: Projeto:**
   - A ficha exibe claramente: **"Importar Mapeamento"** (CTA principal).
   - A geração do documento `.docx` avança a etapa automaticamente.
4. **Etapa 3: Cronograma e Check-list:**
   - A ficha apresenta dois cards paralelos: **"Gerar Cronograma"** e **"Gerar Check-list"**.
   - Os botões para "Editar no Painel" ganham destaque visual sobre a versão em arquivo.
5. **Etapa 4: Encerramento:**
   - A interface concentra-se em verificar pendências e exibe o CTA final: **"Gerar Termo de Encerramento"**.

### 2.3 Melhorias Visuais e Funcionais

- **Limpeza Cognitiva:** Ocultar botões de ações futuras ou passadas. Se o projeto está na fase de "Projeto", os botões de "Gerar Cronograma" não devem estar visíveis, apenas indicados como passos futuros no *stepper*.
- **Renomeação Semântica:**
  - "Importar Mapeamento" → "Processar Levantamento e Criar Projeto"
  - "Gerar pendentes" → "Preparar Documentos da Fase"
- **Feedback Imediato:** Utilizar *toasts* e transições suaves ao avançar de etapa, reforçando a sensação de progresso.

---

## 3. Justificativa Técnica e Ganhos Esperados

A implementação desta reestruturação trará benefícios tangíveis para a operação da Rech:

1. **Usabilidade e Produtividade:** Ao remover abas desnecessárias e focar na ação da etapa atual, reduzimos a carga cognitiva. O consultor não precisa pensar "onde clico agora?"; a interface apresenta a ação correta no momento exato.
2. **Redução de Erros e Governança:** Ocultar ações fora de contexto previne cliques errados e mensagens de erro do sistema. A governança é reforçada pela condução visual (o usuário só vê a próxima porta quando a atual for destrancada).
3. **Facilidade de Treinamento:** Novos consultores aprenderão o processo simplesmente usando a ferramenta, pois a interface atuará como um tutorial interativo do processo *GRM:Implantação*.
4. **Escalabilidade:** A arquitetura proposta permite adicionar novas etapas ou sub-processos (como *Hypercare* ou aprovações formais) no futuro, simplesmente inserindo um novo estado no *Workspace de Execução*, sem precisar reorganizar abas ou sobrecarregar a tela com novos botões.
