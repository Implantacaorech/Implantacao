import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Usuario } from '../src/database/entities/usuario.entity';
import { Projeto } from '../src/database/entities/projeto.entity';
import { IndiceTopico } from '../src/database/entities/indice-topico.entity';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { ModeloDocumentoService } from '../src/catalogos/modelo-documento.service';
import { GeracaoDocumentosService } from '../src/geracao/geracao-documentos.service';

// Fake do cliente do serviço Python (docservice/) — a geração .docx em si já é coberta pela
// suíte pytest do próprio serviço (tests/test_documento_fiel.py); aqui só verificamos que o
// NestJS monta o payload corretamente e persiste Documento/Evento após a resposta.
class GeracaoDocumentosServiceFake {
  ultimoCaminho: string | undefined;
  ultimoCorpo: any;
  postParaArquivo(caminho: string, corpo: unknown) {
    this.ultimoCaminho = caminho;
    this.ultimoCorpo = corpo;
    return Promise.resolve({
      buffer: Buffer.from('conteudo-docx-fake'),
      filename: 'termo_teste.docx',
      contentType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
  }
}

describe('Geração de documentos fiéis — Levantamento/Projeto/Termo (e2e)', () => {
  let app: INestApplication<App>;
  let moduleFixture: TestingModule;
  let usuarios: Repository<Usuario>;
  let projetos: Repository<Projeto>;
  let indiceRepo: Repository<IndiceTopico>;
  let fake: GeracaoDocumentosServiceFake;
  let tokenAdm: string;

  const server = () => app.getHttpServer();

  beforeAll(async () => {
    process.env.MIGRACAO_DB_URL = '';
    process.env.MIGRACAO_DB_SQLITE = ':memory:';

    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GeracaoDocumentosService)
      .useClass(GeracaoDocumentosServiceFake)
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
    indiceRepo = moduleFixture.get(getRepositoryToken(IndiceTopico));
    fake = moduleFixture.get<GeracaoDocumentosServiceFake>(
      GeracaoDocumentosService,
    );

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
    const loginAdm = await request(server())
      .post('/api/auth/login')
      .send({ login: 'admin', senha: 'senha-adm-123' });
    tokenAdm = loginAdm.body.data.accessToken;

    await indiceRepo.save(
      [{ moduloSigla: 'FAT', modulo: 'Faturamento', adicional: '', topico: 'Emissão de NF' }].map(
        (l, i) => indiceRepo.create({ ordem: i, ...l }),
      ),
    );

    // Usa os layouts fiéis reais do repositório (tools/templates/layouts/) — mesmo padrão
    // de cadastros.e2e-spec.ts.
    const modeloDocumentoService = moduleFixture.get(ModeloDocumentoService);
    await modeloDocumentoService.seedDefaults();
  });

  afterAll(async () => {
    await app.close();
  });

  function auth(req: request.Test, token = tokenAdm): request.Test {
    return req.set('Authorization', `Bearer ${token}`);
  }

  async function criarProjeto(): Promise<number> {
    const p = await projetos.save(
      projetos.create({
        cliente: 'Cliente Teste LTDA',
        cnpj: '00.000.000/0001-00',
        modulos: 'FAT',
        numeroProjeto: 'PRJ-1',
        dataEncerramento: '2026-08-20',
      }),
    );
    return p.id;
  }

  it('slug inválido devolve 400', async () => {
    const pid = await criarProjeto();
    const res = await auth(
      request(server()).post(`/api/projetos/${pid}/gerar-layout/checklist`),
    );
    expect(res.status).toBe(400);
  });

  it('gera o Termo, monta o payload corretamente e anexa Documento + Evento ao projeto', async () => {
    const pid = await criarProjeto();
    const res = await auth(
      request(server()).post(`/api/projetos/${pid}/gerar-layout/termo`),
    );
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('termo_teste.docx');

    expect(fake.ultimoCaminho).toBe('/gerar/documento-fiel');
    expect(fake.ultimoCorpo.slug).toBe('termo');
    expect(fake.ultimoCorpo.modo).toBe('auto');
    expect(fake.ultimoCorpo.projeto.cliente).toBe('Cliente Teste LTDA');
    expect(fake.ultimoCorpo.projeto.numeroProjeto).toBe('PRJ-1');
    expect(typeof fake.ultimoCorpo.modeloBase64).toBe('string');
    expect(fake.ultimoCorpo.modeloBase64.length).toBeGreaterThan(0);

    const docs = await auth(
      request(server()).get(`/api/projetos/${pid}/documentos`),
    );
    expect(docs.body.data).toHaveLength(1);
    expect(docs.body.data[0].tipo).toBe('termo');

    // Além do evento "documento", a geração agora também dispara a notificação padrão
    // do evento termo_ok à Coordenação (ver NotificacaoService/§2 do documento de
    // conversão) — sem SMTP configurado neste teste, ela fica registrada como
    // "Notificação pendente" (não bloqueia nem falha a geração).
    const eventos = await auth(
      request(server()).get(`/api/projetos/${pid}/eventos`),
    );
    expect(eventos.body.data).toHaveLength(2);
    expect(
      eventos.body.data.some((e: { descricao: string }) => e.descricao.includes('termo_teste.docx')),
    ).toBe(true);
    expect(
      eventos.body.data.some((e: { tipo: string }) => e.tipo === 'email'),
    ).toBe(true);
  });

  it('modo=modelo é repassado ao docservice (guia de preenchimento manual do Projeto)', async () => {
    const pid = await criarProjeto();
    await auth(
      request(server()).post(`/api/projetos/${pid}/gerar-layout/projeto?modo=modelo`),
    );
    expect(fake.ultimoCorpo.slug).toBe('projeto');
    expect(fake.ultimoCorpo.modo).toBe('modelo');
  });
});
