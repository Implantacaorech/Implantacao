import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppConfig } from '../config/configuration';
import { Projeto } from '../database/entities/projeto.entity';
import { Documento } from '../database/entities/documento.entity';
import { MetricasService } from '../metricas/metricas.service';
import { MailerService } from '../email/mailer.service';
import { construirDocsMap } from '../painel/docs-map.util';

export interface ResultadoDigest {
  ok: boolean;
  mensagem: string;
}

/** Resumo diário da Coordenação (KPIs + alertas) por e-mail. Espelha
 * webapp/app.py:_digest_destinos/_montar_digest/enviar_digest. */
@Injectable()
export class DigestService {
  constructor(
    @InjectRepository(Projeto) private readonly projetos: Repository<Projeto>,
    @InjectRepository(Documento)
    private readonly documentos: Repository<Documento>,
    private readonly metricas: MetricasService,
    private readonly mailer: MailerService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /** Lista de e-mails do `MIGRACAO_DIGEST_PARA` (separados por `;`, `,` ou quebra de
   * linha). Espelha webapp/app.py:_digest_destinos (sem o fallback de arquivo — ver
   * comentário em configuration.ts). */
  destinos(): string[] {
    const bruto = this.config.get('digestPara', { infer: true }) ?? '';
    return bruto
      .split(/[;,\n]/)
      .map((e) => e.trim())
      .filter(Boolean);
  }

  private async montarDigest(): Promise<{ assunto: string; corpo: string }> {
    const projetos = await this.projetos.find();
    const docsMap = construirDocsMap(await this.documentos.find());
    const m = this.metricas.metricas(projetos, docsMap);
    const alertas = this.metricas.alertas(projetos, docsMap);

    const linhas = [
      'Resumo diário — Implantação',
      '='.repeat(30),
      '',
      `Ativos: ${m.ativos}  ·  No prazo: ${m.noPrazo}  ·  Atrasados: ${m.nAtrasados}  ·  Em risco: ${m.nRisco}`,
      `Documentos obrigatórios pendentes: ${m.gatePendente}`,
      '',
    ];
    if (alertas.length > 0) {
      linhas.push(`Alertas (${alertas.length}):`);
      linhas.push(
        ...alertas
          .slice(0, 30)
          .map((a) => `  [${a.nivel.toUpperCase()}] ${a.cliente} — ${a.msg}`),
      );
    } else {
      linhas.push('Sem alertas no momento.');
    }
    linhas.push('', '— Painel de Implantação · Rech');

    const hoje = new Date();
    const dataBr = `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`;
    return {
      assunto: `Resumo diário da Implantação — ${dataBr}`,
      corpo: linhas.join('\n'),
    };
  }

  async enviar(): Promise<ResultadoDigest> {
    const destinos = this.destinos();
    if (destinos.length === 0) {
      return {
        ok: false,
        mensagem: 'Sem destinatários (defina MIGRACAO_DIGEST_PARA).',
      };
    }
    if (!this.mailer.configurado()) {
      return { ok: false, mensagem: 'E-mail não configurado.' };
    }
    const { assunto, corpo } = await this.montarDigest();
    const r = await this.mailer.enviar(destinos, assunto, corpo);
    return {
      ok: r.ok,
      mensagem: r.ok ? 'Digest enviado.' : (r.erro ?? 'Falha ao enviar.'),
    };
  }
}
