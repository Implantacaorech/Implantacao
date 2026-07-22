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

/** Prova ponta a ponta de que o pipeline de telemetria de agentes é real, não simulado:
 * inicia uma execução via HTTP (como um agente faria de verdade via curl), confirma que ela
 * aparece "ativa" no grafo, conclui, e confirma que sai de "ativa" e conta em execucoes24h. */
describe('Agentes — telemetria de execução (e2e)', () => {
  let app: INestApplication<App>;
  let usuarios: Repository<Usuario>;
  let tokenAdm: string;
  let tokenConsultor: string;

  const server = () => app.getHttpServer();

  beforeAll(async () => {
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
  });

  afterAll(async () => {
    await app.close();
  });

  it('Consultor (qualquer autenticado) inicia uma execução real', async () => {
    const res = await request(server())
      .post('/api/agentes/execucoes')
      .set('Authorization', `Bearer ${tokenConsultor}`)
      .send({ agente: 'painel-core', tarefa: 'Teste e2e de telemetria' });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('em_execucao');
    expect(res.body.data.id).toBeGreaterThan(0);
  });

  it('grafo mostra painel-core ativo enquanto a execução não foi concluída', async () => {
    await request(server())
      .post('/api/agentes/execucoes')
      .set('Authorization', `Bearer ${tokenConsultor}`)
      .send({ agente: 'documentacao-contexto', tarefa: 'Outro teste e2e' });

    const grafo = await request(server())
      .get('/api/agentes/grafo')
      .set('Authorization', `Bearer ${tokenAdm}`);
    expect(grafo.status).toBe(200);
    const no = grafo.body.data.nos.find(
      (n: { id: string }) => n.id === 'documentacao-contexto',
    );
    expect(no.ativo).toBe(true);
    expect(no.execucoes24h).toBeGreaterThanOrEqual(1);
    // nó que nunca teve execução nesta suíte continua honesto (não inventa atividade)
    const semExecucao = grafo.body.data.nos.find(
      (n: { id: string }) => n.id === 'gestao-mudanca',
    );
    expect(semExecucao.ativo).toBe(false);
  });

  it('conclui a execução e ela deixa de aparecer como ativa', async () => {
    const iniciada = await request(server())
      .post('/api/agentes/execucoes')
      .set('Authorization', `Bearer ${tokenConsultor}`)
      .send({ agente: 'seguranca-permissoes', tarefa: 'Revisão de teste' });
    const id = iniciada.body.data.id as number;

    const concluida = await request(server())
      .patch(`/api/agentes/execucoes/${id}`)
      .set('Authorization', `Bearer ${tokenConsultor}`)
      .send({ status: 'concluido', resultado: '2 achados, ambos corrigidos' });
    expect(concluida.status).toBe(200);
    expect(concluida.body.data.status).toBe('concluido');
    expect(concluida.body.data.concluidoEm).toBeTruthy();

    const grafo = await request(server())
      .get('/api/agentes/grafo')
      .set('Authorization', `Bearer ${tokenAdm}`);
    const no = grafo.body.data.nos.find(
      (n: { id: string }) => n.id === 'seguranca-permissoes',
    );
    expect(no.ativo).toBe(false);
    expect(no.execucoes24h).toBeGreaterThanOrEqual(1);
  });

  it('listar exige perfil de gestão (Consultor não pode ver o dashboard)', async () => {
    const negado = await request(server())
      .get('/api/agentes/execucoes')
      .set('Authorization', `Bearer ${tokenConsultor}`);
    expect(negado.status).toBe(403);

    const ok = await request(server())
      .get('/api/agentes/execucoes')
      .set('Authorization', `Bearer ${tokenAdm}`);
    expect(ok.status).toBe(200);
    expect(Array.isArray(ok.body.data)).toBe(true);
  });
});
