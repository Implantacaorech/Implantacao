import { Usuario } from './usuario.entity';
import { Projeto } from './projeto.entity';
import { RefreshToken } from './refresh-token.entity';
import { ChecklistModelo } from './checklist-modelo.entity';
import { Designacao } from './designacao.entity';
import { AtividadeCronograma } from './atividade-cronograma.entity';
import { SlotCronograma } from './slot-cronograma.entity';
import { CronogramaConfig } from './cronograma-config.entity';
import { CronogramaPeriodoBloqueado } from './cronograma-periodo-bloqueado.entity';
import { IndiceTopico } from './indice-topico.entity';
import { ModeloDocumento } from './modelo-documento.entity';
import { ModeloDocumentoVersao } from './modelo-documento-versao.entity';
import { ModeloDocumentoCampo } from './modelo-documento-campo.entity';
import { LevantamentoResposta } from './levantamento-resposta.entity';
import { DocConteudo } from './doc-conteudo.entity';
import { Documento } from './documento.entity';
import { Evento } from './evento.entity';
import { Protocolo } from './protocolo.entity';
import { ModeloEmail } from './modelo-email.entity';
import { ConsultaBD } from './consulta-bd.entity';
import { MatrizCompetencia } from './matriz-competencia.entity';
import { MatrizTecnico } from './matriz-tecnico.entity';
import { CadastroPendente } from './cadastro-pendente.entity';
import { CronogramaItem } from './cronograma-item.entity';
import { ChecklistItem } from './checklist-item.entity';
import { Modificacao } from './modificacao.entity';
import { AgenteExecucao } from './agente-execucao.entity';
import { SigerFonte } from './siger-fonte.entity';

export * from './usuario.entity';
export * from './projeto.entity';
export * from './refresh-token.entity';
export * from './checklist-modelo.entity';
export * from './designacao.entity';
export * from './atividade-cronograma.entity';
export * from './slot-cronograma.entity';
export * from './cronograma-config.entity';
export * from './cronograma-periodo-bloqueado.entity';
export * from './indice-topico.entity';
export * from './modelo-documento.entity';
export * from './modelo-documento-versao.entity';
export * from './modelo-documento-campo.entity';
export * from './levantamento-resposta.entity';
export * from './doc-conteudo.entity';
export * from './documento.entity';
export * from './evento.entity';
export * from './protocolo.entity';
export * from './modelo-email.entity';
export * from './consulta-bd.entity';
export * from './matriz-competencia.entity';
export * from './matriz-tecnico.entity';
export * from './cadastro-pendente.entity';
export * from './cronograma-item.entity';
export * from './checklist-item.entity';
export * from './modificacao.entity';
export * from './agente-execucao.entity';
export * from './siger-fonte.entity';

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
  IndiceTopico,
  ModeloDocumento,
  ModeloDocumentoVersao,
  ModeloDocumentoCampo,
  LevantamentoResposta,
  DocConteudo,
  Documento,
  Evento,
  Protocolo,
  ModeloEmail,
  ConsultaBD,
  MatrizCompetencia,
  MatrizTecnico,
  CadastroPendente,
  CronogramaItem,
  ChecklistItem,
  Modificacao,
  AgenteExecucao,
  SigerFonte,
];
