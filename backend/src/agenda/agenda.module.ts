import { Module } from '@nestjs/common';
import { DadosModule } from '../dados/dados.module';
import { UsersModule } from '../users/users.module';
import { AgendaController } from './agenda.controller';
import { AgendaService } from './agenda.service';

/** Tela **Execução → Agenda** — calendário de compromissos dos técnicos, aberto já
 * filtrado no usuário logado. Lê `POWERBI_IMP_LISTACOMPROMISSOS_2` pela conexão Oracle do
 * DadosModule, com o SQL compartilhado com o BI "Alocação de Agendas"
 * (`bi-agenda-alocacao/`); o que muda é a janela (livre) e o gate de menu (`agenda`). */
@Module({
  // UsersModule: o filtro de técnicos da tela nasce da TABELA `usuarios` do Painel
  // (importada de SICLA.LISTA_TECNICOS), não só de quem tem compromisso no período.
  imports: [DadosModule, UsersModule],
  controllers: [AgendaController],
  providers: [AgendaService],
})
export class AgendaModule {}
