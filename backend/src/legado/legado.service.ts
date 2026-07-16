import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, existsSync, statSync } from 'fs';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { basename, join, normalize, resolve, sep } from 'path';
import type { Response } from 'express';
import { AppConfig } from '../config/configuration';
import { LegadoCliService } from './legado-cli.service';
import { LegadoDownloadRegistry } from './legado-download.registry';
import { FormLegado } from './dto/legado.dto';

export interface ArquivoBaixavel {
  token: string;
  rotulo: string;
  nome: string;
}

export interface ModuloCatalogo {
  codigo: number;
  abrev: string;
  descricao?: string;
  area: string;
}

export interface GrupoCatalogo {
  area: string;
  modulos: ModuloCatalogo[];
}

@Injectable()
export class LegadoService {
  constructor(
    private readonly cli: LegadoCliService,
    private readonly registro: LegadoDownloadRegistry,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  private raizesPermitidas(): string[] {
    const webappDir = this.config.get('legadoWebappDir', { infer: true });
    return [resolve(webappDir, '..', 'exemplos'), resolve(webappDir, '..', 'tools', 'data')];
  }

  private pathDentro(caminho: string): boolean {
    const p = normalize(resolve(caminho));
    return this.raizesPermitidas().some((raiz) => {
      const r = normalize(raiz);
      return p === r || p.startsWith(r.endsWith(sep) ? r : r + sep);
    });
  }

  private async comArquivoTemporario<T>(
    buffer: Buffer,
    nomeOriginal: string,
    fn: (caminho: string) => Promise<T>,
  ): Promise<T> {
    const dir = await mkdtemp(join(tmpdir(), 'legado-'));
    const caminho = join(dir, nomeOriginal || 'arquivo');
    try {
      await writeFile(caminho, buffer);
      return await fn(caminho);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  private registrarSeExistir(caminho: string | null, rotulo: string): ArquivoBaixavel | null {
    if (!caminho) return null;
    const token = this.registro.registrar(caminho);
    return { token, rotulo, nome: basename(caminho) };
  }

  async iaStatus(): Promise<{ ativa: boolean; modelo: string }> {
    return this.cli.executar('ia_status');
  }

  async saude(): Promise<{ ok: boolean; relatorio: string }> {
    const r = await this.cli.executar<{ code: number; relatorio: string }>('saude');
    return { ok: r.code === 0, relatorio: r.relatorio };
  }

  async catalogo(): Promise<GrupoCatalogo[]> {
    const r = await this.cli.executar<{ grupos: GrupoCatalogo[] }>('catalogo_por_area');
    return r.grupos;
  }

  async definirCliente(form: FormLegado): Promise<{ arquivo: string; nome: string }> {
    return this.cli.executar('cliente_yaml', { form });
  }

  async criarTemplates(
    form: FormLegado,
  ): Promise<{ ok: boolean; erro?: string; arquivos: ArquivoBaixavel[] }> {
    const r = await this.cli.executar<{ ok: boolean; erro?: string; mapa?: string; termo?: string }>(
      'criar_templates',
      { form },
    );
    if (!r.ok) return { ok: false, erro: r.erro, arquivos: [] };
    const arquivos = [
      this.registrarSeExistir(r.mapa ?? null, 'Mapeamento de Processos (Word)'),
      this.registrarSeExistir(r.termo ?? null, 'Termo de Encerramento (Word)'),
    ].filter((a): a is ArquivoBaixavel => a !== null);
    return { ok: true, arquivos };
  }

  async converterVerbalTexto(texto: string): Promise<{ depois: string; mudancas: [string, string][] }> {
    return this.cli.executar('converter_verbal_texto', { texto });
  }

  async converterVerbalDocx(buffer: Buffer, nomeOriginal: string): Promise<ArquivoBaixavel> {
    return this.comArquivoTemporario(buffer, nomeOriginal, async (caminho) => {
      const r = await this.cli.executar<{ arquivo: string }>('converter_verbal_docx', {
        caminho,
        nomeOriginal,
      });
      const arquivo = this.registrarSeExistir(r.arquivo, 'Documento corrigido (.docx)');
      if (!arquivo) throw new NotFoundException('Não foi possível gerar o documento corrigido.');
      return arquivo;
    });
  }

  async formModulos(
    tipo: 'levantamento' | 'checklist',
    form: FormLegado,
    modulos: string[],
  ): Promise<{ ok: boolean; erro?: string; arquivo?: ArquivoBaixavel }> {
    const acao = tipo === 'checklist' ? 'gerar_checklist_form' : 'gerar_levantamento_form';
    const rotulo = tipo === 'checklist' ? 'Check List do Consultor (Excel)' : 'Levantamento (Word)';
    const r = await this.cli.executar<{ arquivo: string | null; log: string }>(acao, { form, modulos });
    if (!r.arquivo) return { ok: false, erro: 'Não foi possível gerar.' };
    const arquivo = this.registrarSeExistir(r.arquivo, rotulo);
    return { ok: true, arquivo: arquivo ?? undefined };
  }

  /** Resolve a base YAML de um "gerar" (tipo genérico da ação): o .yaml enviado agora
   * tem prioridade; senão usa o `clienteArquivo` (de uma chamada anterior a
   * `definirCliente`, guardado pelo Angular); sem nenhum dos dois, gera com dados de
   * exemplo (mesmo fallback do Flask original quando não há sessão de cliente). */
  async resolverYamlBase(
    buffer: Buffer | null,
    nomeOriginal: string | null,
    clienteArquivo?: string,
  ): Promise<string | undefined> {
    if (buffer && nomeOriginal) {
      return this.comArquivoTemporario(buffer, nomeOriginal, async (caminho) => {
        const r = await this.cli.executar<{ arquivo: string }>('save_upload_yaml', {
          caminho,
          nomeOriginal,
        });
        return r.arquivo;
      });
    }
    return clienteArquivo;
  }

  async gerar(
    mod: string,
    yamlBasename: string | undefined,
  ): Promise<{ ok: boolean; erro?: string; arquivo?: ArquivoBaixavel }> {
    const r = await this.cli.executar<{ arquivo: string | null; log: string }>('gerar', {
      mod,
      yamlBasename: yamlBasename ?? null,
    });
    if (!r.arquivo) return { ok: false, erro: 'Não foi possível localizar o arquivo gerado.' };
    const arquivo = this.registrarSeExistir(r.arquivo, 'Documento gerado');
    return { ok: true, arquivo: arquivo ?? undefined };
  }

  async importarSequencia(buffer: Buffer, nomeOriginal: string): Promise<{
    ok: boolean;
    erro?: string;
    cliente?: string;
    modulos?: number;
    arquivos: ArquivoBaixavel[];
  }> {
    return this.comArquivoTemporario(buffer, nomeOriginal, async (caminho) => {
      try {
        const r = await this.cli.executar<{
          cliente: string;
          modulos: number;
          projeto: string | null;
          checklist: string | null;
          termo: string | null;
          yaml: string;
        }>('run_sequencia', { caminho });
        const arquivos = [
          this.registrarSeExistir(r.projeto, 'Projeto de Implantação (Word)'),
          this.registrarSeExistir(r.checklist, 'Check List do Consultor (Excel)'),
          this.registrarSeExistir(r.termo, 'Termo de Encerramento (Word)'),
          this.registrarSeExistir(r.yaml, 'projeto.yaml (para ajustes manuais)'),
        ].filter((a): a is ArquivoBaixavel => a !== null);
        return { ok: true, cliente: r.cliente, modulos: r.modulos, arquivos };
      } catch {
        return { ok: false, erro: 'Não foi possível importar o Levantamento.', arquivos: [] };
      }
    });
  }

  baixar(token: string, res: Response): void {
    const item = this.registro.obter(token);
    if (!item || !existsSync(item.caminho) || !this.pathDentro(item.caminho)) {
      throw new NotFoundException('Arquivo não encontrado.');
    }
    const tamanho = statSync(item.caminho).size;
    res.set({
      'Content-Length': String(tamanho),
      'Content-Disposition': `attachment; filename="${item.nome}"`,
    });
    createReadStream(item.caminho).pipe(res);
  }
}
