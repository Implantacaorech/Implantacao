import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FluxoService } from './fluxo.service';
import { Projeto } from '../database/entities/projeto.entity';
import { DocumentosService } from '../documentos/documentos.service';
import { GeracaoLayoutService } from '../documentos/geracao-layout.service';
import { LegadoCliService } from '../legado/legado-cli.service';
import { MailerService } from '../email/mailer.service';
import { NotificacaoService } from '../email/notificacao.service';

// checklist (gerador legado) lê o arquivo do disco (readFileSync) — mockado aqui pra não
// depender de um arquivo real existir no ambiente de teste. jest.requireActual preserva o
// resto do módulo real (o TypeORM depende de outras partes de 'fs' para carregar entities).
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: jest.fn(() => Buffer.from('conteudo-xlsx-fake')),
}));

describe('FluxoService', () => {
  let service: FluxoService;
  const projetos = { find: jest.fn(), save: jest.fn(), create: jest.fn((dto) => dto) };
  const documentos = {
    registrarEvento: jest.fn(),
    salvarArquivoGerado: jest.fn(),
    registrarDocumento: jest.fn(),
  };
  const notificacao = { notificarEvento: jest.fn() };
  const geracaoLayout = { gerar: jest.fn() };
  const legadoCli = { executar: jest.fn() };
  const mailer = { configurado: jest.fn(() => false), enviar: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FluxoService,
        { provide: getRepositoryToken(Projeto), useValue: projetos },
        { provide: DocumentosService, useValue: documentos },
        { provide: NotificacaoService, useValue: notificacao },
        { provide: GeracaoLayoutService, useValue: geracaoLayout },
        { provide: LegadoCliService, useValue: legadoCli },
        { provide: MailerService, useValue: mailer },
      ],
    }).compile();
    service = module.get(FluxoService);
  });

  const EMAIL_FECHAMENTO = `Cliente (Razão Social): Cliente Teste LTDA
CNPJ: 12.345.678/0001-90
Ramo: Comércio
Cidade/UF: Novo Hamburgo/RS
Contato (nome): Fulano de Tal
E-mail do contato: fulano@teste.com
Telefone: (51) 99999-0000
Nº da proposta/projeto: PRJ-42
Módulos contratados (siglas): FAT, EST
Horas cobradas: 40
Horas bonificadas: 8
Produto / Observações: Cliente estratégico`;

  describe('parseFechamento', () => {
    it('extrai todos os campos reconhecidos', () => {
      const d = service.parseFechamento(EMAIL_FECHAMENTO);
      expect(d).toMatchObject({
        cliente: 'Cliente Teste LTDA',
        cnpj: '12.345.678/0001-90',
        ramo: 'Comércio',
        cidade: 'Novo Hamburgo/RS',
        contatoNome: 'Fulano de Tal',
        contatoEmail: 'fulano@teste.com',
        contatoTel: '(51) 99999-0000',
        numeroProjeto: 'PRJ-42',
        modulos: 'FAT, EST',
        horasCobradas: '40',
        horasBonificadas: '8',
        observacoes: 'Cliente estratégico',
      });
    });

    it('linhas sem ":" são ignoradas e rótulos desconhecidos não geram campo', () => {
      const d = service.parseFechamento('isso não é um rótulo\nRótulo Inventado: valor');
      expect(Object.keys(d)).toHaveLength(0);
    });

    it('a primeira ocorrência de um rótulo vence (não sobrescreve)', () => {
      const d = service.parseFechamento('Cliente: Primeiro\nCliente: Segundo');
      expect(d.cliente).toBe('Primeiro');
    });

    it('remove os marcadores <> do valor (linha de exemplo do modelo)', () => {
      const d = service.parseFechamento('Cliente: <Razão Social>');
      expect(d.cliente).toBe('Razão Social');
    });
  });

  describe('paraProjeto', () => {
    it('junta cidade + observações com separador', () => {
      const p = service.paraProjeto({ cidade: 'Novo Hamburgo/RS', observacoes: 'obs aqui' });
      expect(p.observacoes).toBe('Novo Hamburgo/RS · obs aqui');
    });

    it('campos ausentes viram string vazia, nunca undefined', () => {
      const p = service.paraProjeto({});
      expect(p.cliente).toBe('');
      expect(p.cnpj).toBe('');
    });
  });

  describe('existeSimilar', () => {
    it('casa por CNPJ ignorando formatação', async () => {
      projetos.find.mockResolvedValue([{ id: 10, cnpj: '12.345.678/0001-90', cliente: 'X' }]);
      const id = await service.existeSimilar('Outro Nome', '12345678000190');
      expect(id).toBe(10);
    });

    it('sem CNPJ, casa por nome do cliente normalizado', async () => {
      projetos.find.mockResolvedValue([{ id: 11, cnpj: '', cliente: '  Cliente   Teste  ' }]);
      const id = await service.existeSimilar('cliente teste', '');
      expect(id).toBe(11);
    });

    it('sem cliente nem cnpj, devolve null sem consultar', async () => {
      const id = await service.existeSimilar('', '');
      expect(id).toBeNull();
      expect(projetos.find).not.toHaveBeenCalled();
    });
  });

  describe('criarDeFechamento', () => {
    it('cria o projeto, registra o evento de etapa e notifica "fechamento"', async () => {
      projetos.find.mockResolvedValue([]);
      projetos.save.mockResolvedValue({ id: 99, cliente: 'Cliente Teste LTDA' });
      const id = await service.criarDeFechamento(EMAIL_FECHAMENTO);
      expect(id).toBe(99);
      expect(documentos.registrarEvento).toHaveBeenCalledWith(
        99,
        'etapa',
        'Fechamento recebido automaticamente da caixa.',
        'sistema',
      );
      expect(notificacao.notificarEvento).toHaveBeenCalledWith(
        99,
        'fechamento',
        expect.objectContaining({ id: 99 }),
      );
    });

    it('dedup: não cria nem notifica de novo se o CNPJ já existe', async () => {
      projetos.find.mockResolvedValue([{ id: 5, cnpj: '12345678000190', cliente: 'Já existe' }]);
      const id = await service.criarDeFechamento(EMAIL_FECHAMENTO);
      expect(id).toBe(5);
      expect(projetos.save).not.toHaveBeenCalled();
      expect(notificacao.notificarEvento).not.toHaveBeenCalled();
    });

    it('cliente vazio no e-mail usa o padrão "Cliente" (nunca viola o NOT NULL)', async () => {
      projetos.find.mockResolvedValue([]);
      projetos.save.mockResolvedValue({ id: 100, cliente: 'Cliente' });
      await service.criarDeFechamento('Assunto sem rótulos reconhecíveis');
      expect(projetos.create).toHaveBeenCalledWith(
        expect.objectContaining({ cliente: 'Cliente' }),
      );
    });
  });

  describe('criarComPacote', () => {
    it('dedup: devolve o existente sem criar, gerar documentos ou enviar e-mail', async () => {
      projetos.find.mockResolvedValue([{ id: 7, cnpj: '12345678000190', cliente: 'Já existe' }]);
      const r = await service.criarComPacote({ cliente: 'X', cnpj: '12.345.678/0001-90' }, 'ana');
      expect(r).toEqual({ projetoId: 7, duplicado: true, documentosGerados: [], emailEnviado: false });
      expect(projetos.save).not.toHaveBeenCalled();
      expect(geracaoLayout.gerar).not.toHaveBeenCalled();
      expect(mailer.enviar).not.toHaveBeenCalled();
    });

    it('cria o projeto com o texto de evento do fluxo manual (distinto do robô da caixa)', async () => {
      projetos.find.mockResolvedValue([]);
      projetos.save.mockResolvedValue({ id: 42, cliente: 'Cliente Teste LTDA' });
      await service.criarComPacote({ cliente: 'Cliente Teste LTDA', gerar: [] }, 'ana');
      expect(documentos.registrarEvento).toHaveBeenCalledWith(
        42,
        'etapa',
        'Fluxo iniciado pelo e-mail de fechamento (Comercial).',
        'ana',
      );
    });

    it('registra notas de GCI e técnicos e acrescenta "Técnicos" às observações', async () => {
      projetos.find.mockResolvedValue([]);
      projetos.save.mockResolvedValue({ id: 43, cliente: 'X' });
      await service.criarComPacote(
        { cliente: 'X', consultor: 'Fulano', tecnicos: 'Ciclano, Beltrano', gerar: [] },
        'ana',
      );
      expect(projetos.create).toHaveBeenCalledWith(
        expect.objectContaining({ consultor: 'Fulano', observacoes: 'Técnicos: Ciclano, Beltrano' }),
      );
      expect(documentos.registrarEvento).toHaveBeenCalledWith(
        43,
        'nota',
        'GCI designado p/ Levantamento: Fulano',
        'ana',
      );
      expect(documentos.registrarEvento).toHaveBeenCalledWith(
        43,
        'nota',
        'Técnico(s) da implantação: Ciclano, Beltrano',
        'ana',
      );
    });

    it('gera "checklist" pelo gerador legado (LegadoCliService), os outros pela layout fiel', async () => {
      projetos.find.mockResolvedValue([]);
      projetos.save.mockResolvedValue({ id: 44, cliente: 'X', modulos: 'FAT, EST' });
      geracaoLayout.gerar.mockResolvedValue({ filename: 'lev.docx', buffer: Buffer.from('x') });
      legadoCli.executar.mockResolvedValue({ arquivo: 'C:\\exemplos\\CheckList_X.xlsx', log: 'ok' });
      documentos.salvarArquivoGerado.mockReturnValue({ arquivo: 'lev.docx', caminho: '/tmp/lev.docx' });
      const r = await service.criarComPacote(
        { cliente: 'X', gerar: ['levantamento', 'checklist', 'cronograma'] },
        'ana',
      );
      expect(geracaoLayout.gerar).toHaveBeenCalledTimes(2);
      expect(geracaoLayout.gerar).toHaveBeenCalledWith(44, 'levantamento', 'auto');
      expect(geracaoLayout.gerar).toHaveBeenCalledWith(44, 'cronograma', 'auto');
      expect(legadoCli.executar).toHaveBeenCalledWith('gerar_do_projeto', {
        projeto: { cliente: 'X', modulos: 'FAT, EST' },
        tipo: 'checklist',
      });
      expect(r.documentosGerados).toEqual([
        'Mapeamento de Processos',
        'Check List do Consultor',
        'Cronograma',
      ]);
    });

    it('ignora um tipo pedido que não é reconhecido (nem "checklist" nem layout fiel)', async () => {
      projetos.find.mockResolvedValue([]);
      projetos.save.mockResolvedValue({ id: 45, cliente: 'X' });
      const r = await service.criarComPacote({ cliente: 'X', gerar: ['termo'] }, 'ana');
      expect(geracaoLayout.gerar).not.toHaveBeenCalled();
      expect(legadoCli.executar).not.toHaveBeenCalled();
      expect(r.documentosGerados).toEqual([]);
    });

    it('envia o e-mail-resumo com os documentos gerados como anexo quando há destinos e SMTP configurado', async () => {
      projetos.find.mockResolvedValue([]);
      projetos.save.mockResolvedValue({ id: 45, cliente: 'X', horasCobradas: '40', horasBonificadas: '8' });
      geracaoLayout.gerar.mockResolvedValue({ filename: 'lev.docx', buffer: Buffer.from('x') });
      documentos.salvarArquivoGerado.mockReturnValue({ arquivo: 'lev.docx', caminho: '/tmp/lev.docx' });
      mailer.configurado.mockReturnValue(true);
      mailer.enviar.mockResolvedValue({ ok: true });
      const r = await service.criarComPacote(
        { cliente: 'X', gerar: ['levantamento'], emailsResponsaveis: 'a@x.com, b@x.com' },
        'ana',
      );
      expect(mailer.enviar).toHaveBeenCalledWith(
        ['a@x.com', 'b@x.com'],
        'Implantação iniciada — X',
        expect.stringContaining('Resumo do projeto de implantação'),
        [{ caminho: '/tmp/lev.docx' }],
      );
      expect(r.emailEnviado).toBe(true);
      expect(r.avisoEmail).toBeUndefined();
    });

    it('sem destinatários: cria o fluxo mas avisa que não enviou e-mail', async () => {
      projetos.find.mockResolvedValue([]);
      projetos.save.mockResolvedValue({ id: 46, cliente: 'X' });
      const r = await service.criarComPacote({ cliente: 'X', gerar: [] }, 'ana');
      expect(mailer.enviar).not.toHaveBeenCalled();
      expect(r.avisoEmail).toBe('Fluxo criado. Nenhum destinatário informado — pacote não enviado por e-mail.');
    });
  });
});
