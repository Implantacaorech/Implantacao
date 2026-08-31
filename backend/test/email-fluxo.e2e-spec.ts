import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { rmSync } from 'fs';
import { join } from 'path';
import { AppModule } from '../src/app.module';
import { Usuario } from '../src/database/entities/usuario.entity';
import { Projeto } from '../src/database/entities/projeto.entity';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { ModeloEmailService } from '../src/email/modelo-email.service';
import { MODELOS_EMAIL_PADRAO } from '../src/email/modelo-email.constants';
import { EMAILS_POR_PASSO } from '../src/passos/passos-email.constants';

// dados/email_test_<JEST_WORKER_ID>/ guarda smtp.json/imap.json/graph.json entre execuções
// — limpo no início E no fim para não vazar estado de uma corrida anterior (mesma lição do
// EBUSY/store isolado por worker, ver docs/migracao/03-documento-conversao.md §6).
const DIR_TESTE = join(
  process.cwd(),
  'dados',
  `email_test_${process.env.JEST_WORKER_ID ?? '0'}`,
);

describe('E-mail / Fluxo (e2e)', () => {
  let app: INestApplication<App>;
  let usuarios: Repository<Usuario>;
  let projetos: Repository<Projeto>;
  let tokenAdm: string;
  let tokenConsultor: string;

  const server = () => app.getHttpServer();

  beforeAll(async () => {
    rmSync(DIR_TESTE, { recursive: true, force: true });
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
    projetos = moduleFixture.get(getRepositoryToken(Projeto));

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

    // Auto-seed pulado em teste (NODE_ENV=test) — semeia manualmente, mesmo padrão de
    // cadastros.e2e-spec.ts para os outros catálogos.
    const modeloEmailService = moduleFixture.get(ModeloEmailService);
    await modeloEmailService.seedPadroes();
  });

  afterAll(async () => {
    await app.close();
    rmSync(DIR_TESTE, { recursive: true, force: true });
  });

  function auth(req: request.Test, token = tokenAdm): request.Test {
    return req.set('Authorization', `Bearer ${token}`);
  }

  // Roda ANTES de qualquer teste que configure um meio de envio (abaixo) — assim
  // mailer.configurado() é false e o caminho é o rápido ("e-mail não configurado"),
  // sem tentar uma conexão de rede real (que seria lenta/instável neste ambiente).
  describe('Notificação automática de encerramento', () => {
    it('mudar a situação do projeto para Concluído registra um evento "email" pendente', async () => {
      const projeto = await projetos.save(
        projetos.create({
          cliente: 'Cliente Encerramento',
          situacao: 'Em andamento',
        }),
      );
      const res = await auth(
        request(server())
          .put(`/api/projetos/${projeto.id}`)
          .send({ situacao: 'Concluído' }),
      );
      expect(res.status).toBe(200);

      const eventos = await auth(
        request(server()).get(`/api/projetos/${projeto.id}/eventos`),
      );
      const eventoEmail = eventos.body.data.find(
        (e: { tipo: string }) => e.tipo === 'email',
      );
      expect(eventoEmail).toBeDefined();
      expect(eventoEmail.descricao).toContain(
        'Implantação encerrada — Cliente Encerramento',
      );
      expect(eventoEmail.descricao).toContain('Notificação pendente');
    });
  });

  describe('Config → E-mail (SMTP)', () => {
    it('não-ADM não acessa', async () => {
      const res = await auth(
        request(server()).get('/api/config/email'),
        tokenConsultor,
      );
      expect(res.status).toBe(403);
    });

    it('salva e lê de volta, sem nunca devolver a senha', async () => {
      // "smtp.invalid" — TLD reservado (RFC 2606), NUNCA resolve em DNS: qualquer
      // tentativa real de envio nos testes seguintes falha rápido e deterministicamente
      // (ENOTFOUND), sem depender de acesso à rede deste ambiente.
      const salvar = await auth(
        request(server()).post('/api/config/email').send({
          host: 'smtp.invalid',
          port: '587',
          user: 'u',
          remetente: 'r@x.com',
          senha: 'segredo',
        }),
      );
      expect(salvar.status).toBe(200);
      expect(salvar.body.data.senha).toBeUndefined();
      expect(salvar.body.data.configurado).toBe(true);

      const status = await auth(request(server()).get('/api/config/email'));
      expect(status.body.data.host).toBe('smtp.invalid');
      expect(status.body.data.senha).toBeUndefined();
    });
  });

  describe('Config → Caixa de entrada (IMAP)', () => {
    it('não-ADM não acessa', async () => {
      const res = await auth(
        request(server()).get('/api/config/imap'),
        tokenConsultor,
      );
      expect(res.status).toBe(403);
    });

    it('salva e lê de volta, sem nunca devolver a senha', async () => {
      const salvar = await auth(
        request(server()).post('/api/config/imap').send({
          host: 'imap.exemplo.com',
          user: 'u',
          pasta: 'Fechamentos',
          senha: 'segredo',
        }),
      );
      expect(salvar.status).toBe(200);
      expect(salvar.body.data.senha).toBeUndefined();
      expect(salvar.body.data.pasta).toBe('Fechamentos');
      expect(salvar.body.data.configurado).toBe(true);
    });
  });

  describe('Config → E-mail (Microsoft 365)', () => {
    // Deixar o Graph configurado faria as notificações dos testes seguintes tentarem uma
    // chamada REAL à Microsoft (lenta e dependente de rede) em vez do caminho rápido.
    afterAll(() => {
      rmSync(join(DIR_TESTE, 'graph.json'), { force: true });
    });

    it('não-ADM não acessa', async () => {
      const res = await auth(
        request(server()).get('/api/config/graph'),
        tokenConsultor,
      );
      expect(res.status).toBe(403);
    });

    it('status inicial: não configurado e sem segredo', async () => {
      const res = await auth(request(server()).get('/api/config/graph'));
      expect(res.body.data.configurado).toBe(false);
      expect(res.body.data.temSegredo).toBe(false);
    });

    it('salva e lê de volta, sem nunca devolver o segredo', async () => {
      const salvar = await auth(
        request(server()).post('/api/config/graph').send({
          tenantId: 'tenant-uuid',
          clientId: 'client-uuid',
          clientSecret: 'segredo',
          remetente: 'implantacao@rech.com.br',
        }),
      );
      expect(salvar.status).toBe(200);
      expect(salvar.body.data.clientSecret).toBeUndefined();
      expect(salvar.body.data.temSegredo).toBe(true);
      expect(salvar.body.data.configurado).toBe(true);

      const status = await auth(request(server()).get('/api/config/graph'));
      expect(status.body.data.tenantId).toBe('tenant-uuid');
      expect(status.body.data.clientSecret).toBeUndefined();
    });
  });

  describe('Config → Modelos de e-mail', () => {
    // Duas famílias semeadas: os modelos avulsos herdados do Flask e um `passo-N` por passo
    // que dispara e-mail. Os números saem das constantes de propósito — a revisão do processo
    // (19 → 21 passos) quebrou este teste quando ele fixava "7", e o próximo passo novo
    // quebraria de novo.
    it('semeia os modelos avulsos e um por passo que envia e-mail', async () => {
      const res = await auth(
        request(server()).get('/api/config/modelos-email'),
      );
      const slugs = (res.body.data.itens as { slug: string }[]).map(
        (m) => m.slug,
      );
      expect(slugs).toContain('boas-vindas');
      for (const e of EMAILS_POR_PASSO) {
        expect(slugs).toContain(`passo-${e.passo}`);
      }
      expect(slugs).toHaveLength(
        MODELOS_EMAIL_PADRAO.length + EMAILS_POR_PASSO.length,
      );
    });

    it('cria, edita e não deixa excluir um modelo padrão', async () => {
      const criar = await auth(
        request(server()).post('/api/config/modelos-email').send({
          nome: 'Aviso Extra',
          assunto: 'Assunto',
          corpo: 'Corpo {{CLIENTE}}',
        }),
      );
      expect(criar.status).toBe(200);
      const id = criar.body.data.id;

      const editar = await auth(
        request(server()).post(`/api/config/modelos-email/${id}`).send({
          nome: 'Aviso Extra Editado',
          assunto: 'Assunto',
          corpo: 'Corpo',
        }),
      );
      expect(editar.body.data.nome).toBe('Aviso Extra Editado');

      const excluirNaoPadrao = await auth(
        request(server()).post(`/api/config/modelos-email/${id}/excluir`),
      );
      expect(excluirNaoPadrao.status).toBe(200);

      const listaPadrao = await auth(
        request(server()).get('/api/config/modelos-email'),
      );
      const padrao = listaPadrao.body.data.itens.find(
        (m: { slug: string }) => m.slug === 'boas-vindas',
      );
      const excluirPadrao = await auth(
        request(server()).post(
          `/api/config/modelos-email/${padrao.id}/excluir`,
        ),
      );
      expect(excluirPadrao.status).toBe(400);
    });
  });

  describe('Fluxo (onboarding a partir do e-mail de fechamento)', () => {
    const EMAIL = `Cliente (Razão Social): Cliente Fluxo LTDA
CNPJ: 11.222.333/0001-44
Módulos contratados (siglas): FAT
Horas cobradas: 20`;

    it('status: reflete a configuração de IMAP/SMTP já salva nos testes anteriores', async () => {
      const res = await auth(request(server()).get('/api/fluxo'));
      expect(res.body.data.imapConfigurado).toBe(true);
      expect(res.body.data.smtpConfigurado).toBe(true);
    });

    it('parse extrai os campos sem criar nada', async () => {
      const res = await auth(
        request(server()).post('/api/fluxo/parse').send({ texto: EMAIL }),
      );
      expect(res.body.data.campos.cliente).toBe('Cliente Fluxo LTDA');
      expect(res.body.data.campos.cnpj).toBe('11.222.333/0001-44');
    });

    it('criar registra o projeto e a timeline recebe o evento de etapa', async () => {
      const parse = await auth(
        request(server()).post('/api/fluxo/parse').send({ texto: EMAIL }),
      );
      const criar = await auth(
        request(server()).post('/api/fluxo/criar').send(parse.body.data.campos),
      );
      expect(criar.status).toBe(200);
      const projetoId = criar.body.data.projetoId;

      const eventos = await auth(
        request(server()).get(`/api/projetos/${projetoId}/eventos`),
      );
      // '/api/fluxo/criar' chama criarComPacote (confirmação manual da tela), que registra
      // esta mensagem — 'Fechamento recebido automaticamente' é do OUTRO caminho
      // (criarDeCampos/criarDeFechamento, usado pelo robô da caixa). Achado real: este
      // teste checava a mensagem antiga, de antes de criarComPacote existir (§14).
      expect(
        eventos.body.data.some((e: { descricao: string }) =>
          e.descricao.includes('Fluxo iniciado pelo e-mail de fechamento'),
        ),
      ).toBe(true);

      // dedup: criar de novo com o mesmo CNPJ devolve o MESMO projeto, sem duplicar
      const criarDeNovo = await auth(
        request(server()).post('/api/fluxo/criar').send(parse.body.data.campos),
      );
      expect(criarDeNovo.body.data.projetoId).toBe(projetoId);
    });
  });
});
