import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CadastroPendente } from '../database/entities/cadastro-pendente.entity';
import { Usuario } from '../database/entities/usuario.entity';
import { UsersModule } from '../users/users.module';
import { EmailModule } from '../email/email.module';
import { AuthModule } from '../auth/auth.module';
import { CadastroService } from './cadastro.service';
import { CadastroController } from './cadastro.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([CadastroPendente, Usuario]),
    UsersModule,
    EmailModule,
    AuthModule,
  ],
  controllers: [CadastroController],
  providers: [CadastroService],
})
export class CadastroModule {}
