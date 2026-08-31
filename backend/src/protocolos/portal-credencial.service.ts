import { Injectable } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

/** Credencial do Portal Rech de UM consultor. Guardada por usuário: o atendimento fica
 * gravado no Portal como sendo dele (decisão do usuário em 2026-08-13). */
export interface CredencialPortal {
  login: string;
  senha: string;
}

/** Guarda as credenciais do Portal Rech por usuário, em `dados/portal_credenciais.json`
 * (mesmo padrão de segredo-em-repouso de `disponibilidade.json`/`imap`: rede interna, arquivo
 * fora do git). A senha NUNCA volta para o cliente — só o `login` é exposto (para a tela
 * mostrar "conectado como fulano"). O envio ao Portal roda no backend, então a senha não
 * transita para o navegador depois de salva. */
@Injectable()
export class PortalCredencialService {
  private dir(): string {
    const base =
      process.env.NODE_ENV === 'test'
        ? join(
            process.cwd(),
            'dados',
            `portal_cred_test_${process.env.JEST_WORKER_ID ?? '0'}`,
          )
        : join(process.cwd(), 'dados');
    mkdirSync(base, { recursive: true });
    return base;
  }

  private arquivo(): string {
    return join(this.dir(), 'portal_credenciais.json');
  }

  private ler(): Record<string, CredencialPortal> {
    if (!existsSync(this.arquivo())) return {};
    try {
      const dados = JSON.parse(readFileSync(this.arquivo(), 'utf8')) as unknown;
      if (typeof dados !== 'object' || dados === null) return {};
      return dados as Record<string, CredencialPortal>;
    } catch {
      return {};
    }
  }

  private gravar(mapa: Record<string, CredencialPortal>): void {
    writeFileSync(this.arquivo(), JSON.stringify(mapa, null, 2), 'utf8');
  }

  /** O usuário já tem credencial salva? (gate do "obrigatório salvar antes de preencher"). */
  tem(usuarioId: number): boolean {
    const c = this.ler()[String(usuarioId)];
    return !!(c && c.login && c.senha);
  }

  /** Só o login (seguro de exibir) — vazio se não houver credencial. */
  loginDe(usuarioId: number): string {
    return this.ler()[String(usuarioId)]?.login ?? '';
  }

  /** Uso INTERNO (backend): credencial completa para autenticar no Portal. Nunca serializar
   * isto numa resposta HTTP. */
  obter(usuarioId: number): CredencialPortal | null {
    const c = this.ler()[String(usuarioId)];
    return c && c.login && c.senha ? { login: c.login, senha: c.senha } : null;
  }

  /** Salva/atualiza. Senha em branco NÃO apaga a existente (mesma regra da Disponibilidade):
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
