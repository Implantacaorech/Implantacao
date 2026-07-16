import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Repository } from 'typeorm';
import { ModeloDocumento } from '../database/entities/modelo-documento.entity';
import { ModeloDocumentoVersao } from '../database/entities/modelo-documento-versao.entity';
import { ModeloDocumentoCampo } from '../database/entities/modelo-documento-campo.entity';

interface ModeloDefault {
  slug: string;
  nome: string;
  fase: string;
  tipo: 'docx' | 'xlsx';
  base: string;
  descricao: string;
}

// Espelha webapp/db.py:_MODELOS_DOC_DEFAULTS — os 4 documentos fiéis das fases obrigatórias.
const MODELOS_DEFAULT: ModeloDefault[] = [
  {
    slug: 'levantamento',
    nome: 'Mapeamento / Levantamento de Processos',
    fase: 'Levantamento',
    tipo: 'docx',
    base: 'levantamento.docx',
    descricao:
      'Layout do mapeamento de processos preenchido na fase de Levantamento.',
  },
  {
    slug: 'projeto',
    nome: 'Projeto de Implantação',
    fase: 'Projeto',
    tipo: 'docx',
    base: 'projeto.docx',
    descricao: 'Layout do Projeto de Implantação gerado na fase de Projeto.',
  },
  {
    slug: 'cronograma',
    nome: 'Cronograma',
    fase: 'Cronograma e Check-list',
    tipo: 'xlsx',
    base: 'cronograma.xlsx',
    descricao: 'Planilha de cronograma de visitas, tarefas e pendências.',
  },
  {
    slug: 'termo',
    nome: 'Termo de Encerramento',
    fase: 'Encerramento',
    tipo: 'docx',
    base: 'termo.docx',
    descricao: 'Layout do Termo de Encerramento gerado no fim da implantação.',
  },
];

export interface ModeloDocumentoListado extends ModeloDocumento {
  nVersoes: number;
}

/** (seção, placeholder, rótulo, origem, obrigatório, observação) — espelha
 * webapp/db.py:_MODELOS_DOC_CAMPOS 1:1. */
type CampoDefault = [string, string, string, string, boolean, string];

