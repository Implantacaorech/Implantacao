import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Projeto } from '../database/entities/projeto.entity';
import { Documento } from '../database/entities/documento.entity';
import { Evento } from '../database/entities/evento.entity';
import { Designacao } from '../database/entities/designacao.entity';
import { UsersService } from '../users/users.service';
import { MailerService } from '../email/mailer.service';
import { MetricasService, DocLeve } from '../metricas/metricas.service';
import { PassosService } from '../passos/passos.service';
// Antes havia uma cópia local desta função, em UTC — mesma falha corrigida em datas.util.
import { hojeIso } from '../cronograma/datas.util';

export interface DefinirGciView {
  gciAtual: string;
  gcis: string[];
}

export interface AgendarView {
  gci: string;
  dataLevantamento: string;
  hojeIso: string;
}

export interface ConsultoresView {
  modulos: string[];
  consultores: string[];
  atuais: Record<string, string>;
}

function formatBr(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function parseModulos(modulos: string): string[] {
  return (modulos || '')
    .split(/[,;\n]+/)
    .map((m) => m.trim())
    .filter(Boolean);
}

/** Fluxo de Designação (GCI/consultor por projeto — distinto do técnico por visita do
 * Agendador): Etapas 2/5 (Administrativo agenda o Levantamento e define o GCI) e Etapa 6
 * (GCI designa os Consultores da implantação), com notificação por e-mail e avanço
 * automático de etapa quando o gate seguinte já está satisfeito. Espelha
 * webapp/routes_designacao.py:projeto_definir_gci/projeto_agendar/projeto_consultores — a
 * rota combinada `projeto_designar` não foi portada por estar morta no Flask original
 * (nenhum template linka para ela). */
@Injectable()
export class DesignacaoService {
  constructor(
    @InjectRepository(Projeto) private readonly projetos: Repository<Projeto>,
    @InjectRepository(Documento)
    private readonly documentos: Repository<Documento>,
    @InjectRepository(Evento) private readonly eventos: Repository<Evento>,
    @InjectRepository(Designacao)
    private readonly designacoes: Repository<Designacao>,
    private readonly users: UsersService,
    private readonly mailer: MailerService,
    private readonly metricas: MetricasService,
    private readonly passos: PassosService,
  ) {}

  private async buscarProjeto(id: number): Promise<Projeto> {
    const p = await this.projetos.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Projeto não encontrado.');
    return p;
  }

  private async docsDoProjeto(projetoId: number): Promise<DocLeve[]> {
    return (await this.documentos.find({ where: { projetoId } })).map((d) => ({
      tipo: d.tipo,
    }));
  }

  private async registrarEvento(
    projetoId: number,
    descricao: string,
    autor: string,
  ): Promise<void> {
    await this.eventos.save(
      this.eventos.create({ projetoId, tipo: 'etapa', descricao, autor }),
    );
  }

  /** Avança a etapa automaticamente (quando o gate seguinte já está ok) e registra um
   * evento por transição — mesmo texto/autor "sistema" de webapp/app.py:_auto_avancar. */
  private async autoAvancar(projeto: Projeto): Promise<void> {
    const docs = await this.docsDoProjeto(projeto.id);
    const transicoes = this.metricas.autoAvancar(projeto, docs);
    for (const t of transicoes) {
      await this.registrarEvento(
        projeto.id,
        `Avançou automaticamente: ${t.etapaAnterior} → ${t.etapaNova}`,
        'sistema',
      );
    }
    if (transicoes.length > 0) await this.projetos.save(projeto);
  }

  // --- Etapa 5 (Administrativo): definir o(s) GCI(s) ---

  async obterDefinirGci(projetoId: number): Promise<DefinirGciView> {
    const projeto = await this.buscarProjeto(projetoId);
    const gcis = await this.users.porPerfil('GCI');
    return { gciAtual: projeto.gci, gcis: gcis.map((u) => u.nome) };
  }

  async definirGci(
    projetoId: number,
    gcisSelecionados: string[],
    autor: string,
  ): Promise<Projeto> {
    const nomes = [
      ...new Set(gcisSelecionados.map((n) => n.trim()).filter(Boolean)),
    ];
    if (nomes.length === 0)
      throw new BadRequestException('Selecione ao menos um GCI.');
    const projeto = await this.buscarProjeto(projetoId);
    projeto.gci = nomes.join(', ');
    await this.projetos.save(projeto);
    await this.registrarEvento(
      projetoId,
      `GCI(s) definido(s): ${projeto.gci}`,
      autor,
    );
    // Sem notificação aqui de propósito — só quando a data é confirmada (etapa seguinte),
    // igual webapp/routes_designacao.py:projeto_definir_gci.
    return projeto;
  }

  // --- Etapa 2 (Administrativo): agendar a data do Levantamento ---

  async obterAgendar(projetoId: number): Promise<AgendarView> {
    const projeto = await this.buscarProjeto(projetoId);
    return {
      gci: projeto.gci,
      dataLevantamento: projeto.dataLevantamento,
      hojeIso: hojeIso(),
    };
  }

  async agendar(
    projetoId: number,
    dataLevantamento: string,
    autor: string,
    levantadores: string[] = [],
  ): Promise<Projeto> {
    const projeto = await this.buscarProjeto(projetoId);
    if (!this.metricas.gciDefinido(projeto)) {
      throw new BadRequestException(
        'Defina o GCI antes de agendar o levantamento.',
      );
    }
    const hoje = hojeIso();
    if (!dataLevantamento || dataLevantamento < hoje) {
      throw new BadRequestException(
        'Informe uma data válida (hoje ou futura).',
      );
    }
    projeto.dataLevantamento = dataLevantamento;
    await this.projetos.save(projeto);
    // A data é única (a visita é a mesma), mas os levantadores podem ser vários.
    if (levantadores.length > 0) {
      await this.passos.definirPessoas(projetoId, 'levantador', levantadores);
    }
    await this.registrarEvento(
      projetoId,
      `Data do Levantamento definida: ${formatBr(dataLevantamento)} (GCI: ${projeto.gci})`,
      autor,
    );

    const nomes = projeto.gci
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean);
    const emails = (
      await Promise.all(nomes.map((n) => this.users.emailDoUsuario(n)))
    ).filter((e): e is string => !!e);
    if (emails.length > 0) {
      await this.mailer.enviar(
        emails,
        `Levantamento agendado — ${projeto.cliente}`,
        `O levantamento do cliente ${projeto.cliente} foi agendado para ${formatBr(dataLevantamento)}.`,
      );
    }

    await this.autoAvancar(projeto);
    return projeto;
  }

  // --- Etapa 6 (GCI): designar os Consultores por módulo ---

  async obterConsultores(projetoId: number): Promise<ConsultoresView> {
    const projeto = await this.buscarProjeto(projetoId);
    const modulos = parseModulos(projeto.modulos);
    const consultores = await this.users.porPerfil('Consultor');
    const atuaisLista = await this.designacoes.find({ where: { projetoId } });
    const atuais = Object.fromEntries(
      atuaisLista.map((d) => [d.modulo, d.consultor]),
    );
    return { modulos, consultores: consultores.map((u) => u.nome), atuais };
  }

  async designarConsultores(
    projetoId: number,
    designacoesPorModulo: Record<string, string>,
    autor: string,
  ): Promise<Projeto> {
    const projeto = await this.buscarProjeto(projetoId);
    const modulos = parseModulos(projeto.modulos);
    const linhas = modulos
      .map((m) => ({
        modulo: m,
        consultor: (designacoesPorModulo[m] || '').trim(),
      }))
      .filter((d) => d.consultor);
    if (linhas.length === 0) {
      throw new BadRequestException('Designe ao menos um consultor.');
    }

    // Apaga tudo e reinsere — mesmo padrão de webapp/routes_designacao.py:
    // projeto_consultores. NÃO toca em AtividadeCronograma (diferente de
    // DesignacoesService.tecnicoModulo, que existe para o fluxo do Agendador).
    await this.designacoes.delete({ projetoId });
    await this.designacoes.save(
      linhas.map((d) =>
        this.designacoes.create({
          projetoId,
          modulo: d.modulo,
          consultor: d.consultor,
        }),
      ),
    );
    const nomes = [...new Set(linhas.map((d) => d.consultor))].sort();
    projeto.consultor = nomes.join(', ');
    const concluido = projeto.situacao === 'Concluído';
    await this.projetos.save(projeto);

    // Além da designação POR MÓDULO (acima), grava o vínculo por PAPEL — é a fonte da
    // verdade de "quem são os consultores do projeto" desde a revisão de 2026-07-22, e é
    // ela que os e-mails dos passos consultam. `Projeto.consultor` segue como espelho.
    await this.passos.definirPessoas(projetoId, 'consultor', nomes);
    await this.registrarEvento(
      projetoId,
      `Consultores designados: ${projeto.consultor}`,
      autor,
    );

    // Sem e-mail se o projeto já está Concluído — reatribuições pós-encerramento não
    // devem spammar o consultor. Espelha webapp/routes_designacao.py:projeto_consultores.
    if (!concluido) {
      const porConsultor = new Map<string, string[]>();
      for (const d of linhas) {
        const lista = porConsultor.get(d.consultor) ?? [];
        lista.push(d.modulo);
        porConsultor.set(d.consultor, lista);
      }
      for (const [consultor, mods] of porConsultor) {
        const email = await this.users.emailDoUsuario(consultor);
        if (email) {
          await this.mailer.enviar(
            email,
            `Implantação designada — ${projeto.cliente}`,
            `Você foi designado(a) como consultor(a) do cliente ${projeto.cliente} para o(s) módulo(s): ${mods.join(', ')}.`,
          );
        }
      }
    }

    await this.autoAvancar(projeto);
    return projeto;
  }
}
