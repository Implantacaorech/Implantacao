import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Usuario } from '../database/entities/usuario.entity';
import { DadosService } from '../dados/dados.service';
import { ConexoesService } from '../dados/conexoes/conexoes.service';
import { AcessoClienteRepository } from './repositories/acesso-cliente.repository';
import { papeisDoUsuario } from '../users/papeis.util';
import {
  ContatoSicla,
  ResultadoLiberacao,
  ResultadoRevogacao,
  SENHA_PADRAO_CONTATO,
} from './contatos-sicla.constants';

const SALT_ROUNDS = 12;

/** Resposta da revalidação de um contato contra o SICLA — ver `situacaoNoSicla`. */
export type SituacaoContato =
  'liberado' | 'nao-liberado' | 'indisponivel' | 'sem-integracao';

export interface ResultadoListaContatos {
  ok: boolean;
  mensagem: string;
  contatos: ContatoSicla[];
}

/** Acesso do CLIENTE ao Painel, a partir de `SICLA.LISTA_CONTATOS`.
 *
 * Pede a consulta `sicla.contatos.listar` à API de Dados (ADR-0003) e grava na tabela
 * `usuarios`. Irmão de `TecnicosSiclaService`, com duas diferenças que mandam no desenho:
 * o papel criado é EXTERNO (`Cliente`, exclusivo) e a senha é aleatória e descartada.
 *
 * **Quem autoriza é o SICLA, não esta tela.** A lista só traz `PORTAL_RECH_CLIENTES = 1`, e
 * `liberadoNoSicla()` é consultado de novo a cada login — liberar aqui é dar ao contato uma
 * conta no Painel, não conceder a autorização, que já era do SICLA. */
@Injectable()
export class ContatosSiclaService {
  private readonly logger = new Logger('ContatosSiclaService');

  constructor(
    private readonly usuarios: AcessoClienteRepository,
    private readonly dados: DadosService,
    private readonly conexoes: ConexoesService,
  ) {}

  /** Valor de coluna do Oracle como texto aparado. O driver devolve `unknown`: número, data
   * ou string conforme a coluna — daí o `String()` explícito, com os tipos que NÃO têm
   * representação textual útil (objeto, array) virando vazio em vez de "[object Object]". */
  private texto(v: unknown): string {
    if (v === null || v === undefined) return '';
    if (typeof v === 'object') return v instanceof Date ? v.toISOString() : '';
    if (typeof v === 'string') return v.trim();
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    return '';
  }

  /** Contatos liberados no SICLA. `cliente` recorta um cliente só (o caso da tela); sem ele
   * vem a lista inteira, que é o que a revalidação do login usa.
   *
   * O filtro por `termo` é EM MEMÓRIA, como no módulo de técnicos: assim um SQL editado sem
   * bind de busca nunca quebra a tela. */
  async listar(
    cliente?: string,
    termoBruto = '',
    somenteNaoLiberados = false,
  ): Promise<ResultadoListaContatos> {
    const codigo = this.texto(cliente);
    const n = Number(codigo);
    const r = await this.dados.consultar('sicla.contatos.listar', {
      cliente: codigo && Number.isInteger(n) ? n : null,
    });
    if (!r.ok) return { ok: false, mensagem: r.mensagem, contatos: [] };

    // Um SELECT só resolve o "já liberado" de todas as linhas — o cadastro cabe em memória.
    const existentes = await this.usuarios.todos();
    const porEmail = new Map<string, Usuario>();
    for (const u of existentes) {
      for (const e of [u.email, u.login]) {
        const chave = (e || '').trim().toLowerCase();
        if (chave && !porEmail.has(chave)) porEmail.set(chave, u);
      }
    }

    const termo = termoBruto.trim().toLowerCase();
    const contatos = r.linhas
      .map((row) => this.mapear(row, porEmail))
      // Sem nome E sem e-mail não é contato — é linha de lixo do SELECT.
      .filter((c) => c.nome !== '' || c.email !== '')
      // O bind já recorta no banco; este filtro cobre o SQL editado que o tenha perdido.
      .filter((c) => !codigo || c.cliente === codigo)
      .filter(
        (c) =>
          termo === '' ||
          [c.nome, c.email, c.cargo, c.cliente].some((x) =>
            x.toLowerCase().includes(termo),
          ),
      )
      .filter((c) => !somenteNaoLiberados || !c.jaLiberado);
    return { ok: true, mensagem: r.mensagem, contatos };
  }

