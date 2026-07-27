import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Projeto } from '../database/entities/projeto.entity';
import { DisponibilidadeService } from '../disponibilidade/disponibilidade.service';
import { ConsultaBdService } from '../disponibilidade/consulta-bd.service';
import { PassosService } from '../passos/passos.service';
import { hojeIso } from '../cronograma/datas.util';
import type { Perfil } from '../common/constants/perfis';
import {
  ClienteSicla,
  NOME_BUSCA_CLIENTE,
  SLUG_BUSCA_CLIENTE,
  SQL_BUSCA_CLIENTE_PADRAO,
} from './clientes-sicla.constants';
import { CadastrarClienteDto } from './dto/cadastrar-cliente.dto';

export interface ResultadoBusca {
  ok: boolean;
  mensagem: string;
  clientes: ClienteSicla[];
}

export interface ResultadoCadastro {
  projetoId: number;
  duplicado: boolean;
}

/** Passo 1 do processo: consulta o cliente no SICLA e cadastra a ficha.
 *
 * Substitui o antigo robô de leitura de e-mail. A consulta reusa o motor Oracle da
 * Disponibilidade (`executarSql`, mesma conexão configurada); o SQL é editável pelo
 * Administrador (consulta nomeada), com um default embutido. O cadastro cria a ficha e
 * conclui o passo 1 — o que dispara o aviso ao Administrativo. */
@Injectable()
export class ClientesSiclaService implements OnModuleInit {
  private readonly logger = new Logger('ClientesSiclaService');

  constructor(
    @InjectRepository(Projeto) private readonly projetos: Repository<Projeto>,
    private readonly disponibilidade: DisponibilidadeService,
    private readonly consultas: ConsultaBdService,
    private readonly passos: PassosService,
  ) {}

