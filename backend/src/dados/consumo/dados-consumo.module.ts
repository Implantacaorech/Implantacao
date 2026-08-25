import { HttpModule } from '@nestjs/axios';
import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TokenApiDados } from '../../database/entities/token-api-dados.entity';
import { DadosModule } from '../dados.module';
import { DadosRemotoService } from './dados-remoto.service';
import { DELEGADO_REMOTO } from './delegado-remoto';
import { TokensApiController } from './tokens-api.controller';
import { TokenApiDadosService } from './token-api-dados.service';
import { TokenApiDadosRepository } from './repositories/token-api-dados.repository';

/** CONSUMO REMOTO da API de Dados — o lado do **Portal Implantação**.
 *
 * Montado só pelo `AppModule`. O `DadosAppModule` (Portal API) **não** o monta, e é isso que
 * mantém a instância interna com a superfície que o usuário pediu: conexão de banco, criação
 * de consulta e geração de token, nada mais.
 *
 * `@Global` porque o `DadosService` injeta o delegado de forma OPCIONAL: sem este módulo,
 * ele não existe e o Painel consulta o banco direto, como sempre fez. Com ele, e havendo
 * token ativo, a execução passa a ir para o Portal API — sem que nenhum módulo de negócio
 * saiba da diferença. */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([TokenApiDados]),
    HttpModule,
    // Para o `CatalogoService`, que responde "quais consultas ainda não têm token".
    DadosModule,
  ],
  controllers: [TokensApiController],
  providers: [
    TokenApiDadosService,
    TokenApiDadosRepository,
    DadosRemotoService,
    { provide: DELEGADO_REMOTO, useExisting: DadosRemotoService },
  ],
  exports: [DELEGADO_REMOTO, DadosRemotoService, TokenApiDadosService],
})
export class DadosConsumoModule {}
