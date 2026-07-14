import { Usuario } from './usuario.entity';
import { Projeto } from './projeto.entity';
import { RefreshToken } from './refresh-token.entity';
import { ChecklistModelo } from './checklist-modelo.entity';
import { Designacao } from './designacao.entity';
import { AtividadeCronograma } from './atividade-cronograma.entity';
import { SlotCronograma } from './slot-cronograma.entity';
import { CronogramaConfig } from './cronograma-config.entity';
import { CronogramaPeriodoBloqueado } from './cronograma-periodo-bloqueado.entity';

export * from './usuario.entity';
export * from './projeto.entity';
export * from './refresh-token.entity';
export * from './checklist-modelo.entity';
export * from './designacao.entity';
export * from './atividade-cronograma.entity';
export * from './slot-cronograma.entity';
export * from './cronograma-config.entity';
export * from './cronograma-periodo-bloqueado.entity';

// Lista única usada por DatabaseModule (runtime) e AppDataSource (CLI de migrations) —
// evita as duas listas divergirem conforme novas entidades são adicionadas.
export const ENTITIES = [
  Usuario,
  Projeto,
  RefreshToken,
  ChecklistModelo,
  Designacao,
  AtividadeCronograma,
  SlotCronograma,
  CronogramaConfig,
  CronogramaPeriodoBloqueado,
];
