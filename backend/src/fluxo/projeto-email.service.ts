import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Projeto } from '../database/entities/projeto.entity';
import { DocumentosService } from '../documentos/documentos.service';
import { MailerService } from '../email/mailer.service';
import { ModeloEmailService } from '../email/modelo-email.service';

export interface ModeloEmailRenderizado {
  nome: string;
  assunto: string;
  corpo: string;
}

export interface TelaEmailProjeto {
  cliente: string;
  destinoPadrao: string;
  configurado: boolean;
  tpls: Record<string, ModeloEmailRenderizado>;
}

export interface ResultadoEnvioEmailProjeto {
  enviado: boolean;
  erro?: string;
}

/** E-mail avulso a partir da ficha do projeto — espelha
 * webapp/routes_fluxo.py:projeto_email. Qualquer usuário autenticado pode enviar (sem
 * `pode_ver` adicional, mesmo padrão do Flask original). */
@Injectable()
export class ProjetoEmailService {
  constructor(
    @InjectRepository(Projeto) private readonly projetos: Repository<Projeto>,
    private readonly modelos: ModeloEmailService,
    private readonly mailer: MailerService,
    private readonly documentos: DocumentosService,
  ) {}

  private async buscar(projetoId: number): Promise<Projeto> {
    const p = await this.projetos.findOne({ where: { id: projetoId } });
    if (!p) throw new NotFoundException('Projeto não encontrado.');
    return p;
  }

  async dadosTela(projetoId: number): Promise<TelaEmailProjeto> {
    const p = await this.buscar(projetoId);
    const modelosAtivos = await this.modelos.listar(true);
    const tpls: Record<string, ModeloEmailRenderizado> = {};
    for (const m of modelosAtivos) {
      tpls[String(m.id)] = {
        nome: m.nome,
        assunto: this.modelos.renderizar(m.assunto, p),
        corpo: this.modelos.renderizar(m.corpo, p),
      };
    }
    return {
      cliente: p.cliente,
      destinoPadrao: p.contatoEmail || '',
      configurado: this.mailer.configurado(),
      tpls,
    };
  }

  async enviar(
    projetoId: number,
    destino: string,
    assunto: string,
    corpo: string,
    autor: string,
  ): Promise<ResultadoEnvioEmailProjeto> {
    await this.buscar(projetoId);
    if (!this.mailer.configurado())
      return { enviado: false, erro: 'SMTP não configurado.' };
    const destinoLimpo = (destino || '').trim();
    if (!destinoLimpo)
      return { enviado: false, erro: 'Informe o destinatário.' };

    const r = await this.mailer.enviar(destinoLimpo, assunto, corpo);
    await this.documentos.registrarEvento(
      projetoId,
      'email',
      r.ok
        ? `E-mail enviado a ${destinoLimpo} — ${assunto}`
        : `Falha ao enviar e-mail a ${destinoLimpo}: ${r.erro}`,
      autor,
    );
    return r.ok
      ? { enviado: true }
      : { enviado: false, erro: r.erro ?? undefined };
  }
}