  /** A AGENDA de contatos de um cliente — TODOS, liberados no Portal Rech ou não.
   *
   * Serve para nomear quem, do lado do cliente, responde por um cartão do Controle de
   * Atividades. **Não confundir com `listar()`**, que é a consulta de AUTORIZAÇÃO
   * (`PORTAL_RECH_CLIENTES = 1`) e alimenta o Acesso de Clientes e a revalidação do login.
   *
   * Reusar `listar()` aqui foi um defeito real (2026-09-03): o seletor do cartão só oferecia
   * os contatos já liberados no Portal, e num cliente com um único liberado aparecia uma
   * pessoa só — quando o desenho do módulo diz que um contato pode ser membro **mesmo sem
   * conta no Painel** (docs/controle-atividades.md §2.4).
   *
   * O código do cliente é obrigatório: sem ele a consulta nem é chamada. Um `:cliente` nulo
   * aqui devolveria a agenda da base inteira, e nenhuma tela precisa disso.
   */
  async listarDoCliente(cliente: string): Promise<ResultadoListaContatos> {
    const codigo = this.texto(cliente);
    const n = Number(codigo);
    if (!codigo || !Number.isInteger(n)) {
      return {
        ok: false,
        mensagem: 'Código de cliente inválido.',
        contatos: [],
      };
    }
    const r = await this.dados.consultar('sicla.contatos.do-cliente', {
      cliente: n,
    });
    if (!r.ok) return { ok: false, mensagem: r.mensagem, contatos: [] };

    const existentes = await this.usuarios.todos();
    const porEmail = new Map<string, Usuario>();
    for (const u of existentes) {
      for (const e of [u.email, u.login]) {
        const chave = (e || '').trim().toLowerCase();
        if (chave && !porEmail.has(chave)) porEmail.set(chave, u);
      }
    }

    const contatos = r.linhas
      .map((row) => this.mapear(row, porEmail))
      // Sem nome E sem e-mail não é contato — é linha de lixo do SELECT.
      .filter((c) => c.nome !== '' || c.email !== '')
      // O bind já recorta no banco; isto cobre o SQL editado que tenha perdido o filtro —
      // e aqui o recorte é a única proteção, porque não há mais o filtro de autorização.
      .filter((c) => c.cliente === codigo);
    return { ok: true, mensagem: r.mensagem, contatos };
  }

  private mapear(
    bruta: Record<string, unknown>,
    porEmail: Map<string, Usuario>,
  ): ContatoSicla {
    // Colunas por NOME, em MAIÚSCULAS: o SQL é editável em Consultas BD, e casar por posição
    // quebraria ao primeiro ajuste. Coluna extra é ignorada; ausente vira campo vazio.
    const l: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(bruta)) l[(k || '').toUpperCase()] = v;

