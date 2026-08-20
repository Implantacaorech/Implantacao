import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { readFileSync } from 'fs';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Usuario } from '../src/database/entities/usuario.entity';
import { Projeto } from '../src/database/entities/projeto.entity';
import { IndiceTopico } from '../src/database/entities/indice-topico.entity';
import { CronogramaItem } from '../src/database/entities/cronograma-item.entity';
import { ProjetoPasso } from '../src/database/entities/projeto-passo.entity';
import { DocConteudo } from '../src/database/entities/doc-conteudo.entity';
import { LevantamentoResposta } from '../src/database/entities/levantamento-resposta.entity';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { ModeloDocumentoService } from '../src/catalogos/modelo-documento.service';
import { GeracaoDocumentosService } from '../src/geracao/geracao-documentos.service';
import { seTiverInsumo } from '../src/common/insumo-local';

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

// Só roda onde os layouts fiéis existem: `tools/templates/layouts/` é ignorado no .gitignore
// (linha 63), então no CI, que clona apenas o que está no git, `seedDefaults()` não encontra
// arquivo nenhum e toda geração responde 404. Sem os layouts não há o que provar aqui — a
// suíte aparece como PULADA em vez de reprovar o commit.
seTiverInsumo(
  'tools',
  'templates',
  'layouts',
  'levantamento.docx',
)('Geração de documentos fiéis — Levantamento/Projeto/Termo (e2e)', () => {
  let app: INestApplication<App>;
  let moduleFixture: TestingModule;
  let usuarios: Repository<Usuario>;
  let projetos: Repository<Projeto>;
  let indiceRepo: Repository<IndiceTopico>;
  let cronogramaRepo: Repository<CronogramaItem>;
  let passosRepo: Repository<ProjetoPasso>;
  let docConteudoRepo: Repository<DocConteudo>;
  let respostasRepo: Repository<LevantamentoResposta>;
  let modelos: ModeloDocumentoService;
  let fake: GeracaoDocumentosServiceFake;
  let tokenAdm: string;
  let tokenConsultor: string;
  let tokenGci: string;

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
    cronogramaRepo = moduleFixture.get(getRepositoryToken(CronogramaItem));
    passosRepo = moduleFixture.get(getRepositoryToken(ProjetoPasso));
    docConteudoRepo = moduleFixture.get(getRepositoryToken(DocConteudo));
    respostasRepo = moduleFixture.get(getRepositoryToken(LevantamentoResposta));
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

    await usuarios.save(
      usuarios.create({
        login: 'consultor',
        nome: 'Consultora',
        email: 'consultor@teste.com',
        senhaHash: await bcrypt.hash('senha-consultor-123', 4),
        perfil: 'Consultor',
        ativo: true,
      }),
    );
    const loginConsultor = await request(server())
      .post('/api/auth/login')
      .send({ login: 'consultor', senha: 'senha-consultor-123' });
    tokenConsultor = loginConsultor.body.data.accessToken;

    await usuarios.save(
      usuarios.create({
        login: 'gci',
        nome: 'Gerente de Contas',
        email: 'gci@teste.com',
        senhaHash: await bcrypt.hash('senha-gci-123', 4),
        perfil: 'GCI',
        ativo: true,
      }),
    );
    const loginGci = await request(server())
      .post('/api/auth/login')
      .send({ login: 'gci', senha: 'senha-gci-123' });
    tokenGci = loginGci.body.data.accessToken;

    await indiceRepo.save(
      [
        {
          moduloSigla: 'FAT',
          modulo: 'Faturamento',
          adicional: '',
          topico: 'Emissão de NF',
        },
      ].map((l, i) => indiceRepo.create({ ordem: i, ...l })),
    );

    // Usa os layouts fiéis reais do repositório (tools/templates/layouts/) — mesmo padrão
    // de cadastros.e2e-spec.ts.
    modelos = moduleFixture.get(ModeloDocumentoService);
    await modelos.seedDefaults();
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

  it('gate por tipo de documento: Consultor não gera levantamento/projeto (espelha webapp/app.py:_GERA)', async () => {
    const pid = await criarProjeto();
    const res = await auth(
      request(server()).post(`/api/projetos/${pid}/gerar-layout/levantamento`),
      tokenConsultor,
    );
    expect(res.status).toBe(403);
  });

  it('gate por tipo de documento: GCI não gera cronograma/termo (espelha webapp/app.py:_GERA)', async () => {
    const pid = await criarProjeto();
    const res = await auth(
      request(server()).post(`/api/projetos/${pid}/gerar-layout/termo`),
      tokenGci,
    );
    expect(res.status).toBe(403);
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
    // Também entra um evento de PASSO: gerar o Termo é o passo 18 do processo (era o 15
    // antes da revisão que levou o processo a 21 passos — ver DocumentosService.
    // PASSO_POR_TIPO), e como este projeto de teste não passou pelos passos anteriores, o
    // Gerar o Termo NÃO conclui o passo 18 (mudou em 2026-08-05).
    //
    // O passo 18 é "Gerar o Termo de Encerramento **e enviar** ao Administrativo", e o envio
    // é um e-mail que a pessoa REDIGE na tela (RN-8). Enquanto a geração o fechava, saía o
    // e-mail do MODELO, sem revisão — e no `modo=modelo` com o Termo EM BRANCO anexado.
    // Como o passo é irreversível, não havia como desfazer. Por isso `termo` saiu de
    // `PASSO_POR_TIPO`: gerar o arquivo é PARTE do passo, não o passo inteiro.
    expect(
      eventos.body.data.some(
        (e: { tipo: string; descricao: string }) =>
          e.tipo === 'passo' && /passo 18.*conclu/i.test(e.descricao),
      ),
    ).toBe(false);
    expect(
      eventos.body.data.some((e: { descricao: string }) =>
        e.descricao.includes('termo_teste.docx'),
      ),
    ).toBe(true);
    expect(
      eventos.body.data.some((e: { tipo: string }) => e.tipo === 'email'),
    ).toBe(true);
  });

  it('modo=modelo é repassado ao docservice (guia de preenchimento manual do Projeto)', async () => {
    const pid = await criarProjeto();
    await auth(
      request(server()).post(
        `/api/projetos/${pid}/gerar-layout/projeto?modo=modelo`,
      ),
    );
    expect(fake.ultimoCorpo.slug).toBe('projeto');
    expect(fake.ultimoCorpo.modo).toBe('modelo');
  });

  it('gera o Cronograma a partir das linhas editáveis (CronogramaItem) e dispara cronograma_ok', async () => {
    const pid = await criarProjeto();
    await cronogramaRepo.save(
      cronogramaRepo.create({
        projetoId: pid,
        ordem: 0,
        etapa: 'Abertura',
        topicos: 'Parametrização inicial',
        horas: '4',
        data: '10/08/2026',
        modalidade: 'Remoto',
        status: 'Previsto',
      }),
    );

    const res = await auth(
      request(server()).post(`/api/projetos/${pid}/gerar-layout/cronograma`),
    );
    expect(res.status).toBe(200);
    expect(fake.ultimoCorpo.slug).toBe('cronograma');
    expect(fake.ultimoCorpo.cronogramaItens).toEqual([
      {
        etapa: 'Abertura',
        topicos: 'Parametrização inicial',
        horas: '4',
        data: '10/08/2026',
        modalidade: 'Remoto',
        status: 'Previsto',
      },
    ]);

    const eventos = await auth(
      request(server()).get(`/api/projetos/${pid}/eventos`),
    );
    expect(
      eventos.body.data.some((e: { descricao: string }) =>
        e.descricao.includes('pelo layout oficial (cronograma)'),
      ),
    ).toBe(true);
  });
  // --- Ligação layout (Cadastro de Modelos) x passo 10 "Criação do Projeto" ---------------
  //
  // O passo 10 não tem botão "Concluir" próprio: ele fecha SOZINHO quando o Projeto é gerado
  // (DocumentosService.PASSO_POR_TIPO -> projeto: 10). Os dois testes abaixo cobrem as duas
  // pontas dessa ligação — o arquivo que alimenta a geração e o passo que ela fecha —, que
  // nenhum caso desta suíte verificava.

  it('gera o Projeto com o arquivo VIGENTE do Cadastro de Modelos (slug projeto) e conclui o passo 10', async () => {
    const pid = await criarProjeto();
    // O passo 10 depende do 8; sem ele a conclusão automática só registra o motivo e para.
    await passosRepo.save(
      passosRepo.create({ projetoId: pid, passo: 8, concluidoPor: 'setup' }),
    );

    const res = await auth(
      request(server()).post(`/api/projetos/${pid}/gerar-layout/projeto`),
    );
    expect(res.status).toBe(200);
    expect(fake.ultimoCorpo.slug).toBe('projeto');
    expect(fake.ultimoCorpo.modo).toBe('auto');

    // A ligação em si: o modelo enviado ao docservice é o arquivo vigente do slug 'projeto'
    // no Cadastro de Modelos — trocar a versão pela tela troca o layout gerado aqui.
    const modelo = await modelos.porSlug('projeto');
    expect(modelo).not.toBeNull();
    const caminho = await modelos.arquivoPath(modelo!.id);
    expect(caminho).not.toBeNull();
    expect(fake.ultimoCorpo.modeloBase64).toBe(
      readFileSync(caminho!).toString('base64'),
    );

    const passo10 = await passosRepo.findOne({
      where: { projetoId: pid, passo: 10 },
    });
    expect(passo10).not.toBeNull();

    const docs = await auth(
      request(server()).get(`/api/projetos/${pid}/documentos`),
    );
    expect(
      docs.body.data.some((d: { tipo: string }) => d.tipo === 'projeto'),
    ).toBe(true);
  });

  it('modo=modelo (layout em branco) NÃO conclui o passo 10', async () => {
    const pid = await criarProjeto();
    await passosRepo.save(
      passosRepo.create({ projetoId: pid, passo: 8, concluidoPor: 'setup' }),
    );

    const res = await auth(
      request(server()).post(
        `/api/projetos/${pid}/gerar-layout/projeto?modo=modelo`,
      ),
    );
    expect(res.status).toBe(200);

    // Baixar o layout em branco para preencher à mão não é entregar o Projeto (achado de
    // 2026-08-05): o arquivo fica anexado, o passo continua aberto.
    const passo10 = await passosRepo.findOne({
      where: { projetoId: pid, passo: 10 },
    });
    expect(passo10).toBeNull();
  });
  // --- Etapa 3 (Levantamento) alimenta a etapa 10 (Projeto) -------------------------------
  //
  // Regra do usuário (2026-08-20): o Projeto não é redigido do zero — ele herda o que foi
  // levantado na etapa 3, o GCI revisa na tela do passo 10 e só então o passo 11 (conferência
  // do Administrativo + envio para assinatura) faz sentido.

  /** Preenche a etapa 3 do projeto: campos estruturados + questionário respondido. */
  async function preencherLevantamento(pid: number): Promise<void> {
    await docConteudoRepo.save(
      [
        ['objetivos', 'Padronizar o processo comercial no SIGER.'],
        ['filiais', 'Matriz em Novo Hamburgo e filial em Campo Bom.'],
        ['usu_0_nome', 'Fulano da Silva'],
        ['usu_0_email', 'fulano@cliente.com.br'],
        ['usu_0_atrib', 'Comercial'],
      ].map(([campo, valor]) =>
        docConteudoRepo.create({
          projetoId: pid,
          doc: 'levantamento',
          campo,
          valor,
        }),
      ),
    );
    await respostasRepo.save(
      respostasRepo.create({
        projetoId: pid,
        ordem: 0,
        moduloSigla: 'FAT',
        modulo: 'Faturamento',
        topico: 'Emissão de NF',
        resposta: 'Emitida pelo faturamento após liberação do comercial.',
      }),
    );
  }

  it('a tela do passo 10 já abre com o que foi levantado na etapa 3', async () => {
    const pid = await criarProjeto();
    await preencherLevantamento(pid);

    const res = await auth(
      request(server()).get(`/api/projetos/${pid}/doc-conteudo/projeto`),
    );
    expect(res.status).toBe(200);
    const v = res.body.data as Record<string, string>;

    expect(v.objetivos).toBe('Padronizar o processo comercial no SIGER.');
    expect(v.empresas).toBe('Matriz em Novo Hamburgo e filial em Campo Bom.');
    expect(v.usu_0_nome).toBe('Fulano da Silva');
    expect(v.usu_0_email).toBe('fulano@cliente.com.br');
    // "Atribuições" da etapa 3 vira "Área de Atuação no SIGER" no Projeto.
    expect(v.usu_0_area).toBe('Comercial');
    // O Detalhamento de Rotinas chega MONTADO, para o GCI revisar antes de gerar — antes
    // ele só existia dentro do .docx pronto.
    expect(v.det_vendas_modulos).toBe('FAT — Faturamento');
    expect(v.det_vendas_detalhamento).toBe(
      'Emissão de NF: Emitida pelo faturamento após liberação do comercial.',
    );
  });

  it('o que o GCI edita na etapa 10 vence a herança e é o que vai para o documento', async () => {
    const pid = await criarProjeto();
    await preencherLevantamento(pid);
    await passosRepo.save(
      passosRepo.create({ projetoId: pid, passo: 8, concluidoPor: 'setup' }),
    );

    // O GCI ajusta os objetivos e deixa o resto como veio da etapa 3.
    await auth(
      request(server())
        .put(`/api/projetos/${pid}/doc-conteudo/projeto`)
        .send({ objetivos: 'Objetivos revisados pelo GCI.', empresas: '' }),
    );

    const relido = await auth(
      request(server()).get(`/api/projetos/${pid}/doc-conteudo/projeto`),
    );
    const v = relido.body.data as Record<string, string>;
    expect(v.objetivos).toBe('Objetivos revisados pelo GCI.');
    // Campo salvo em branco continua acompanhando a etapa 3 — apagar não pode deixar o
    // Projeto mais pobre que o Levantamento que o originou.
    expect(v.empresas).toBe('Matriz em Novo Hamburgo e filial em Campo Bom.');

    // Gerar daqui é o fecho do passo 10: o docservice recebe exatamente o que estava na tela.
    const res = await auth(
      request(server()).post(`/api/projetos/${pid}/gerar-layout/projeto`),
    );
    expect(res.status).toBe(200);
    expect(fake.ultimoCorpo.docConteudo.objetivos).toBe(
      'Objetivos revisados pelo GCI.',
    );
    expect(fake.ultimoCorpo.docConteudo.empresas).toBe(
      'Matriz em Novo Hamburgo e filial em Campo Bom.',
    );
    expect(fake.ultimoCorpo.docConteudo.det_vendas_detalhamento).toBe(
      'Emissão de NF: Emitida pelo faturamento após liberação do comercial.',
    );

    const passo10 = await passosRepo.findOne({
      where: { projetoId: pid, passo: 10 },
    });
    expect(passo10).not.toBeNull();
  });
});
