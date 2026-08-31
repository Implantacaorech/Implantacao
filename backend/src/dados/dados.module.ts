import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClienteApi } from '../database/entities/cliente-api.entity';
import { ConsultaBD } from '../database/entities/consulta-bd.entity';
import { CatalogoSeedService } from './catalogo-seed.service';
import { ConsultaBdService } from './consulta-bd.service';
import { ConsultasPublicadasService } from './consultas-publicadas.service';
import { ConexaoPortalService } from './conexoes/conexao-portal.service';
import { ConexaoSiclaService } from './conexoes/conexao-sicla.service';
import { ClienteApiService } from './cliente-api.service';
import { CatalogoService } from './catalogo/catalogo.service';
import { ConexoesService } from './conexoes/conexoes.service';
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
  // Só o endpoint de EXECUÇÃO (`/api/dados/v1`) mora aqui, porque as duas instâncias o
  // servem. Os controllers de ADMINISTRAÇÃO (`/admin/*` e `config/consultas-bd`) são
  // declarados no `DadosAppModule` — administrar a API é exclusivo do Portal API desde
  // 2026-08-26, e deixá-los aqui os manteria expostos no Painel, sem tela mas alcançáveis.
  controllers: [DadosController],
  providers: [
    DadosService,
    CatalogoService,
    CatalogoSeedService,
    ConsultaBdService,
    ConsultasPublicadasService,
    ConexoesService,
    ConexaoSiclaService,
    ConexaoPortalService,
    ClienteApiService,
    ClienteApiRepository,
    AcessoDadosGuard,
  ],
  // Exporta o que os controllers de ADMINISTRAÇÃO precisam — eles são declarados no
  // `DadosAppModule` (só o Portal API os serve), e um controller só resolve dependências
  // que o módulo dele enxerga. Sem `ClienteApiService` e `ConsultasPublicadasService` aqui,
  // o Portal API nem sobe: `UnknownDependenciesException` no boot, que é onde este tipo de
  // erro aparece — nenhum teste de unidade monta a raiz.
  exports: [
    DadosService,
    CatalogoService,
    ConexoesService,
    ConsultaBdService,
    ConexaoSiclaService,
    ConexaoPortalService,
    ClienteApiService,
    ConsultasPublicadasService,
  ],
})
export class DadosModule {}
