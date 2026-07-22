import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ModeloEmailService } from './modelo-email.service';
import { ModeloEmail } from '../database/entities/modelo-email.entity';
import { MODELOS_EMAIL_PADRAO } from './modelo-email.constants';

describe('ModeloEmailService', () => {
  let service: ModeloEmailService;

  const repo = {
    count: jest.fn(),
    save: jest.fn((entity) =>
      Promise.resolve({ id: entity.id ?? 1, ...entity }),
    ),
    create: jest.fn((dto) => dto),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModeloEmailService,
        { provide: getRepositoryToken(ModeloEmail), useValue: repo },
      ],
    }).compile();
    service = module.get(ModeloEmailService);
  });

  describe('seedPadroes', () => {
    it('semeia os 7 modelos padrão quando nenhum existe', async () => {
      repo.count.mockResolvedValue(0);
      const n = await service.seedPadroes();
      expect(n).toBe(MODELOS_EMAIL_PADRAO.length);
      expect(repo.save).toHaveBeenCalledTimes(MODELOS_EMAIL_PADRAO.length);
    });

    it('é idempotente por slug — não recria os que já existem', async () => {
      repo.count.mockResolvedValue(1);
      const n = await service.seedPadroes();
      expect(n).toBe(0);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('salvar', () => {
    it('gera um slug único a partir do nome ao criar', async () => {
      repo.count.mockResolvedValue(0);
      const m = await service.salvar({
        nome: 'Aviso Rapido',
        assunto: 'A',
        corpo: 'B',
      });
      expect(m.slug).toBe('aviso-rapido');
    });

    it(
      'slug não normaliza acentos — mesmo comportamento do regex original em Python ' +
        '(re.sub(r"[^a-z0-9]+", "-", nome.lower()), sem NFKD)',
      async () => {
        repo.count.mockResolvedValue(0);
        const m = await service.salvar({
          nome: 'Início Rápido',
          assunto: 'A',
          corpo: 'B',
        });
        expect(m.slug).toBe('in-cio-r-pido');
      },
    );

    it('evita colisão de slug adicionando sufixo numérico', async () => {
      repo.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
      const m = await service.salvar({
        nome: 'Boas-vindas',
        assunto: 'A',
        corpo: 'B',
      });
      expect(m.slug).toBe('boas-vindas-1');
    });

    it('atualizar não regenera o slug', async () => {
      repo.findOne.mockResolvedValue({ id: 5, slug: 'antigo', padrao: false });
      const m = await service.salvar(
        { nome: 'Novo nome', assunto: 'A', corpo: 'B' },
        5,
      );
      expect(m.slug).toBe('antigo');
    });
  });

  describe('excluir', () => {
    it('recusa excluir modelo padrão', async () => {
      repo.findOne.mockResolvedValue({ id: 1, padrao: true });
      const r = await service.excluir(1);
      expect(r.ok).toBe(false);
      expect(repo.remove).not.toHaveBeenCalled();
    });

    it('exclui modelo não-padrão', async () => {
      repo.findOne.mockResolvedValue({ id: 2, padrao: false });
      const r = await service.excluir(2);
      expect(r.ok).toBe(true);
      expect(repo.remove).toHaveBeenCalled();
    });
  });

  describe('renderizar', () => {
    it('substitui variáveis simples e deriva CONSULTOR_A/B do campo consultor', () => {
      const texto =
        'Olá {{CLIENTE}}, consultores {{CONSULTOR_A}} e {{CONSULTOR_B}}.';
      const out = service.renderizar(texto, {
        cliente: 'Cliente Teste',
        consultor: 'Ana, Beto',
      });
      expect(out).toBe('Olá Cliente Teste, consultores Ana e Beto.');
    });

    it('deixa placeholders sem correspondência intactos e não recursiona substituições', () => {
      const texto = '{{CLIENTE}} — {{NAO_EXISTE}}';
      const out = service.renderizar(texto, { cliente: '{{OUTRO}}' });
      expect(out).toBe('{{OUTRO}} — {{NAO_EXISTE}}');
    });

    it('texto vazio devolve vazio sem lançar', () => {
      expect(service.renderizar('', {} as any)).toBe('');
    });
  });
});
