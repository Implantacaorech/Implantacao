import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FluxoService } from './fluxo.service';
import { Projeto } from '../database/entities/projeto.entity';
import { DocumentosService } from '../documentos/documentos.service';
import { NotificacaoService } from '../email/notificacao.service';

describe('FluxoService', () => {
  let service: FluxoService;
  const projetos = { find: jest.fn(), save: jest.fn(), create: jest.fn((dto) => dto) };
  const documentos = { registrarEvento: jest.fn() };
  const notificacao = { notificarEvento: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FluxoService,
        { provide: getRepositoryToken(Projeto), useValue: projetos },
        { provide: DocumentosService, useValue: documentos },
        { provide: NotificacaoService, useValue: notificacao },
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
});
