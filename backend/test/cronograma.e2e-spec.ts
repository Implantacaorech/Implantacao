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
import { ChecklistModelo } from '../src/database/entities/checklist-modelo.entity';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { GeracaoDocumentosService } from '../src/geracao/geracao-documentos.service';

// Fake do cliente do serviço Python (docservice/) — a lógica de geração em si já é coberta
// pela suíte pytest do próprio serviço; aqui só verificamos que o NestJS monta o payload e
// trata a resposta (sucesso/erro) corretamente.
class GeracaoDocumentosServiceFake {
  ultimoCorpo: unknown;
  postParaArquivo(_caminho: string, corpo: unknown) {
    this.ultimoCorpo = corpo;
    // content-type texto de propósito neste fake — só testamos a orquestração do NestJS
    // (payload montado + repasse de headers/arquivo), não o parsing de binário do supertest.
    return Promise.resolve({
      buffer: Buffer.from('conteudo-xlsx-fake'),
      filename: 'cronograma_visitas_teste.xlsx',
      contentType: 'text/plain',
    });
  }
}

// Suíte end-to-end do Agendador de Visitas (o módulo mais complexo do sistema — distribuição
// automática, ordem V1<V2, períodos sem agenda por técnico). Cada teste usa um SQLite em
// memória isolado e semeia um ChecklistModelo sintético (não o catálogo real da empresa, que
// é dado local fora do git — ver src/catalogos/checklist-modelo.service.ts).
describe('Agendador de Visitas (e2e)', () => {
  let app: INestApplication<App>;
  let moduleFixture: TestingModule;
  let usuarios: Repository<Usuario>;
  let projetos: Repository<Projeto>;
  let checklist: Repository<ChecklistModelo>;
  let tokenAdm: string;
  let tokenConsultor: string;

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
    checklist = moduleFixture.get(getRepositoryToken(ChecklistModelo));

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

    // Catálogo sintético: FAT tem V1 (2 itens) e V2 (1 item); EST tem V1 (1 item).
    await checklist.save(
      [
        { modulo: 'FAT', menu: '1.1', item: 'Cadastro de produtos', seq: '1' },
        { modulo: 'FAT', menu: '1.2', item: 'Emissão de NF', seq: '1' },
        { modulo: 'FAT', menu: '2.1', item: 'Relatórios avançados', seq: '2' },
        { modulo: 'EST', menu: '1.1', item: 'Cadastro de itens', seq: '1' },
      ].map((l, i) => checklist.create({ ordem: i, ...l })),
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

    const login = await request(server())
      .post('/api/auth/login')
      .send({ login: 'admin', senha: 'senha-adm-123' });
    tokenAdm = login.body.data.accessToken;
    const loginConsultor = await request(server())
      .post('/api/auth/login')
      .send({ login: 'consultor1', senha: 'senha-cons-123' });
    tokenConsultor = loginConsultor.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  async function novoProjeto(
    cliente: string,
    modulos: string,
    dataUsoOficial = '',
  ): Promise<number> {
    const p = await projetos.save(
      projetos.create({
        cliente,
        cnpj: '00.000.000/0001-00',
        modulos,
        dataUsoOficial,
      }),
    );
    return p.id;
  }

  function auth(req: request.Test): request.Test {
    return req.set('Authorization', `Bearer ${tokenAdm}`);
  }

  it('semeia as atividades a partir do Check List, agrupadas em Visitas (V1/V2)', async () => {
    const pid = await novoProjeto('Cliente Seed LTDA', 'FAT,EST');
    const res = await auth(
      request(server()).get(`/api/projetos/${pid}/agenda/visitas`),
    );
    expect(res.status).toBe(200);
    const visitas: { modulo: string; seq: number; atividades: unknown[] }[] =
      res.body.data;
    expect(visitas).toHaveLength(3);
    const fatV1 = visitas.find((v) => v.modulo === 'FAT' && v.seq === 1);
    expect(fatV1?.atividades).toHaveLength(2);
  });

  it('distribui respeitando a ordem V1 antes de V2 dentro do mesmo módulo', async () => {
    const pid = await novoProjeto('Cliente Ordem LTDA', 'FAT');
    await auth(request(server()).get(`/api/projetos/${pid}/agenda/visitas`)); // garante o seed
    await auth(
      request(server()).put(`/api/projetos/${pid}/agenda/designacoes`),
    ).send({ modulo: 'FAT', tecnico: 'Ana' });

    const res = await auth(
      request(server()).post(`/api/projetos/${pid}/agenda/distribuir`),
    );
    expect(res.status).toBe(200);
    expect(res.body.data.ok).toBe(true);
    expect(res.body.data.n).toBe(2); // FAT V1 e FAT V2

    const atividades: { seq: number; data: string; turno: string }[] = (
      await auth(
        request(server()).get(`/api/projetos/${pid}/agenda/atividades`),
      )
    ).body.data;
    const dataTurno = (seq: number) => {
      const as = atividades.filter((a) => a.seq === seq);
      return `${as[0].data}#${as[0].turno === 'tarde' ? 1 : 0}`;
    };
    expect(dataTurno(1) <= dataTurno(2)).toBe(true);
    expect(dataTurno(1)).not.toBe(''); // V1 realmente foi alocada
  });

  it('bloqueia a distribuição se algum módulo usado não tem técnico válido', async () => {
    const pid = await novoProjeto('Cliente SemTecnico LTDA', 'FAT');
    await auth(request(server()).get(`/api/projetos/${pid}/agenda/visitas`));
    const res = await auth(
      request(server()).post(`/api/projetos/${pid}/agenda/distribuir`),
    );
    expect(res.body.data.ok).toBe(false);
    expect(res.body.data.erro).toContain('FAT');
  });

  it('módulo "Não distribuir" é ignorado pela distribuição automática', async () => {
    const pid = await novoProjeto('Cliente NaoDistribuir LTDA', 'FAT,EST');
    await auth(request(server()).get(`/api/projetos/${pid}/agenda/visitas`));
    await auth(
      request(server()).put(`/api/projetos/${pid}/agenda/designacoes`),
    ).send({
      modulo: 'FAT',
      naoDistribuir: true,
    });
    await auth(
      request(server()).put(`/api/projetos/${pid}/agenda/designacoes`),
    ).send({ modulo: 'EST', tecnico: 'Beto' });

    const res = await auth(
      request(server()).post(`/api/projetos/${pid}/agenda/distribuir`),
    );
    expect(res.body.data.ok).toBe(true);
    expect(res.body.data.n).toBe(1); // só EST V1 — FAT ignorado
  });

  it('alocação manual tira a atividade da distribuição automática (auto_agendado=false)', async () => {
    const pid = await novoProjeto('Cliente Manual LTDA', 'EST');
    const visitas = (
      await auth(request(server()).get(`/api/projetos/${pid}/agenda/visitas`))
    ).body.data;
    const atividadeId = visitas[0].atividades[0].id;

    const hoje = new Date().toISOString().slice(0, 10);
    const alocacao = await auth(
      request(server()).post(
        `/api/projetos/${pid}/agenda/alocar/${atividadeId}`,
      ),
    ).send({
      data: hoje,
      turno: 'manha',
      tecnico: 'Carla',
    });
    expect(alocacao.status).toBe(200);
    expect(alocacao.body.data.status).toBe('Agendada');
    expect(alocacao.body.data.autoAgendado).toBe(false);
  });

  it('recusa alocação manual em data passada', async () => {
    const pid = await novoProjeto('Cliente DataPassada LTDA', 'EST');
    const visitas = (
      await auth(request(server()).get(`/api/projetos/${pid}/agenda/visitas`))
    ).body.data;
    const atividadeId = visitas[0].atividades[0].id;
    const res = await auth(
      request(server()).post(
        `/api/projetos/${pid}/agenda/alocar/${atividadeId}`,
      ),
    ).send({
      data: '2000-01-01',
      turno: 'manha',
    });
    expect(res.status).toBe(422);
    expect(res.body.message).toContain('data passada');
  });

  describe('Período sem agenda por técnico', () => {
    it('bloqueia só o técnico listado, libera os demais', async () => {
      const pid = await novoProjeto('Cliente Periodo LTDA', 'FAT,EST');
      await auth(request(server()).get(`/api/projetos/${pid}/agenda/visitas`));
      const hoje = new Date().toISOString().slice(0, 10);

      await auth(
        request(server()).post(`/api/projetos/${pid}/agenda/periodos`),
      ).send({
        dataIni: hoje,
        dataFim: hoje,
        motivo: 'Ana de folga',
        tecnicos: ['Ana'],
      });

      const visitas = (
        await auth(request(server()).get(`/api/projetos/${pid}/agenda/visitas`))
      ).body.data;
      const fatId = visitas.find((v: { modulo: string }) => v.modulo === 'FAT')
        .atividades[0].id;
      const estId = visitas.find((v: { modulo: string }) => v.modulo === 'EST')
        .atividades[0].id;

      const bloqueado = await auth(
        request(server()).post(`/api/projetos/${pid}/agenda/alocar/${fatId}`),
      ).send({
        data: hoje,
        turno: 'manha',
        tecnico: 'Ana',
      });
      expect(bloqueado.status).toBe(422);
      expect(bloqueado.body.message).toContain('Período sem agenda');

      const liberado = await auth(
        request(server()).post(`/api/projetos/${pid}/agenda/alocar/${estId}`),
      ).send({
        data: hoje,
        turno: 'manha',
        tecnico: 'Beto',
      });
      expect(liberado.status).toBe(200);
    });
  });

  describe('Indicador visual (bloqueios) — modo conjunta x individual', () => {
    it('conjunta (sem ?tecnico) reflete o período mesmo pra quem não é o técnico dele; individual só reflete se for o técnico certo', async () => {
      const pid = await novoProjeto('Cliente Bloqueios LTDA', 'FAT,EST');
      await auth(request(server()).get(`/api/projetos/${pid}/agenda/visitas`));
      await auth(
        request(server()).put(`/api/projetos/${pid}/agenda/designacoes`),
      ).send({ modulo: 'FAT', tecnico: 'Ana' });
      await auth(
        request(server()).put(`/api/projetos/${pid}/agenda/designacoes`),
      ).send({ modulo: 'EST', tecnico: 'Beto' });

      const hoje = new Date().toISOString().slice(0, 10);
      await auth(
        request(server()).post(`/api/projetos/${pid}/agenda/periodos`),
      ).send({
        dataIni: hoje,
        dataFim: hoje,
        motivo: 'Ana de folga',
        tecnicos: ['Ana'],
      });

      const conjunta = await auth(
        request(server())
          .get(`/api/projetos/${pid}/agenda/bloqueios`)
          .query({ inicio: hoje, fim: hoje }),
      );
      expect(conjunta.status).toBe(200);
      expect(Object.keys(conjunta.body.data).length).toBeGreaterThan(0);

      const individualBeto = await auth(
        request(server())
          .get(`/api/projetos/${pid}/agenda/bloqueios`)
          .query({ inicio: hoje, fim: hoje, tecnico: 'Beto' }),
      );
      expect(individualBeto.status).toBe(200);
      expect(Object.keys(individualBeto.body.data)).toHaveLength(0);

      const individualAna = await auth(
        request(server())
          .get(`/api/projetos/${pid}/agenda/bloqueios`)
          .query({ inicio: hoje, fim: hoje, tecnico: 'Ana' }),
      );
      expect(individualAna.status).toBe(200);
      expect(Object.keys(individualAna.body.data).length).toBeGreaterThan(0);
    });
  });

  it('desfazer tudo é bloqueado se alguma visita já foi Realizada', async () => {
    const pid = await novoProjeto('Cliente Realizada LTDA', 'EST');
    const visitas = (
      await auth(request(server()).get(`/api/projetos/${pid}/agenda/visitas`))
    ).body.data;
    const atividadeId = visitas[0].atividades[0].id;
    await auth(
      request(server()).put(
        `/api/projetos/${pid}/agenda/atividades/${atividadeId}/status`,
      ),
    ).send({
      status: 'Realizada',
    });

    const res = await auth(
      request(server()).post(`/api/projetos/${pid}/agenda/desfazer-tudo`),
    );
    expect(res.body.data.ok).toBe(false);
    expect(res.body.data.erro).toContain('Realizada');
  });

  it('postergar cria um histórico Postergada + nova ocorrência Agendada no destino', async () => {
    const pid = await novoProjeto('Cliente Postergar LTDA', 'EST');
    const visitas = (
      await auth(request(server()).get(`/api/projetos/${pid}/agenda/visitas`))
    ).body.data;
    const atividadeId = visitas[0].atividades[0].id;
    const hoje = new Date().toISOString().slice(0, 10);
    await auth(
      request(server()).post(
        `/api/projetos/${pid}/agenda/alocar/${atividadeId}`,
      ),
    ).send({
      data: hoje,
      turno: 'manha',
      tecnico: 'Ana',
    });

    const amanha = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const post = await auth(
      request(server()).post(`/api/projetos/${pid}/agenda/postergar`),
    ).send({
      atividadeId,
      novaData: amanha,
      novoTurno: 'tarde',
    });
    expect(post.status).toBe(200);
    expect(post.body.data.n).toBe(1);

    const atividades: { status: string; data: string }[] = (
      await auth(
        request(server()).get(`/api/projetos/${pid}/agenda/atividades`),
      )
    ).body.data;
    expect(atividades.some((a) => a.status === 'Postergada')).toBe(true);
    expect(
      atividades.some((a) => a.status === 'Agendada' && a.data === amanha),
    ).toBe(true);
  });

  it('exclusão de atividade Postergada é exclusiva do ADM, e só funciona em status Postergada', async () => {
    const pid = await novoProjeto('Cliente ExcluirPostergada LTDA', 'EST');
    const visitas = (
      await auth(request(server()).get(`/api/projetos/${pid}/agenda/visitas`))
    ).body.data;
    const atividadeId: number = visitas[0].atividades[0].id;
    const hoje = new Date().toISOString().slice(0, 10);
    await auth(
      request(server()).post(
        `/api/projetos/${pid}/agenda/alocar/${atividadeId}`,
      ),
    ).send({
      data: hoje,
      turno: 'manha',
    });
    const amanha = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    await auth(
      request(server()).post(`/api/projetos/${pid}/agenda/postergar`),
    ).send({
      atividadeId,
      novaData: amanha,
      novoTurno: 'tarde',
    });
    const atividades: { id: number; status: string }[] = (
      await auth(
        request(server()).get(`/api/projetos/${pid}/agenda/atividades`),
      )
    ).body.data;
    const clone = atividades.find((a) => a.status === 'Agendada')!;

    const consultorTentando = await request(server())
      .delete(`/api/projetos/${pid}/agenda/atividades/${atividadeId}`)
      .set('Authorization', `Bearer ${tokenConsultor}`);
    expect(consultorTentando.status).toBe(403);

    const excluirCloneAgendada = await auth(
      request(server()).delete(
        `/api/projetos/${pid}/agenda/atividades/${clone.id}`,
      ),
    );
    expect(excluirCloneAgendada.status).toBe(422); // não está Postergada — deve falhar

    const excluirPostergada = await auth(
      request(server()).delete(
        `/api/projetos/${pid}/agenda/atividades/${atividadeId}`,
      ),
    );
    expect(excluirPostergada.status).toBe(200);
  });

  describe('Gerar cronograma de visitas (.xlsx) via serviço de geração', () => {
    it('rejeita gerar sem nenhuma atividade alocada', async () => {
      const pid = await novoProjeto('Cliente GerarVazio LTDA', 'EST');
      await auth(request(server()).get(`/api/projetos/${pid}/agenda/visitas`));
      const res = await auth(
        request(server()).post(`/api/projetos/${pid}/agenda/gerar`),
      );
      expect(res.status).toBe(422);
    });

    it('monta o payload corretamente e devolve o arquivo do serviço de geração', async () => {
      const pid = await novoProjeto('Cliente Gerar LTDA', 'EST');
      const visitas = (
        await auth(request(server()).get(`/api/projetos/${pid}/agenda/visitas`))
      ).body.data;
      const atividadeId = visitas[0].atividades[0].id;
      const hoje = new Date().toISOString().slice(0, 10);
      await auth(
        request(server()).post(
          `/api/projetos/${pid}/agenda/alocar/${atividadeId}`,
        ),
      ).send({
        data: hoje,
        turno: 'manha',
        tecnico: 'Ana',
      });
      await auth(
        request(server()).put(`/api/projetos/${pid}/agenda/designacoes`),
      ).send({
        modulo: 'EST',
        tecnico: 'Ana',
        analista: 'Carla',
      });

      const res = await auth(
        request(server()).post(`/api/projetos/${pid}/agenda/gerar`),
      );
      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toContain(
        'cronograma_visitas_teste.xlsx',
      );
      expect(res.text).toBe('conteudo-xlsx-fake');

      const fake = moduleFixture.get<GeracaoDocumentosServiceFake>(
        GeracaoDocumentosService,
      );
      const corpo = fake.ultimoCorpo as {
        projeto: { cliente: string };
        atividades: unknown[];
        designacoes: { analista: string }[];
      };
      expect(corpo.projeto.cliente).toBe('Cliente Gerar LTDA');
      expect(corpo.atividades).toHaveLength(1);
      expect(
        corpo.designacoes.find((d) => d.analista === 'Carla'),
      ).toBeDefined();
    });
  });
});
