import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Usuario } from '../src/database/entities/usuario.entity';
import { DicionarioDocumento } from '../src/database/entities/dicionario-documento.entity';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

/** Prova ponta a ponta do Dicionário Inteligente: pesquisa, abre o documento com
 * seções/fonte, filtra por sigla, e a rota /perguntar responde de forma honesta (sem chave
 * de IA no ambiente de teste, devolve as fontes sem inventar).
 *
 * Atualizado em 2026-07-29: o Dicionário deixou de ser aberto a qualquer autenticado e virou
 * ADM-only na definição de menus de 2026-07-28 (`@Permissao('dicionario')` no controller,
 * `dicionario: { ADM: 'alteracao' }` em PADRAO_PERMISSOES). Este arquivo ainda rodava tudo
 * com token de Consultor e levava 403 em seis casos. */
describe('Dicionário Inteligente (e2e)', () => {
  let app: INestApplication<App>;
  let usuarios: Repository<Usuario>;
  let docs: Repository<DicionarioDocumento>;
  /** O Dicionário é ADM-only (`dicionario: { ADM: 'alteracao' }` em PADRAO_PERMISSOES e
   * MENU_DICIONARIO no frontend, definição de 2026-07-28). Os cenários funcionais correm
   * com o ADM; o Consultor fica só para provar que a porta está fechada. */
  let tokenAdm: string;
  let tokenConsultor: string;

  const server = () => app.getHttpServer();

  beforeAll(async () => {
    process.env.MIGRACAO_DB_URL = '';
    process.env.MIGRACAO_DB_SQLITE = ':memory:';
    delete process.env.MIGRACAO_ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

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
    docs = moduleFixture.get(getRepositoryToken(DicionarioDocumento));

    await usuarios.save([
      usuarios.create({
        login: 'consultor1',
        nome: 'Consultor Um',
        email: 'consultor1@teste.com',
        senhaHash: await bcrypt.hash('senha-cons-123', 4),
        perfil: 'Consultor',
        ativo: true,
      }),
      usuarios.create({
        login: 'admin1',
        nome: 'Administradora',
        email: 'admin1@teste.com',
        senhaHash: await bcrypt.hash('senha-adm-123', 4),
        perfil: 'ADM',
        ativo: true,
      }),
    ]);
    tokenConsultor = (
      await request(server())
        .post('/api/auth/login')
        .send({ login: 'consultor1', senha: 'senha-cons-123' })
    ).body.data.accessToken;
    tokenAdm = (
      await request(server())
        .post('/api/auth/login')
        .send({ login: 'admin1', senha: 'senha-adm-123' })
    ).body.data.accessToken;

    await docs.save(
      docs.create({
        slug: '01-ctb-contabilidade',
        tipo: 'modulo',
        sigla: 'CTB',
        titulo: 'CTB - Contabilidade',
        resumo: 'Centraliza a contabilidade do SIGER.',
        conteudo:
          '# CTB - Contabilidade\n\n## 8. Configuracoes disponiveis\n\nA configuracao CTB101 no menu 1.1 define os parametros do sistema.',
        palavrasChave: 'CTB005 CTB101 CTB106 parametros',
        caminhoOrigem: 'c:/docs/modulos/01-ctb-contabilidade.md',
        urlOrigem:
          'https://github.com/x/blob/main/modulos/01-ctb-contabilidade.md',
        hashConteudo: 'a'.repeat(64),
      }),
    );
    await docs.save(
      docs.create({
        slug: '01-etg-etiquetas',
        tipo: 'adicional',
        sigla: 'ETG',
        titulo: 'ETG - Etiquetas',
        resumo: 'Etiquetas GOL/SSCC.',
        conteudo:
          '# ETG - Etiquetas\n\nConteudo do adicional ETG sobre etiquetas.',
        palavrasChave: 'ETG etiqueta',
        caminhoOrigem: 'c:/docs/adicionais/01-etg-etiquetas.md',
        urlOrigem:
          'https://github.com/x/blob/main/adicionais/01-etg-etiquetas.md',
        hashConteudo: 'b'.repeat(64),
      }),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('pesquisa por termo devolve o documento com trecho', async () => {
    const res = await request(server())
      .get('/api/dicionario/pesquisar')
      .query({ q: 'CTB101' })
      .set('Authorization', `Bearer ${tokenAdm}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].sigla).toBe('CTB');
    expect(res.body.data[0].trecho).toContain('CTB101');
  });

  it('filtra por tipo=adicional', async () => {
    const res = await request(server())
      .get('/api/dicionario/pesquisar')
      .query({ tipo: 'adicional' })
      .set('Authorization', `Bearer ${tokenAdm}`);
    expect(res.status).toBe(200);
    expect(
      res.body.data.every((d: { tipo: string }) => d.tipo === 'adicional'),
    ).toBe(true);
  });

  it('abre um documento pelo slug com seções e fonte', async () => {
    const res = await request(server())
      .get('/api/dicionario/01-ctb-contabilidade')
      .set('Authorization', `Bearer ${tokenAdm}`);
    expect(res.status).toBe(200);
    expect(res.body.data.titulo).toBe('CTB - Contabilidade');
    expect(res.body.data.secoes[0].categoria).toBe('configuracao');
    expect(res.body.data.urlOrigem).toContain(
      'modulos/01-ctb-contabilidade.md',
    );
  });

  it('slug inexistente devolve 404', async () => {
    const res = await request(server())
      .get('/api/dicionario/nao-existe')
      .set('Authorization', `Bearer ${tokenAdm}`);
    expect(res.status).toBe(404);
  });

  it('status reflete a base ingerida', async () => {
    const res = await request(server())
      .get('/api/dicionario/status')
      .set('Authorization', `Bearer ${tokenAdm}`);
    expect(res.status).toBe(200);
    expect(res.body.data.totalDocumentos).toBe(2);
    expect(res.body.data.totalModulos).toBe(1);
    expect(res.body.data.totalAdicionais).toBe(1);
  });

  it('perguntar sem chave de IA devolve fontes reais sem inventar resposta', async () => {
    const res = await request(server())
      .post('/api/dicionario/perguntar')
      .send({ pergunta: 'como configuro o CTB101' })
      .set('Authorization', `Bearer ${tokenAdm}`);
    expect(res.status).toBe(201);
    expect(res.body.data.iaDisponivel).toBe(false);
    expect(res.body.data.fontes.length).toBeGreaterThan(0);
    expect(res.body.data.fontes[0].slug).toBe('01-ctb-contabilidade');
  });

  it('Consultor não entra no Dicionário — a tela é ADM-only', async () => {
    const res = await request(server())
      .get('/api/dicionario/pesquisar')
      .query({ q: 'CTB101' })
      .set('Authorization', `Bearer ${tokenConsultor}`);
    expect(res.status).toBe(403);
  });

  it('sem autenticação é rejeitado', async () => {
    const res = await request(server())
      .get('/api/dicionario/pesquisar')
      .query({ q: 'x' });
    expect(res.status).toBe(401);
  });
});
