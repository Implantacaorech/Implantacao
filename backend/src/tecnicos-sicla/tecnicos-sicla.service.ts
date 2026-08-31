import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Usuario } from '../database/entities/usuario.entity';
import { DadosService } from '../dados/dados.service';
import {
  ResultadoImportacao,
  SENHA_PADRAO_TECNICO,
  TecnicoSicla,
} from './tecnicos-sicla.constants';

const SALT_ROUNDS = 12;

export interface ResultadoListaTecnicos {
  ok: boolean;
  mensagem: string;
  tecnicos: TecnicoSicla[];
}

/** Cadastro de Usuários alimentado por `SICLA.LISTA_TECNICOS`.
 *
 * Pede a consulta `sicla.tecnicos.listar` à API de Dados (ADR-0003) e grava na tabela
 * `usuarios` do Painel. */
@Injectable()
export class TecnicosSiclaService {
  // Continua usado no laço de importação: falha ao gravar UM técnico não aborta a rodada,
  // só é registrada e o técnico entra em `ignorados`.
  private readonly logger = new Logger('TecnicosSiclaService');

  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    private readonly dados: DadosService,
  ) {}

  /** Técnicos do SICLA. `termo` filtra EM MEMÓRIA (nome, código, e-mail, setor ou módulo) —
   * a lista é pequena e assim um SQL editado sem bind de filtro nunca quebra.
   *
   * `somenteNovos` devolve só quem AINDA NÃO tem cadastro no Painel — é a "busca rápida"
   * do dia a dia: técnico novo entrou na Rech, aparece aqui, importa e pronto. */
  async listar(
    termoBruto = '',
    somenteNovos = false,
  ): Promise<ResultadoListaTecnicos> {
    const r = await this.dados.consultar('sicla.tecnicos.listar');
    if (!r.ok) return { ok: false, mensagem: r.mensagem, tecnicos: [] };

    // Um único SELECT nos usuários resolve o `jaCadastrado` de todas as linhas — o cadastro
    // do Painel cabe inteiro em memória.
    const existentes = await this.usuarios.find();
    const porCodigo = new Set(
      existentes.map((u) => (u.codigoSicla || '').trim()).filter(Boolean),
    );
    const porEmail = new Set(
      existentes
        .flatMap((u) => [u.email, u.login])
        .map((e) => (e || '').trim().toLowerCase())
        .filter(Boolean),
    );

    const termo = termoBruto.trim().toLowerCase();
    const tecnicos = r.linhas
      .map((row) => this.mapear(row, porCodigo, porEmail))
      .filter((t) => t.codigo !== '' || t.nome !== '')
      .filter(
        (t) =>
          termo === '' ||
          [
            t.codigo,
            t.nome,
            t.email,
            t.setorAtuacao,
            t.modulosCapacitados,
          ].some((c) => c.toLowerCase().includes(termo)),
      )
      .filter((t) => !somenteNovos || !t.jaCadastrado);
    return { ok: true, mensagem: r.mensagem, tecnicos };
  }

  /** Importa técnicos do SICLA para `usuarios`. Sem `codigos`, importa a lista inteira.
   *
   * Quem já existe (mesmo código SICLA, ou mesmo e-mail/login) é ATUALIZADO com os dados do
   * SICLA — perfil, papéis, situação e senha ficam como estão, porque são do Painel, não do
   * SICLA. Quem não existe é CRIADO com a senha padrão e perfil Consultor. */
  async importar(codigos?: string[]): Promise<ResultadoImportacao> {
    const lista = await this.listar();
    if (!lista.ok) {
      return {
        ok: false,
        mensagem: lista.mensagem,
        criados: 0,
        atualizados: 0,
        ignorados: [],
      };
    }

    const alvo = new Set((codigos ?? []).map((c) => (c || '').trim()));
    const selecionados =
      alvo.size > 0
        ? lista.tecnicos.filter((t) => alvo.has(t.codigo))
        : lista.tecnicos;

    const existentes = await this.usuarios.find();
    const ignorados: ResultadoImportacao['ignorados'] = [];
    let criados = 0;
    let atualizados = 0;
    // Hash calculado UMA vez: bcrypt com 12 rounds custa ~250ms, e uma importação de 60
    // técnicos novos levaria 15s se cada um gerasse o seu. Como a senha é a mesma para
    // todos por definição, o hash também pode ser.
    let hashPadrao: string | null = null;

    for (const t of selecionados) {
      if (!t.email) {
        ignorados.push({
          codigo: t.codigo,
          nome: t.nome,
          motivo: 'sem e-mail no SICLA (o login do Painel é o e-mail)',
        });
        continue;
      }
      const emailLower = t.email.toLowerCase();
      const existente = existentes.find(
        (u) =>
          (t.codigo !== '' && (u.codigoSicla || '').trim() === t.codigo) ||
          (u.email || '').trim().toLowerCase() === emailLower ||
          (u.login || '').trim().toLowerCase() === emailLower,
      );

      // Cada linha grava por conta própria: uma que esbarre no índice único de login (o
      // e-mail do SICLA já em uso por OUTRO usuário do Painel, por exemplo) vira um item
      // de `ignorados` em vez de derrubar a importação inteira no meio.
      try {
        if (existente) {
          existente.nome = t.nome || existente.nome;
          existente.email = t.email;
          existente.login = t.email; // login = e-mail, definição do de/para
          existente.codigoSicla = t.codigo || existente.codigoSicla;
          existente.modulosCapacitados = t.modulosCapacitados;
          existente.setorAtuacao = t.setorAtuacao;
          await this.usuarios.save(existente);
          atualizados += 1;
          continue;
        }

        hashPadrao ??= await bcrypt.hash(SENHA_PADRAO_TECNICO, SALT_ROUNDS);
        const novo = await this.usuarios.save(
          this.usuarios.create({
            login: t.email,
            nome: t.nome,
            email: t.email,
            senhaHash: hashPadrao,
            perfil: 'Consultor',
            perfis: 'Consultor',
            codigoSicla: t.codigo,
            modulosCapacitados: t.modulosCapacitados,
            setorAtuacao: t.setorAtuacao,
            ativo: true,
          }),
        );
        // Entra na lista para a própria rodada não recriar um técnico repetido no SICLA
        // (mesmo e-mail em dois códigos, por exemplo).
        existentes.push(novo);
        criados += 1;
      } catch (e) {
        this.logger.error(
          `Falha ao importar o técnico ${t.codigo} (${t.email})`,
          e instanceof Error ? e.stack : String(e),
        );
        ignorados.push({
          codigo: t.codigo,
          nome: t.nome,
          motivo: 'falha ao gravar (login/e-mail já em uso por outro usuário?)',
        });
      }
    }

    const partes = [`${criados} criado(s)`, `${atualizados} atualizado(s)`];
    if (ignorados.length > 0) partes.push(`${ignorados.length} ignorado(s)`);
    return {
      ok: true,
      mensagem: `Importação concluída: ${partes.join(', ')}.`,
      criados,
      atualizados,
      ignorados,
    };
  }

  /** Converte com segurança um valor de coluna (string/número/data) em texto. */
  private texto(v: unknown): string {
    if (v === undefined || v === null) return '';
    if (typeof v === 'string') return v.trim();
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return '';
  }

  /** Traduz uma linha de LISTA_TECNICOS para o técnico normalizado, escolhendo a coluna por
   * nome (aceita variações comuns). Colunas desconhecidas ficam em `bruto`, sem quebrar. */
  private mapear(
    row: Record<string, unknown>,
    porCodigo: Set<string>,
    porEmail: Set<string>,
  ): TecnicoSicla {
    const pega = (...chaves: string[]): string => {
      for (const k of chaves) {
        const t = this.texto(
          row[k] ?? row[k.toUpperCase()] ?? row[k.toLowerCase()],
        );
        if (t !== '') return t;
      }
      return '';
    };
    const codigo = pega('CODIGO', 'COD', 'CODTECNICO', 'CODIGOTECNICO');
    const email = pega('EMAIL', 'E_MAIL', 'ENDINT01');
    return {
      codigo,
      nome: pega('NOME', 'TECNICO', 'DESCRICAO'),
      modulosCapacitados: pega(
        'MODULOCAPACITADO',
        'MODULOSCAPACITADOS',
        'MODULO_CAPACITADO',
        'MODULOCAPACITADOS',
      ),
      email,
      setorAtuacao: pega('SETORDES', 'SETOR', 'SETOR_DES', 'SETORDESCRICAO'),
      jaCadastrado:
        (codigo !== '' && porCodigo.has(codigo)) ||
        (email !== '' && porEmail.has(email.toLowerCase())),
      bruto: row,
    };
  }
}
