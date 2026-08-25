import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { compare, hash } from 'bcrypt';
import { randomBytes } from 'crypto';
import { ClienteApi } from '../database/entities/cliente-api.entity';
import { escoposDisponiveis } from './catalogo/catalogo';
import { ClienteApiRepository } from './repositories/cliente-api.repository';

/** Prefixo humano da chave — identifica de longe (num log, num .env de terceiro) que
 * aquilo é uma chave da API de Dados da Rech, e não um token qualquer. */
const MARCA = 'rd';
const ROUNDS_BCRYPT = 10;

/** Cliente como ele sai nas respostas: NUNCA com o hash. */
export interface ClienteApiPublico {
  id: number;
  nome: string;
  prefixo: string;
  escopos: string[];
  ativo: boolean;
  observacao: string;
  criadoEm: Date;
  ultimoUsoEm: Date | null;
}

export interface ClienteApiCriado extends ClienteApiPublico {
  /** A chave em claro — devolvida UMA única vez, no cadastro. Não há como recuperá-la
   * depois; perdeu, gera outra (`rotacionar`). */
  chave: string;
}

/** Cadastro e autenticação dos clientes de MÁQUINA da API de Dados.
 *
 * Por que chave própria e não o JWT do Painel: o JWT é de pessoa — vive 15 min, carrega
 * perfil e menus, e morre quando a pessoa sai da empresa. Integração precisa de credencial
 * de sistema, com escopo próprio, revogável isoladamente e rastreável no log. */
@Injectable()
export class ClienteApiService {
  private readonly logger = new Logger('ClienteApiService');

  constructor(private readonly repo: ClienteApiRepository) {}

  private publicar(c: ClienteApi): ClienteApiPublico {
    return {
      id: c.id,
      nome: c.nome,
      prefixo: c.prefixo,
      escopos: this.lista(c.escopos),
      ativo: c.ativo,
      observacao: c.observacao,
      criadoEm: c.criadoEm,
      ultimoUsoEm: c.ultimoUsoEm,
    };
  }

  private lista(csv: string): string[] {
    return (csv || '')
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);
  }

  /** Só escopo que EXISTE no catálogo entra — senão um erro de digitação viraria um cliente
   * que autentica e nunca consegue chamar nada, com 403 sem explicação. */
  private validarEscopos(escopos: string[]): string {
    const validos = escoposDisponiveis();
    const limpos = [...new Set(escopos.map((e) => e.trim()).filter(Boolean))];
    if (limpos.length === 0) {
      throw new BadRequestException(
        `Informe ao menos um escopo. Disponíveis: ${validos.join(', ')}.`,
      );
    }
    const invalidos = limpos.filter((e) => !validos.includes(e));
    if (invalidos.length) {
      throw new BadRequestException(
        `Escopo inexistente: ${invalidos.join(', ')}. Disponíveis: ${validos.join(', ')}.`,
      );
    }
    return limpos.join(',');
  }

  async listar(): Promise<ClienteApiPublico[]> {
    return (await this.repo.listar()).map((c) => this.publicar(c));
  }

  escopos(): string[] {
    return escoposDisponiveis();
  }

  async criar(dados: {
    nome: string;
    escopos: string[];
    observacao?: string;
  }): Promise<ClienteApiCriado> {
    const nome = (dados.nome || '').trim();
    if (!nome) throw new BadRequestException('Informe o nome do cliente.');
    const escopos = this.validarEscopos(dados.escopos ?? []);

    const { prefixo, segredo, chave } = this.gerarChave();
    const cliente = await this.repo.criar({
      nome,
      prefixo,
      chaveHash: await hash(segredo, ROUNDS_BCRYPT),
      escopos,
      ativo: true,
      observacao: (dados.observacao || '').trim(),
      ultimoUsoEm: null,
    });
    this.logger.log(`Cliente de API criado: ${nome} (prefixo ${prefixo})`);
    return { ...this.publicar(cliente), chave };
  }

  /** Gera uma chave nova para um cliente existente (perda/vazamento). A anterior para de
   * valer no mesmo instante — é a razão de rotacionar ser um caminho próprio, e não
   * "apague e crie de novo": o id, os escopos e o histórico de uso ficam. */
  async rotacionar(id: number): Promise<ClienteApiCriado> {
    const cliente = await this.exigir(id);
    const { prefixo, segredo, chave } = this.gerarChave();
    cliente.prefixo = prefixo;
    cliente.chaveHash = await hash(segredo, ROUNDS_BCRYPT);
    const salvo = await this.repo.salvar(cliente);
    this.logger.warn(`Chave rotacionada: ${cliente.nome} (id ${id})`);
    return { ...this.publicar(salvo), chave };
  }

  async atualizar(
    id: number,
    dados: { nome?: string; escopos?: string[]; observacao?: string },
  ): Promise<ClienteApiPublico> {
    const cliente = await this.exigir(id);
    if (dados.nome !== undefined) cliente.nome = dados.nome.trim();
    if (dados.escopos !== undefined) {
      cliente.escopos = this.validarEscopos(dados.escopos);
    }
    if (dados.observacao !== undefined) {
      cliente.observacao = dados.observacao.trim();
    }
    return this.publicar(await this.repo.salvar(cliente));
  }

  /** Desativa sem apagar: o registro é a prova de quem tinha acesso e até quando. */
  async definirAtivo(id: number, ativo: boolean): Promise<ClienteApiPublico> {
    const cliente = await this.exigir(id);
    cliente.ativo = ativo;
    this.logger.warn(
      `Cliente de API ${ativo ? 'reativado' : 'revogado'}: ${cliente.nome} (id ${id})`,
    );
    return this.publicar(await this.repo.salvar(cliente));
  }

  async remover(id: number): Promise<void> {
    await this.exigir(id);
    await this.repo.remover(id);
  }

  private async exigir(id: number): Promise<ClienteApi> {
    const cliente = await this.repo.porId(id);
    if (!cliente) throw new NotFoundException('Cliente de API não encontrado.');
    return cliente;
  }

  private gerarChave(): { prefixo: string; segredo: string; chave: string } {
    const prefixo = randomBytes(6).toString('hex');
    const segredo = randomBytes(24).toString('hex');
    return { prefixo, segredo, chave: `${MARCA}_${prefixo}_${segredo}` };
  }

  /** Autentica uma chave apresentada em `X-API-Key`. Devolve `null` para QUALQUER falha
   * (formato, prefixo inexistente, segredo errado, cliente inativo) — de propósito: uma
   * mensagem que distinga "prefixo não existe" de "segredo errado" transforma o endpoint
   * num oráculo de chaves válidas. */
  async autenticar(chaveBruta: string): Promise<ClienteApi | null> {
    const partes = (chaveBruta || '').trim().split('_');
    if (partes.length !== 3 || partes[0] !== MARCA) return null;
    const [, prefixo, segredo] = partes;
    if (!prefixo || !segredo) return null;

    const cliente = await this.repo.porPrefixo(prefixo);
    if (!cliente || !cliente.ativo) return null;
    if (!(await compare(segredo, cliente.chaveHash))) return null;

    // Grava o uso sem segurar a requisição: é dado de operação, não parte da autenticação.
    void this.repo
      .marcarUso(cliente.id, new Date())
      .catch((e: unknown) =>
        this.logger.warn(
          `Falha ao gravar último uso do cliente ${cliente.id}: ${String(e)}`,
        ),
      );
    return cliente;
  }

  escoposDoCliente(cliente: ClienteApi): string[] {
    return this.lista(cliente.escopos);
  }
}