  /** Semeia o SQL de busca (idempotente) para o Administrador poder editá-lo na tela de
   * Consultas BD. Não sobrescreve se já existir — respeita edição manual. */
  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === 'test') return;
    try {
      const existe = await this.consultas.porSlug(SLUG_BUSCA_CLIENTE);
      if (!existe) {
        await this.consultas.salvar(SLUG_BUSCA_CLIENTE, {
          nome: NOME_BUSCA_CLIENTE,
          sql: SQL_BUSCA_CLIENTE_PADRAO,
          ordem: 99,
          mostrarGrafico: false,
        });
      }
    } catch (e) {
      this.logger.error(
        'Falha ao semear a consulta de busca de cliente no SICLA',
        e instanceof Error ? e.stack : String(e),
      );
    }
  }

  /** SQL vigente: a versão editada pelo Administrador, ou o default embutido. */
  private async sqlBusca(): Promise<string> {
    const c = await this.consultas.porSlug(SLUG_BUSCA_CLIENTE);
    const sql = (c?.sql ?? '').trim();
    return sql || SQL_BUSCA_CLIENTE_PADRAO;
  }

  async buscar(termoBruto: string): Promise<ResultadoBusca> {
    const termo = (termoBruto ?? '').trim();
    if (termo.length < 2) {
      return {
        ok: false,
        mensagem: 'Digite ao menos 2 caracteres para buscar.',
        clientes: [],
      };
    }
    const sql = await this.sqlBusca();
    const r = await this.disponibilidade.executarSql(
      sql,
      { termo: `%${termo}%` },
      undefined,
      50,
    );
    if (!r.ok) {
      return { ok: false, mensagem: r.mensagem, clientes: [] };
    }
    const clientes = r.linhas.map((row) => this.mapear(row));
    return { ok: true, mensagem: r.mensagem, clientes };
  }

  /** Converte com segurança um valor de coluna (string/número/data) em texto. Objetos
   * inesperados viram vazio, para não cair no '[object Object]'. */
  private texto(v: unknown): string {
    if (v === undefined || v === null) return '';
    if (typeof v === 'string') return v.trim();
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return '';
  }

  /** Traduz uma linha do SICLA para a ficha, escolhendo a coluna por nome (aceita variações
   * comuns). Colunas desconhecidas ficam em `bruto`, sem quebrar. */
  private mapear(row: Record<string, unknown>): ClienteSicla {
    const pega = (...chaves: string[]): string => {
      for (const k of chaves) {
        const t = this.texto(
          row[k] ?? row[k.toUpperCase()] ?? row[k.toLowerCase()],
        );
        if (t !== '') return t;
      }
      return '';
    };
    return {
      codigo: pega('CODIGO', 'COD', 'CODCLIENTE', 'CODIGOCLIENTE'),
      cliente: pega('CLIENTE', 'RAZAO', 'RAZAOSOCIAL', 'NOME', 'DESCRICAO'),
      fantasia: pega('FANTASIA', 'NOMEFANTASIA', 'APELIDO'),
      cnpj: pega('CNPJ', 'CGC', 'CPFCNPJ', 'CNPJCPF'),
      ramo: pega('RAMO', 'ATIVIDADE', 'SEGMENTO'),
      responsavel: pega('RESPONSAVEL', 'RESPONSAVELDES', 'VENDEDOR'),
      contatoNome: pega('CONTATO', 'CONTATONOME', 'NOMECONTATO'),
      contatoEmail: pega('EMAIL', 'CONTATOEMAIL', 'EMAILCONTATO'),
      contatoTel: pega('TELEFONE', 'FONE', 'CONTATOTEL', 'TEL'),
      bruto: row,
    };
  }

  /** Cadastra o cliente: cria a ficha e conclui o passo 1 (o que avisa o Administrativo).
   * Se já houver projeto com o mesmo CNPJ ou nome, não duplica — devolve o existente. */
  async cadastrar(
    dto: CadastrarClienteDto,
    usuario: { nome: string; perfil: Perfil; perfis?: Perfil[] },
  ): Promise<ResultadoCadastro> {
    const cliente = (dto.cliente ?? '').trim();
    const cnpj = (dto.cnpj ?? '').trim();

    const dup = await this.acharSimilar(cliente, cnpj);
    if (dup) return { projetoId: dup, duplicado: true };

    const {
      comercialEmail,
      modulosSelecionados,
      conversoesSelecionadas,
      ...ficha
    } = dto;

    // Módulos marcados no SICLA (passo 1): a lista de CÓDIGOS efetivos alimenta `modulos`
    // (o que os geradores leem); a descrição e a observação de cada item vão para
    // `modulos_detalhe` (JSON). Sem marcação, mantém o `modulos` que veio (texto livre) e
    // deixa o detalhe nulo.
    const temModulos =
      Array.isArray(modulosSelecionados) && modulosSelecionados.length > 0;
    const modulosCodigos = temModulos
      ? modulosSelecionados
          .map((m) => (m.codigo ?? '').trim())
          .filter(Boolean)
          .join(', ')
      : (ficha.modulos ?? '');
    const modulosDetalhe = temModulos
      ? JSON.stringify(
          modulosSelecionados.map((m) => ({
            codigo: (m.codigo ?? '').trim(),
            descricao: (m.descricao ?? '').trim(),
            obs: (m.obs ?? '').trim(),
          })),
        )
      : null;

    // Conversões de dados estimadas (nome + horas). Só grava se houver alguma.
    const temConversoes =
      Array.isArray(conversoesSelecionadas) &&
      conversoesSelecionadas.length > 0;
    const conversoes = temConversoes
      ? JSON.stringify(
          conversoesSelecionadas
            .map((c) => ({
              nome: (c.nome ?? '').trim(),
              horas: (c.horas ?? '').trim(),
            }))
            .filter((c) => c.nome !== ''),
        )
      : null;

    const projeto = await this.projetos.save(
      this.projetos.create({
        ...ficha,
        cliente: cliente || 'Cliente',
        etapa: 'Agendamento',
        situacao: 'Em andamento',
        dataInicio: dto.dataInicio?.trim() || hojeIso(),
        comercialEmail: (comercialEmail ?? '').trim(),
        modulos: modulosCodigos,
        modulosDetalhe,
        conversoes,
      }),
    );

    await this.passos.concluir(
      projeto.id,
      1,
      { nome: usuario.nome, perfil: usuario.perfil, perfis: usuario.perfis },
      'Cliente cadastrado a partir da consulta ao SICLA',
    );

    return { projetoId: projeto.id, duplicado: false };
  }

  /** Anti-duplicação: mesmo CNPJ (quando houver) ou mesmo nome de cliente. */
  private async acharSimilar(
    cliente: string,
    cnpj: string,
  ): Promise<number | null> {
    if (cnpj) {
      const p = await this.projetos.findOne({ where: { cnpj } });
      if (p) return p.id;
    }
    if (cliente) {
      const p = await this.projetos.findOne({ where: { cliente } });
      if (p) return p.id;
    }
    return null;
  }
}