    const email = this.texto(l.EMAIL).toLowerCase();
    const usuario = email ? porEmail.get(email) : undefined;
    return {
      nome: this.texto(l.NOME),
      cargo: this.texto(l.CARGO),
      email,
      cliente: this.texto(l.CLIENTE),
      ativo: this.texto(l.ATIVODES),
      status: this.texto(l.STATUSDES),
      liberacaoPortal: this.texto(l.PORTAL_RECH_CLIENTES_DES),
      jaLiberado: !!usuario && usuario.ativo,
      desativado: !!usuario && !usuario.ativo,
      bruto: bruta,
    };
  }

  /** O contato ainda está liberado no SICLA? É a revalidação do login do usuário-cliente
   * (decisão do usuário em 2026-08-31: "o SICLA manda").
   *
   * Quatro respostas, e a diferença entre as duas últimas importa:
   *
   * - `liberado` / `nao-liberado` — o SICLA respondeu.
   * - `indisponivel` — a conexão EXISTE mas falhou (Oracle fora, SQL quebrado). Quem chama
   *   recusa o login: é o caso de produção, e deixar entrar aqui seria abrir a porta
   *   justamente quando não dá para conferir quem está do outro lado.
   * - `sem-integracao` — não há conexão SICLA cadastrada nesta instância. Não é falha: é uma
   *   instância que não fala com o SICLA (a descartável do e2e, uma máquina de
   *   desenvolvimento). Recusar aqui não protegeria nada — sem SICLA o BI do cliente não
   *   tem uma linha para mostrar —, e tornaria o acesso do cliente impossível de exercitar
   *   fora de produção. Quem chama deixa entrar. */
  async situacaoNoSicla(email: string): Promise<SituacaoContato> {
    const alvo = (email || '').trim().toLowerCase();
    if (!alvo) return 'nao-liberado';
    if (!this.conexoes.configurada('sicla')) return 'sem-integracao';
    const r = await this.dados.consultar('sicla.contatos.listar', {
      cliente: null,
    });
    if (!r.ok) {
      this.logger.warn(
        `Não foi possível revalidar "${alvo}" no SICLA: ${r.mensagem}`,
      );
      return 'indisponivel';
    }
    const achou = r.linhas.some((row) => {
      const l: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) l[(k || '').toUpperCase()] = v;
      return this.texto(l.EMAIL).toLowerCase() === alvo;
    });
    return achou ? 'liberado' : 'nao-liberado';
  }

  /** Dá acesso ao Painel aos contatos indicados (por e-mail). Sem `emails`, libera todos os
   * contatos do cliente informado.
   *
   * Quem já tem usuário ATIVO é pulado; quem tem usuário DESATIVADO é reativado — é o caso
   * de quem já teve acesso, perdeu e voltou. A senha de quem já existe nunca é tocada.
   *
   * O perfil é fixo em `Cliente` e o vínculo vem do SICLA: não há campo de entrada aqui por
   * onde alguém possa criar um usuário interno ou apontar para outro cliente. */
  async liberar(
    cliente: string,
    emails?: string[],
  ): Promise<ResultadoLiberacao> {
    const lista = await this.listar(cliente);
    if (!lista.ok) {
      return {
        ok: false,
        mensagem: lista.mensagem,
        liberados: 0,
        reativados: 0,
        ignorados: [],
      };
    }

    const alvo = new Set(
      (emails ?? []).map((e) => (e || '').trim().toLowerCase()).filter(Boolean),
    );
    const selecionados =
      alvo.size > 0
        ? lista.contatos.filter((c) => alvo.has(c.email))
        : lista.contatos;

    const ignorados: ResultadoLiberacao['ignorados'] = [];
    let liberados = 0;
    let reativados = 0;

    for (const c of selecionados) {
      if (!c.email) {
        ignorados.push({
          nome: c.nome,
          email: '',
          motivo: 'sem e-mail no SICLA (o login do Painel é o e-mail)',
        });
        continue;
      }
      if (!c.cliente) {
        ignorados.push({
          nome: c.nome,
          email: c.email,
          motivo:
            'sem código de cliente no SICLA — sem ele não há recorte do BI',
        });
        continue;
      }

      const existente = await this.usuarios.porEmailOuLogin(c.email);

      try {
        if (existente) {
          // Reativar é o único caminho de "voltar a ter acesso": recriar duplicaria login.
          const papeis = papeisDoUsuario(existente);
          if (!papeis.includes('Cliente')) {
            ignorados.push({
              nome: c.nome,
              email: c.email,
              motivo:
                'esse e-mail já pertence a um usuário INTERNO do Painel — libere por outro e-mail',
            });
            continue;
          }
          if (existente.ativo) continue; // já liberado, nada a fazer
          existente.ativo = true;
          existente.codigoClienteSicla = c.cliente;
          existente.nome = c.nome || existente.nome;
          await this.usuarios.salvar(existente);
          reativados++;
          continue;
        }

        // Senha PADRÃO e conhecida, para os testes internos (ver a constante: antes de
        // publicar para fora, tem de voltar a ser aleatória).
        await this.usuarios.criar({
          login: c.email,
          nome: c.nome || c.email,
          email: c.email,
          senhaHash: await bcrypt.hash(SENHA_PADRAO_CONTATO, SALT_ROUNDS),
          perfil: 'Cliente',
          perfis: 'Cliente',
          codigoSicla: '',
          codigoClienteSicla: c.cliente,
          modulosCapacitados: '',
          setorAtuacao: '',
          ativo: true,
        });
        liberados++;
      } catch (e) {
        // Falha em UM contato não aborta a rodada — vira linha de "ignorados", com o motivo.
        const motivo = e instanceof Error ? e.message : String(e);
        this.logger.warn(`Falha ao liberar "${c.email}": ${motivo}`);
        ignorados.push({ nome: c.nome, email: c.email, motivo });
      }
    }

    const partes = [
      `${liberados} liberado(s)`,
      `${reativados} reativado(s)`,
      `${ignorados.length} ignorado(s)`,
    ];
    return {
      ok: true,
      mensagem: partes.join(', ') + '.',
      liberados,
      reativados,
      ignorados,
    };
  }

  /** Tira o acesso — DESATIVA o usuário, não apaga. O histórico de quem entrou fica, e o
   * caminho de volta é reativar pela mesma tela. Só alcança usuário com papel `Cliente`. */
  async revogar(emails: string[]): Promise<ResultadoRevogacao> {
    const alvo = (emails ?? [])
      .map((e) => (e || '').trim().toLowerCase())
      .filter(Boolean);
    if (!alvo.length) {
      return { ok: true, mensagem: 'Nada a revogar.', revogados: 0 };
    }
    let revogados = 0;
    for (const email of alvo) {
      const u = await this.usuarios.porEmailOuLogin(email);
      if (!u || !papeisDoUsuario(u).includes('Cliente') || !u.ativo) continue;
      u.ativo = false;
      await this.usuarios.salvar(u);
      revogados++;
    }
    return {
      ok: true,
      mensagem: `${revogados} acesso(s) revogado(s).`,
      revogados,
    };
  }
}
