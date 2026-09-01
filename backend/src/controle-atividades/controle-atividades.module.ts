import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AtividadeQuadro } from '../database/entities/atividade-quadro.entity';
import { AtividadeQuadroResponsavel } from '../database/entities/atividade-quadro-responsavel.entity';
import { AtividadeLista } from '../database/entities/atividade-lista.entity';
import { AtividadeCartao } from '../database/entities/atividade-cartao.entity';
import { AtividadeMembro } from '../database/entities/atividade-membro.entity';
import { AtividadeChecklistItem } from '../database/entities/atividade-checklist-item.entity';
import { AtividadeAnexo } from '../database/entities/atividade-anexo.entity';
import { AtividadeComentario } from '../database/entities/atividade-comentario.entity';
import { AtividadeEvento } from '../database/entities/atividade-evento.entity';
import { AtividadeNotificacao } from '../database/entities/atividade-notificacao.entity';
import { ProjetoPessoa } from '../database/entities/projeto-pessoa.entity';
import { Projeto } from '../database/entities/projeto.entity';
import { UsersModule } from '../users/users.module';
import { EmailModule } from '../email/email.module';
import { ClientesSiclaModule } from '../clientes-sicla/clientes-sicla.module';
import { ContatosSiclaModule } from '../contatos-sicla/contatos-sicla.module';
import { QuadrosRepository } from './repositories/quadros.repository';
import { ListasRepository } from './repositories/listas.repository';
import { CartoesRepository } from './repositories/cartoes.repository';
import { DetalhesCartaoRepository } from './repositories/detalhes-cartao.repository';
import { EventosAtividadeRepository } from './repositories/eventos-atividade.repository';
import { NotificacoesRepository } from './repositories/notificacoes.repository';
import { DesignadosRepository } from './repositories/designados.repository';
import { QuadrosService } from './quadros.service';
import { ListasService } from './listas.service';
import { CartoesService } from './cartoes.service';
import { AnexosService } from './anexos.service';
import { BuscaService } from './busca.service';
import { NotificacoesAtividadeService } from './notificacoes-atividade.service';
import { RoboPrazosService } from './robo-prazos.service';
import { ControleAtividadesService } from './controle-atividades.service';
import { ControleAtividadesController } from './controle-atividades.controller';

/** Execução → Controle de Atividades — quadro de atividades por cliente
 * (docs/controle-atividades.md).
 *
 * Estrutura no molde do módulo-piloto `plano-cronograma`: Controller → Service → Repository,
 * com os 6 documentos em `docs/`. `ProjetoPessoa`/`Projeto` entram no `forFeature` só para
 * LEITURA da designação (`DesignadosRepository`) — é o que decide quem abre o quadro de um
 * cliente e quem responde por ele. */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      AtividadeQuadro,
      AtividadeQuadroResponsavel,
      AtividadeLista,
      AtividadeCartao,
      AtividadeMembro,
      AtividadeChecklistItem,
      AtividadeAnexo,
      AtividadeComentario,
      AtividadeEvento,
      AtividadeNotificacao,
      ProjetoPessoa,
      Projeto,
    ]),
    UsersModule,
    EmailModule,
    ClientesSiclaModule,
    ContatosSiclaModule,
  ],
  controllers: [ControleAtividadesController],
  providers: [
    QuadrosRepository,
    ListasRepository,
    CartoesRepository,
    DetalhesCartaoRepository,
    EventosAtividadeRepository,
    NotificacoesRepository,
    DesignadosRepository,
    QuadrosService,
    ListasService,
    CartoesService,
    AnexosService,
    BuscaService,
    NotificacoesAtividadeService,
    RoboPrazosService,
    ControleAtividadesService,
  ],
  exports: [ControleAtividadesService],
})
export class ControleAtividadesModule {}
