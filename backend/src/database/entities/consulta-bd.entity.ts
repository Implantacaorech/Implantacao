import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Consulta SQL nomeada, salva pelo Administrador em "Consultas BD" (área Sistema),
 * rodada contra a mesma conexão/credencial da Disponibilidade
 * (`DisponibilidadeService.executarSql`) — base dos Dashboards. Espelha
 * webapp/db.py:ConsultaBD, com 3 colunas NOVAS (`colunaData`/`colunaSituacao`/
 * `mostrarGrafico`) que generalizam o Dashboard: o Flask original só implementou de
 * verdade UMA análise (Previsão Início Oficial) com essas duas colunas hardcoded no
 * Python (`routes_dashboards.py`); aqui qualquer consulta salva pode declarar sua
 * própria coluna de data (para o filtro de período + gráfico por mês) e coluna de
 * situação (para o filtro multi-seleção), e o motor de dashboard passa a ser genérico —
 * decisão tomada com o usuário, ver docs/migracao/03-documento-conversao.md. */
@Entity({ name: 'consultas_bd' })
export class ConsultaBD {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ length: 60, default: '' })
  slug: string;

  @Column({ length: 160, default: '' })
  nome: string;

  @Column({ type: 'text', default: '' })
  sql: string;

  @Column({ default: 0 })
  ordem: number;

  // Nome da coluna (como o SELECT a devolve, via AS) usada como data do dashboard — filtro
  // de período e bucket mensal do gráfico. Vazio = essa consulta não é exibida como
  // dashboard (só existe como consulta nomeada reutilizável).
  @Column({ name: 'coluna_data', length: 120, default: '' })
  colunaData: string;

  // Nome da coluna usada no filtro multi-seleção (ex.: SITUACAO). Opcional mesmo quando
  // colunaData está preenchida.
  @Column({ name: 'coluna_situacao', length: 120, default: '' })
  colunaSituacao: string;

  @Column({ name: 'mostrar_grafico', default: false })
  mostrarGrafico: boolean;

  // Em QUAL conexão externa a consulta roda: 'sicla' (Oracle da Disponibilidade — o
  // comportamento de sempre) ou 'portal' (banco do Portal Rech, MySQL, cadastrado em
  // Sistema → Consulta BD). O Testar desta tela, os Dashboards e o painel de visitas do
  // BI roteiam o executor por este campo.
  @Column({ length: 20, default: 'sicla' })
  conexao: string;

  // ── Publicação na API de Dados (ADR-0003) ──────────────────────────────────────────
  // Uma consulta salva pode ser só um dashboard interno (o caso histórico) OU virar uma
  // consulta do CATÁLOGO, chamável por token. Os campos abaixo só valem no segundo caso e
  // são preenchidos pela tela de criação, com o Testar descobrindo binds e colunas.

  /** Nome PÚBLICO no catálogo (`<origem>.<assunto>.<ação>`). Vazio = a consulta não é
   * publicada; existe só para os Dashboards/Testar, como antes. */
  @Column({ name: 'nome_api', length: 80, default: '' })
  nomeApi: string;

  /** `true` a coloca em `GET /api/dados/v1/consultas` e a torna autorizável num token. */
  @Column({ default: false })
  publicada: boolean;

  /** Contrato dos parâmetros, em JSON: `[{nome,tipo,obrigatorio,descricao,maxTamanho}]`.
   * Os NOMES saem do próprio SQL (extrairBinds); o operador escolhe o tipo. */
  @Column({ type: 'text', nullable: true })
  parametros: string | null;

  /** Colunas que a consulta devolve, em JSON — preenchidas pelo Testar, que executa com
   * limite 1 e lê o metaData do driver. É o que documenta a SAÍDA para quem consome. */
  @Column({ type: 'text', nullable: true })
  colunas: string | null;

  /** Teto de linhas trazidas do banco. Obrigatório para publicar: sem ele, um SELECT sem
   * WHERE vira um tiro no Oracle. */
  @Column({ name: 'limite_linhas', default: 0 })
  limiteLinhas: number;

  @Column({ name: 'cache_segundos', default: 0 })
  cacheSegundos: number;
}
