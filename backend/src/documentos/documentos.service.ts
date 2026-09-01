import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { basename, join } from 'path';
import {
  caminhoAbsolutoDocumento,
  caminhoParaPersistir,
  storeDocumentos,
} from './caminho-documento.util';
import { Repository } from 'typeorm';
import {
  Documento,
  OrigemDocumento,
} from '../database/entities/documento.entity';
import { Evento, TipoEvento } from '../database/entities/evento.entity';
import { Projeto } from '../database/entities/projeto.entity';
import {
  Cabecalho,
  DocLeve,
  MetricasService,
} from '../metricas/metricas.service';
import { PassosService } from '../passos/passos.service';
import type { Perfil } from '../common/constants/perfis';

/** Torna seguro um nome de arquivo vindo do usuário (o `originalname` do upload) antes de
 * concatenar num caminho de disco. Achado C2 da auditoria de 2026-08-12 (path traversal):
 * `salvarArquivoGerado` montava `${id}_${ts}_${nomeSugerido}` com o nome CRU, e um
 * `originalname` como `a/../../../../evil.js` escapava da pasta ao passar por `join` —
 * escrita de arquivo arbitrária com o privilégio do processo Node.
 *
 * Defesa em duas camadas: `basename` (após normalizar `\` → `/`, para valer igual no Windows
 * e no Linux do CI) remove qualquer componente de diretório; em seguida tudo que não for
 * `[A-Za-z0-9._-]` vira `_`, o que elimina QUALQUER separador remanescente e neutraliza `..`
 * (não sobra separador para subir de pasta). Ponto e nomes ocultos no início são removidos, e
 * o tamanho é limitado. Nome vazio após a limpeza vira `arquivo`. */
export function nomeArquivoSeguro(nome: string): string {
  const semDiretorio = basename(String(nome ?? '').replace(/\\/g, '/'));
  const limpo = semDiretorio
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 180);
  return limpo || 'arquivo';
}

// Precedência dos documentos no fluxo — a exclusão respeita as dependências: um documento
// só pode ser excluído se nenhum documento POSTERIOR existir (ex.: exclua o Projeto antes
// do Levantamento). Cronograma e checklist são irmãos (mesmo nível); o Termo depende de
// ambos. Espelha webapp/db.py:DOC_ORDEM/tipo_excluivel.
const DOC_ORDEM: Record<string, number> = {
  levantamento: 0,
  projeto: 1,
  cronograma: 2,
  checklist: 2,
  termo: 3,
};

function tipoExcluivel(tipo: string, tiposExistentes: Set<string>): boolean {
  const rank = DOC_ORDEM[(tipo || '').trim().toLowerCase()];
  if (rank === undefined) return true;
  for (const t of tiposExistentes) {
    const r = DOC_ORDEM[(t || '').trim().toLowerCase()];
    if (r !== undefined && r > rank) return false;
  }
  return true;
}

/** Histórico de documentos anexados/gerados por projeto + timeline de eventos. Espelha
 * webapp/db.py (Documento, Evento, registrar_evento) — usado pela geração de documentos
 * (§item 3 da migração) para registrar o que foi gerado, e por `ProjetosService.excluir`
 * para não deixar linhas órfãs (ver docs/migracao/03-documento-conversao.md). */