// Espelha webapp/db.py:_MODELOS_DOC_CAMPOS — mapa de preenchimento por modelo, só
// informativo (a geração em si não lê esta tabela, a lógica já está em código nos gl_*).
const CAMPOS_DEFAULT: Record<string, CampoDefault[]> = {
  levantamento: [
    ['Identificação', '<Nome Cliente>', 'Razão Social', 'projeto.cliente', true, ''],
    ['Identificação', 'Data: <xx/xx/xxxx>', 'Data do Levantamento', 'projeto.data_levantamento', false, ''],
    ['Identificação', 'Responsáveis: <...>', 'Responsáveis (GCI/Consultor)', 'projeto.gci + designações', false, ''],
    ['Identificação da Empresa', 'Ramo Atividade:', 'Ramo de Atividade', 'projeto.ramo', false, ''],
    ['Identificação da Empresa', 'Produto:', 'Produto', 'manual', false, 'Produto principal do cliente'],
    ['Identificação da Empresa', 'Fornecedor Atual Software:', 'Software atual', 'manual', false, ''],
    ['Identificação da Empresa', '<Localização / Filiais:>', 'Localização / Filiais', 'manual', false, ''],
    ['Identificação da Empresa', 'Observações / Objetivos:', 'Objetivos', 'projeto.observacoes', false, ''],
    ['Identificação da Empresa', '<Quantidade usuários e identificação:>', 'Qtd. de usuários', 'manual', false, ''],
    ['Usuários (tabela)', 'Nome / E-mail / Atribuições', 'Usuários-chave', 'designações / usuarios', false, ''],
    ['Módulos e Adicionais (A)', 'Previstos antes do Levantamento', 'Módulos contratados', 'projeto.modulos', true, ''],
    ['Módulos e Adicionais (B)', 'Identificados no Levantamento', 'Módulos adicionais', 'manual', false, ''],
    ['Implantação/Treinamento', 'Quantidade de horas Cobradas', 'Horas cobradas', 'projeto.horas_cobradas', false, ''],
    ['Implantação/Treinamento', 'Quantidade de horas Bonificadas', 'Horas bonificadas', 'projeto.horas_bonificadas', false, ''],
    ['Conversões', 'CONVERSÕES <(xxxx horas)>', 'Conversões', 'manual', false, ''],
    ['Mapeamento por área', '<Colar aqui o quadro com as perguntas>', 'Tópicos por módulo', 'Cadastro: Índice de Tópicos', false, 'Usar o cadastro Índice de Tópicos por módulo'],
  ],
  projeto: [
    ['Cabeçalho', 'Nome do Cliente: <RAZÃO SOCIAL>', 'Razão Social', 'projeto.cliente', true, ''],
    ['Escopo', 'CNPJ: <(preencher)>', 'CNPJ', 'projeto.cnpj', true, ''],
    ['Objetivos', '<(preencher)>', 'Objetivos', 'projeto.observacoes', false, ''],
    ['Conversões (tabela)', 'Conversão (Sim/Não) / Dados / Obs', 'Conversões por módulo', 'manual', false, ''],
    ['Detalhamento das Rotinas', '- Módulos Previstos <XX>', 'Módulos previstos por área', 'projeto.modulos', true, ''],
    ['Detalhamento das Rotinas', 'Detalhamento das rotinas <XX>', 'Rotinas atendidas', 'Cadastro: Índice de Tópicos / manual', false, ''],
    ['Equipes (Rech)', 'Gerente de Contas do Projeto', 'GCI', 'projeto.gci', false, ''],
    ['Equipes (Rech)', 'Redator do Projeto', 'Redator', 'manual', false, ''],
    ['Equipes (Rech)', 'Consultor/Implantador', 'Consultor', 'projeto.consultor / designações', false, ''],
    ['Equipes (Cliente)', 'Encarregado pelo Projeto', 'Encarregado (cliente)', 'projeto.contato_nome', false, ''],
    ['Tabela de Usuários', 'Nome / E-mail / Área / Assina Protocolo', 'Usuários do cliente', 'designações / usuarios', false, ''],
    ['Cronograma Macro (tabela)', 'Período previsto <XX>', 'Datas das etapas', 'cronograma_itens / datas', false, ''],
    ['Tempo Estimado', '<XX horas bonificadas>', 'Horas bonificadas', 'projeto.horas_bonificadas', false, ''],
    ['Tempo Estimado', '<XX horas cobradas>', 'Horas cobradas', 'projeto.horas_cobradas', false, ''],
    ['Rodapé', 'Novo Hamburgo, <_> de <_> de 202<X>', 'Data de emissão', 'data atual', false, ''],
  ],
  cronograma: [
    ['Cabeçalho', 'Consultor:', 'Consultor', 'projeto.consultor / designações', false, ''],
    ['Cabeçalho', 'Cliente: XXXX - RAZÃO SOCIAL', 'Razão Social', 'projeto.cliente', true, ''],
    ['Cabeçalho', 'Usuário chave:', 'Usuário chave', 'designações', false, ''],
    ['Cabeçalho', 'Horas do Planejamento', 'Horas planejamento', 'projeto.horas_cobradas', false, ''],
    ['Cabeçalho', 'Hrs previstas bonificadas', 'Horas bonificadas', 'projeto.horas_bonificadas', false, ''],
    ['Aba: Cronograma de visitas', 'Data / Local / Turno / Horário / Técnico / Módulo(s) / O que será abordado / Ações', 'Linhas de visita', 'cronograma_itens', false, ''],
    ['Aba: Tarefas_usuários', 'Tipo / Tarefa / Status / Responsável / Datas', 'Tarefas do usuário', 'checklist_itens / manual', false, ''],
    ['Aba: Pendências_Consultores', 'Tipo / Tarefa / Prazo / Status / Dias de atraso', 'Pendências', 'manual', false, ''],
  ],
  termo: [
    ['Cabeçalho', 'Cliente: <Razão Social Longa>', 'Razão Social', 'projeto.cliente', true, ''],
    ['Resumo Geral (tabela)', 'Módulo / Adicional / Processo / Status de Uso / Obs.', 'Módulos e status de uso', 'projeto.modulos / designações', false, ''],
    ['Alterações fora do escopo', '<Detalhamento das alterações>', 'Alterações / incrementos', 'manual', false, ''],
    ['Pendências', '<Pendência 01> / <Técnico responsável> / <Detalhamento>', 'Pendências sequenciadas', 'manual', false, ''],
    ['Rodapé', 'Novo Hamburgo, _ de _ de 202X', 'Data de encerramento', 'projeto.data_encerramento', false, ''],
  ],
};

