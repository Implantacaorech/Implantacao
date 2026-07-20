import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Usuario } from '../src/database/entities/usuario.entity';
import { SigerFonte } from '../src/database/entities/siger-fonte.entity';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

/** Prova ponta a ponta da busca sobre o código-fonte do SIGER® indexado: qualquer perfil
 * autenticado pesquisa (não é uma tela de gestão), o resultado traz um trecho do conteúdo em
 * torno do termo buscado, e o status honesto reflete só o que foi de fato importado. */
describe('Base de Conhecimento SIGER (e2e)', () => {
  let app: INestApplication<App>;
  let usuarios: Repository<Usuario>;
  let fontes: Repository<SigerFonte>;
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
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.setGlobalPrefix('api');
    await app.init();

    usuarios = moduleFixture.get(getRepositoryToken(Usuario));
    fontes = moduleFixture.get(getRepositoryToken(SigerFonte));

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
    tokenConsultor = (
      await request(server())
        .post('/api/auth/login')
        .send({ login: 'consultor1', senha: 'senha-cons-123' })
    ).body.data.accessToken;

    await fontes.save(
      fontes.create({
        caminho: 'CRIAFONTES_MTZ/22.20c/AUE031.CBL',
        extensao: '.cbl',
        pastaRaiz: 'CRIAFONTES_MTZ',
        tamanhoBytes: 12345,
        modificadoEm: new Date('2026-01-01'),
        hashSha256: 'a'.repeat(64),
        conteudo: 'PROCEDURE DIVISION.\n    MOVE SALDO-DEVEDOR TO WS-RESULTADO.',
      }),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('Consultor (qualquer autenticado) pesquisa e recebe trecho do conteúdo', async () => {
    const res = await request(server())
      .get('/api/base-conhecimento/pesquisar')
      .query({ q: 'SALDO-DEVEDOR' })
      .set('Authorization', `Bearer ${tokenConsultor}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].caminho).toBe('CRIAFONTES_MTZ/22.20c/AUE031.CBL');
    expect(res.body.data[0].trecho).toContain('SALDO-DEVEDOR');
  });

  it('sem termo de busca retorna lista vazia em vez de erro', async () => {
    const res = await request(server())
      .get('/api/base-conhecimento/pesquisar')
      .set('Authorization', `Bearer ${tokenConsultor}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('sem autenticação é rejeitado', async () => {
    const res = await request(server())
      .get('/api/base-conhecimento/pesquisar')
      .query({ q: 'qualquer' });
    expect(res.status).toBe(401);
  });

  it('status reflete a cobertura real (não inventa números)', async () => {
    const res = await request(server())
      .get('/api/base-conhecimento/status')
      .set('Authorization', `Bearer ${tokenConsultor}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totalIndexado).toBe(1);
    expect(res.body.data.totalComConteudo).toBe(1);
  });
});
