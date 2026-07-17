import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Usuario } from '../src/database/entities/usuario.entity';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

// Suíte end-to-end do primeiro corte da migração: autenticação (login/refresh/logout,
// autorização por perfil) + módulo Projetos (CRUD + filtro de visibilidade _so_meus).
// Cada execução usa um SQLite em memória isolado (ver src/config/configuration.ts).
describe('Auth + Projetos (e2e)', () => {
  let app: INestApplication<App>;
  let usuarios: Repository<Usuario>;

  beforeAll(async () => {
    process.env.MIGRACAO_DB_URL = '';
    process.env.MIGRACAO_DB_SQLITE = ':memory:';
    process.env.MIGRACAO_JWT_EXPIRES_IN = '15m';

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
        nome: 'Administradora Teste',
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
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();

  async function login(login_: string, senha: string) {
    const res = await request(server())
      .post('/api/auth/login')
      .send({ login: login_, senha });
    return res;
  }

  it('rejeita login com senha errada (401, sem vazar detalhe interno)', async () => {
    const res = await login('admin', 'senha-errada');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Login ou senha inválidos');
  });

  it('autentica e devolve access+refresh token', async () => {
    const res = await login('admin', 'senha-adm-123');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.usuario).toMatchObject({
      login: 'admin',
      perfil: 'ADM',
    });
  });

  it('rejeita rota protegida sem token (401)', async () => {
    const res = await request(server()).get('/api/projetos');
    expect(res.status).toBe(401);
  });

  it('renova o access token via refresh e revoga o token antigo', async () => {
    const { body } = await login('admin', 'senha-adm-123');
    const refreshToken: string = body.data.refreshToken;

    const renovado = await request(server())
      .post('/api/auth/refresh')
      .send({ refreshToken });
    expect(renovado.status).toBe(200);
    expect(renovado.body.data.accessToken).toBeDefined();

    // token antigo já rotacionado — reutilizá-lo deve falhar
    const reuso = await request(server())
      .post('/api/auth/refresh')
      .send({ refreshToken });
    expect(reuso.status).toBe(401);
  });

  it('logout revoga o refresh token (não pode mais renovar depois)', async () => {
    const { body } = await login('admin', 'senha-adm-123');
    const { accessToken, refreshToken } = body.data;

    const logout = await request(server())
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken });
    expect(logout.status).toBe(200);

    const renovar = await request(server())
      .post('/api/auth/refresh')
      .send({ refreshToken });
    expect(renovar.status).toBe(401);
  });

  describe('Projetos — CRUD e controle de acesso por perfil', () => {
    let tokenAdm: string;
    let tokenConsultor: string;
    let projetoId: number;

    beforeAll(async () => {
      tokenAdm = (await login('admin', 'senha-adm-123')).body.data.accessToken;
      tokenConsultor = (await login('consultor1', 'senha-cons-123')).body.data
        .accessToken;
    });

    it('ADM cria um projeto', async () => {
      const res = await request(server())
        .post('/api/projetos')
        .set('Authorization', `Bearer ${tokenAdm}`)
        .send({
          cliente: 'Cliente E2E LTDA',
          cnpj: '00.000.000/0001-55',
          consultor: 'Consultor Um',
          gci: 'Bruna',
        });
      expect(res.status).toBe(201);
      expect(res.body.data.cliente).toBe('Cliente E2E LTDA');
      projetoId = res.body.data.id;
    });

    it('Consultor não pode criar projeto (403 — RolesGuard)', async () => {
      const res = await request(server())
        .post('/api/projetos')
        .set('Authorization', `Bearer ${tokenConsultor}`)
        .send({ cliente: 'Outro Cliente LTDA' });
      expect(res.status).toBe(403);
    });

    it('rejeita payload inválido (campo desconhecido) com 400 e VALIDATION_ERROR', async () => {
      const res = await request(server())
        .post('/api/projetos')
        .set('Authorization', `Bearer ${tokenAdm}`)
        .send({ cliente: 'Cliente X', campoQueNaoExiste: 'valor' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('lista projetos paginado para ADM (vê todos)', async () => {
      const res = await request(server())
        .get('/api/projetos')
        .set('Authorization', `Bearer ${tokenAdm}`);
      expect(res.status).toBe(200);
      expect(res.body.pagination).toMatchObject({ page: 1, limit: 20 });
      expect(
        res.body.data.some((p: { id: number }) => p.id === projetoId),
      ).toBe(true);
    });

    it('aceita limit=1000 (achado real: a tela Carteira busca tudo de uma vez assim, e o antigo @Max(100) rejeitava com 400, deixando a lista sempre vazia)', async () => {
      const res = await request(server())
        .get('/api/projetos')
        .query({ page: 1, limit: 1000 })
        .set('Authorization', `Bearer ${tokenAdm}`);
      expect(res.status).toBe(200);
      expect(res.body.pagination.limit).toBe(1000);
      expect(
        res.body.data.some((p: { id: number }) => p.id === projetoId),
      ).toBe(true);
    });

    it('Consultor só vê projetos onde está designado (_so_meus)', async () => {
      const res = await request(server())
        .get('/api/projetos')
        .set('Authorization', `Bearer ${tokenConsultor}`);
      expect(res.status).toBe(200);
      expect(
        res.body.data.every(
          (p: { consultor: string }) => p.consultor === 'Consultor Um',
        ),
      ).toBe(true);
      expect(
        res.body.data.some((p: { id: number }) => p.id === projetoId),
      ).toBe(true);
    });

    it('busca, atualiza e exclui um projeto', async () => {
      const busca = await request(server())
        .get(`/api/projetos/${projetoId}`)
        .set('Authorization', `Bearer ${tokenAdm}`);
      expect(busca.status).toBe(200);
      expect(busca.body.data.id).toBe(projetoId);

      const atualiza = await request(server())
        .put(`/api/projetos/${projetoId}`)
        .set('Authorization', `Bearer ${tokenAdm}`)
        .send({ situacao: 'Em risco' });
      expect(atualiza.status).toBe(200);
      expect(atualiza.body.data.situacao).toBe('Em risco');

      const exclui = await request(server())
        .delete(`/api/projetos/${projetoId}`)
        .set('Authorization', `Bearer ${tokenAdm}`);
      expect(exclui.status).toBe(200);

      const buscaDepois = await request(server())
        .get(`/api/projetos/${projetoId}`)
        .set('Authorization', `Bearer ${tokenAdm}`);
      expect(buscaDepois.status).toBe(404);
    });

    it('projeto inexistente devolve 404 com NOT_FOUND', async () => {
      const res = await request(server())
        .get('/api/projetos/999999')
        .set('Authorization', `Bearer ${tokenAdm}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NOT_FOUND');
    });
  });
});
