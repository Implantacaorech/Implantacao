import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LegadoService } from './legado.service';
import { LegadoCliService } from './legado-cli.service';
import { LegadoDownloadRegistry } from './legado-download.registry';
import { AppConfig } from '../config/configuration';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';

describe('LegadoService', () => {
  let service: LegadoService;
  const cli = { executar: jest.fn() };
  const webappDir = join('C:', 'repo', 'webapp');
  const config = {
    get: jest.fn((chave: keyof AppConfig) => (chave === 'legadoWebappDir' ? webappDir : undefined)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LegadoService,
        { provide: LegadoCliService, useValue: cli },
        LegadoDownloadRegistry,
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = module.get(LegadoService);
  });

  describe('saude', () => {
    it('ok=true quando code=0', async () => {
      cli.executar.mockResolvedValue({ code: 0, relatorio: 'tudo certo' });
      const r = await service.saude();
      expect(r).toEqual({ ok: true, relatorio: 'tudo certo' });
    });

    it('ok=false quando code != 0', async () => {
      cli.executar.mockResolvedValue({ code: 1, relatorio: 'falhou' });
      const r = await service.saude();
      expect(r.ok).toBe(false);
    });
  });

  describe('catalogo', () => {
    it('devolve os grupos tal como vieram do CLI', async () => {
      const grupos = [{ area: 'Vendas', modulos: [{ codigo: 1, abrev: 'FAT', area: 'Vendas' }] }];
      cli.executar.mockResolvedValue({ grupos });
      const r = await service.catalogo();
      expect(r).toBe(grupos);
      expect(cli.executar).toHaveBeenCalledWith('catalogo_por_area');
    });
  });

  describe('criarTemplates', () => {
    it('registra token para cada arquivo gerado (mapa + termo)', async () => {
      cli.executar.mockResolvedValue({ ok: true, mapa: '/exemplos/mapa.docx', termo: '/exemplos/termo.docx' });
      const r = await service.criarTemplates({ cliente: 'X' });
      expect(r.ok).toBe(true);
      expect(r.arquivos).toHaveLength(2);
      expect(r.arquivos[0].rotulo).toBe('Mapeamento de Processos (Word)');
      expect(r.arquivos[1].rotulo).toBe('Termo de Encerramento (Word)');
      expect(r.arquivos[0].token).toBeTruthy();
    });

    it('só registra o que foi gerado (só termo marcado)', async () => {
      cli.executar.mockResolvedValue({ ok: true, termo: '/exemplos/termo.docx' });
      const r = await service.criarTemplates({});
      expect(r.arquivos).toHaveLength(1);
      expect(r.arquivos[0].rotulo).toBe('Termo de Encerramento (Word)');
    });

    it('propaga erro sem registrar nada', async () => {
      cli.executar.mockResolvedValue({ ok: false, erro: 'Marque ao menos um documento a gerar.' });
      const r = await service.criarTemplates({});
      expect(r).toEqual({ ok: false, erro: 'Marque ao menos um documento a gerar.', arquivos: [] });
    });
  });

  describe('converterVerbalTexto', () => {
    it('repassa o texto ao CLI e devolve depois/mudanças tal como vieram', async () => {
      cli.executar.mockResolvedValue({
        depois: 'O sistema utilizará o cadastro.',
        mudancas: [['utiliza', 'utilizará']],
      });
      const r = await service.converterVerbalTexto('O sistema utiliza o cadastro.');
      expect(cli.executar).toHaveBeenCalledWith('converter_verbal_texto', {
        texto: 'O sistema utiliza o cadastro.',
      });
      expect(r.depois).toBe('O sistema utilizará o cadastro.');
      expect(r.mudancas).toEqual([['utiliza', 'utilizará']]);
    });
  });

  describe('converterVerbalDocx', () => {
    it('grava o buffer num arquivo temporário, chama o CLI com o caminho e registra o resultado', async () => {
      cli.executar.mockResolvedValue({ arquivo: '/tmp/xyz/documento_corrigido.docx' });
      const r = await service.converterVerbalDocx(Buffer.from('conteudo-docx-fake'), 'documento.docx');
      expect(cli.executar).toHaveBeenCalledWith(
        'converter_verbal_docx',
        expect.objectContaining({ nomeOriginal: 'documento.docx' }),
      );
      const [, args] = cli.executar.mock.calls[0] as [string, { caminho: string }];
      expect(args.caminho).toContain('documento.docx');
      expect(r.rotulo).toBe('Documento corrigido (.docx)');
      expect(r.token).toBeTruthy();
    });

    it('sem arquivo devolvido pelo CLI: lança NotFoundException', async () => {
      cli.executar.mockResolvedValue({ arquivo: null });
      await expect(
        service.converterVerbalDocx(Buffer.from('x'), 'documento.docx'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('formModulos', () => {
    it('checklist: chama gerar_checklist_form e rotula como Excel', async () => {
      cli.executar.mockResolvedValue({ arquivo: '/exemplos/chk.xlsx', log: '' });
      const r = await service.formModulos('checklist', {}, ['FAT']);
      expect(cli.executar).toHaveBeenCalledWith('gerar_checklist_form', { form: {}, modulos: ['FAT'] });
      expect(r.ok).toBe(true);
      expect(r.arquivo?.rotulo).toBe('Check List do Consultor (Excel)');
    });

    it('sem arquivo devolvido: ok=false com erro', async () => {
      cli.executar.mockResolvedValue({ arquivo: null, log: '' });
      const r = await service.formModulos('levantamento', {}, []);
      expect(r).toEqual({ ok: false, erro: 'Não foi possível gerar.' });
    });
  });

  describe('resolverYamlBase', () => {
    it('sem upload: devolve o clienteArquivo passado', async () => {
      const r = await service.resolverYamlBase(null, null, 'cliente_x.yaml');
      expect(r).toBe('cliente_x.yaml');
      expect(cli.executar).not.toHaveBeenCalled();
    });

    it('com upload: salva e devolve o basename gerado, ignorando clienteArquivo', async () => {
      cli.executar.mockResolvedValue({ arquivo: 'upload_meu.yaml' });
      const r = await service.resolverYamlBase(Buffer.from('a: 1'), 'meu.yaml', 'cliente_x.yaml');
      expect(r).toBe('upload_meu.yaml');
      expect(cli.executar).toHaveBeenCalledWith('save_upload_yaml', expect.objectContaining({ nomeOriginal: 'meu.yaml' }));
    });
  });

  describe('gerar', () => {
    it('sem arquivo: ok=false', async () => {
      cli.executar.mockResolvedValue({ arquivo: null, log: '' });
      const r = await service.gerar('gerar_projeto_implantacao', undefined);
      expect(r.ok).toBe(false);
    });

    it('com arquivo: registra token', async () => {
      cli.executar.mockResolvedValue({ arquivo: '/exemplos/projeto.docx', log: 'ok' });
      const r = await service.gerar('gerar_projeto_implantacao', 'base.yaml');
      expect(r.ok).toBe(true);
      expect(r.arquivo?.token).toBeTruthy();
      expect(cli.executar).toHaveBeenCalledWith('gerar', { mod: 'gerar_projeto_implantacao', yamlBasename: 'base.yaml' });
    });
  });

  describe('importarSequencia', () => {
    it('registra só os arquivos que vieram preenchidos', async () => {
      cli.executar.mockResolvedValue({
        cliente: 'Cliente X',
        modulos: 3,
        projeto: '/exemplos/projeto.docx',
        checklist: null,
        termo: '/exemplos/termo.docx',
        yaml: '/tools/data/projeto_x.yaml',
      });
      const r = await service.importarSequencia(Buffer.from('docx'), 'lev.docx');
      expect(r.ok).toBe(true);
      expect(r.cliente).toBe('Cliente X');
      expect(r.arquivos.map((a) => a.rotulo)).toEqual([
        'Projeto de Implantação (Word)',
        'Termo de Encerramento (Word)',
        'projeto.yaml (para ajustes manuais)',
      ]);
    });

    it('erro do CLI vira resultado ok=false (não propaga exceção)', async () => {
      cli.executar.mockRejectedValue(new Error('boom'));
      const r = await service.importarSequencia(Buffer.from('docx'), 'lev.docx');
      expect(r).toEqual({ ok: false, erro: 'Não foi possível importar o Levantamento.', arquivos: [] });
    });
  });

  describe('baixar', () => {
    it('token desconhecido: 404', () => {
      const res = { set: jest.fn() } as any;
      expect(() => service.baixar('token-inexistente', res)).toThrow(NotFoundException);
    });
  });
});
