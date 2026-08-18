import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalleArquivo } from '../database/entities/walle-arquivo.entity';
import { WalleChat } from '../database/entities/walle-chat.entity';
import { WalleEntidade } from '../database/entities/walle-entidade.entity';
import { DisponibilidadeModule } from '../disponibilidade/disponibilidade.module';
import { IaModule } from '../ia/ia.module';
import { AcervoFsRepository } from './repositories/acervo-fs.repository';
import { WalleArquivosRepository } from './repositories/walle-arquivos.repository';
import { WalleChatsRepository } from './repositories/walle-chats.repository';
import { WalleEntidadesRepository } from './repositories/walle-entidades.repository';
import { BuscaWalleService } from './busca-walle.service';
import { IndexacaoWalleService } from './indexacao-walle.service';
import { WalleController } from './walle.controller';
import { WalleIaService } from './walle-ia.service';
import { WalleOracleService } from './walle-oracle.service';
import { WalleService } from './walle.service';

/** Módulo **Consulta Wall-e** — transforma o acervo documental dos chats do bot Wall-e
 * (`R:\GRM\CHAT_WALLE\`, fonte oficial SOMENTE LEITURA) em base de conhecimento
 * pesquisável: indexação incremental para as tabelas `walle_*`, busca híbrida em memória,
 * enriquecimento opcional pelo Oracle do SICLA (`CHAT_WALLE`) e síntese por IA com
 * provedor local (finalidade `walle`, só-local por política de privacidade). */
@Module({
  imports: [
    TypeOrmModule.forFeature([WalleChat, WalleArquivo, WalleEntidade]),
    DisponibilidadeModule,
    IaModule,
  ],
  controllers: [WalleController],
  providers: [
    AcervoFsRepository,
    WalleChatsRepository,
    WalleArquivosRepository,
    WalleEntidadesRepository,
    IndexacaoWalleService,
    BuscaWalleService,
    WalleOracleService,
    WalleIaService,
    WalleService,
  ],
})
export class WalleModule {}
