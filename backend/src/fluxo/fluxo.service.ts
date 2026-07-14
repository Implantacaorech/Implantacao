import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Projeto } from '../database/entities/projeto.entity';
import { DocumentosService } from '../documentos/documentos.service';
import { NotificacaoService } from '../email/notificacao.service';
import { LABELS } from './fluxo.constants';

// Marcas diacríticas combinantes (U+0300-U+036F) — mesma técnica de
// protocolos.constants.ts:slug(), para não depender da codificação do arquivo-fonte.
const MARCAS_DIACRITICAS = new RegExp(
  `[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`,
  'g',
);

function norm(s: string): string {
  return (s || '')
    .normalize('NFKD')
    .replace(MARCAS_DIACRITICAS, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function campoDoRotulo(rotulo: string): string | null {
  const n = norm(rotulo).replace(/[.:\s-]+$/, '');
  for (const [alvos, campo] of LABELS) {
    if (alvos.includes(n)) return campo;
  }
  for (const [alvos, campo] of LABELS) {
    if (alvos.some((a) => n.startsWith(a))) return campo;
  }
  return null;
}

export interface CamposFechamento {
  cliente?: string;
  cnpj?: string;
  ramo?: string;
  cidade?: string;
  contatoNome?: string;
  contatoEmail?: string;
  contatoTel?: string;
  numeroProjeto?: string;
  modulos?: string;
  horasCobradas?: string;
  horasBonificadas?: string;
  observacoes?: string;
}

/** Motor de onboarding da Implantação: a partir do e-mail de FECHAMENTO do Comercial,
 * extrai os dados e cria a ficha do projeto. Espelha webapp/fluxo.py +
 * webapp/app.py:_criar_projeto_de_fechamento/db.py:projeto_existe/aplicar_form. */
@Injectable()
export class FluxoService {
  private readonly logger = new Logger('FluxoService');

  constructor(
    @InjectRepository(Projeto) private readonly projetos: Repository<Projeto>,
    private readonly documentos: DocumentosService,
    private readonly notificacao: NotificacaoService,
  ) {}

  /** Extrai os campos do corpo do e-mail (linhas "Rótulo: valor"). */
  parseFechamento(texto: string): CamposFechamento {
    const d: Record<string, string> = {};
    for (const linhaBruta of (texto || '').split('\n')) {
      if (!linhaBruta.includes(':')) continue;
      const idx = linhaBruta.indexOf(':');
      const rotulo = linhaBruta.slice(0, idx);
      let valor = linhaBruta.slice(idx + 1).trim();
      valor = valor.replace(/^[<\s]+|[>\s]+$/g, '').trim();
      const campo = campoDoRotulo(rotulo);
      if (campo && valor && !d[campo]) d[campo] = valor;
    }
    return d;
  }

  /** Converte os campos extraídos no dict de campos do Projeto — mapeia o contato para
   * os campos SEPARADOS (nome/e-mail/telefone) usados na ficha. */
  paraProjeto(d: CamposFechamento): Partial<Projeto> {
    const obs = [d.cidade, d.observacoes].filter(Boolean).join(' · ');
    return {
      cliente: d.cliente || '',
      cnpj: d.cnpj || '',
      ramo: d.ramo || '',
      numeroProjeto: d.numeroProjeto || '',
      modulos: d.modulos || '',
      horasCobradas: d.horasCobradas || '',
      horasBonificadas: d.horasBonificadas || '',
      contatoNome: d.contatoNome || '',
      contatoEmail: d.contatoEmail || '',
      contatoTel: d.contatoTel || '',
      contatos: '',
      observacoes: obs,
    };
  }

  /** ID de um projeto já cadastrado com o mesmo CNPJ (preferência, comparando só os
   * dígitos) ou, na falta de CNPJ, o mesmo nome de cliente. `null` se não houver — usado
   * para NÃO duplicar o mesmo fechamento. */
  async existeSimilar(cliente?: string, cnpj?: string): Promise<number | null> {
    const cnpjD = (cnpj || '').replace(/\D/g, '');
    const cli = (cliente || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!cnpjD && !cli) return null;
    const todos = await this.projetos.find();
    for (const p of todos) {
      if (cnpjD && (p.cnpj || '').replace(/\D/g, '') === cnpjD) return p.id;
      if (cli && !cnpjD && (p.cliente || '').trim().toLowerCase().replace(/\s+/g, ' ') === cli) {
        return p.id;
      }
    }
    return null;
  }

  /** Cria a ficha do projeto a partir do corpo do e-mail de fechamento (robô da caixa) —
   * faz o parse e delega para `criarDeCampos`. */
  async criarDeFechamento(corpo: string, _assunto = ''): Promise<number> {
    return this.criarDeCampos(this.paraProjeto(this.parseFechamento(corpo)));
  }

  /** Cria a ficha do projeto a partir de campos JÁ estruturados (confirmação manual da
   * tela do fluxo, depois que o usuário revisou/editou o resultado do parse). Faz dedup
   * — se já existe um projeto com o mesmo CNPJ/cliente, devolve o id existente sem criar
   * nem notificar de novo. */
  async criarDeCampos(pf: Partial<Projeto>): Promise<number> {
    const ja = await this.existeSimilar(pf.cliente, pf.cnpj);
    if (ja) {
      this.logger.log(
        `Fechamento ignorado (já cadastrado, id=${ja}): ${pf.cliente || '?'} | CNPJ ${pf.cnpj || '-'}`,
      );
      return ja;
    }
    const hoje = new Date().toISOString().slice(0, 10);
    const projeto = await this.projetos.save(
      this.projetos.create({
        ...pf,
        cliente: pf.cliente || 'Cliente',
        dataInicio: hoje,
      }),
    );
    await this.documentos.registrarEvento(
      projeto.id,
      'etapa',
      'Fechamento recebido automaticamente da caixa.',
      'sistema',
    );
    await this.notificacao.notificarEvento(projeto.id, 'fechamento', projeto);
    return projeto.id;
  }
}
