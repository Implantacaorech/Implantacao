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
import { ConsultaBdService } from '../src/disponibilidade/consulta-bd.service';

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

describe('Disponibilidade / Consultas BD / Dashboards (e2e)', () => {
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

  function conexaoFake(execute: jest.Mock) {
    return { execute, close: jest.fn().mockResolvedValue(undefined) };
  }

  beforeAll(async () => {
    rmSync(DIR_TESTE, { recursive: true, force: true });
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

    // Auto-seed pulado em teste (NODE_ENV=test) — semeia manualmente, mesmo padrão já
    // usado para os outros catálogos.
    const consultaBdService = moduleFixture.get(ConsultaBdService);
    await consultaBdService.seedPadrao();
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

  describe('Config → Disponibilidade', () => {
    it('não-ADM não acessa', async () => {
      const res = await auth(request(server()).get('/api/config/disponibilidade'), tokenConsultor);
      expect(res.status).toBe(403);
    });

    it('salva e lê de volta, sem nunca devolver a senha', async () => {
      const salvar = await auth(
        request(server())
          .post('/api/config/disponibilidade')
          .send({ tipo: 'oracle', host: 'sicla.invalid', porta: '1521', banco: 'ORCL', usuario: 'u', senha: 'segredo', select: 'SELECT 1', ativo: true }),
      );
      expect(salvar.status).toBe(200);
      expect(salvar.body.data.senha).toBeUndefined();
      expect(salvar.body.data.configurado).toBe(true);

      const status = await auth(request(server()).get('/api/config/disponibilidade'));
      expect(status.body.data.host).toBe('sicla.invalid');
      expect(status.body.data.senha).toBeUndefined();
    });

    it('testar devolve a amostra da conexão mockada', async () => {
      const execute = jest.fn().mockResolvedValue({
        rows: [{ TECNICO: 'Ana', DATA: '2026-08-10', TURNO: '' }],
      });
      mockedOracledb.getConnection.mockResolvedValue(conexaoFake(execute));
      const r = await auth(request(server()).post('/api/config/disponibilidade/testar'));
      expect(r.status).toBe(200);
      expect(r.body.data.ok).toBe(true);
      expect(r.body.data.amostra).toHaveLength(1);
    });
  });

  describe('Config → Consultas BD', () => {
    it('não-ADM não acessa (nem Coordenador/GCI — mais restrito que as demais telas de Sistema)', async () => {
      const res = await auth(request(server()).get('/api/config/consultas-bd'), tokenGci);
      expect(res.status).toBe(403);
    });

    it('lista a consulta padrão semeada, já com metadata de dashboard', async () => {
      const res = await auth(request(server()).get('/api/config/consultas-bd'));
      const previsao = res.body.data.itens.find(
        (c: { slug: string }) => c.slug === 'previsao_inicio_oficial',
      );
      expect(previsao).toBeDefined();
      expect(previsao.colunaData).toBe('PREVISAO_INICIO_OFICIAL');
      expect(previsao.mostrarGrafico).toBe(true);
    });

    it('cria, edita e exclui uma consulta nova', async () => {
      const criar = await auth(
        request(server())
          .post('/api/config/consultas-bd')
          .send({ nome: 'Minha Consulta', sql: 'SELECT 1 FROM dual' }),
      );
      expect(criar.status).toBe(200);
      expect(criar.body.data.slug).toBe('minha_consulta');

      const editar = await auth(
        request(server())
          .post('/api/config/consultas-bd/minha_consulta')
          .send({ sql: 'SELECT 2 FROM dual' }),
      );
      expect(editar.body.data.sql).toBe('SELECT 2 FROM dual');

      const excluir = await auth(request(server()).post('/api/config/consultas-bd/minha_consulta/excluir'));
      expect(excluir.status).toBe(200);

      const depois = await auth(request(server()).get('/api/config/consultas-bd/minha_consulta'));
      expect(depois.status).toBe(404);
    });

    it('não deixa criar duas consultas com o mesmo identificador', async () => {
      // Nota: o slug derivado do `nome` NÃO tira acento (mesmo comportamento do Flask
      // original, webapp/routes_config.py:config_consultas_bd — só `.lower().replace(" ",
      // "_")`) — por isso o teste usa o `slug` explícito para bater com o já semeado, em
      // vez de reenviar "Previsão Início Oficial" (que geraria um slug ACENTUADO
      // diferente do seed ASCII "previsao_inicio_oficial").
      const r = await auth(
        request(server())
          .post('/api/config/consultas-bd')
          .send({ slug: 'previsao_inicio_oficial', nome: 'Duplicata', sql: 'SELECT 1' }),
      );
      expect(r.status).toBe(400);
    });

    it('testar sempre supre :data_ini/:data_fim, mesmo para uma consulta que não os usa', async () => {
      const execute = jest.fn().mockResolvedValue({ rows: [], metaData: [] });
      mockedOracledb.getConnection.mockResolvedValue(conexaoFake(execute));
      await auth(
        request(server())
          .post('/api/config/consultas-bd')
          .send({ nome: 'Sem Data', sql: 'SELECT 1 FROM dual' }),
      );
      const r = await auth(request(server()).post('/api/config/consultas-bd/sem_data/testar'));
      expect(r.status).toBe(200);
      expect(r.body.data.ok).toBe(true);
      const [, bindsChamados] = execute.mock.calls[0];
      expect(bindsChamados).toHaveProperty('data_ini');
      expect(bindsChamados).toHaveProperty('data_fim');
    });
  });

  describe('Dashboards', () => {
    it('Consultor não acessa (só gestão: ADM/Coordenador/Administrativo/GCI)', async () => {
      const res = await auth(request(server()).get('/api/dashboards'), tokenConsultor);
      expect(res.status).toBe(403);
    });

    it('GCI acessa a listagem de dashboards disponíveis', async () => {
      const res = await auth(request(server()).get('/api/dashboards'), tokenGci);
      expect(res.status).toBe(200);
      expect(
        res.body.data.itens.some((d: { slug: string }) => d.slug === 'previsao_inicio_oficial'),
      ).toBe(true);
    });

    it('sem conexão configurada, devolve erro amigável (200, não quebra a tela)', async () => {
      // desativa a conexão salva nos testes anteriores
      await auth(
        request(server())
          .post('/api/config/disponibilidade')
          .send({ select: 'SELECT 1', ativo: false }),
      );
      const res = await auth(request(server()).get('/api/dashboards/previsao_inicio_oficial'));
      expect(res.status).toBe(200);
      expect(res.body.data.erro).toContain('não configurada');
    });

    it('roda o dashboard: filtra por período, monta o gráfico por mês e a lista de situações', async () => {
      await auth(
        request(server())
          .post('/api/config/disponibilidade')
          .send({ host: 'sicla.invalid', banco: 'ORCL', select: 'SELECT 1', ativo: true }),
      );
      const execute = jest.fn().mockResolvedValue({
        rows: [
          { CODIGO: 'A1', CLIENTE: 'Cliente X', PREVISAO_INICIO_OFICIAL: '2026-01-15', SITUACAO: 'Em andamento' },
          { CODIGO: 'A2', CLIENTE: 'Cliente Y', PREVISAO_INICIO_OFICIAL: '2026-02-05', SITUACAO: 'Concluído' },
        ],
      });
      mockedOracledb.getConnection.mockResolvedValue(conexaoFake(execute));

      const res = await auth(
        request(server())
          .get('/api/dashboards/previsao_inicio_oficial')
          .query({ ref: '2026-01', n: '2' }),
        tokenGci,
      );
      expect(res.status).toBe(200);
      expect(res.body.data.erro).toBeNull();
      expect(res.body.data.linhasTabela).toHaveLength(2);
      expect(res.body.data.grafico).toEqual({ labels: ['janeiro', 'fevereiro'], valores: [1, 1] });
      expect(res.body.data.situacoesDisponiveis).toEqual(['Concluído', 'Em andamento']);
    });

    it('dashboard inexistente devolve o erro de "não configurada" (não 404 solto)', async () => {
      const res = await auth(request(server()).get('/api/dashboards/nao-existe'), tokenGci);
      expect(res.status).toBe(200);
      expect(res.body.data.erro).toContain('não configurada');
    });
  });
});
