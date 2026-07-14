import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import oracledb from 'oracledb';
import { AppModule } from '../src/app.module';
import { Usuario } from '../src/database/entities/usuario.entity';
import { Projeto } from '../src/database/entities/projeto.entity';
import { Documento } from '../src/database/entities/documento.entity';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

// A conexão Oracle real não está disponível neste ambiente — mocka só a fronteira de rede,
// mesma técnica de disponibilidade-dashboards.e2e-spec.ts (o PainelModule importa
// DisponibilidadeModule transitivamente via CapacidadeService).
jest.mock('oracledb', () => ({
  __esModule: true,
  default: { getConnection: jest.fn(), initOracleClient: jest.fn(), OUT_FORMAT_OBJECT: 4002 },
}));

describe('Painel (e2e)', () => {
  let app: INestApplication<App>;
  let usuarios: Repository<Usuario>;
  let projetos: Repository<Projeto>;
  let documentos: Repository<Documento>;
  let tokenAdm: string;
  let tokenConsultor: string;
  let tokenGci: string;
  void oracledb;

  const server = () => app.getHttpServer();

  function auth(req: request.Test, token: string): request.Test {
    return req.set('Authorization', `Bearer ${token}`);
  }

  beforeAll(async () => {
    process.env.MIGRACAO_DB_URL = '';
    process.env.MIGRACAO_DB_SQLITE = ':memory:';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.setGlobalPrefix('api');
    await app.init();

    usuarios = moduleFixture.get(getRepositoryToken(Usuario));
    projetos = moduleFixture.get(getRepositoryToken(Projeto));
    documentos = moduleFixture.get(getRepositoryToken(Documento));

    await usuarios.save(
      usuarios.create({
        login: 'admin',
        nome: 'Administradora',
        email: 'adm@teste.com',
        senhaHash: await bcrypt.hash('senha-adm-123', 4),
        perfil: 'ADM',
        ativo: true,
      }),
    );
    await usuarios.save(
      usuarios.create({
        login: 'consultor1',
        nome: 'Consultor Um',
        email: 'consultor1@teste.com',
        senhaHash: await bcrypt.hash('senha-cons-123', 4),
        perfil: 'Consultor',
        ativo: true,
      }),
    );
    await usuarios.save(
      usuarios.create({
        login: 'gci1',
        nome: 'GCI Um',
        email: 'gci1@teste.com',
        senhaHash: await bcrypt.hash('senha-gci-123', 4),
        perfil: 'GCI',
        ativo: true,
      }),
    );

    tokenAdm = (
      await request(server()).post('/api/auth/login').send({ login: 'admin', senha: 'senha-adm-123' })
    ).body.data.accessToken;
    tokenConsultor = (
      await request(server())
        .post('/api/auth/login')
        .send({ login: 'consultor1', senha: 'senha-cons-123' })
    ).body.data.accessToken;
    tokenGci = (
      await request(server()).post('/api/auth/login').send({ login: 'gci1', senha: 'senha-gci-123' })
    ).body.data.accessToken;

    const p1 = await projetos.save(
      projetos.create({
        cliente: 'Cliente Visível ao GCI',
        cnpj: 'x',
        numeroProjeto: 'P1',
        modulos: 'FAT',
        horasCobradas: '10',
        gci: 'GCI Um',
        etapa: 'Levantamento',
        situacao: 'Em andamento',
        dataLevantamento: '2026-08-01',
      }),
    );
    await projetos.save(
      projetos.create({
        cliente: 'Cliente de Outro GCI',
        cnpj: 'x',
        numeroProjeto: 'P2',
        modulos: 'FAT',
        horasCobradas: '10',
        gci: 'Outra Pessoa',
        etapa: 'Projeto',
        situacao: 'Em risco',
      }),
    );
    await documentos.save(documentos.create({ projetoId: p1.id, tipo: 'levantamento' }));
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /painel/home', () => {
    it('qualquer perfil autenticado acessa (Consultor incluído)', async () => {
      const res = await auth(request(server()).get('/api/painel/home'), tokenConsultor);
      expect(res.status).toBe(200);
      expect(res.body.data.dados).toBeDefined();
    });

    it('sem token -> 401', async () => {
      const res = await request(server()).get('/api/painel/home');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /painel/coordenacao', () => {
    it('Consultor não acessa (403)', async () => {
      const res = await auth(request(server()).get('/api/painel/coordenacao'), tokenConsultor);
      expect(res.status).toBe(403);
    });

    it('ADM vê a carteira inteira', async () => {
      const res = await auth(request(server()).get('/api/painel/coordenacao'), tokenAdm);
      expect(res.status).toBe(200);
      expect(res.body.data.m.total).toBe(2);
      expect(res.body.data.etapas).toContain('Encerramento');
    });

    it('GCI só vê os próprios projetos', async () => {
      const res = await auth(request(server()).get('/api/painel/coordenacao'), tokenGci);
      expect(res.status).toBe(200);
      expect(res.body.data.m.total).toBe(1);
    });
  });

  describe('GET /painel/coordenacao/capacidade', () => {
    it('Consultor não acessa (403)', async () => {
      const res = await auth(
        request(server()).get('/api/painel/coordenacao/capacidade'),
        tokenConsultor,
      );
      expect(res.status).toBe(403);
    });

    it('ADM avalia a equipe (sem Consultor/GCI cadastrado com perfil certo -> equipe vazia é aceitável)', async () => {
      const res = await auth(
        request(server()).get('/api/painel/coordenacao/capacidade').query({ semanas: '2' }),
        tokenAdm,
      );
      expect(res.status).toBe(200);
      expect(res.body.data.turnosSemana).toBe(10);
      expect(res.body.data.semanas).toHaveLength(2);
      expect(res.body.data.equipe.map((e: { nome: string }) => e.nome)).toEqual(
        expect.arrayContaining(['Consultor Um', 'GCI Um']),
      );
    });
  });

  describe('GET /painel/atividade', () => {
    it('Consultor não acessa (403)', async () => {
      const res = await auth(request(server()).get('/api/painel/atividade'), tokenConsultor);
      expect(res.status).toBe(403);
    });

    it('ADM vê o funil macro cobrindo os projetos visíveis', async () => {
      const res = await auth(request(server()).get('/api/painel/atividade'), tokenAdm);
      expect(res.status).toBe(200);
      const total = res.body.data.funil.reduce((n: number, f: { n: number }) => n + f.n, 0);
      expect(total).toBe(2);
    });
  });

  describe('POST /painel/coordenacao/digest', () => {
    it('Consultor não acessa (403)', async () => {
      const res = await auth(request(server()).post('/api/painel/coordenacao/digest'), tokenConsultor);
      expect(res.status).toBe(403);
    });

    it('ADM aciona o envio manual — sem MIGRACAO_DIGEST_PARA configurado, devolve erro amigável (200)', async () => {
      const res = await auth(request(server()).post('/api/painel/coordenacao/digest'), tokenAdm);
      expect(res.status).toBe(200);
      expect(res.body.data.ok).toBe(false);
      expect(res.body.data.mensagem).toContain('destinatários');
    });
  });

  describe('GET /painel/monitoramento', () => {
    it('Consultor não acessa (403)', async () => {
      const res = await auth(request(server()).get('/api/painel/monitoramento'), tokenConsultor);
      expect(res.status).toBe(403);
    });

    it('ADM vê os 8 setores, saúde e mapa cobrindo a carteira inteira', async () => {
      const res = await auth(request(server()).get('/api/painel/monitoramento'), tokenAdm);
      expect(res.status).toBe(200);
      expect(res.body.data.setores).toHaveLength(8);
      expect(typeof res.body.data.saude).toBe('number');
      expect(res.body.data.mapa).toHaveLength(2); // os 2 projetos ativos vistos pelo ADM
    });

    it('GCI só vê o próprio projeto no mapa', async () => {
      const res = await auth(request(server()).get('/api/painel/monitoramento'), tokenGci);
      expect(res.status).toBe(200);
      expect(res.body.data.mapa).toHaveLength(1);
      expect(res.body.data.mapa[0].cliente).toBe('Cliente Visível ao GCI');
    });
  });
});
