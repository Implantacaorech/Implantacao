import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import { join } from 'path';
import { AppConfig } from '../config/configuration';

interface RespostaCli {
  ok: boolean;
  data?: unknown;
  erro?: string;
}

/** Ponte de subprocesso para webapp/legado_cli.py — mantém o assistente administrativo
 * legado (roles/cliente/criar-templates/verbal/saúde/action) fora do docservice, cujo
 * escopo documentado (docs/migracao/02-decisao-arquitetura.md) é só geração fiel +
 * transcrição. Nenhuma lógica de geração é reescrita aqui: webapp/runner.py, roles.py e
 * forms.py rodam tal como são, só trocando Flask request/session por um payload JSON. */
@Injectable()
export class LegadoCliService {
  private readonly logger = new Logger('LegadoCliService');

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  async executar<T = unknown>(acao: string, payload: Record<string, unknown> = {}): Promise<T> {
    const webappDir = this.config.get('legadoWebappDir', { infer: true });
    const pythonExe = this.config.get('legadoPythonExe', { infer: true });
    const script = join(webappDir, 'legado_cli.py');
    const entrada = JSON.stringify({ acao, ...payload });

    const resposta = await new Promise<RespostaCli>((resolve, reject) => {
      const proc = spawn(pythonExe, ['-X', 'utf8', script], {
        cwd: webappDir,
        env: { ...process.env, PYTHONUTF8: '1' },
      });
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (d: Buffer) => (stdout += d.toString('utf8')));
      proc.stderr.on('data', (d: Buffer) => (stderr += d.toString('utf8')));
      proc.on('error', reject);
      proc.on('close', () => {
        const linha = stdout.trim().split('\n').pop() ?? '';
        try {
          resolve(JSON.parse(linha) as RespostaCli);
        } catch {
          this.logger.error(`legado_cli (${acao}) não devolveu JSON válido. stderr: ${stderr}`);
          reject(new InternalServerErrorException('Falha ao executar o gerador legado.'));
        }
      });
      proc.stdin.write(Buffer.from(entrada, 'utf8'));
      proc.stdin.end();
    });

    if (!resposta.ok) {
      this.logger.warn(`legado_cli (${acao}) devolveu erro: ${resposta.erro}`);
      throw new InternalServerErrorException(resposta.erro || 'Falha ao executar o gerador legado.');
    }
    return resposta.data as T;
  }
}
