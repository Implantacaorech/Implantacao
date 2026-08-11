import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import oracledb from 'oracledb';
import { AppModule } from '../src/app.module';
import { Usuario } from '../src/database/entities/usuario.entity';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

// Mesma técnica dos outros e2e: o AppModule arrasta o DisponibilidadeModule, que abre
// conexão Oracle — indisponível aqui, então só a fronteira de rede é mockada.
jest.mock('oracledb', () => ({
  __esModule: true,
  default: {
    getConnection: jest.fn(),
    initOracleClient: jest.fn(),
    OUT_FORMAT_OBJECT: 4002,
  },
}));

interface ItemResposta {
  chave: string;
  nivel: string;
  mensagem: string;
  detalhe: string;
}

describe('Saúde da infraestrutura (e2e)', () => {
  let app: INestApplication<App>;
  let usuarios: Repository<Usuario>;
  let tokenAdm: string;
  let tokenConsultor: string;
  let pastaBackups: string;
  void oracledb;

  const server = () => app.getHttpServer();
  const auth = (req: request.Test, token: string) =>
    req.set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    // Pasta de operação FALSA: o e2e nunca pode ler (nem escrever) o C:\PainelBackups real.
    pastaBackups = mkdtempSync(join(tmpdir(), 'saude-e2e-'));
    process.env.MIGRACAO_BACKUP_DIR = pastaBackups;
    process.env.MIGRACAO_DB_URL = '';
    process.env.MIGRACAO_DB_SQLITE = ':memory:';
    // Endereço morto: a checagem do docservice tem de falhar como "fora do ar", não achar
    // um serviço de verdade rodando na máquina de quem executa a suíte.
    process.env.MIGRACAO_DOCSERVICE_URL = 'http://127.0.0.1:9';

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
  }, 30000);

  afterAll(async () => {
    await app.close();
    rmSync(pastaBackups, { recursive: true, force: true });
    delete process.env.MIGRACAO_BACKUP_DIR;
    delete process.env.MIGRACAO_DOCSERVICE_URL;
  });

  it('exige sessão', async () => {
    expect((await request(server()).get('/api/saude')).status).toBe(401);
  });

  it('exige a permissão do Centro Operacional — Consultor não vê', async () => {
    const res = await auth(request(server()).get('/api/saude'), tokenConsultor);
    expect(res.status).toBe(403);
  });

  it('devolve as seis checagens, com o banco respondendo', async () => {
    const res = await auth(request(server()).get('/api/saude'), tokenAdm);
    expect(res.status).toBe(200);

    const itens = res.body.data.itens as ItemResposta[];
    expect(itens.map((i) => i.chave).sort()).toEqual([
      'backup',
      'banco',
      'docservice',
      'email',
      'guardiao',
      'transcricao',
    ]);
    // O banco do e2e é o SQLite em memória — está de pé, e o item prova que a checagem
    // atravessa de verdade até a conexão.
    expect(itens.find((i) => i.chave === 'banco')?.nivel).toBe('ok');
    expect(res.body.data.verificadoEm).toBeTruthy();
  }, 20000);

  it('sem backup nenhum na pasta, o diagnóstico fica crítico e diz onde procurar', async () => {
    const res = await auth(request(server()).get('/api/saude'), tokenAdm);
    const backup = (res.body.data.itens as ItemResposta[]).find(
      (i) => i.chave === 'backup',
    );
    expect(backup?.nivel).toBe('critico');
    expect(backup?.detalhe).toContain(pastaBackups);
    expect(res.body.data.nivel).toBe('critico'); // o pior manda no nível geral
  }, 20000);

  it('com um dump recente e cheio, o backup passa a "ok"', async () => {
    const zip = join(pastaBackups, 'painel_novo_mariadb_20260811_220000.zip');
    writeFileSync(zip, Buffer.alloc(1_048_576));
    const agora = new Date();
    utimesSync(zip, agora, agora);

    const res = await auth(request(server()).get('/api/saude'), tokenAdm);
    const backup = (res.body.data.itens as ItemResposta[]).find(
      (i) => i.chave === 'backup',
    );
    expect(backup?.nivel).toBe('ok');
    expect(backup?.mensagem).toContain('1.00 MB');
  }, 20000);

  it('docservice inalcançável vira crítico, com o que rodar para subir', async () => {
    const res = await auth(request(server()).get('/api/saude'), tokenAdm);
    const doc = (res.body.data.itens as ItemResposta[]).find(
      (i) => i.chave === 'docservice',
    );
    expect(doc?.nivel).toBe('critico');
    expect(doc?.detalhe).toContain('iniciar.bat');
  }, 20000);
});