@Injectable()
export class DocumentosService {
  constructor(
    @InjectRepository(Documento)
    private readonly documentos: Repository<Documento>,
    @InjectRepository(Evento) private readonly eventos: Repository<Evento>,
    @InjectRepository(Projeto) private readonly projetos: Repository<Projeto>,
    private readonly metricas: MetricasService,
    // forwardRef: PassosModule importa DocumentosModule (para anexar o e-mail do Outlook)
    // e este importa PassosModule (para concluir o passo do documento) — ciclo real,
    // resolvido do jeito que o Nest prevê.
    @Inject(forwardRef(() => PassosService))
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

  /** Stepper, gates, próxima ação e KPIs da ficha — mesmo cálculo usado no "projeto em
   * foco" da Home (`MetricasService.cabecalho`), aqui exposto para QUALQUER projeto (não só
   * o foco), que é o que a ficha (`projeto_ficha.html`) sempre precisou. */
  async cabecalho(projetoId: number): Promise<Cabecalho> {
    const projeto = await this.buscarProjeto(projetoId);
    return this.metricas.cabecalho(
      projeto,
      await this.docsDoProjeto(projetoId),
    );
  }

  /** Avanço manual de etapa (botão "Avançar para X" da ficha) — exige que o gate da etapa
   * atual esteja OK (mesma regra do avanço automático). Espelha
   * webapp/app.py:projeto_avancar. */
  async avancarEtapa(projetoId: number, autor: string): Promise<Projeto> {
    const projeto = await this.buscarProjeto(projetoId);
    const cab = this.metricas.cabecalho(
      projeto,
      await this.docsDoProjeto(projetoId),
    );
    if (!cab.proxEtapa || !cab.avancarOk) {
      throw new BadRequestException(
        cab.bloqueios.length > 0
          ? cab.bloqueios.join(' · ')
          : 'Avanço de etapa bloqueado.',
      );
    }
    const etapaAnterior = projeto.etapa;
    projeto.etapa = cab.proxEtapa;
    await this.projetos.save(projeto);
    await this.registrarEvento(
      projetoId,
      'etapa',
      `Avançou: ${etapaAnterior} → ${projeto.etapa}`,
      autor,
    );
    return projeto;
  }

  /** Anotação manual na timeline (aba Histórico da ficha). Espelha
   * webapp/app.py:projeto_nota. */
  async adicionarNota(
    projetoId: number,
    nota: string,
    autor: string,
  ): Promise<Evento> {
    if (!nota.trim()) throw new BadRequestException('Informe o texto da nota.');
    return this.registrarEvento(projetoId, 'nota', nota.trim(), autor);
  }

  /** Anexo manual de documento (upload direto pela ficha, distinto dos gerados pelo
   * layout fiel) — sempre `origem: 'importado'`. Espelha webapp/app.py:projeto_anexar.
   *
   * `usuario` é repassado a `registrarDocumento` para que o `tipo` escolhido por quem envia
   * o arquivo não sirva de atalho para fechar o passo de outra pessoa (ver RN-10 lá). */
  async anexarDocumento(
    projetoId: number,
    tipo: string,
    arquivoOriginal: string,
    buffer: Buffer,
    usuario?: { nome: string; perfil: Perfil; perfis?: Perfil[] },
  ): Promise<Documento> {
    const salvo = this.salvarArquivoGerado(projetoId, arquivoOriginal, buffer);
    return this.registrarDocumento(
      projetoId,
      tipo || 'outro',
      salvo.arquivo,
      salvo.caminho,
      'importado',
      usuario?.nome || 'sistema',
      { usuario },
    );
  }

  /** Exclui um documento SÓ SE nada posterior no fluxo depender dele (DOC_ORDEM) — permite
   * regenerar sem deixar o histórico inconsistente. Espelha
   * webapp/db.py:tipo_excluivel/pode_excluir_documento + webapp/app.py:projeto_doc_excluir. */
  async excluirDocumento(id: number, autor: string): Promise<void> {
    const doc = await this.documentos.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('Documento não encontrado.');
    const outros = await this.documentos.find({
      where: { projetoId: doc.projetoId },
    });
    const tiposExistentes = new Set(
      outros.map((d) => (d.tipo || '').trim().toLowerCase()),
    );
    if (!tipoExcluivel(doc.tipo, tiposExistentes)) {
      throw new BadRequestException(
        'Exclua antes os documentos que dependem deste (respeita o fluxo: Levantamento → Projeto → Cronograma/Checklist → Termo).',
      );
    }
    await this.documentos.delete({ id });
    try {
      unlinkSync(caminhoAbsolutoDocumento(doc.caminho));
    } catch {
      // Arquivo físico já ausente/inacessível — não bloqueia a exclusão do registro
      // (mesmo comportamento tolerante do Flask original, que só usa o caminho para
      // servir download, nunca falha a exclusão por causa dele).
    }
    await this.registrarEvento(
      doc.projetoId,
      'documento',
      `Excluiu ${doc.arquivo} (${doc.tipo})`,
      autor,
    );
  }

  private store(): string {
    const dir = storeDocumentos();
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  /** Grava o buffer recebido do serviço de geração no store local e devolve o nome/caminho
   * a persistir no registro do Documento. Prefixa com o id do projeto + timestamp para
   * nunca colidir entre gerações repetidas do mesmo cliente. */
  salvarArquivoGerado(
    projetoId: number,
    nomeSugerido: string,
    buffer: Buffer,
  ): { arquivo: string; caminho: string } {
    // nomeArquivoSeguro é o que impede path traversal (ver C2). O prefixo id+timestamp evita
    // colisão entre gerações repetidas; a sanitização garante que o resultado nunca saia do
    // store, por mais malicioso que seja o originalname enviado.
    const arquivo = `${projetoId}_${Date.now()}_${nomeArquivoSeguro(nomeSugerido)}`;
    const caminho = join(this.store(), arquivo);
    writeFileSync(caminho, buffer);
    return { arquivo, caminho };
  }

  /** Documento gerado/anexado -> conclui o passo do processo que corresponde a ele.
   *
   * Todo caminho de geração passa por aqui, então este é o único lugar que precisa saber a
   * correspondência. Tipo que não estiver no mapa (por exemplo `email_passo_3`, do anexo do
   * Outlook) simplesmente não conclui passo nenhum. */
  // Números conforme os 21 passos (revisão de 2026-07-30, que inseriu os passos 5 e 12):
  // Criação do Projeto = 10, Cronograma = 13, Check-list = 14.
  //
  // `termo` SAIU do mapa em 2026-08-05: o passo 18 é "Gerar o Termo de Encerramento **e
  // enviar ao Administrativo**", e o envio é um e-mail que a pessoa REDIGE na tela (RN-8).
  // Fechá-lo ao gerar o arquivo mandava o texto do modelo sem revisão — com o Termo EM
  // BRANCO anexado, quando a geração era `modo=modelo` — e o passo é irreversível, então não
  // dava para desfazer. Agora o consultor gera o arquivo aqui e fecha o passo pela tela.
  private static readonly PASSO_POR_TIPO: Record<string, number> = {
    projeto: 10,
    cronograma: 13,
    checklist: 14,
  };

  /** Passo que este tipo de documento conclui, ou `undefined` se não conclui nenhum. */
  static passoDoTipo(tipo: string): number | undefined {
    return DocumentosService.PASSO_POR_TIPO[(tipo || '').trim().toLowerCase()];
  }

  /**
   * @param opcoes.usuario Quem está agindo. Informado, a conclusão do passo passa pela RN-10
   *   (designação NAQUELE projeto): o documento é gravado de todo jeito, mas o passo só
   *   fecha se essa pessoa pudesse concluí-lo. Omitido, mantém o comportamento de sempre —
   *   é a chamada interna do sistema, cuja autorização já foi dada pela rota que a disparou.
   * @param opcoes.concluiPasso `false` guarda o arquivo sem fechar passo nenhum. É o caso do
   *   layout EM BRANCO (`modo=modelo`): baixar o modelo para preencher à mão não é entregar
   *   o documento, e fechar o passo ali dava o trabalho por feito (achado de 2026-08-05).
   */
  async registrarDocumento(
    projetoId: number,
    tipo: string,
    arquivo: string,
    caminho: string,
    origem: OrigemDocumento = 'gerado',
    autor = 'sistema',
    opcoes: {
      usuario?: { nome: string; perfil: Perfil; perfis?: Perfil[] };
      concluiPasso?: boolean;
    } = {},
  ): Promise<Documento> {
    const { usuario, concluiPasso = true } = opcoes;
    const doc = await this.documentos.save(
      this.documentos.create({
        projetoId,
        tipo,
        arquivo,
        // Relativo ao store quando o arquivo mora lá — portável entre máquinas; registros
        // antigos seguem absolutos e são resolvidos por caminhoAbsolutoDocumento().
        caminho: caminhoParaPersistir(caminho),
        origem,
      }),
    );
    const passo = concluiPasso
      ? DocumentosService.passoDoTipo(tipo)
      : undefined;
    if (passo) {
      // Sem este gate, RN-10 valia só dentro do PassosController: qualquer autenticado
      // anexava um arquivo rotulado `checklist` e fechava o passo 14 — irreversível — de um
      // projeto alheio, gravado em nome de "sistema" (achado de 2026-08-05).
      const autorizado =
        !usuario ||
        (await this.passos.podeExecutarPasso(projetoId, passo, usuario));
      if (autorizado) {
        await this.passos.concluirAutomatico(
          projetoId,
          passo,
          usuario?.nome || autor,
          `Documento ${tipo} gerado`,
        );
      } else {
        await this.registrarEvento(
          projetoId,
          'passo',
          `Documento ${tipo} registrado, mas o passo ${passo} NÃO foi concluído: ` +
            `${usuario.nome} não é o responsável designado por ele neste projeto.`,
          usuario.nome,
        );
      }
    }
    return doc;
  }

  async registrarEvento(
    projetoId: number,
    tipo: TipoEvento,
    descricao: string,
    autor = '',
  ): Promise<Evento> {
    return this.eventos.save(
      this.eventos.create({ projetoId, tipo, descricao, autor }),
    );
  }

  async listarDocumentos(projetoId: number): Promise<Documento[]> {
    return this.documentos.find({
      where: { projetoId },
      order: { criadoEm: 'DESC' },
    });
  }

  async listarEventos(projetoId: number): Promise<Evento[]> {
    return this.eventos.find({
      where: { projetoId },
      order: { criadoEm: 'DESC' },
    });
  }

  async buscarDocumento(id: number): Promise<Documento | null> {
    return this.documentos.findOne({ where: { id } });
  }

  /** Chamado por `ProjetosService.excluir` — sem isso, excluir um projeto deixaria
   * Documento/Evento órfãos (mesma categoria de bug já encontrada e corrigida no Flask
   * original, e reproduzida aqui até esta correção — ver §6 da documentação da migração). */
  async limparProjeto(projetoId: number): Promise<void> {
    await this.documentos.delete({ projetoId });
    await this.eventos.delete({ projetoId });
  }
}
