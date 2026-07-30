import { Module } from '@nestjs/common';
import { DisponibilidadeModule } from '../disponibilidade/disponibilidade.module';
import { BiAgendaAlocacaoService } from './bi-agenda-alocacao.service';
import { BiAgendaAlocacaoController } from './bi-agenda-alocacao.controller';

/** "Alocação de Agendas" da aba **BI Implantação** (porte do `BI_Interno.pbix`): Calendário
 * e Horas Aplicadas. Lê `POWERBI_IMP_LISTACOMPROMISSOS_2` e
 * `POWERBI_AGENDA_POSTERGACAO_IMP_2` pela conexão Oracle do DisponibilidadeModule. */
@Module({
  imports: [DisponibilidadeModule],
  controllers: [BiAgendaAlocacaoController],
  providers: [BiAgendaAlocacaoService],
  exports: [BiAgendaAlocacaoService],
})
export class BiAgendaAlocacaoModule {}