/** Registro + versionamento dos 4 layouts fiéis (Levantamento, Projeto, Cronograma, Termo).
 * O arquivo-base fiel vem de `tools/templates/layouts/` (compartilhado com o Flask,
 * somente leitura); as versões enviadas ficam no store gravável `backend/dados/modelos_documento/`.
 * `ModeloDocumentoCampo` (mapa de preenchimento, só informativo — a geração em si não lê essa
 * tabela) agora se semeia junto dos 4 modelos. Espelha webapp/db.py
 * (modelos_documento_*, ModeloDocumento/Versao/Campo). */
@Injectable()
export class ModeloDocumentoService implements OnModuleInit {
  private readonly logger = new Logger('ModeloDocumentoService');

  constructor(
    @InjectRepository(ModeloDocumento)
    private readonly repo: Repository<ModeloDocumento>,
    @InjectRepository(ModeloDocumentoVersao)
    private readonly versoesRepo: Repository<ModeloDocumentoVersao>,
    @InjectRepository(ModeloDocumentoCampo)
    private readonly camposRepo: Repository<ModeloDocumentoCampo>,
  ) {}

  /** Semeia automaticamente no boot (mesmo padrão do ChecklistModeloService) — pulado em
   * ambiente de teste. */
  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === 'test') return;
    try {
      await this.seedDefaults();
    } catch (e) {
      this.logger.error(
        'Falha ao semear modelos_documento no boot',
        e instanceof Error ? e.stack : String(e),
      );
    }
  }

  private store(): string {
    // Em teste, cada arquivo *.e2e-spec.ts roda num processo Jest separado, mas todos
    // compartilham este mesmo caminho real em disco (ao contrário do SQLite ':memory:',
    // que já é isolado por processo) — dois specs chamando seedDefaults() em paralelo
    // colidiam no mesmo `levantamento_v1.docx` e o copyFileSync falhava com EBUSY no
    // Windows. Isolado por JEST_WORKER_ID para eliminar a corrida.
    const dir =
      process.env.NODE_ENV === 'test'
        ? join(
            process.cwd(),
            'dados',
            'modelos_documento_test',
            process.env.JEST_WORKER_ID ?? '0',
          )
        : join(process.cwd(), 'dados', 'modelos_documento');
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  private layoutsBaseDir(baseDir?: string): string {
    return (
      baseDir ?? join(process.cwd(), '..', 'tools', 'templates', 'layouts')
    );
  }

  /** Idempotente — cria os 4 modelos (1ª vez), copiando o layout fiel como versão 1. */
  async seedDefaults(baseDir?: string): Promise<number> {
    const jaExiste = await this.repo.count();
    if (jaExiste > 0) return jaExiste;

    const base = this.layoutsBaseDir(baseDir);
    const store = this.store();
    for (let i = 0; i < MODELOS_DEFAULT.length; i++) {
      const m = MODELOS_DEFAULT[i];
      const stored = `${m.slug}_v1.${m.tipo}`;
      const origem = join(base, m.base);
      if (existsSync(origem)) {
        copyFileSync(origem, join(store, stored));
      } else {
        this.logger.warn(
          `Layout base não encontrado: ${origem} — modelo '${m.slug}' fica sem arquivo.`,
        );
      }
      const modelo = await this.repo.save(
        this.repo.create({
          slug: m.slug,
          nome: m.nome,
          fase: m.fase,
          tipo: m.tipo,
          arquivo: stored,
          descricao: m.descricao,
          ordem: i,
        }),
      );
      await this.versoesRepo.save(
        this.versoesRepo.create({
          modeloId: modelo.id,
          versao: 1,
          arquivo: stored,
          autor: 'sistema',
          motivo: 'Layout inicial (anexo).',
          vigente: true,
        }),
      );
      const campos = CAMPOS_DEFAULT[m.slug] ?? [];
      for (let j = 0; j < campos.length; j++) {
        const [secao, placeholder, rotulo, origem, obrigatorio, observacao] = campos[j];
        await this.camposRepo.save(
          this.camposRepo.create({
            modeloId: modelo.id,
            ordem: j,
            secao,
            placeholder,
            rotulo,
            origem,
            obrigatorio,
            observacao,
          }),
        );
      }
    }
    return MODELOS_DEFAULT.length;
  }

  async listar(): Promise<ModeloDocumentoListado[]> {
    const modelos = await this.repo.find({
      order: { ordem: 'ASC', id: 'ASC' },
    });
    const out: ModeloDocumentoListado[] = [];
    for (const m of modelos) {
      const nVersoes = await this.versoesRepo.count({
        where: { modeloId: m.id },
      });
      out.push({ ...m, nVersoes });
    }
    return out;
  }

  async obter(id: number): Promise<ModeloDocumento> {
    const m = await this.repo.findOne({ where: { id } });
    if (!m) throw new NotFoundException('Modelo de documento não encontrado.');
    return m;
  }

  async porSlug(slug: string): Promise<ModeloDocumento | null> {
    return this.repo.findOne({ where: { slug } });
  }

  async versoes(modeloId: number): Promise<ModeloDocumentoVersao[]> {
    return this.versoesRepo.find({
      where: { modeloId },
      order: { versao: 'DESC' },
    });
  }

  async campos(modeloId: number): Promise<ModeloDocumentoCampo[]> {
    return this.camposRepo.find({
      where: { modeloId },
      order: { ordem: 'ASC', id: 'ASC' },
    });
  }

  async salvarCampo(
    modeloId: number,
    dto: Partial<ModeloDocumentoCampo> & { id?: number },
  ): Promise<ModeloDocumentoCampo> {
    if (dto.id) {
      const existente = await this.camposRepo.findOne({
        where: { id: dto.id, modeloId },
      });
      if (existente) {
        Object.assign(existente, dto);
        return this.camposRepo.save(existente);
      }
    }
    const ultimo = await this.camposRepo.findOne({
      where: { modeloId },
      order: { ordem: 'DESC' },
    });
    return this.camposRepo.save(
      this.camposRepo.create({
        ...dto,
        modeloId,
        ordem: ultimo ? ultimo.ordem + 1 : 0,
      }),
    );
  }

  async excluirCampo(id: number): Promise<void> {
    await this.camposRepo.delete(id);
  }

  private async proximaVersao(modeloId: number): Promise<number> {
    const v = await this.versoesRepo.findOne({
      where: { modeloId },
      order: { versao: 'DESC' },
    });
    return v ? v.versao + 1 : 1;
  }

  /** Recebe o buffer de um arquivo enviado (upload), valida a extensão contra o tipo do
   * modelo, grava no store e registra como a nova versão vigente. */
  async enviarVersao(
    modeloId: number,
    arquivoOriginalNome: string,
    conteudo: Buffer,
    autor: string,
    motivo: string,
  ): Promise<{ ok: true; versao: number } | { ok: false; erro: string }> {
    const modelo = await this.obter(modeloId);
    const ext = arquivoOriginalNome.includes('.')
      ? arquivoOriginalNome.split('.').pop()!.toLowerCase()
      : '';
    if (ext !== modelo.tipo) {
      return {
        ok: false,
        erro: `O arquivo deve ser .${modelo.tipo} (igual ao modelo).`,
      };
    }
    const n = await this.proximaVersao(modeloId);
    const stored = `${modelo.slug}_v${n}.${ext}`;
    writeFileSync(join(this.store(), stored), conteudo);

    await this.versoesRepo.update({ modeloId }, { vigente: false });
    await this.versoesRepo.save(
      this.versoesRepo.create({
        modeloId,
        versao: n,
        arquivo: stored,
        autor,
        motivo,
        vigente: true,
      }),
    );
    modelo.arquivo = stored;
    await this.repo.save(modelo);
    return { ok: true, versao: n };
  }

  /** Caminho absoluto do arquivo vigente (ou de uma versão específica) no store, ou null. */
  async arquivoPath(
    modeloId: number,
    versaoId?: number,
  ): Promise<string | null> {
    let arquivo: string | null = null;
    if (versaoId) {
      const v = await this.versoesRepo.findOne({ where: { id: versaoId } });
      arquivo = v && v.modeloId === modeloId ? v.arquivo : null;
    } else {
      const m = await this.repo.findOne({ where: { id: modeloId } });
      arquivo = m?.arquivo ?? null;
    }
    if (!arquivo) return null;
    const caminho = join(this.store(), arquivo);
    return existsSync(caminho) ? caminho : null;
  }
}
