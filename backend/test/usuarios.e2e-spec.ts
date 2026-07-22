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

describe('Usuários (e2e)', () => {
  let app: INestApplication<App>;
  let usuarios: Repository<Usuario>;
  let tokenAdm: string;
  let tokenConsultor: string;

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

  it('Consultor não acessa (403) — só ADM', async () => {
    const res = await auth(
      request(server()).get('/api/usuarios'),
      tokenConsultor,
    );
    expect(res.status).toBe(403);
  });

  it('lista, nunca devolvendo senhaHash', async () => {
    const res = await auth(request(server()).get('/api/usuarios'), tokenAdm);
    expect(res.status).toBe(200);
    expect(res.body.data.itens.length).toBeGreaterThanOrEqual(2);
    expect(
      res.body.data.itens.every(
        (u: Record<string, unknown>) => !('senhaHash' in u),
      ),
    ).toBe(true);
  });

  it('cria um usuário; login em branco usa o e-mail; Código SICLA é obrigatório', async () => {
    const semCodigo = await auth(
      request(server()).post('/api/usuarios'),
      tokenAdm,
    ).send({
      email: 'novo@teste.com',
      senha: 'segredo1',
    });
    expect(semCodigo.status).toBe(400);

    const res = await auth(
      request(server()).post('/api/usuarios'),
      tokenAdm,
    ).send({
      email: 'novo@teste.com',
      senha: 'segredo1',
      codigoSicla: '099',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.login).toBe('novo@teste.com');
    expect(res.body.data.perfil).toBe('Consultor'); // default
    expect(res.body.data.senhaHash).toBeUndefined();
  });

  it('rejeita e-mail/login duplicado', async () => {
    const res = await auth(
      request(server()).post('/api/usuarios'),
      tokenAdm,
    ).send({
      email: 'novo@teste.com',
      senha: 'segredo1',
      codigoSicla: '098',
    });
    expect(res.status).toBe(409);
  });

  it('atualiza um usuário sem enviar senha — login continua funcionando com a senha antiga', async () => {
    const criado = await auth(
      request(server()).post('/api/usuarios'),
      tokenAdm,
    ).send({
      email: 'editar@teste.com',
      senha: 'senha-original',
      codigoSicla: '050',
    });
    const id = criado.body.data.id;

    const editado = await auth(
      request(server()).put(`/api/usuarios/${id}`),
      tokenAdm,
    ).send({
      nome: 'Nome Editado',
    });
    expect(editado.status).toBe(200);
    expect(editado.body.data.nome).toBe('Nome Editado');

    const login = await request(server())
      .post('/api/auth/login')
      .send({ login: 'editar@teste.com', senha: 'senha-original' });
    expect(login.status).toBe(200); // senha preservada — edição não a tocou
  });

  it('altera a senha quando enviada na edição', async () => {
    const criado = await auth(
      request(server()).post('/api/usuarios'),
      tokenAdm,
    ).send({
      email: 'trocar-senha@teste.com',
      senha: 'senha-velha-123',
      codigoSicla: '051',
    });
    const id = criado.body.data.id;

    await auth(request(server()).put(`/api/usuarios/${id}`), tokenAdm).send({
      senha: 'senha-nova-456',
    });

    const loginAntiga = await request(server())
      .post('/api/auth/login')
      .send({ login: 'trocar-senha@teste.com', senha: 'senha-velha-123' });
    expect(loginAntiga.status).toBe(401);

    const loginNova = await request(server())
      .post('/api/auth/login')
      .send({ login: 'trocar-senha@teste.com', senha: 'senha-nova-456' });
    expect(loginNova.status).toBe(200);
  });
});
