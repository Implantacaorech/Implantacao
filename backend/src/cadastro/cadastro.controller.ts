import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CadastroService } from './cadastro.service';
import { UsersService } from '../users/users.service';
import { MailerService } from '../email/mailer.service';
import { AuthService } from '../auth/auth.service';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { CriarCadastroDto } from './dto/criar-cadastro.dto';
import { ConfirmarCadastroDto } from './dto/confirmar-cadastro.dto';
import { ReenviarCadastroDto } from './dto/reenviar-cadastro.dto';

/** Auto-cadastro (/cadastro*) — sem login, propositalmente sem `JwtAuthGuard` (é assim
 * que uma pessoa nova ganha acesso ao Painel). Espelha webapp/app.py:cadastro/
 * cadastro_confirmar. A conta é criada direto na confirmação, sempre com perfil
 * `Consultor` — sem fila de aprovação do ADM (o ADM pode depois editar/promover/
 * desativar via `/usuarios`). */
@ApiTags('cadastro')
@Controller('cadastro')
export class CadastroController {
  constructor(
    private readonly cadastro: CadastroService,
    private readonly users: UsersService,
    private readonly mailer: MailerService,
    private readonly auth: AuthService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Inicia o auto-cadastro: valida, gera e envia o código por e-mail',
  })
  async criar(@Body() dto: CriarCadastroDto) {
    await this.cadastro.limparPendentes();
    if (await this.users.existeUsuario(dto.email, dto.email)) {
      throw new BadRequestException(
        'Este e-mail já tem acesso. Use a tela de login.',
      );
    }
    if (!this.mailer.configurado()) {
      throw new BadRequestException(
        'E-mail não configurado neste Painel — peça ao Administrador para configurar em Config → E-mail (Microsoft 365).',
      );
    }
    const codigo = this.cadastro.gerarCodigo();
    await this.cadastro.salvarPendente(
      dto.nome,
      dto.email,
      dto.email,
      dto.senha,
      codigo,
      dto.codigoSicla,
    );
    const envio = await this.enviarCodigo(dto.nome, dto.email, codigo);
    if (!envio.ok) {
      throw new BadRequestException(
        envio.erro ?? 'Falha ao enviar o e-mail com o código.',
      );
    }
    return new ApiEnvelope({ email: dto.email });
  }

  @Post('confirmar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Confirma o código: cria o usuário e já devolve os tokens (login imediato)',
  })
  async confirmar(@Body() dto: ConfirmarCadastroDto) {
    const r = await this.cadastro.confirmarPendente(dto.email, dto.codigo);
    if (!r.ok) throw new BadRequestException(r.mensagem);
    return new ApiEnvelope(await this.auth.emitirParaUsuario(r.usuario));
  }

  @Post('reenviar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gera um novo código e renova a janela de 30min' })
  async reenviar(@Body() dto: ReenviarCadastroDto) {
    const codigo = this.cadastro.gerarCodigo();
    const existia = await this.cadastro.atualizarCodigo(dto.email, codigo);
    if (!existia)
      throw new BadRequestException(
        'Cadastro não encontrado. Recomece o cadastro.',
      );
    const envio = await this.enviarCodigo('', dto.email, codigo);
    if (!envio.ok)
      throw new BadRequestException(
        envio.erro ?? 'Falha ao reenviar o e-mail.',
      );
    return new ApiEnvelope({ email: dto.email });
  }

  private async enviarCodigo(nome: string, email: string, codigo: string) {
    const saudacao = nome ? `Olá, ${nome}!` : 'Olá!';
    const corpo =
      `${saudacao}\n\n` +
      `Seu código de verificação para acessar o Painel de Implantação é: ${codigo}\n\n` +
      `Este código expira em 30 minutos.\n\n` +
      `Se você não solicitou este cadastro, ignore este e-mail.`;
    return this.mailer.enviar(
      email,
      'Código de validação — Painel de Implantação',
      corpo,
    );
  }
}
