import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RecuperacaoSenhaService } from './recuperacao-senha.service';
import { JwtStrategy } from './jwt.strategy';
import { RefreshToken } from '../database/entities/refresh-token.entity';
import { RecuperacaoSenha } from '../database/entities/recuperacao-senha.entity';
import { UsersModule } from '../users/users.module';
import { ContatosSiclaModule } from '../contatos-sicla/contatos-sicla.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    UsersModule,
    // O login do usuário-cliente revalida a liberação no SICLA a cada entrada.
    ContatosSiclaModule,
    // O "Esqueci minha senha" manda o código pelo MailerService (Microsoft 365/SMTP) —
    // mesma infraestrutura de e-mail do auto-cadastro.
    EmailModule,
    PassportModule,
    JwtModule.register({}),
    TypeOrmModule.forFeature([RefreshToken, RecuperacaoSenha]),
  ],
  controllers: [AuthController],
  providers: [AuthService, RecuperacaoSenhaService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
