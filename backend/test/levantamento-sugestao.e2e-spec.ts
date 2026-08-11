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
import { Protocolo } from '../src/database/entities/protocolo.entity';
import { LevantamentoResposta } from '../src/database/entities/levantamento-resposta.entity';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { IaService } from '../src/ia/ia.service';

jest.mock('oracledb', () => ({
  __esModule: true,
  default: {
    getConnection: jest.fn(),
    initOracleClient: jest.fn(),
    OUT_FORMAT_OBJECT: 4002,
  },
}));

/** Dublê da fronteira de IA — a lógica de leitura da resposta já é coberta em
 * sugestao-levantamento.service.spec.ts; aqui interessa o caminho HTTP inteiro. */
class IaServiceFake {
  static ultimoPrompt = '';
  disponivel(): boolean {
    return true;
  }
  completar(_finalidade: string, opcoes: { messages: { content: string }[] }) {
    IaServiceFake.ultimoPrompt = opcoes.messages[0].content;
    return Promise.resolve(
      JSON.stringify([
        {
          n: 1,
          resposta:
            'A emissão de notas é feita hoje no sistema antigo, uma a uma.',
          trecho: '[00:10]',
        },
      ]),
    );
  }
}

describe('Levantamento a partir da reunião (e2e)', () => {
  let app: INestApplication<App>;
  let usuarios: Repository<Usuario>;
  let projetos: Repository<Projeto>;
  let protocolos: Repository<Protocolo>;
  let linhas: Repository<LevantamentoResposta>;
  let token: string;
  let projetoId: number;
  let gravacaoId: number;
  let linhaId: number;
  void oracledb;

  const server = () => app.getHttpServer();
  const auth = (req: request.Test) =>
    req.set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    process.env.MIGRACAO_DB_URL = '';
    process.env.MIGRACAO_DB_SQLITE = ':memory:';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(IaService)
      .useClass(IaServiceFake)
      .compile();
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
    projetos = moduleFixture.get(getRepositoryToken(Projeto));
    protocolos = moduleFixture.get(getRepositoryToken(Protocolo));
    linhas = moduleFixture.get(getRepositoryToken(LevantamentoResposta));

    await usuarios.save(
      usuarios.create({
        login: 'gci1',
        nome: 'Ivian GCI',
        email: 'gci@teste.com',
        senhaHash: await bcrypt.hash('senha-gci-123', 4),
        perfil: 'GCI',
        ativo: true,
      }),
    );
    token = (
      await request(server())
        .post('/api/auth/login')
        .send({ login: 'gci1', senha: 'senha-gci-123' })
    ).body.data.accessToken;

    const projeto = await projetos.save(
      projetos.create({ cliente: 'Cliente X', modulos: 'FAT' }),
    );
    projetoId = projeto.id;

    // Gravação SEM projetoId, casada só pelo nome do cliente: é o caso real da reunião de
    // levantamento, que acontece antes de a ficha existir (o cliente vem da busca no SICLA).
    const gravacao = await protocolos.save(
      protocolos.create({
        titulo: 'Reunião de levantamento',
        cliente: 'Cliente X',
        videoOrigem: 'gravacao',
        status: 'Em revisão',
        duracaoSeg: 1800,
        transcricao:
          '[00:10] P1: hoje a emissão de nota é feita no sistema antigo, uma a uma.',
      }),
    );
    gravacaoId = gravacao.id;

    const linha = await linhas.save(
      linhas.create({
        projetoId,
        ordem: 0,
        moduloSigla: 'FAT',
        modulo: 'Faturamento',
        topico: 'Como é feita a emissão de notas hoje?',
      }),
    );
    linhaId = linha.id;
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('lista as gravações do cliente, mesmo sem vínculo com o projeto', async () => {
    const res = await auth(
      request(server()).get(
        `/api/projetos/${projetoId}/levantamento/gravacoes`,
      ),
    );
    expect(res.status).toBe(200);
    expect(res.body.data.iaDisponivel).toBe(true);
    expect(res.body.data.gravacoes).toHaveLength(1);
    expect(res.body.data.gravacoes[0].titulo).toBe('Reunião de levantamento');
  });

  it('sugere a resposta e NÃO grava nada — o campo continua em branco', async () => {
    const res = await auth(
      request(server())
        .post(`/api/projetos/${projetoId}/levantamento/sugerir`)
        .send({ protocoloId: gravacaoId }),
    );
    expect(res.status).toBe(201);
    expect(res.body.data.sugestoes).toHaveLength(1);
    expect(res.body.data.sugestoes[0].linhaId).toBe(linhaId);
    expect(res.body.data.sugestoes[0].texto).toContain('sistema antigo');

    // O tópico pendente chegou ao prompt, e a transcrição junto.
    expect(IaServiceFake.ultimoPrompt).toContain(
      'Como é feita a emissão de notas hoje?',
    );
    expect(IaServiceFake.ultimoPrompt).toContain('sistema antigo');

    // A INVARIANTE do recurso: sugerir não responde por ninguém.
    const noBanco = await linhas.findOneByOrFail({ id: linhaId });
    expect(noBanco.resposta).toBe('');
    expect(noBanco.versao).toBe(0); // intocada — nem a versão andou
    expect(noBanco.atualizadoPor).toBe('');
  });

  it('aceitar a sugestão grava pelo caminho normal, em nome de quem aceitou', async () => {
    const texto =
      'A emissão de notas é feita hoje no sistema antigo, uma a uma.';
    const antes = await linhas.findOneByOrFail({ id: linhaId });
    const res = await auth(
      request(server())
        .patch(`/api/projetos/${projetoId}/levantamento/${linhaId}`)
        .send({ resposta: texto, versao: antes.versao }),
    );
    expect(res.status).toBe(200);

    const noBanco = await linhas.findOneByOrFail({ id: linhaId });
    expect(noBanco.resposta).toBe(texto);
    expect(noBanco.atualizadoPor).toBe('Ivian GCI'); // a autoria é humana
    expect(noBanco.versao).toBe(antes.versao + 1);
  });

  it('pergunta já respondida não volta a ser sugerida', async () => {
    const res = await auth(
      request(server())
        .post(`/api/projetos/${projetoId}/levantamento/sugerir`)
        .send({ protocoloId: gravacaoId }),
    );
    expect(res.body.data.analisados).toBe(0);
    expect(res.body.data.sugestoes).toEqual([]);
    expect(res.body.data.aviso).toContain('Não há pergunta pendente');
  });

  it('gravação de outro cliente não é acessível por este projeto', async () => {
    const alheia = await protocolos.save(
      protocolos.create({
        titulo: 'Reunião de outro cliente',
        cliente: 'Cliente Y',
        videoOrigem: 'gravacao',
        transcricao: '[00:01] segredo do outro cliente',
      }),
    );
    const res = await auth(
      request(server())
        .post(`/api/projetos/${projetoId}/levantamento/sugerir`)
        .send({ protocoloId: alheia.id }),
    );
    expect(res.status).toBe(404);
  });
});
