import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { BiImplantacaoController } from './bi-implantacao.controller';
import { BiImplantacaoService } from './bi-implantacao.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissaoGuard } from '../permissoes/permissao.guard';

/** Estes testes existem porque os specs de serviço NÃO passam pelo pipeline HTTP: o
 * ValidationPipe global roda com `forbidNonWhitelisted` (parâmetro fora do DTO => 400) e
 * `enableImplicitConversion` (converte tipos sozinho). Um filtro que o frontend manda e o DTO
 * não declara derruba a tela inteira com 400 — sem aparecer em nenhum teste de serviço. */
describe('BiImplantacaoController (HTTP)', () => {
  let app: INestApplication;
  const bi = {
    resumo: jest.fn(),
    extrato: jest.fn(),
    visitasPortal: jest.fn(),
    modeloEmailVisitas: jest.fn(),
    enviarVisitasPorEmail: jest.fn(),
    descricaoCompleta: jest.fn(),
  };

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      controllers: [BiImplantacaoController],
      providers: [{ provide: BiImplantacaoService, useValue: bi }],
    })
      .overrideGuard(JwtAuthGuard)
      // Injeta o req.user que o JwtAuthGuard real colocaria — o @CurrentUser da rota de
      // visitas lê user.sub (sem isso, a rota estoura em user undefined).
      .useValue({
        canActivate: (ctx: import('@nestjs/common').ExecutionContext) => {
          const req = ctx
            .switchToHttp()
            .getRequest<{ user?: { sub: number } }>();
          req.user = { sub: 7 };
          return true;
        },
      })
      .overrideGuard(PermissaoGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = modulo.createNestApplication();
    // MESMA configuração do main.ts — é o que torna este teste representativo
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    bi.resumo.mockResolvedValue({ linhas: [] });
    bi.extrato.mockResolvedValue({ linhas: [] });
    bi.visitasPortal.mockResolvedValue({ linhas: [] });
    bi.modeloEmailVisitas.mockResolvedValue({ assunto: 'A', corpo: 'C' });
    bi.enviarVisitasPorEmail.mockResolvedValue({ ok: true, erro: null });
    bi.descricaoCompleta.mockResolvedValue({
      descricao: 'x',
      tamanho: 1,
      erro: null,
    });
  });

  describe('GET /bi-implantacao/extrato', () => {
    it('aceita a chamada sem filtro nenhum', async () => {
      await request(app.getHttpServer())
        .get('/bi-implantacao/extrato')
        .expect(200);
      expect(bi.extrato).toHaveBeenCalled();
    });

    it('aceita TODOS os filtros que o frontend envia', async () => {
      await request(app.getHttpServer())
        .get('/bi-implantacao/extrato')
        .query({
          dataIni: '2025-07-29',
          dataFim: '2026-07-29',
          grupo: ['G1', 'G2'],
          tecnico: ['Ramon'],
          sigla: ['FAT'],
          cliente: ['DEG'],
          status: ['6-Concluída'],
          rns: ['138935'],
        })
        .expect(200);
      const q = bi.extrato.mock.calls[0][0];
      expect(q.grupo).toEqual(['G1', 'G2']);
      expect(q.status).toEqual(['6-Concluída']);
      expect(q.rns).toEqual(['138935']);
    });

    it('um único valor de filtro chega como ARRAY (o Angular não repete a chave)', async () => {
      await request(app.getHttpServer())
        .get('/bi-implantacao/extrato')
        .query({ sigla: 'FAT', rns: '138935' })
        .expect(200);
      const q = bi.extrato.mock.calls[0][0];
      expect(q.sigla).toEqual(['FAT']);
      expect(q.rns).toEqual(['138935']);
    });

    it('recusa parâmetro desconhecido em vez de ignorá-lo silenciosamente', async () => {
      await request(app.getHttpServer())
        .get('/bi-implantacao/extrato')
        .query({ inventado: 'x' })
        .expect(400);
    });
  });

  describe('GET /bi-implantacao/extrato/descricao', () => {
    it('não é engolida pela rota /extrato', async () => {
      await request(app.getHttpServer())
        .get('/bi-implantacao/extrato/descricao')
        .query({ protocolo: '1435877', datahora: '2026-07-29 10:35' })
        .expect(200);
      expect(bi.descricaoCompleta).toHaveBeenCalledWith(
        1435877,
        '2026-07-29 10:35',
      );
      expect(bi.extrato).not.toHaveBeenCalled();
    });

    it('sem os parâmetros, responde com aviso em vez de 500', async () => {
      const r = await request(app.getHttpServer())
        .get('/bi-implantacao/extrato/descricao')
        .expect(200);
      expect(JSON.stringify(r.body)).toContain('Informe protocolo e datahora');
    });
  });

  describe('GET /bi-implantacao/resumo', () => {
    it('aceita TODOS os filtros que o frontend envia', async () => {
      await request(app.getHttpServer())
        .get('/bi-implantacao/resumo')
        .query({
          dataIni: '2025-07-29',
          dataFim: '2026-07-29',
          grupo: ['G1'],
          status: ['6-Concluída'],
          tecnico: ['Jolemar'],
          ativo: ['Sim'],
          tipoCliente: ['Cliente'],
          rns: ['138935'],
        })
        .expect(200);
      const q = bi.resumo.mock.calls[0][0];
      expect(q.rns).toEqual(['138935']);
      expect(q.tipoCliente).toEqual(['Cliente']);
    });

    it('filtro com valor único também chega como array', async () => {
      await request(app.getHttpServer())
        .get('/bi-implantacao/resumo')
        .query({ status: '6-Concluída' })
        .expect(200);
      expect(bi.resumo.mock.calls[0][0].status).toEqual(['6-Concluída']);
    });
  });

  describe('GET /bi-implantacao/visitas-portal', () => {
    it('aceita a chamada sem filtro nenhum e com o período do De/Até', async () => {
      await request(app.getHttpServer())
        .get('/bi-implantacao/visitas-portal')
        .expect(200);
      expect(bi.visitasPortal).toHaveBeenCalled();

      await request(app.getHttpServer())
        .get('/bi-implantacao/visitas-portal')
        .query({ dataIni: '2025-08-17', dataFim: '2026-08-17' })
        .expect(200);
      const q = bi.visitasPortal.mock.calls[1][0];
      expect(q.dataIni).toBe('2025-08-17');
      expect(q.dataFim).toBe('2026-08-17');
    });

    it('recusa parâmetro desconhecido em vez de ignorá-lo silenciosamente', async () => {
      await request(app.getHttpServer())
        .get('/bi-implantacao/visitas-portal')
        .query({ inventado: 'x' })
        .expect(400);
    });

    it('modelo-email não é engolido pela rota de listagem', async () => {
      await request(app.getHttpServer())
        .get('/bi-implantacao/visitas-portal/modelo-email')
        .expect(200);
      expect(bi.modeloEmailVisitas).toHaveBeenCalled();
      expect(bi.visitasPortal).not.toHaveBeenCalled();
    });

    it('enviar-email aceita o payload da tela e repassa ao serviço', async () => {
      await request(app.getHttpServer())
        .post('/bi-implantacao/visitas-portal/enviar-email')
        .send({
          para: 'coord@rech.com.br',
          assunto: 'Protocolos',
          corpo: 'Segue anexo.',
          recorte: ['Período: 01/08 a 17/08'],
          linhas: [{ empresa: 'MELBROS', protocolo: 135089 }],
        })
        .expect(200);
      expect(bi.enviarVisitasPorEmail).toHaveBeenCalledWith(
        expect.objectContaining({ para: 'coord@rech.com.br' }),
      );
    });

    it('enviar-email recusa campo desconhecido (whitelist do pipe)', async () => {
      await request(app.getHttpServer())
        .post('/bi-implantacao/visitas-portal/enviar-email')
        .send({
          para: 'a@b.c',
          assunto: 'x',
          corpo: 'y',
          recorte: [],
          linhas: [],
          hack: 1,
        })
        .expect(400);
    });
  });
});
