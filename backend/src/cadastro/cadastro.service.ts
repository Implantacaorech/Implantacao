import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { randomInt } from 'crypto';
import * as bcrypt from 'bcrypt';
import { CadastroPendente } from '../database/entities/cadastro-pendente.entity';
import { Usuario } from '../database/entities/usuario.entity';

const SALT_ROUNDS = 12;
const EXPIRA_MIN = 30;
const MAX_TENTATIVAS = 5;

export type ResultadoConfirmacao =
  | { ok: true; usuario: Usuario }
  | { ok: false; mensagem: string };

/** Auto-cadastro com código de verificação por e-mail (sem aprovação de ADM — a conta é
 * criada direto, sempre com perfil `Consultor`, o de menor privilégio). Espelha
 * webapp/db.py (CadastroPendente + limpar_pendentes/salvar_pendente/atualizar_codigo/
 * confirmar_pendente). */
@Injectable()
export class CadastroService {
  constructor(
    @InjectRepository(CadastroPendente)
    private readonly pendentes: Repository<CadastroPendente>,
    @InjectRepository(Usuario)
    private readonly usuarios: Repository<Usuario>,
  ) {}

  gerarCodigo(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  /** Apaga pendentes com mais de `minutos` — housekeeping, chamado a cada acesso à tela. */
  async limparPendentes(minutos = EXPIRA_MIN): Promise<void> {
    const corte = new Date(Date.now() - minutos * 60_000);
    await this.pendentes.delete({ criadoEm: LessThan(corte) });
  }

  /** Substitui qualquer pendente anterior do mesmo e-mail (case-insensitive) por um novo,
   * com a senha já hasheada. */
  async salvarPendente(
    nome: string,
    login: string,
    email: string,
    senha: string,
    codigo: string,
    codigoSicla = '',
  ): Promise<void> {
    await this.pendentes
      .createQueryBuilder()
      .delete()
      .where('LOWER(email) = :email', { email: email.trim().toLowerCase() })
      .execute();
    const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);
    await this.pendentes.save(
      this.pendentes.create({ nome, login, email, senhaHash, codigo, codigoSicla, tentativas: 0 }),
    );
  }

  /** Gera um novo código e renova a janela de expiração (usado pelo "Reenviar"). Devolve
   * `false` se não havia pendente para esse e-mail. */
  async atualizarCodigo(email: string, codigo: string): Promise<boolean> {
    const p = await this.buscarPendente(email);
    if (!p) return false;
    p.codigo = codigo;
    p.tentativas = 0;
    p.criadoEm = new Date();
    await this.pendentes.save(p);
    return true;
  }

  private async buscarPendente(email: string): Promise<CadastroPendente | null> {
    return this.pendentes
      .createQueryBuilder('p')
      .where('LOWER(p.email) = :email', { email: (email || '').trim().toLowerCase() })
      .orderBy('p.criadoEm', 'DESC')
      .getOne();
  }

  /** Valida o código e, se bater, cria o `Usuario` real (perfil sempre `Consultor`) e
   * apaga o pendente. Espelha webapp/db.py:confirmar_pendente (bloqueio por expiração de
   * 30min e por 5 tentativas erradas — em ambos os casos o pendente é descartado, forçando
   * recomeçar do zero). */
  async confirmarPendente(email: string, codigo: string): Promise<ResultadoConfirmacao> {
    const p = await this.buscarPendente(email);
    if (!p) return { ok: false, mensagem: 'Cadastro não encontrado. Recomece o cadastro.' };

    const expiraEm = new Date(p.criadoEm.getTime() + EXPIRA_MIN * 60_000);
    if (new Date() > expiraEm) {
      await this.pendentes.remove(p);
      return { ok: false, mensagem: 'O código expirou. Recomece o cadastro.' };
    }
    if (p.tentativas >= MAX_TENTATIVAS) {
      await this.pendentes.remove(p);
      return { ok: false, mensagem: 'Muitas tentativas. Recomece o cadastro.' };
    }
    if (p.codigo !== codigo) {
      p.tentativas += 1;
      await this.pendentes.save(p);
      return { ok: false, mensagem: 'Código incorreto. Confira e tente novamente.' };
    }

    const usuario = await this.usuarios.save(
      this.usuarios.create({
        nome: p.nome,
        login: p.login || p.email,
        email: p.email,
        senhaHash: p.senhaHash, // já hasheada em salvarPendente — reaproveitada como está
        perfil: 'Consultor', // sempre o de menor privilégio, mesmo em auto-cadastro
        ativo: true,
        codigoSicla: p.codigoSicla,
      }),
    );
    await this.pendentes.remove(p);
    return { ok: true, usuario };
  }
}
