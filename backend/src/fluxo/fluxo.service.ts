import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Projeto } from '../database/entities/projeto.entity';
import { DocumentosService } from '../documentos/documentos.service';
import {
  GeracaoLayoutService,
  SlugDocumentoFiel,
} from '../documentos/geracao-layout.service';
import { MailerService } from '../email/mailer.service';
import { NotificacaoService } from '../email/notificacao.service';
import { LABELS } from './fluxo.constants';

// Pacote inicial do fluxo (fluxo_confirmar.html oferece só estes dois pela "layout fiel"
// nova — a 3ª opção do Flask original ("checklist") usa o gerador legado runner.py, ainda
// não portado; 'termo' não faz parte do pacote inicial em nenhuma das duas versões).
const TIPOS_GERAVEIS_PACOTE: readonly SlugDocumentoFiel[] = ['levantamento', 'cronograma'];

const NOMES_DOC: Record<SlugDocumentoFiel, string> = {
  levantamento: 'Mapeamento de Processos',
  projeto: 'Projeto de Implantação',
  cronograma: 'Cronograma',
  termo: 'Termo de Encerramento',
};

export interface CriarFluxoManualDto extends Partial<Projeto> {
  consultor?: string;
  tecnicos?: string;
  gerar?: string[];
  emailsResponsaveis?: string;
}

