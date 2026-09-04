import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { rmSync } from 'fs';
import { join } from 'path';
import oracledb from 'oracledb';
import { AppModule } from '../src/app.module';
import { Usuario } from '../src/database/entities/usuario.entity';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { CatalogoSeedService } from '../src/dados/catalogo-seed.service';

// A conexão Oracle real não está disponível neste ambiente — mocka só a fronteira de rede
// (oracledb.getConnection), mesma técnica de disponibilidade.service.spec.ts. O resto do
// fluxo (config em disco, orquestração dos controllers, motor de dashboard) roda de
// verdade.
jest.mock('oracledb', () => ({
  __esModule: true,
  default: {
    getConnection: jest.fn(),
    initOracleClient: jest.fn(),
    OUT_FORMAT_OBJECT: 4002,
  },
}));

describe('Dashboards (e2e)', () => {
  let app: INestApplication<App>;
  let usuarios: Repository<Usuario>;
  let tokenAdm: string;
  let tokenConsultor: string;
  let tokenGci: string;
  const mockedOracledb = oracledb as unknown as { getConnection: jest.Mock };

  const DIR_TESTE = join(
    process.cwd(),
    'dados',
    `disponibilidade_test_${process.env.JEST_WORKER_ID ?? '0'}`,
  );

  const server = () => app.getHttpServer();

  beforeAll(async () => {
    rmSync(DIR_TESTE, { recursive: true, force: true });
    process.env.MIGRACAO_DB_URL = '';
    process.env.MIGRACAO_DB_SQLITE = ':memory:';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.setGlobalPrefix('api');
    await app.init();

    usuarios = moduleFixture.get(getRepositoryToken(Usuario));
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
      await request(server())
        .post('/api/auth/login')
        .send({ login: 'admin', senha: 'senha-adm-123' })
    ).body.data.accessToken;
    tokenConsultor = (
      await request(server())
        .post('/api/auth/login')
        .send({ login: 'consultor1', senha: 'senha-cons-123' })
    ).body.data.accessToken;
    tokenGci = (
      await request(server())
        .post('/api/auth/login')
        .send({ login: 'gci1', senha: 'senha-gci-123' })
    ).body.data.accessToken;

    // Auto-seed pulado em teste (NODE_ENV=test) — semeia manualmente. Desde a fase 1 do
    // ADR-0003 quem semeia é o catálogo da API de Dados, não mais o ConsultaBdService.
    await moduleFixture.get(CatalogoSeedService).semear();
  });

  afterAll(async () => {
    await app.close();
    rmSync(DIR_TESTE, { recursive: true, force: true });
  });

  afterEach(() => {
    mockedOracledb.getConnection.mockReset();
  });

  function auth(req: request.Test, token = tokenAdm): request.Test {
    return req.set('Authorization', `Bearer ${token}`);
  }

  // ------------------------------------------------------------------------------------
  // "Config → Disponibilidade" e "Config → Consultas BD" SAÍRAM daqui em `9d4c83f`
  // ("Consultas BD e API de Dados saem do Painel"): a administração dessas conexões passou a
  // existir só no Portal API (ADR-0003). Os describes que as exercitavam continuaram neste
  // arquivo batendo em rota inexistente, e 16 casos falhavam no CI desde então. Quem cobre
  // aquela administração agora é `e2e/testes/08-api-dados.spec.ts`, contra a instância 5198.
  //
  // O caso que RODAVA o motor do dashboard também saiu: ele precisava cadastrar a conexão por
  // `POST /api/config/disponibilidade` para ter o que consultar, e essa rota não existe mais
  // aqui. A matemática que ele provava (recorte por período, agrupamento por mês, rótulos do
  // gráfico e lista de situações) está coberta em
  // `src/disponibilidade/dashboards.service.spec.ts`, com mais casos do que havia aqui.
  //
  // O que sobra abaixo é o que este arquivo pode de fato provar hoje: quem alcança a tela de
  // Dashboards, e que sem conexão cadastrada ela degrada com aviso em vez de quebrar.
  // ------------------------------------------------------------------------------------
  describe('Dashboards', () => {
    it('Consultor acessa — Dashboards é liberado a todo o time pelo painel de Permissões', async () => {
      // Mudou em 2026-07-28, quando as liberações saíram do código e foram para o banco:
      // `dashboards` tem `alteracao` para todos os papéis internos (só o Comercial fica em
      // `consulta`) em PADRAO_PERMISSOES. O teste afirmava a regra fixa anterior, de gestão.
      const res = await auth(
        request(server()).get('/api/dashboards'),
        tokenConsultor,
      );
      expect(res.status).toBe(200);
    });

    it('GCI acessa a listagem de dashboards disponíveis', async () => {
      const res = await auth(
        request(server()).get('/api/dashboards'),
        tokenGci,
      );
      expect(res.status).toBe(200);
      expect(
        res.body.data.itens.some(
          (d: { slug: string }) => d.slug === 'previsao_inicio_oficial',
        ),
      ).toBe(true);
    });

    it('sem conexão configurada, devolve erro amigável (200, não quebra a tela)', async () => {
      // Nenhuma conexão é cadastrada neste arquivo — a rota que fazia isso saiu para o Portal
      // API. E é justamente esse o estado sob teste: a tela tem de avisar, não quebrar.
      const res = await auth(
        request(server()).get('/api/dashboards/previsao_inicio_oficial'),
      );
      expect(res.status).toBe(200);
      expect(res.body.data.erro).toContain('não configurada');
    });

    it('dashboard inexistente devolve o erro de "não configurada" (não 404 solto)', async () => {
      const res = await auth(
        request(server()).get('/api/dashboards/nao-existe'),
        tokenGci,
      );
      expect(res.status).toBe(200);
      expect(res.body.data.erro).toContain('não configurada');
    });
  });
});
