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

describe('Plano Cronograma/Checklist (e2e)', () => {
  let app: INestApplication<App>;
  let usuarios: Repository<Usuario>;
  let projetos: Repository<Projeto>;
  let checklistModelo: Repository<ChecklistModelo>;
  let tokenAdm: string;
  let tokenGci: string;
  let projetoId: number;

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
    checklistModelo = moduleFixture.get(getRepositoryToken(ChecklistModelo));

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
        login: 'gci1',
        nome: 'GCI Um',
        email: 'gci1@teste.com',
        senhaHash: await bcrypt.hash('senha-gci-123', 4),
        perfil: 'GCI',
        ativo: true,
      }),
    );

    tokenAdm = (
      await request(server())
        .post('/api/auth/login')
        .send({ login: 'admin', senha: 'senha-adm-123' })
    ).body.data.accessToken;
    tokenGci = (
      await request(server())
        .post('/api/auth/login')
        .send({ login: 'gci1', senha: 'senha-gci-123' })
    ).body.data.accessToken;

    const p = await projetos.save(
      projetos.create({
        cliente: 'Cliente Plano',
        cnpj: 'x',
        numeroProjeto: 'P1',
        modulos: 'FAT',
        horasCobradas: '20',
        consultor: 'Beto Consultor',
        dataInicio: '2026-08-10', // segunda-feira
        etapa: 'Cronograma e Check-list',
        situacao: 'Em andamento',
      }),
    );
    projetoId = p.id;

    await checklistModelo.save(
      checklistModelo.create({
        modulo: 'FAT',
        adicional: '',
        item: 'Emitir nota fiscal',
        acao: 'conferir tributação',
        menu: '2.1.A',
        ordem: 0,
      }),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET/POST /projetos/:id/cronograma', () => {
    it('GCI não acessa (403) — fora de PERFIS_GERA_CRONOGRAMA', async () => {
      const res = await auth(
        request(server()).get(`/api/projetos/${projetoId}/cronograma`),
        tokenGci,
      );
      expect(res.status).toBe(403);
    });

    it('começa vazio, sem histórico', async () => {
      const res = await auth(
        request(server()).get(`/api/projetos/${projetoId}/cronograma`),
        tokenAdm,
      );
      expect(res.status).toBe(200);
      expect(res.body.data.itens).toEqual([]);
      expect(res.body.data.historico).toEqual([]);
    });

    it('seed gera o plano automático a partir dos módulos/horas do projeto', async () => {
      const res = await auth(
        request(server()).post(`/api/projetos/${projetoId}/cronograma/seed`),
        tokenAdm,
      );
      expect(res.status).toBe(200);
      expect(res.body.data.itens.length).toBeGreaterThan(1);
      expect(res.body.data.itens[0].etapa).toBe(
        'Abertura + Parametrização inicial',
      );
      expect(res.body.data.itens[0].data).toBe('10/08/2026');
    });

    it('salvar substitui as linhas e registra o histórico + evento', async () => {
      const atual = await auth(
        request(server()).get(`/api/projetos/${projetoId}/cronograma`),
        tokenAdm,
      );
      const linhas = atual.body.data.itens.map(
        (i: {
          etapa: string;
          topicos: string;
          horas: string;
          data: string;
          modalidade: string;
          status: string;
        }) => ({
          etapa: i.etapa,
          topicos: i.topicos,
          horas: i.horas,
          data: i.data,
          modalidade: i.modalidade,
          status:
            i.etapa === 'Abertura + Parametrização inicial'
              ? 'Concluído'
              : i.status,
        }),
      );

      const salvo = await auth(
        request(server()).post(`/api/projetos/${projetoId}/cronograma`),
        tokenAdm,
      ).send({
        linhas,
      });
      expect(salvo.status).toBe(200);
      expect(salvo.body.data.mudancas).toBe(1); // só o status da 1ª linha mudou

      const depois = await auth(
        request(server()).get(`/api/projetos/${projetoId}/cronograma`),
        tokenAdm,
      );
      expect(depois.body.data.itens[0].status).toBe('Concluído');
      // histórico acumula o seed (1 "linha nova" por etapa) + esta edição (1 "status")
      expect(depois.body.data.historico.length).toBeGreaterThanOrEqual(1);
      expect(
        depois.body.data.historico.some(
          (h: { campo: string; de: string; para: string }) =>
            h.campo === 'status' &&
            h.de === 'Previsto' &&
            h.para === 'Concluído',
        ),
      ).toBe(true);
    });
  });

  describe('GET/POST /projetos/:id/checklist', () => {
    it('seed gera o roteiro a partir do catálogo ChecklistModelo (não do YAML)', async () => {
      const res = await auth(
        request(server()).post(`/api/projetos/${projetoId}/checklist/seed`),
        tokenAdm,
      );
      expect(res.status).toBe(200);
      expect(res.body.data.itens).toEqual([
        expect.objectContaining({
          modulo: 'FAT',
          item: 'Emitir nota fiscal — conferir tributação',
          responsavel: 'Beto Consultor',
          status: 'Pendente',
          obs: '2.1.A',
        }),
      ]);
    });

    it('salvar substitui as linhas e registra o histórico', async () => {
      const salvo = await auth(
        request(server()).post(`/api/projetos/${projetoId}/checklist`),
        tokenAdm,
      ).send({
        linhas: [
          {
            modulo: 'FAT',
            item: 'Emitir nota fiscal — conferir tributação',
            responsavel: 'Beto Consultor',
            status: 'Concluído',
            obs: '2.1.A',
          },
        ],
      });
      expect(salvo.status).toBe(200);
      expect(salvo.body.data.mudancas).toBe(1);
      expect(salvo.body.data.itens[0].status).toBe('Concluído');
    });

    it('lista vazia apaga todas as linhas', async () => {
      const salvo = await auth(
        request(server()).post(`/api/projetos/${projetoId}/checklist`),
        tokenAdm,
      ).send({
        linhas: [],
      });
      expect(salvo.status).toBe(200);
      expect(salvo.body.data.itens).toEqual([]);
    });
  });

  it('projeto inexistente devolve 404', async () => {
    const res = await auth(
      request(server()).get('/api/projetos/999999/cronograma'),
      tokenAdm,
    );
    expect(res.status).toBe(404);
  });
});