export interface ResultadoCriarFluxo {
  projetoId: number;
  duplicado: boolean;
  documentosGerados: string[];
  emailEnviado: boolean;
  avisoEmail?: string;
}

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
    private readonly geracaoLayout: GeracaoLayoutService,
    private readonly mailer: MailerService,
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

  /** Texto-resumo do projeto para o e-mail final aos responsáveis. Espelha
   * webapp/fluxo.py:resumo_projeto. */
  private resumoProjeto(proj: Projeto, docs: string[], gci: string, tecnicos: string): string {
    const contato =
      [proj.contatoNome, proj.contatoEmail, proj.contatoTel].filter(Boolean).join(' · ') ||
      proj.contatos ||
      '';
    const linhas = ['Resumo do projeto de implantação', '='.repeat(34), ''];
    const campos: [string, string | undefined][] = [
      ['Cliente', proj.cliente],
      ['CNPJ', proj.cnpj],
      ['Ramo', proj.ramo],
      ['Nº do projeto', proj.numeroProjeto],
      ['Módulos', proj.modulos],
      ['Horas', `${proj.horasCobradas || '0'} cobradas + ${proj.horasBonificadas || '0'} bonificadas`],
      ['Contato', contato],
      ['GCI (Levantamento)', gci],
      ['Técnico(s)', tecnicos],
    ];
    for (const [rot, val] of campos) {
      if (val) linhas.push(`• ${rot}: ${val}`);
    }
    if (docs.length > 0) {
      linhas.push('', 'Documentos em anexo:');
      linhas.push(...docs.map((d) => `  - ${d}`));
    }
    linhas.push(
      '',
      'Próximo passo: o GCI realiza o Levantamento de Processos e segue o fluxo no Painel.',
      '',
      '— Painel de Implantação · Rech Sistemas de Gestão',
    );
    return linhas.join('\n');
  }

  /** Cria o fluxo completo a partir da tela de confirmação manual (fluxo_confirmar.html):
   * cria a ficha, gera o pacote inicial de documentos e envia o e-mail-resumo com anexos
   * aos responsáveis. Espelha webapp/routes_fluxo.py:fluxo_criar — distinto de
   * `criarDeCampos`, usado pelo robô automático da caixa (texto de evento e efeitos
   * colaterais diferentes). */
  async criarComPacote(dto: CriarFluxoManualDto, autor = ''): Promise<ResultadoCriarFluxo> {
    const gci = (dto.consultor || '').trim();
    const tecnicos = (dto.tecnicos || '').trim();
    let observacoes = (dto.observacoes || '').trim();
    if (tecnicos) observacoes = `${observacoes}${observacoes ? ' · ' : ''}Técnicos: ${tecnicos}`;

    const ja = await this.existeSimilar(dto.cliente, dto.cnpj);
    if (ja) {
      return { projetoId: ja, duplicado: true, documentosGerados: [], emailEnviado: false };
    }

    const hoje = new Date().toISOString().slice(0, 10);
    const { consultor: _consultor, tecnicos: _tecnicos, gerar: _gerar, emailsResponsaveis: _er, ...pf } = dto;
    const projeto = await this.projetos.save(
      this.projetos.create({
        ...pf,
        observacoes,
        consultor: gci,
        cliente: dto.cliente || 'Cliente',
        dataInicio: hoje,
      }),
    );
    await this.documentos.registrarEvento(
      projeto.id,
      'etapa',
      'Fluxo iniciado pelo e-mail de fechamento (Comercial).',
      autor,
    );
    if (gci) {
      await this.documentos.registrarEvento(
        projeto.id,
        'nota',
        `GCI designado p/ Levantamento: ${gci}`,
        autor,
      );
    }
    if (tecnicos) {
      await this.documentos.registrarEvento(
        projeto.id,
        'nota',
        `Técnico(s) da implantação: ${tecnicos}`,
        autor,
      );
    }
    await this.notificacao.notificarEvento(projeto.id, 'fechamento', projeto);

    const tiposPedidos = (dto.gerar && dto.gerar.length > 0 ? dto.gerar : ['levantamento', 'cronograma']).filter(
      (t): t is SlugDocumentoFiel => TIPOS_GERAVEIS_PACOTE.includes(t as SlugDocumentoFiel),
    );
    const caminhos: string[] = [];
    const nomes: string[] = [];
    for (const tipo of tiposPedidos) {
      try {
        const arquivo = await this.geracaoLayout.gerar(projeto.id, tipo, 'auto');
        const salvo = this.documentos.salvarArquivoGerado(projeto.id, arquivo.filename, arquivo.buffer);
        await this.documentos.registrarDocumento(projeto.id, tipo, salvo.arquivo, salvo.caminho, 'gerado');
        await this.documentos.registrarEvento(
          projeto.id,
          'documento',
          `Gerou ${salvo.arquivo} (${tipo})`,
          autor,
        );
        caminhos.push(salvo.caminho);
        nomes.push(NOMES_DOC[tipo]);
      } catch (e) {
        this.logger.warn(`Falha ao gerar ${tipo} no pacote inicial do fluxo: ${(e as Error).message}`);
      }
    }

    const destinos = (dto.emailsResponsaveis || '')
      .split(/[;,]/)
      .map((e) => e.trim())
      .filter(Boolean);
    let emailEnviado = false;
    let avisoEmail: string | undefined;
    if (destinos.length > 0 && this.mailer.configurado()) {
      const resumo = this.resumoProjeto(projeto, nomes, gci, tecnicos);
      const anexos = caminhos.map((caminho) => ({ caminho }));
      const resultado = await this.mailer.enviar(
        destinos,
        `Implantação iniciada — ${projeto.cliente}`,
        resumo,
        anexos,
      );
      emailEnviado = resultado.ok;
      await this.documentos.registrarEvento(
        projeto.id,
        'email',
        resultado.ok
          ? `Pacote inicial enviado a ${destinos.join(', ')}`
          : `Falha ao enviar o pacote: ${resultado.erro}`,
        autor,
      );
      if (!resultado.ok) avisoEmail = `Fluxo criado, mas o e-mail não saiu: ${resultado.erro}`;
    } else if (destinos.length === 0) {
      avisoEmail = 'Fluxo criado. Nenhum destinatário informado — pacote não enviado por e-mail.';
    } else {
      avisoEmail = 'Fluxo criado, mas o e-mail não saiu: configure o SMTP.';
    }

    return { projetoId: projeto.id, duplicado: false, documentosGerados: nomes, emailEnviado, avisoEmail };
  }
}
