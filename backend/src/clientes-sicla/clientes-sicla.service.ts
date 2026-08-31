import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Projeto } from '../database/entities/projeto.entity';
import { DadosService } from '../dados/dados.service';
import { PassosService } from '../passos/passos.service';
import { hojeIso } from '../cronograma/datas.util';
import type { Perfil } from '../common/constants/perfis';
import { ClienteSicla } from './clientes-sicla.constants';
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
 * Substitui o antigo robô de leitura de e-mail. A busca pede a consulta
 * `sicla.clientes.buscar` à API de Dados (ADR-0003) — o SQL continua editável pelo
 * Administrador em Consultas BD, mas isso é assunto do catálogo, não deste módulo. O
 * cadastro cria a ficha e conclui o passo 1 — o que dispara o aviso ao Administrativo. */
@Injectable()
export class ClientesSiclaService {
  constructor(
    @InjectRepository(Projeto) private readonly projetos: Repository<Projeto>,
    private readonly dados: DadosService,
    private readonly passos: PassosService,
  ) {}

  async buscar(termoBruto: string): Promise<ResultadoBusca> {
    const termo = (termoBruto ?? '').trim();
    if (termo.length < 2) {
      return {
        ok: false,
        mensagem: 'Digite ao menos 2 caracteres para buscar.',
        clientes: [],
      };
    }
    // Termo CRU: o curinga `%` do LIKE é do catálogo (parâmetro `texto_busca`).
    const r = await this.dados.consultar('sicla.clientes.buscar', { termo });
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

    // Conversões de dados estimadas (nome + horas + observação). Só grava se houver alguma.
    const temConversoes =
      Array.isArray(conversoesSelecionadas) &&
      conversoesSelecionadas.length > 0;
    const conversoes = temConversoes
      ? JSON.stringify(
          conversoesSelecionadas
            .map((c) => ({
              nome: (c.nome ?? '').trim(),
              horas: (c.horas ?? '').trim(),
              obs: (c.obs ?? '').trim(),
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
      { observacao: 'Cliente cadastrado a partir da consulta ao SICLA' },
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
