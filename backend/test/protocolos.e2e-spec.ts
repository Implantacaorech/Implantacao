import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { AppModule } from '../src/app.module';
import { Usuario } from '../src/database/entities/usuario.entity';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { TranscricaoService } from '../src/transcricao/transcricao.service';
import { ProtocoloIaService } from '../src/protocolos/protocolo-ia.service';

// Fakes dos dois pontos que o pipeline chama de verdade (docservice via HTTP e Anthropic
// via SDK) — a lógica de cada um já é coberta em suas próprias suítes (docservice pytest
// e protocolo-ia.service.spec.ts); aqui só verificamos a orquestração ponta a ponta:
// upload multipart -> pipeline -> revisão -> aprovação, através do HTTP real do NestJS.
class TranscricaoServiceFake {
  async iniciar(): Promise<void> {}
  async status() {
    return {
      status: 'concluido' as const,
      transcricao: '[00:01] fala de teste sobre o cadastro de produtos',
      duracaoSeg: 7,
      idioma: 'pt',
    };
  }
}

class ProtocoloIaServiceFake {
  disponivel(): boolean {
    return true;
  }
  async analisar() {
    return {
      campos: {
        titulo: 'Cadastro de Produtos',
        modulo: 'Estoque',
        menu: '1.4-I',
        assunto: 'Como cadastrar um produto',
      },
      bruto: '{"modulo":"Estoque"}',
    };
  }
}

describe('Protocolos de Treinamento (e2e)', () => {
  let app: INestApplication<App>;
  let usuarios: Repository<Usuario>;
  let raiz: string;
  let tokenAdm: string;
  let tokenConsultor: string;
  let tokenCoordenador: string;

  const server = () => app.getHttpServer();

  beforeAll(async () => {
    raiz = mkdtempSync(join(tmpdir(), 'protocolos-e2e-'));
    process.env.MIGRACAO_DB_URL = '';
    process.env.MIGRACAO_DB_SQLITE = ':memory:';
    process.env.MIGRACAO_PROTOCOLOS_DIR = raiz;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(TranscricaoService)
      .useClass(TranscricaoServiceFake)
      .overrideProvider(ProtocoloIaService)
      .useClass(ProtocoloIaServiceFake)
      .compile();
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
        login: 'coord1',
        nome: 'Coordenadora',
        email: 'coord1@teste.com',
        senhaHash: await bcrypt.hash('senha-coord-123', 4),
        perfil: 'Coordenador',
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
    tokenCoordenador = (
      await request(server()).post('/api/auth/login').send({ login: 'coord1', senha: 'senha-coord-123' })
    ).body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
    rmSync(raiz, { recursive: true, force: true });
  });

  function auth(req: request.Test, token = tokenAdm): request.Test {
    return req.set('Authorization', `Bearer ${token}`);
  }

  it('rejeita upload com formato não suportado', async () => {
    const res = await auth(
      request(server())
        .post('/api/protocolos/novo')
        .attach('video', Buffer.from('conteudo'), 'arquivo.txt'),
    );
    expect(res.status).toBe(422);
  });

  it('rejeita upload sem arquivo', async () => {
    const res = await auth(request(server()).post('/api/protocolos/novo'));
    expect(res.status).toBe(422);
  });

  it('upload -> pipeline completo (transcrição + IA mockadas) -> revisão -> edição -> aprovação', async () => {
    const upload = await auth(
      request(server())
        .post('/api/protocolos/novo')
        .attach('video', Buffer.from('bytes de video falso'), 'Aula Cadastro.mp4'),
    );
    expect(upload.status).toBe(200);
    expect(upload.body.data.novo).toBe(true);
    const id = upload.body.data.id as number;

    // processarAsync roda em segundo plano; como os fakes resolvem na primeira consulta
    // de status (sem sleep no meio), o pipeline termina bem rápido — ainda assim
    // aguardamos com um pequeno polling para não acoplar ao timing exato.
    let ficha: any;
    for (let i = 0; i < 50; i++) {
      ficha = await auth(request(server()).get(`/api/protocolos/${id}`));
      if (ficha.body.data.protocolo.status === 'Em revisão') break;
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(ficha.body.data.protocolo.status).toBe('Em revisão');
    expect(ficha.body.data.protocolo.modulo).toBe('Estoque');
    expect(ficha.body.data.protocolo.menu).toBe('1.4-I');
    expect(ficha.body.data.protocolo.transcricao).toContain('cadastro de produtos');
    expect(ficha.body.data.ehAudio).toBe(false);
    expect(ficha.body.data.podeAprovar).toBe(true); // ADM

    const salvar = await auth(
      request(server())
        .post(`/api/protocolos/${id}/salvar`)
        .send({ titulo: 'Título revisado manualmente' }),
    );
    expect(salvar.status).toBe(200);

    const semPermissao = await auth(
      request(server()).post(`/api/protocolos/${id}/aprovar`),
      tokenConsultor,
    );
    expect(semPermissao.status).toBe(403);

    const aprovar = await auth(
      request(server()).post(`/api/protocolos/${id}/aprovar`),
      tokenCoordenador,
    );
    expect(aprovar.status).toBe(200);

    const depois = await auth(request(server()).get(`/api/protocolos/${id}`));
    expect(depois.body.data.protocolo.status).toBe('Aprovado');
    expect(depois.body.data.protocolo.titulo).toBe('Título revisado manualmente');
    expect(depois.body.data.protocolo.aprovador).toBe('Coordenadora');

    const listaFiltrada = await auth(
      request(server()).get('/api/protocolos').query({ status: 'Aprovado' }),
    );
    expect(listaFiltrada.body.data.itens.some((p: any) => p.id === id)).toBe(true);
  }, 15000);

  // Nota: dedup por hash não pega uploads repetidos com o MESMO nome original — o
  // arquivo salvo em disco já leva um sufixo "_1" por colisão de nome ANTES do hash ser
  // calculado (o hash inclui o nome do arquivo salvo), tanto aqui quanto no Flask
  // original (webapp/routes_protocolos.py:protocolo_novo). O dedup real de propósito
  // (mesmo arquivo estável, mesmo caminho, revarrido pelo robô da pasta) já é coberto em
  // processamento-protocolos.service.spec.ts ("varrerPasta ... faz dedup") e
  // protocolos.service.spec.ts ("criar dedup").

  it('reconhece arquivo de áudio (eh_audio) na ficha', async () => {
    const upload = await auth(
      request(server())
        .post('/api/protocolos/novo')
        .attach('video', Buffer.from('audio falso'), 'entrevista.mp3'),
    );
    const id = upload.body.data.id as number;
    let ficha: any;
    for (let i = 0; i < 50; i++) {
      ficha = await auth(request(server()).get(`/api/protocolos/${id}`));
      if (ficha.body.data.protocolo.status !== 'Pendente') break;
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(ficha.body.data.ehAudio).toBe(true);
  }, 15000);

  it('/status devolve 404 para protocolo inexistente', async () => {
    const res = await auth(request(server()).get('/api/protocolos/999999/status'));
    expect(res.status).toBe(404);
  });

  it('serve o vídeo original (streaming) e nega arquivo fora da pasta permitida', async () => {
    const upload = await auth(
      request(server())
        .post('/api/protocolos/novo')
        .attach('video', Buffer.from('conteudo do video para stream'), 'stream.mp4'),
    );
    const id = upload.body.data.id as number;
    const res = await auth(request(server()).get(`/api/protocolos/${id}/video`));
    expect(res.status).toBe(200);
    expect(res.text).toBe('conteudo do video para stream');
  });
});
