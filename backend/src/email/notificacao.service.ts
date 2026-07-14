import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { Repository } from 'typeorm';
import { Projeto } from '../database/entities/projeto.entity';
import { Evento } from '../database/entities/evento.entity';
import { UsersService } from '../users/users.service';
import { MailerService } from './mailer.service';

// Espelha webapp/app.py:_EVT_MSG — "%s" é substituído pelo nome do cliente.
const EVT_MSG: Record<string, [string, string]> = {
  fechamento: [
    'Novo fechamento — %s',
    'Novo processo de implantação recebido (%s). Designe o GCI do Levantamento.',
  ],
  levantamento_ok: [
    'Levantamento concluído — %s',
    'O Levantamento de %s foi concluído; siga para o Projeto.',
  ],
  projeto_ok: [
    'Projeto gerado — %s',
    'O Projeto de %s foi gerado. Designe os Consultores da implantação.',
  ],
  cronograma_ok: ['Cronograma concluído — %s', 'O Cronograma de %s foi concluído.'],
  checklist_ok: ['Check-list concluído — %s', 'O Check-list de %s foi concluído.'],
  termo_ok: [
    'Termo de Encerramento — %s',
    'O Termo de Encerramento de %s foi gerado.',
  ],
  encerrado: ['Implantação encerrada — %s', 'A implantação de %s foi encerrada.'],
};

export type EventoNotificacao = keyof typeof EVT_MSG;

/** Dispatcher central de notificação por e-mail — espelha webapp/app.py
 * (_notificar/_notificar_sync/_notificar_evento/_emails_coordenacao/_digest_destinos).
 * Diferença deliberada: o Flask original dispara `_notificar_sync` numa thread daemon
 * para não bloquear a requisição (SMTP pode travar) — em Node isso não é necessário
 * (I/O já é assíncrono/não-bloqueante); aqui só não se dá `await` no envio fora de
 * teste, mesmo efeito (a resposta HTTP não espera o e-mail sair) sem precisar de
 * thread. */
@Injectable()
export class NotificacaoService {
  private readonly logger = new Logger('NotificacaoService');

  constructor(
    @InjectRepository(Projeto) private readonly projetos: Repository<Projeto>,
    @InjectRepository(Evento) private readonly eventos: Repository<Evento>,
    private readonly mailer: MailerService,
    private readonly users: UsersService,
  ) {}

  private digestDestinos(): string[] {
    const v =
      process.env.MIGRACAO_DIGEST_PARA ??
      (existsSync(join(process.cwd(), 'dados', 'digest_para.txt'))
        ? readFileSync(join(process.cwd(), 'dados', 'digest_para.txt'), 'utf8')
        : '');
    return (v || '')
      .split(/[;,\n]/)
      .map((e) => e.trim())
      .filter(Boolean);
  }

  async emailsCoordenacao(): Promise<string[]> {
    const [adm, coord] = await Promise.all([
      this.users.porPerfil('ADM'),
      this.users.porPerfil('Coordenador'),
    ]);
    const emails = [...adm, ...coord].map((u) => u.login).filter(Boolean);
    return emails.length > 0 ? emails : this.digestDestinos();
  }

  private async notificarSync(
    projetoId: number,
    emails: string[],
    assunto: string,
    corpo: string,
    autor: string,
  ): Promise<void> {
    let ok = false;
    let erro = 'e-mail não configurado';
    try {
      if (this.mailer.configurado()) {
        const r = await this.mailer.enviar(emails, assunto, corpo);
        ok = r.ok;
        erro = r.erro ?? '';
      }
    } catch (e) {
      ok = false;
      erro = e instanceof Error ? `${e.constructor.name}: ${e.message}` : String(e);
    }
    try {
      const descricao = ok
        ? `Notificou ${emails.join(', ')} — ${assunto}`
        : `Notificação pendente (${assunto}): ${erro || '?'}`;
      await this.eventos.save(
        this.eventos.create({ projetoId, tipo: 'email', descricao, autor }),
      );
    } catch (e) {
      this.logger.error(
        `Falha ao registrar evento de e-mail (projetoId=${projetoId})`,
        e instanceof Error ? e.stack : String(e),
      );
    }
  }

  /** Notifica por e-mail e registra na timeline sem bloquear o chamador (não aguardado
   * fora de teste — o envio + registro do evento roda em segundo plano). */
  async notificar(
    projetoId: number,
    emails: string[],
    assunto: string,
    corpo: string,
    autor = '',
  ): Promise<void> {
    const destinos = emails.filter(Boolean);
    if (destinos.length === 0) return;
    const tarefa = this.notificarSync(projetoId, destinos, assunto, corpo, autor);
    if (process.env.NODE_ENV === 'test') {
      await tarefa; // determinístico em teste, mesmo padrão de app.testing no Flask
    } else {
      tarefa.catch((e) => {
        this.logger.error('notificarSync falhou', e instanceof Error ? e.stack : String(e));
      });
    }
  }

  /** Dispara a notificação padrão (à Coordenação) de um evento do fluxo. */
  async notificarEvento(
    projetoId: number,
    evento: EventoNotificacao,
    proj?: Partial<Projeto> | null,
  ): Promise<void> {
    const par = EVT_MSG[evento];
    if (!par) return;
    let cliente = proj?.cliente;
    if (cliente === undefined) {
      const p = await this.projetos.findOne({ where: { id: projetoId } });
      cliente = p?.cliente ?? '';
    }
    const [assuntoTpl, corpoTpl] = par;
    const assunto = assuntoTpl.replace('%s', cliente || '');
    const corpo = `${corpoTpl.replace('%s', cliente || '')}\n\n— Painel de Implantação`;
    const destinos = await this.emailsCoordenacao();
    await this.notificar(projetoId, destinos, assunto, corpo);
  }
}
