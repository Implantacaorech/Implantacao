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
import { Evento } from '../src/database/entities/evento.entity';
import { MailerService } from '../src/email/mailer.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

class MailerServiceFake {
  enviados: { destino: unknown; assunto: string; corpo: string }[] = [];
  configurado(): boolean {
    return true;
  }
  async enviar(destino: unknown, assunto: string, corpo: string) {
    this.enviados.push({ destino, assunto, corpo });
    return { ok: true, erro: null };
  }
}

describe('Designação (e2e)', () => {
  let app: INestApplication<App>;
  let usuarios: Repository<Usuario>;
  let projetos: Repository<Projeto>;
  let eventos: Repository<Evento>;
  let mailerFake: MailerServiceFake;
  let tokenAdm: string;
  let tokenAdministrativo: string;
  let tokenGci: string;
  let tokenConsultor: string;
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
    })
      .overrideProvider(MailerService)
      .useClass(MailerServiceFake)
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
    projetos = moduleFixture.get(getRepositoryToken(Projeto));
    eventos = moduleFixture.get(getRepositoryToken(Evento));
    mailerFake = moduleFixture.get(MailerService);

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
        login: 'adm1',
        nome: 'Administrativo Um',
        email: 'adm1@teste.com',
        senhaHash: await bcrypt.hash('senha-adm1-123', 4),
        perfil: 'Administrativo',
        ativo: true,
      }),
    );
    await usuarios.save(
      usuarios.create({
        login: 'gci1',
        nome: 'Ana GCI',
        email: 'ana.gci@teste.com',
        senhaHash: await bcrypt.hash('senha-gci-123', 4),
        perfil: 'GCI',
        ativo: true,
      }),
    );
    await usuarios.save(
      usuarios.create({
        login: 'cons1',
        nome: 'Beto Consultor',
        email: 'beto.consultor@teste.com',
        senhaHash: await bcrypt.hash('senha-cons-123', 4),
        perfil: 'Consultor',
        ativo: true,
      }),
    );

    tokenAdm = (
      await request(server()).post('/api/auth/login').send({ login: 'admin', senha: 'senha-adm-123' })
    ).body.data.accessToken;
    tokenAdministrativo = (
      await request(server()).post('/api/auth/login').send({ login: 'adm1', senha: 'senha-adm1-123' })
    ).body.data.accessToken;
    tokenGci = (
      await request(server()).post('/api/auth/login').send({ login: 'gci1', senha: 'senha-gci-123' })
    ).body.data.accessToken;
    tokenConsultor = (
      await request(server()).post('/api/auth/login').send({ login: 'cons1', senha: 'senha-cons-123' })
    ).body.data.accessToken;

    const p = await projetos.save(
      projetos.create({
        cliente: 'Cliente Designação',
        cnpj: 'x',
        numeroProjeto: 'P1',
        modulos: 'FAT,CTB',
        horasCobradas: '10',
        etapa: 'Agendamento',
        situacao: 'Em andamento',
      }),
    );
    projetoId = p.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET/POST /projetos/:id/definir-gci (Etapa 5 — Administrativo)', () => {
    it('GCI não acessa (403) — só ADM/Administrativo', async () => {
      const res = await auth(request(server()).get(`/api/projetos/${projetoId}/definir-gci`), tokenGci);
      expect(res.status).toBe(403);
    });

    it('rejeita quando nenhum GCI é selecionado', async () => {
      const res = await auth(
        request(server()).post(`/api/projetos/${projetoId}/definir-gci`),
        tokenAdministrativo,
      ).send({ gcis: [] });
      expect(res.status).toBe(400);
    });

    it('Administrativo define o GCI, sem notificar por e-mail', async () => {
      mailerFake.enviados = [];
      const res = await auth(
        request(server()).post(`/api/projetos/${projetoId}/definir-gci`),
        tokenAdministrativo,
      ).send({ gcis: ['Ana GCI'] });
      expect(res.status).toBe(200);
      expect(res.body.data.gci).toBe('Ana GCI');
      expect(mailerFake.enviados).toHaveLength(0);
    });
  });

  describe('GET/POST /projetos/:id/agendar (Etapa 2 — Administrativo)', () => {
    it('rejeita data no passado', async () => {
      const res = await auth(
        request(server()).post(`/api/projetos/${projetoId}/agendar`),
        tokenAdministrativo,
      ).send({ dataLevantamento: '2020-01-01' });
      expect(res.status).toBe(400);
    });

    it('confirma a data, notifica o GCI e avança a etapa automaticamente', async () => {
      mailerFake.enviados = [];
      const dataFutura = new Date();
      dataFutura.setDate(dataFutura.getDate() + 10);
      const iso = dataFutura.toISOString().slice(0, 10);

      const res = await auth(
        request(server()).post(`/api/projetos/${projetoId}/agendar`),
        tokenAdministrativo,
      ).send({ dataLevantamento: iso });

      expect(res.status).toBe(200);
      expect(res.body.data.dataLevantamento).toBe(iso);
      expect(res.body.data.etapa).toBe('Levantamento'); // auto-avanço: Agendamento -> Levantamento
      expect(mailerFake.enviados).toHaveLength(1);
      expect(mailerFake.enviados[0].destino).toEqual(['ana.gci@teste.com']);
      expect(mailerFake.enviados[0].assunto).toContain('Levantamento agendado');
    });
  });

  describe('GET/POST /projetos/:id/consultores (Etapa 6 — GCI)', () => {
    it('Administrativo não acessa (403) — só ADM/GCI', async () => {
      const res = await auth(
        request(server()).get(`/api/projetos/${projetoId}/consultores`),
        tokenAdministrativo,
      );
      expect(res.status).toBe(403);
    });

    it('Consultor não acessa (403)', async () => {
      const res = await auth(request(server()).get(`/api/projetos/${projetoId}/consultores`), tokenConsultor);
      expect(res.status).toBe(403);
    });

    it('GCI vê os módulos do projeto e a lista de consultores ativos', async () => {
      const res = await auth(request(server()).get(`/api/projetos/${projetoId}/consultores`), tokenGci);
      expect(res.status).toBe(200);
      expect(res.body.data.modulos).toEqual(['FAT', 'CTB']);
      expect(res.body.data.consultores).toContain('Beto Consultor');
    });

    it('rejeita quando nenhum consultor é designado', async () => {
      const res = await auth(
        request(server()).post(`/api/projetos/${projetoId}/consultores`),
        tokenGci,
      ).send({ designacoes: {} });
      expect(res.status).toBe(400);
    });

    it('GCI designa os consultores, cada um é notificado e a etapa avança automaticamente', async () => {
      mailerFake.enviados = [];
      const res = await auth(
        request(server()).post(`/api/projetos/${projetoId}/consultores`),
        tokenGci,
      ).send({ designacoes: { FAT: 'Beto Consultor', CTB: 'Beto Consultor' } });

      expect(res.status).toBe(200);
      expect(res.body.data.consultor).toBe('Beto Consultor');
      expect(mailerFake.enviados).toHaveLength(1);
      expect(mailerFake.enviados[0].destino).toBe('beto.consultor@teste.com');
      expect(mailerFake.enviados[0].corpo).toContain('FAT, CTB');

      const eventosDoProjeto = await eventos.find({ where: { projetoId } });
      expect(eventosDoProjeto.some((e) => e.descricao.includes('Consultores designados'))).toBe(true);
    });
  });

  describe('ADM sempre acessa (super-perfil em todas as etapas)', () => {
    it('ADM acessa definir-gci, agendar e consultores', async () => {
      const r1 = await auth(request(server()).get(`/api/projetos/${projetoId}/definir-gci`), tokenAdm);
      const r2 = await auth(request(server()).get(`/api/projetos/${projetoId}/agendar`), tokenAdm);
      const r3 = await auth(request(server()).get(`/api/projetos/${projetoId}/consultores`), tokenAdm);
      expect(r1.status).toBe(200);
      expect(r2.status).toBe(200);
      expect(r3.status).toBe(200);
    });
  });
});
