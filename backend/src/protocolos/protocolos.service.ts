import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { closeSync, openSync, readSync, statSync } from 'fs';
import { basename } from 'path';
import { Repository } from 'typeorm';
import {
  Protocolo,
  StatusProtocolo,
  VideoOrigem,
} from '../database/entities/protocolo.entity';
import { CampoTextoProtocolo } from './protocolos.constants';

export interface FiltroProtocolos {
  modulo?: string;
  menu?: string;
  status?: string;
  q?: string;
  origem?: string;
  cliente?: string;
  /** Restringe a lista ao material desta pessoa (+ o do robô do SharePoint, que não tem
   * dono). Definido pelo controller a partir do usuário logado — nunca vem da tela. Ver
   * protocolos.acesso.ts. */
  apenasDe?: string;
}

export interface DadosGravacao {
  titulo: string;
  projetoId: number | null;
  cliente: string;
  clienteCodigo: string;
  vocabulario: string;
  participantes: number;
  responsavel: string;
  /** Frase que descreve a captura ("microfone (reunião presencial)"...) — vai no histórico. */
  fonte: string;
}

/** CRUD + regras de negócio simples do Protocolo (dedup por hash, histórico, edição,
 * decisão de aprovação). A orquestração do pipeline (transcrição + IA) fica em
 * `ProcessamentoProtocolosService` — este serviço só mexe na linha do banco. Espelha as
 * funções `protocolo_*` de webapp/db.py. */
@Injectable()
export class ProtocolosService {
  constructor(
    @InjectRepository(Protocolo)
    private readonly repo: Repository<Protocolo>,
  ) {}

  /** Hash rápido p/ dedup: nome + tamanho + primeiro 1 MB do arquivo — mesmo algoritmo de
   * webapp/db.py:protocolo_hash (não é um hash do arquivo inteiro, de propósito: rápido
   * mesmo em vídeos de vários GB). */
  hash(caminho: string): string {
    const h = createHash('md5');
    h.update(basename(caminho), 'utf8');
    try {
      const tamanho = statSync(caminho).size;
      h.update(String(tamanho));
      const fd = openSync(caminho, 'r');
      try {
        const buf = Buffer.alloc(1024 * 1024);
        const lidos = readSync(fd, buf, 0, buf.length, 0);
        h.update(buf.subarray(0, lidos));
      } finally {
        closeSync(fd);
      }
    } catch {
      // Arquivo inacessível/removido — segue só com nome (mesmo fallback silencioso do
      // Flask original, que também ignora OSError aqui).
    }
    return h.digest('hex');
  }

  private historico(p: Protocolo, acao: string, autor = ''): void {
    const agora = new Date();
    const dd = String(agora.getDate()).padStart(2, '0');
    const mm = String(agora.getMonth() + 1).padStart(2, '0');
    const yyyy = agora.getFullYear();
    const hh = String(agora.getHours()).padStart(2, '0');
    const min = String(agora.getMinutes()).padStart(2, '0');
    const linha = `${dd}/${mm}/${yyyy} ${hh}:${min} | ${autor || 'sistema'} | ${acao}`;
    p.historico = ((p.historico || '') + '\n' + linha).trim();
  }

  /** Cria o registro do vídeo (status Pendente). Dedup por hash: devolve o existente se o
   * mesmo vídeo já foi registrado (novo=false). */
  async criar(
    videoNome: string,
    caminho: string,
    origem: VideoOrigem,
    responsavel = '',
  ): Promise<{ id: number; novo: boolean }> {
    const vh = this.hash(caminho);
    const existente = await this.repo.findOne({ where: { videoHash: vh } });
    if (existente) return { id: existente.id, novo: false };

    const p = this.repo.create({
      videoNome,
      videoCaminho: caminho,
      videoOrigem: origem,
      videoHash: vh,
      responsavel,
    });
    this.historico(p, `Vídeo registrado (${origem}).`, responsavel);
    const salvo = await this.repo.save(p);
    return { id: salvo.id, novo: true };
  }

