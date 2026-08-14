import { Injectable } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

/** Credencial do RechEdu (www.rechedu.com.br) de UM consultor. Guardada por usuário, como a
 * do Portal Rech: o acesso ao portal de educação é pessoal. */
export interface CredencialRechEdu {
  login: string;
  senha: string;
}

/** Guarda as credenciais do RechEdu por usuário, em `dados/rechedu_credenciais.json` —
 * mesmo padrão de segredo-em-repouso do Portal Rech (`portal_credenciais.json`): rede
 * interna, arquivo fora do git. A senha NUNCA volta para o cliente — só o `login` é exposto
 * (para a tela mostrar "conectado como fulano"). */
@Injectable()
export class RecheduCredencialService {
  private dir(): string {
    const base =
      process.env.NODE_ENV === 'test'
        ? join(
            process.cwd(),
            'dados',
            `rechedu_cred_test_${process.env.JEST_WORKER_ID ?? '0'}`,
          )
        : join(process.cwd(), 'dados');
    mkdirSync(base, { recursive: true });
    return base;
  }

  private arquivo(): string {
    return join(this.dir(), 'rechedu_credenciais.json');
  }

  private ler(): Record<string, CredencialRechEdu> {
    if (!existsSync(this.arquivo())) return {};
    try {
      const dados = JSON.parse(readFileSync(this.arquivo(), 'utf8')) as unknown;
      if (typeof dados !== 'object' || dados === null) return {};
      return dados as Record<string, CredencialRechEdu>;
    } catch {
      return {};
    }
  }

  private gravar(mapa: Record<string, CredencialRechEdu>): void {
    writeFileSync(this.arquivo(), JSON.stringify(mapa, null, 2), 'utf8');
  }

  /** O usuário já tem credencial salva? (gate do "solicitar login no 1º uso"). */
  tem(usuarioId: number): boolean {
    const c = this.ler()[String(usuarioId)];
    return !!(c && c.login && c.senha);
  }

  /** Só o login (seguro de exibir) — vazio se não houver credencial. */
  loginDe(usuarioId: number): string {
    return this.ler()[String(usuarioId)]?.login ?? '';
  }

  /** Uso INTERNO (backend): credencial completa. Nunca serializar isto numa resposta HTTP. */
  obter(usuarioId: number): CredencialRechEdu | null {
    const c = this.ler()[String(usuarioId)];
    return c && c.login && c.senha ? { login: c.login, senha: c.senha } : null;
  }

  /** Salva/atualiza. Senha em branco NÃO apaga a existente (mesma regra do Portal Rech):
   * o consultor pode corrigir só o login sem redigitar a senha. */
  salvar(usuarioId: number, login: string, senha: string): void {
    const mapa = this.ler();
    const chave = String(usuarioId);
    const atual = mapa[chave];
    const loginLimpo = (login ?? '').trim();
    const senhaLimpa = (senha ?? '').trim();
    mapa[chave] = {
      login: loginLimpo,
      senha: senhaLimpa || atual?.senha || '',
    };
    this.gravar(mapa);
  }

  remover(usuarioId: number): void {
    const mapa = this.ler();
    delete mapa[String(usuarioId)];
    this.gravar(mapa);
  }
}
