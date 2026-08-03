import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { randomInt } from 'crypto';
import * as bcrypt from 'bcrypt';
import { RecuperacaoSenha } from '../database/entities/recuperacao-senha.entity';
import { UsersService } from '../users/users.service';
import { MailerService } from '../email/mailer.service';

const SALT_ROUNDS = 12;
/** Janela mais curta que a do auto-cadastro (30min): aqui o código dá acesso a uma conta
 * que já existe. */
const EXPIRA_MIN = 15;
const MAX_TENTATIVAS = 5;

export type ResultadoRedefinicao =
  { ok: true; usuarioId: number } | { ok: false; mensagem: string };

/** "Esqueci minha senha" da tela de login: envia um código de 6 dígitos ao e-mail da conta
 * e, com ele, deixa a pessoa gravar uma senha nova.
 *
 * Duas decisões deliberadas, ambas para não transformar a tela num verificador de contas:
 *
 * 1. `solicitar()` NUNCA revela se o e-mail existe — devolve o mesmo `enviado: true` para
 *    e-mail cadastrado e desconhecido. Sem isso, qualquer um de fora descobre quem tem
 *    acesso ao Painel só digitando endereços.
 * 2. `redefinir()` devolve a MESMA mensagem para "não há pedido para este e-mail" e
 *    "código errado". Distinguir os dois vazaria a mesma informação pelo outro caminho. */
@Injectable()
export class RecuperacaoSenhaService {
  constructor(
    @InjectRepository(RecuperacaoSenha)
    private readonly pedidos: Repository<RecuperacaoSenha>,
    private readonly users: UsersService,
    private readonly mailer: MailerService,
  ) {}

  gerarCodigo(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  /** Apaga pedidos fora da janela — housekeeping, chamado a cada solicitação. */
  async limparExpirados(minutos = EXPIRA_MIN): Promise<void> {
    const corte = new Date(Date.now() - minutos * 60_000);
    await this.pedidos.delete({ criadoEm: LessThan(corte) });
  }

  /** Registra o pedido e dispara o e-mail. Silencioso por fora: e-mail desconhecido, conta
   * inativa ou Painel sem e-mail configurado terminam do mesmo jeito para quem chamou —
   * quem tem a conta recebe a mensagem, quem não tem não descobre nada. */
  async solicitar(email: string): Promise<void> {
    await this.limparExpirados();
    const usuario = await this.users.porEmail(email);
    if (!usuario) return;

    const destino = (usuario.email || usuario.login || '').trim();
    if (!destino.includes('@')) return; // conta sem e-mail real: não há para onde enviar
    if (!this.mailer.configurado()) return;

    const codigo = this.gerarCodigo();
    // Um pedido por vez: pedir de novo invalida o código anterior.
    await this.pedidos.delete({ usuarioId: usuario.id });
    await this.pedidos.save(
      this.pedidos.create({
        usuarioId: usuario.id,
        email: destino,
        codigoHash: await bcrypt.hash(codigo, SALT_ROUNDS),
        tentativas: 0,
      }),
    );
    await this.enviarCodigo(usuario.nome, destino, codigo);
  }

  /** Confere o código e grava a senha nova. O pedido é descartado no sucesso, no estouro de
   * tentativas e na expiração — em todos, recomeçar é pedir um código novo. */
  async redefinir(
    email: string,
    codigo: string,
    senhaNova: string,
  ): Promise<ResultadoRedefinicao> {
    const generico = 'Código inválido ou expirado. Peça um novo código.';
    const p = await this.pedidoDoEmail(email);
    if (!p) return { ok: false, mensagem: generico };

    if (new Date() > new Date(p.criadoEm.getTime() + EXPIRA_MIN * 60_000)) {
      await this.pedidos.remove(p);
      return { ok: false, mensagem: generico };
    }
    if (p.tentativas >= MAX_TENTATIVAS) {
      await this.pedidos.remove(p);
      return {
        ok: false,
        mensagem: 'Muitas tentativas. Peça um novo código.',
      };
    }
    if (!(await bcrypt.compare(codigo, p.codigoHash))) {
      p.tentativas += 1;
      await this.pedidos.save(p);
      return {
        ok: false,
        mensagem: 'Código incorreto. Confira e tente novamente.',
      };
    }

    await this.users.definirSenha(p.usuarioId, senhaNova);
    await this.pedidos.remove(p);
    return { ok: true, usuarioId: p.usuarioId };
  }

  private async pedidoDoEmail(email: string): Promise<RecuperacaoSenha | null> {
    return this.pedidos
      .createQueryBuilder('p')
      .where('LOWER(p.email) = :email', {
        email: (email || '').trim().toLowerCase(),
      })
      .orderBy('p.criadoEm', 'DESC')
      .getOne();
  }

  private async enviarCodigo(nome: string, email: string, codigo: string) {
    const saudacao = nome ? `Olá, ${nome}!` : 'Olá!';
    const corpo =
      `${saudacao}\n\n` +
      `Recebemos um pedido para redefinir a sua senha do Painel de Implantação.\n\n` +
      `Seu código de verificação é: ${codigo}\n\n` +
      `Este código expira em ${EXPIRA_MIN} minutos.\n\n` +
      `Se não foi você que pediu, ignore este e-mail — sua senha atual continua valendo.`;
    return this.mailer.enviar(
      email,
      'Redefinição de senha — Painel de Implantação',
      corpo,
    );
  }
}