  /** Abre o registro de uma reunião que COMEÇA AGORA a ser gravada (status 'Gravando').
   * Diferente de `criar`: aqui ainda não existe arquivo nenhum — o .wav só nasce quando a
   * gravação é encerrada, e é nessa hora que `videoNome`/`videoCaminho`/`videoHash` são
   * preenchidos. Por isso também não há dedup por hash: cada reunião é única. */
  async criarGravacao(dados: DadosGravacao): Promise<Protocolo> {
    const p = this.repo.create({
      titulo: dados.titulo,
      projetoId: dados.projetoId,
      cliente: dados.cliente,
      clienteCodigo: dados.clienteCodigo,
      vocabulario: dados.vocabulario,
      participantes: dados.participantes,
      videoOrigem: 'gravacao',
      status: 'Gravando',
      responsavel: dados.responsavel,
    });
    this.historico(
      p,
      `Gravação de reunião iniciada — captura: ${dados.fonte}.` +
        (dados.cliente ? ` Cliente: ${dados.cliente}.` : ''),
      dados.responsavel,
    );
    return this.repo.save(p);
  }

  async buscarPorId(id: number): Promise<Protocolo> {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Protocolo não encontrado.');
    return p;
  }

  async buscar(id: number): Promise<Protocolo | null> {
    return this.repo.findOne({ where: { id } });
  }

  /** Consulta da base de conhecimento, com filtros; mais recentes primeiro. Espelha
   * webapp/db.py:protocolos_listar. */
  async listar(filtro: FiltroProtocolos): Promise<Protocolo[]> {
    const qb = this.repo.createQueryBuilder('p').orderBy('p.criadoEm', 'DESC');
    if (filtro.modulo)
      qb.andWhere('p.modulo = :modulo', { modulo: filtro.modulo });
    if (filtro.status)
      qb.andWhere('p.status = :status', { status: filtro.status });
    if (filtro.origem)
      qb.andWhere('p.videoOrigem = :origem', { origem: filtro.origem });
    if (filtro.menu)
      qb.andWhere('LOWER(p.menu) LIKE :menu', {
        menu: `%${filtro.menu.toLowerCase()}%`,
      });
    if (filtro.cliente)
      qb.andWhere('LOWER(p.cliente) LIKE :cliente', {
        cliente: `%${filtro.cliente.toLowerCase()}%`,
      });
    if (filtro.apenasDe)
      qb.andWhere(
        "(p.responsavel = :apenasDe OR p.videoOrigem = 'sharepoint')",
        { apenasDe: filtro.apenasDe },
      );
    if (filtro.q) {
      qb.andWhere(
        '(LOWER(p.titulo) LIKE :q OR LOWER(p.assunto) LIKE :q OR LOWER(p.resumo) LIKE :q ' +
          'OR LOWER(p.passoAPasso) LIKE :q OR LOWER(p.configuracoes) LIKE :q ' +
          'OR LOWER(p.regrasNegocio) LIKE :q OR LOWER(p.dependencias) LIKE :q ' +
          'OR LOWER(p.menusAbordados) LIKE :q OR LOWER(p.funcionalidades) LIKE :q ' +
          'OR LOWER(p.definicoes) LIKE :q OR LOWER(p.processos) LIKE :q ' +
          'OR LOWER(p.resumoTecnico) LIKE :q OR LOWER(p.resumoCompleto) LIKE :q)',
        { q: `%${filtro.q.toLowerCase()}%` },
      );
    }
    return qb.getMany();
  }

  /** Clientes que têm ao menos um protocolo COM transcrição — alimenta o seletor de cliente
   * do "Preencher protocolo" (Portal Rech). Agrupa por `cliente`/`clienteCodigo` e conta
   * quantos. Respeita o mesmo recorte por dono da listagem (`apenasDe`): quem não é ADM só
   * vê os clientes do próprio material (+ o do robô do SharePoint). */
  async clientesComProtocolo(
    apenasDe?: string,
  ): Promise<{ cliente: string; clienteCodigo: string; total: number }[]> {
    const qb = this.repo
      .createQueryBuilder('p')
      .select('p.cliente', 'cliente')
      .addSelect('p.clienteCodigo', 'clienteCodigo')
      .addSelect('COUNT(*)', 'total')
      .where('p.transcricao <> :vazio', { vazio: '' })
      .andWhere("p.cliente <> ''")
      .groupBy('p.cliente')
      .addGroupBy('p.clienteCodigo')
      .orderBy('p.cliente', 'ASC');
    if (apenasDe) {
      qb.andWhere(
        "(p.responsavel = :apenasDe OR p.videoOrigem = 'sharepoint')",
        { apenasDe },
      );
    }
    const linhas = await qb.getRawMany<{
      cliente: string;
      clienteCodigo: string;
      total: string | number;
    }>();
    return linhas.map((l) => ({
      cliente: l.cliente,
      clienteCodigo: l.clienteCodigo,
      total: Number(l.total),
    }));
  }

