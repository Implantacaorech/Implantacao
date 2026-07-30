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

/** Preferências de tela (filtros salvos) — o ponto sensível é o ESCOPO: cada um só alcança
 * as suas. O dono nunca vem do corpo nem da URL, só do token. */
describe('Preferências de tela (e2e)', () => {
  let app: INestApplication<App>;
  let usuarios: Repository<Usuario>;
  let tokenAna: string;
  let tokenBeto: string;

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
    for (const [login, nome] of [
      ['ana', 'Ana'],
      ['beto', 'Beto'],
    ]) {
      await usuarios.save(
        usuarios.create({
          login,
          nome,
          email: `${login}@teste.com`,
          senhaHash: await bcrypt.hash('senha-123456', 4),
          perfil: 'Consultor',
          ativo: true,
        }),
      );
    }

    const entrar = async (login: string): Promise<string> =>
      (
        await request(server())
          .post('/api/auth/login')
          .send({ login, senha: 'senha-123456' })
      ).body.data.accessToken as string;
    tokenAna = await entrar('ana');
    tokenBeto = await entrar('beto');
  });

  afterAll(async () => {
    await app.close();
  });

  it('exige sessão', async () => {
    expect((await request(server()).get('/api/preferencias')).status).toBe(401);
  });

  it('começa vazio', async () => {
    const res = await auth(
      request(server()).get('/api/preferencias'),
      tokenAna,
    );
    expect(res.status).toBe(200);
    expect(res.body.data.preferencias).toEqual({});
  });

  it('grava e devolve o filtro da tela', async () => {
    const valor = { setor: 'GRM-Implantação', modulos: 'FAT, CTB', semanas: 8 };
    const put = await auth(
      request(server()).put('/api/preferencias/capacidade'),
      tokenAna,
    ).send({ valor });
    expect(put.status).toBe(200);

    const res = await auth(
      request(server()).get('/api/preferencias'),
      tokenAna,
    );
    expect(res.body.data.preferencias).toEqual({ capacidade: valor });
  });

  it('regravar a mesma chave SUBSTITUI (não duplica)', async () => {
    await auth(
      request(server()).put('/api/preferencias/capacidade'),
      tokenAna,
    ).send({ valor: { setor: 'GRM-Suporte' } });

    const res = await auth(
      request(server()).get('/api/preferencias'),
      tokenAna,
    );
    expect(res.body.data.preferencias.capacidade).toEqual({
      setor: 'GRM-Suporte',
    });
  });

  it('guarda telas diferentes em paralelo', async () => {
    await auth(
      request(server()).put('/api/preferencias/carteira'),
      tokenAna,
    ).send({
      valor: { vista: 'tabela' },
    });

    const res = await auth(
      request(server()).get('/api/preferencias'),
      tokenAna,
    );
    expect(Object.keys(res.body.data.preferencias).sort()).toEqual([
      'capacidade',
      'carteira',
    ]);
  });

  it('a preferência é de QUEM ESTÁ LOGADO — o outro usuário não a vê', async () => {
    const res = await auth(
      request(server()).get('/api/preferencias'),
      tokenBeto,
    );
    expect(res.body.data.preferencias).toEqual({});
  });

  it('cada um grava a sua sem pisar na do outro', async () => {
    await auth(
      request(server()).put('/api/preferencias/capacidade'),
      tokenBeto,
    ).send({
      valor: { setor: 'GPD-Desenvolvimento' },
    });

    const doBeto = await auth(
      request(server()).get('/api/preferencias'),
      tokenBeto,
    );
    const daAna = await auth(
      request(server()).get('/api/preferencias'),
      tokenAna,
    );
    expect(doBeto.body.data.preferencias.capacidade).toEqual({
      setor: 'GPD-Desenvolvimento',
    });
    expect(daAna.body.data.preferencias.capacidade).toEqual({
      setor: 'GRM-Suporte',
    });
  });

  it('remove só a chave pedida, só do usuário logado', async () => {
    const del = await auth(
      request(server()).delete('/api/preferencias/capacidade'),
      tokenAna,
    );
    expect(del.status).toBe(200);

    const daAna = await auth(
      request(server()).get('/api/preferencias'),
      tokenAna,
    );
    const doBeto = await auth(
      request(server()).get('/api/preferencias'),
      tokenBeto,
    );
    expect(Object.keys(daAna.body.data.preferencias)).toEqual(['carteira']);
    expect(doBeto.body.data.preferencias.capacidade).toBeDefined();
  });

  it('recusa chave fora do formato', async () => {
    const res = await auth(
      request(server()).put('/api/preferencias/Tela%20Invalida'),
      tokenAna,
    ).send({ valor: {} });
    expect(res.status).toBe(400);
  });

  it('recusa corpo sem `valor`', async () => {
    const res = await auth(
      request(server()).put('/api/preferencias/tela'),
      tokenAna,
    ).send({});
    expect(res.status).toBe(400);
  });

  it('recusa preferência gigante', async () => {
    const res = await auth(
      request(server()).put('/api/preferencias/tela'),
      tokenAna,
    ).send({ valor: { lixo: 'x'.repeat(25_000) } });
    expect(res.status).toBe(400);
  });
});
