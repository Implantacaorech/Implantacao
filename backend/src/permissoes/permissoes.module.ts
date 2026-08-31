import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermissaoPapel } from '../database/entities/permissao-papel.entity';
import { PermissaoUsuario } from '../database/entities/permissao-usuario.entity';
import { PermissoesService } from './permissoes.service';
import { EscopoClienteService } from './escopo-cliente.service';
import { PermissaoGuard } from './permissao.guard';
import { PermissoesController } from './permissoes.controller';
import { UsersModule } from '../users/users.module';

/** Global: o PermissaoGuard e o PermissoesService são usados por controllers de vários
 * módulos (o gate por menu). Exportá-los globalmente evita importar este módulo em cada um. */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([PermissaoPapel, PermissaoUsuario]),
    UsersModule,
  ],
  controllers: [PermissoesController],
  providers: [PermissoesService, PermissaoGuard, EscopoClienteService],
  exports: [PermissoesService, PermissaoGuard, EscopoClienteService],
})
export class PermissoesModule {}