  /** Gravações e vídeos ligados a um projeto, mais recentes primeiro — é a lista que o
   * Levantamento oferece para sugerir respostas a partir da reunião.
   *
   * Casa por `projetoId` **ou** pelo nome do cliente, e o "ou" é o ponto: a gravação de
   * reunião escolhe o cliente pela busca no SICLA, que acontece ANTES de a ficha do projeto
   * existir (`Protocolo.projetoId` fica nulo nesses casos — ver protocolo.entity.ts). Casar
   * só pelo id deixaria de fora justamente a reunião de levantamento, que é a mais provável
   * de ter acontecido antes do cadastro.
   *
   * Só devolve o que tem transcrição: sem texto não há o que sugerir. */
  async listarDoProjeto(projetoId: number, cliente = ''): Promise<Protocolo[]> {
    const qb = this.repo
      .createQueryBuilder('p')
      .where('p.transcricao <> :vazio', { vazio: '' })
      .orderBy('p.criadoEm', 'DESC');
    const nome = (cliente || '').trim().toLowerCase();
    if (nome) {
      qb.andWhere('(p.projetoId = :projetoId OR LOWER(p.cliente) = :cliente)', {
        projetoId,
        cliente: nome,
      });
    } else {
      qb.andWhere('p.projetoId = :projetoId', { projetoId });
    }
    return qb.getMany();
  }

  async atualizarStatus(
    id: number,
    status: StatusProtocolo,
    erro?: string,
    autor = '',
  ): Promise<boolean> {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) return false;
    p.status = status;
    if (erro !== undefined) p.logErro = erro.slice(0, 2000);
    if (status === 'Em revisão') p.processadoEm = new Date();
    this.historico(
      p,
      `Status: ${status}${erro ? ' — ' + erro.slice(0, 120) : ''}`,
      autor,
    );
    await this.repo.save(p);
    return true;
  }

  /** Acrescenta uma linha ao histórico sem mexer em mais nada (usado por fluxos que já
   * atualizaram o registro e só precisam registrar o que aconteceu). */
  async salvarHistorico(id: number, acao: string, autor = ''): Promise<void> {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) return;
    this.historico(p, acao, autor);
    await this.repo.save(p);
  }

  /** Salva a edição humana da tela de revisão (campos de conteúdo). */
  async salvarEdicao(
    id: number,
    campos: Partial<Record<CampoTextoProtocolo, string>>,
    autor = '',
  ): Promise<boolean> {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) return false;
    for (const [campo, valor] of Object.entries(campos)) {
      if (valor !== undefined) {
        (p as unknown as Record<string, string>)[campo] = (valor || '').trim();
      }
    }
    this.historico(p, 'Edição salva na revisão.', autor);
    await this.repo.save(p);
    return true;
  }

  /** Aprova (publica na base) ou reprova (volta p/ ajuste) o protocolo. */
  async decidir(id: number, aprovado: boolean, autor = ''): Promise<boolean> {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) return false;
    if (aprovado) {
      p.status = 'Aprovado';
      p.aprovador = autor;
      p.aprovadoEm = new Date();
      this.historico(p, 'APROVADO — publicado na base de conhecimento.', autor);
    } else {
      p.status = 'Reprovado / Ajustar';
      this.historico(p, 'Reprovado — devolvido para ajuste.', autor);
    }
    await this.repo.save(p);
    return true;
  }

  /** Atualiza campos arbitrários (usado pelo processamento: transcrição, campos da IA,
   * caminho do vídeo após mover de pasta) sem duplicar a lógica de histórico. */
  async atualizar(id: number, dados: Partial<Protocolo>): Promise<void> {
    await this.repo.update(id, dados);
  }

  /** Exclui o registro. Devolve a linha apagada (para o controller apagar o arquivo
   * correspondente no disco) ou null se não existia. */
  async excluir(id: number): Promise<Protocolo | null> {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) return null;
    await this.repo.delete(id);
    return p;
  }
}
