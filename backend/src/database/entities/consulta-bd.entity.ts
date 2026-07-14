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
}
