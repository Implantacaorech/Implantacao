import { Injectable } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';

/** Chave/modelo da API Claude (Anthropic) — usada pela análise de IA dos Protocolos de
 * Treinamento (ver `ProtocoloIaService`). Espelha tools/ia.py (get_key/salvar_key/
 * disponivel): variável de ambiente primeiro, senão um arquivo local em `dados/`
 * (gravado pela tela Config → IA) — nunca no banco. Sem chave, a análise fica
 * indisponível e o pipeline falha com uma mensagem clara (ver ProcessamentoService). */
@Injectable()
export class IaService {
  readonly modelo =
    process.env.MIGRACAO_ANTHROPIC_MODELO ?? 'claude-opus-4-8';

  private arquivoChave(): string {
    // Isolado por JEST_WORKER_ID em teste — mesmo motivo/mesma corrida (EBUSY) já
    // corrigida em modelo-documento.service.ts:store(): specs e2e em processos Jest
    // paralelos não podem compartilhar este caminho real em disco.
    if (process.env.NODE_ENV === 'test') {
      return join(
        process.cwd(),
        'dados',
        `anthropic_key_test_${process.env.JEST_WORKER_ID ?? '0'}.txt`,
      );
    }
    return join(process.cwd(), 'dados', 'anthropic_key.txt');
  }

  viaEnv(): boolean {
    return Boolean(
      process.env.MIGRACAO_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY,
    );
  }

  obterChave(): string {
    const viaEnv =
      process.env.MIGRACAO_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY;
    if (viaEnv) return viaEnv.trim();
    try {
      return readFileSync(this.arquivoChave(), 'utf8').trim();
    } catch {
      return '';
    }
  }

  salvarChave(valor: string | undefined): void {
    const v = (valor ?? '').trim();
    mkdirSync(join(process.cwd(), 'dados'), { recursive: true });
    if (v) {
      writeFileSync(this.arquivoChave(), v, 'utf8');
    } else if (existsSync(this.arquivoChave())) {
      rmSync(this.arquivoChave());
    }
  }

  disponivel(): boolean {
    return Boolean(this.obterChave());
  }
}
