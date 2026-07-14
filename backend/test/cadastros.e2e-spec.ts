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

// Suíte end-to-end de Cadastros (pré-requisito da geração de documentos): ChecklistModelo,
// IndiceTopico, ModeloDocumento e o questionário do Levantamento (LevantamentoResposta +
// DocConteudo). Cada teste usa um SQLite em memória isolado.
describe('Cadastros (e2e)', () => {
  let app: INestApplication<App>;
  let usuarios: Repository<Usuario>;
  let projetos: Repository<Projeto>;
  let indiceRepo: Repository<IndiceTopico>;
  let tokenAdm: string;
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

    const loginAdm = await request(server())
      .post('/api/auth/login')
      .send({ login: 'admin', senha: 'senha-adm-123' });
    tokenAdm = loginAdm.body.data.accessToken;
    const loginConsultor = await request(server())
      .post('/api/auth/login')
      .send({ login: 'consultor1', senha: 'senha-cons-123' });
    tokenConsultor = loginConsultor.body.data.accessToken;

    // Catálogo sintético do Índice de Tópicos (NODE_ENV=test pula o auto-seed do YAML real).
    await indiceRepo.save(
      [
        {
          moduloSigla: 'FAT',
          modulo: 'Faturamento',
          adicional: '',
          topico: 'Emissão de NF',
        },
        {
          moduloSigla: 'FAT',
          modulo: 'Faturamento',
          adicional: '',
          topico: 'Devolução',
        },
        {
          moduloSigla: 'EST',
          modulo: 'Estoque',
          adicional: '',
          topico: 'Inventário',
        },
      ].map((l, i) => indiceRepo.create({ ordem: i, ...l })),
    );

    // ModeloDocumento: seed manual (auto-seed também pulado em teste) usando os layouts
    // fiéis reais do repositório (tools/templates/layouts/) — não é dado sensível, só o
    // esqueleto do documento, já versionado no git.
    const modeloDocumentoService = moduleFixture.get(ModeloDocumentoService);
    await modeloDocumentoService.seedDefaults();
  });

  afterAll(async () => {
    await app.close();
  });

  function auth(req: request.Test, token = tokenAdm): request.Test {
    return req.set('Authorization', `Bearer ${token}`);
  }

  describe('Controle de acesso — exclusivo do Administrador', () => {
    it('Consultor não pode acessar /cadastros/*', async () => {
      const res = await auth(
        request(server()).get('/api/cadastros/checklist'),
        tokenConsultor,
      );
      expect(res.status).toBe(403);
    });

    it('sem token, 401', async () => {
      const res = await request(server()).get('/api/cadastros/checklist');
      expect(res.status).toBe(401);
    });
  });

  describe('Check List (catálogo)', () => {
    it('cria, lista e exclui uma linha', async () => {
      const criar = await auth(
        request(server()).post('/api/cadastros/checklist'),
      ).send({
        modulo: 'FAT',
        item: 'Item de teste',
        seq: '1',
      });
      expect(criar.status).toBe(201);
      const id = criar.body.data.id;

      const listar = await auth(
        request(server()).get('/api/cadastros/checklist?mod=FAT'),
      );
      expect(listar.status).toBe(200);
      expect(
        listar.body.data.linhas.some((l: { id: number }) => l.id === id),
      ).toBe(true);

      const excluir = await auth(
        request(server()).delete(`/api/cadastros/checklist/${id}`),
      );
      expect(excluir.status).toBe(200);
      const listarDepois = await auth(
        request(server()).get('/api/cadastros/checklist?mod=FAT'),
      );
      expect(
        listarDepois.body.data.linhas.some((l: { id: number }) => l.id === id),
      ).toBe(false);
    });
  });

  describe('Índice de Tópicos', () => {
    it('lista com filtro por módulo e módulos distintos', async () => {
      const res = await auth(
        request(server()).get('/api/cadastros/indice?mod=FAT'),
      );
      expect(res.status).toBe(200);
      expect(res.body.data.linhas).toHaveLength(2);
      expect(
        res.body.data.modulos.map((m: { sigla: string }) => m.sigla),
      ).toContain('FAT');
    });

    it('cria e exclui um tópico', async () => {
      const criar = await auth(
        request(server()).post('/api/cadastros/indice'),
      ).send({
        moduloSigla: 'FAT',
        modulo: 'Faturamento',
        topico: 'Tópico novo',
      });
      expect(criar.status).toBe(201);
      const id = criar.body.data.id;
      const excluir = await auth(
        request(server()).delete(`/api/cadastros/indice/${id}`),
      );
      expect(excluir.status).toBe(200);
    });
  });

  describe('Modelos de Documentos', () => {
    it('lista os 4 modelos semeados (Levantamento, Projeto, Cronograma, Termo)', async () => {
      const res = await auth(request(server()).get('/api/cadastros/modelos'));
      expect(res.status).toBe(200);
      const slugs = res.body.data.map((m: { slug: string }) => m.slug).sort();
      expect(slugs).toEqual(['cronograma', 'levantamento', 'projeto', 'termo']);
      expect(
        res.body.data.every((m: { nVersoes: number }) => m.nVersoes === 1),
      ).toBe(true);
    });

    it('detalhe traz o modelo + versões', async () => {
      const lista = (
        await auth(request(server()).get('/api/cadastros/modelos'))
      ).body.data;
      const levantamento = lista.find(
        (m: { slug: string }) => m.slug === 'levantamento',
      );
      const res = await auth(
        request(server()).get(`/api/cadastros/modelos/${levantamento.id}`),
      );
      expect(res.status).toBe(200);
      expect(res.body.data.modelo.slug).toBe('levantamento');
      expect(res.body.data.versoes).toHaveLength(1);
      expect(res.body.data.versoes[0].vigente).toBe(true);
    });

    it('envia uma nova versão e rejeita extensão errada', async () => {
      const lista = (
        await auth(request(server()).get('/api/cadastros/modelos'))
      ).body.data;
      const termo = lista.find((m: { slug: string }) => m.slug === 'termo'); // tipo docx

      const errado = await auth(
        request(server()).post(`/api/cadastros/modelos/${termo.id}/versao`),
      )
        .attach('arquivo', Buffer.from('conteudo'), 'novo.xlsx')
        .field('motivo', 'teste');
      expect(errado.status).toBe(422);

      const certo = await auth(
        request(server()).post(`/api/cadastros/modelos/${termo.id}/versao`),
      )
        .attach('arquivo', Buffer.from('conteudo docx'), 'novo.docx')
        .field('motivo', 'Atualização de teste');
      expect(certo.status).toBe(201);
      expect(certo.body.data.versao).toBe(2);

      const detalhe = await auth(
        request(server()).get(`/api/cadastros/modelos/${termo.id}`),
      );
      expect(detalhe.body.data.versoes).toHaveLength(2);
      expect(
        detalhe.body.data.versoes.find(
          (v: { versao: number }) => v.versao === 2,
        ).vigente,
      ).toBe(true);
      expect(
        detalhe.body.data.versoes.find(
          (v: { versao: number }) => v.versao === 1,
        ).vigente,
      ).toBe(false);
    });

    it('baixa o arquivo vigente', async () => {
      const lista = (
        await auth(request(server()).get('/api/cadastros/modelos'))
      ).body.data;
      const cronograma = lista.find(
        (m: { slug: string }) => m.slug === 'cronograma',
      );
      const res = await auth(
        request(server()).get(`/api/cadastros/modelos/${cronograma.id}/baixar`),
      );
      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toContain('cronograma');
    });
  });

  describe('Levantamento (respostas) e DocConteudo', () => {
    async function novoProjeto(
      cliente: string,
      modulos: string,
    ): Promise<number> {
      const p = await projetos.save(
        projetos.create({ cliente, cnpj: '00.000.000/0001-00', modulos }),
      );
      return p.id;
    }

    it('semeia as respostas a partir do Índice de Tópicos dos módulos contratados', async () => {
      const pid = await novoProjeto('Cliente Levantamento LTDA', 'FAT,EST');
      const res = await auth(
        request(server()).get(`/api/projetos/${pid}/levantamento`),
      );
      expect(res.status).toBe(200);
      expect(res.body.data.linhas).toHaveLength(3); // 2 de FAT + 1 de EST
      expect(res.body.data.resumo).toEqual({ respondidas: 0, total: 3 });
    });

    it('salva respostas e atualiza o resumo', async () => {
      const pid = await novoProjeto('Cliente Respostas LTDA', 'EST');
      const antes = await auth(
        request(server()).get(`/api/projetos/${pid}/levantamento`),
      );
      const linhaId = antes.body.data.linhas[0].id;

      const salvar = await auth(
        request(server()).put(`/api/projetos/${pid}/levantamento`),
      ).send({
        [String(linhaId)]: 'Resposta preenchida',
      });
      expect(salvar.status).toBe(200);
      expect(salvar.body.data.respondidas).toBe(1);

      const depois = await auth(
        request(server()).get(`/api/projetos/${pid}/levantamento`),
      );
      expect(depois.body.data.resumo).toEqual({ respondidas: 1, total: 1 });
    });

    it('Consultor não pode acessar o Levantamento (pode_gerar("levantamento") exclui Consultor)', async () => {
      const pid = await novoProjeto('Cliente SemAcesso LTDA', 'EST');
      const res = await request(server())
        .get(`/api/projetos/${pid}/levantamento`)
        .set('Authorization', `Bearer ${tokenConsultor}`);
      expect(res.status).toBe(403);
    });

    it('DocConteudo salva e devolve campos estruturados por documento', async () => {
      const pid = await novoProjeto('Cliente DocConteudo LTDA', 'EST');
      const salvar = await auth(
        request(server()).put(`/api/projetos/${pid}/doc-conteudo/levantamento`),
      ).send({
        objetivos: 'Reduzir retrabalho',
        software_atual: 'Planilhas',
      });
      expect(salvar.status).toBe(200);

      const valores = await auth(
        request(server()).get(`/api/projetos/${pid}/doc-conteudo/levantamento`),
      );
      expect(valores.body.data).toEqual({
        objetivos: 'Reduzir retrabalho',
        software_atual: 'Planilhas',
      });

      // "projeto" é um doc diferente — não compartilha valores com "levantamento".
      const outroDoc = await auth(
        request(server()).get(`/api/projetos/${pid}/doc-conteudo/projeto`),
      );
      expect(outroDoc.body.data).toEqual({});
    });
  });
});
