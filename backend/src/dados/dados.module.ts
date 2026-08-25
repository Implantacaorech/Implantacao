import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClienteApi } from '../database/entities/cliente-api.entity';
import { ConsultaBD } from '../database/entities/consulta-bd.entity';
import { CatalogoSeedService } from './catalogo-seed.service';
import { ConsultaBdService } from './consulta-bd.service';
import { ConexaoPortalService } from './conexoes/conexao-portal.service';
import { ConexaoSiclaService } from './conexoes/conexao-sicla.service';
import { ClienteApiService } from './cliente-api.service';
import { ConexoesService } from './conexoes/conexoes.service';
import { DadosAdminController } from './dados-admin.controller';
import { DadosController } from './dados.controller';
import { DadosService } from './dados.service';
import { AcessoDadosGuard } from './guards/acesso-dados.guard';
import { ClienteApiRepository } from './repositories/cliente-api.repository';

/** API DE DADOS — fronteira única entre o Painel e os bancos EXTERNOS (ADR-0003).
 *
 * Depois da fase 2 este módulo é dono de TUDO que toca banco externo: os drivers
 * (`conexoes/`), o catálogo de consultas, o executor, as consultas salvas em Consultas BD
 * e os clientes de máquina. **Não importa nenhum módulo de negócio** — a seta aponta só
 * para cá, e é isso que impede a fronteira de virar um ciclo.
 *
 * `exports: [DadosService]` é a porta: todo módulo que precisa de dado externo importa este
 * e pede a consulta PELO NOME. A guarda `common/conformidade-api-dados.spec.ts` trava o
 * resto. */
@Module({
  imports: [TypeOrmModule.forFeature([ClienteApi, ConsultaBD])],
  controllers: [DadosController, DadosAdminController],
  providers: [
    DadosService,
    CatalogoSeedService,
    ConsultaBdService,
    ConexoesService,
    ConexaoSiclaService,
    ConexaoPortalService,
    ClienteApiService,
    ClienteApiRepository,
    AcessoDadosGuard,
  ],
  // ConsultaBdService e as conexões saem para as TELAS de configuração (Sistema →
  // Consultas BD / Disponibilidade), que editam o que este módulo executa.
  exports: [
    DadosService,
    ConexoesService,
    ConsultaBdService,
    ConexaoSiclaService,
    ConexaoPortalService,
  ],
})
export class DadosModule {}
