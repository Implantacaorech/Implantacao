import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Usuario } from '../src/database/entities/usuario.entity';
import { MatrizCompetencia } from '../src/database/entities/matriz-competencia.entity';
import { MatrizTecnico } from '../src/database/entities/matriz-tecnico.entity';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

describe('Matriz de Conhecimento (e2e)', () => {
  let app: INestApplication<App>;
  let usuarios: Repository<Usuario>;
  let competencias: Repository<MatrizCompetencia>;
  let tecnicos: Repository<MatrizTecnico>;
  let tokenAdm: string;
  let tokenCoordenador: string;
  let tokenAna: string; // Consultor, casado por código SICLA
  let tokenBeto: string; // GCI, sem linha na matriz
  let idAna: number;

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
    competencias = moduleFixture.get(getRepositoryToken(MatrizCompetencia));
    tecnicos = moduleFixture.get(getRepositoryToken(MatrizTecnico));

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
        login: 'coord1',
        nome: 'Coordenadora Um',
        email: 'coord1@teste.com',
        senhaHash: await bcrypt.hash('senha-coord-123', 4),
        perfil: 'Coordenador',
        ativo: true,
      }),
    );
    await usuarios.save(
      usuarios.create({
        login: 'ana',
        nome: 'Ana Consultora',
        email: 'ana@teste.com',
        senhaHash: await bcrypt.hash('senha-ana-123', 4),
        perfil: 'Consultor',
        codigoSicla: '007',
        ativo: true,
      }),
    );
    await usuarios.save(
      usuarios.create({
        login: 'beto',
        nome: 'Beto GCI',
        email: 'beto@teste.com',
        senhaHash: await bcrypt.hash('senha-beto-123', 4),
        perfil: 'GCI',
        codigoSicla: '008',
        ativo: true,
      }),
    );

    tokenAdm = (
      await request(server()).post('/api/auth/login').send({ login: 'admin', senha: 'senha-adm-123' })
    ).body.data.accessToken;
    tokenCoordenador = (
      await request(server())
        .post('/api/auth/login')
        .send({ login: 'coord1', senha: 'senha-coord-123' })
    ).body.data.accessToken;
    tokenAna = (
      await request(server()).post('/api/auth/login').send({ login: 'ana', senha: 'senha-ana-123' })
    ).body.data.accessToken;
    tokenBeto = (
      await request(server()).post('/api/auth/login').send({ login: 'beto', senha: 'senha-beto-123' })
    ).body.data.accessToken;

    await competencias.save(competencias.create({ sigla: 'FAT01', area: 'Faturamento', ordem: 1 }));
    const ana = await tecnicos.save(
      tecnicos.create({
        nome: '007', // casado pelo Código SICLA da Ana
        setor: 'Implantação',
        dias: '365',
        notas: JSON.stringify({ FAT01: 8 }),
      }),
    );
    idAna = ana.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /matriz', () => {
    it('ADM/Coordenador (VE_TUDO) veem a lista completa, com qtdNotas', async () => {
      const res = await auth(request(server()).get('/api/matriz'), tokenAdm);
      expect(res.status).toBe(200);
      expect(res.body.data.restrito).toBe(false);
      expect(res.body.data.podeAdmin).toBe(true);
      const linha = res.body.data.itens.find((t: { id: number }) => t.id === idAna);
      expect(linha.qtdNotas).toBe(1);

      const resCoord = await auth(request(server()).get('/api/matriz'), tokenCoordenador);
      expect(resCoord.body.data.restrito).toBe(false);
      expect(resCoord.body.data.podeAdmin).toBe(false);
    });

    it('Consultor com linha própria é redirecionado (não vê a lista)', async () => {
      const res = await auth(request(server()).get('/api/matriz'), tokenAna);
      expect(res.status).toBe(200);
      expect(res.body.data.itens).toEqual([]);
      expect(res.body.data.redirecionarParaId).toBe(idAna);
    });

    it('GCI sem linha cadastrada vê "restrito"', async () => {
      const res = await auth(request(server()).get('/api/matriz'), tokenBeto);
      expect(res.status).toBe(200);
      expect(res.body.data.restrito).toBe(true);
      expect(res.body.data.itens).toEqual([]);
    });
  });

  describe('GET /matriz/:id', () => {
    it('a própria consultora acessa a própria ficha, editável', async () => {
      const res = await auth(request(server()).get(`/api/matriz/${idAna}`), tokenAna);
      expect(res.status).toBe(200);
      expect(res.body.data.editavel).toBe(true);
      expect(res.body.data.notas).toEqual({ FAT01: 8 });
      expect(res.body.data.areas).toEqual([['Faturamento', expect.any(Array)]]);
    });

    it('GCI não pode abrir a ficha de outra pessoa (403)', async () => {
      const res = await auth(request(server()).get(`/api/matriz/${idAna}`), tokenBeto);
      expect(res.status).toBe(403);
    });

    it('Coordenador acessa qualquer ficha, mas não pode editar', async () => {
      const res = await auth(request(server()).get(`/api/matriz/${idAna}`), tokenCoordenador);
      expect(res.status).toBe(200);
      expect(res.body.data.editavel).toBe(false);
    });

    it('id inexistente -> 404', async () => {
      const res = await auth(request(server()).get('/api/matriz/999999'), tokenAdm);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /matriz/:id/salvar', () => {
    it('a própria consultora salva as notas', async () => {
      const res = await auth(
        request(server()).post(`/api/matriz/${idAna}/salvar`),
        tokenAna,
      ).send({ notas: { FAT01: '10' }, setor: 'Implantação Sênior' });
      expect(res.status).toBe(200);

      const ficha = await auth(request(server()).get(`/api/matriz/${idAna}`), tokenAna);
      expect(ficha.body.data.notas).toEqual({ FAT01: 10 });
      expect(ficha.body.data.tecnico.setor).toBe('Implantação Sênior');
    });

    it('Coordenador (só consulta) não pode salvar (403)', async () => {
      const res = await auth(
        request(server()).post(`/api/matriz/${idAna}/salvar`),
        tokenCoordenador,
      ).send({ notas: { FAT01: '1' } });
      expect(res.status).toBe(403);
    });

    it('GCI não pode salvar a ficha de outra pessoa (403)', async () => {
      const res = await auth(
        request(server()).post(`/api/matriz/${idAna}/salvar`),
        tokenBeto,
      ).send({ notas: { FAT01: '1' } });
      expect(res.status).toBe(403);
    });

    it('ADM sempre pode salvar, mesmo não sendo a própria linha', async () => {
      const res = await auth(
        request(server()).post(`/api/matriz/${idAna}/salvar`),
        tokenAdm,
      ).send({ dias: '400' });
      expect(res.status).toBe(200);
    });
  });

  describe('POST /matriz/importar', () => {
    it('não-ADM não pode importar (403)', async () => {
      const res = await auth(request(server()).post('/api/matriz/importar'), tokenCoordenador);
      expect(res.status).toBe(403);
    });

    it('ADM pode disparar a importação (planilha local pode ou não existir no ambiente)', async () => {
      const res = await auth(request(server()).post('/api/matriz/importar'), tokenAdm);
      expect(res.status).toBe(200);
      expect(typeof res.body.data.ok).toBe('boolean');
      expect(typeof res.body.data.mensagem).toBe('string');
    });
  });
});
