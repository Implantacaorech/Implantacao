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
import { ProjetoPasso } from '../src/database/entities/projeto-passo.entity';
import { MailerService } from '../src/email/mailer.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { Perfil } from '../src/common/constants/perfis';

class MailerServiceFake {
  configurado(): boolean {
    return true;
  }
  async enviar() {
    return { ok: true, erro: null };
  }
}

/** Prova das REGRAS do processo de 18 passos (revisão de 2026-07-22) contra a aplicação de
 * verdade: guards, banco e serviço. O que está aqui é o que o usuário especificou, não o que
 * o código faz. */
describe('Passos do processo (e2e)', () => {
  let app: INestApplication<App>;
  let usuarios: Repository<Usuario>;
  let projetos: Repository<Projeto>;
  let passosRepo: Repository<ProjetoPasso>;
  const tokens: Record<string, string> = {};
  let projetoId: number;

  const server = () => app.getHttpServer();
  const auth = (req: request.Test, token: string) =>
    req.set('Authorization', `Bearer ${token}`);

  /** Conclui o passo com um usuário do perfil certo, sem passar pelas regras — usado para
   * chegar rápido ao ponto que cada teste quer exercitar. */
  async function jaConcluido(numeros: number[]) {
    for (const passo of numeros) {
      await passosRepo.save(
        passosRepo.create({ projetoId, passo, concluidoPor: 'setup' }),
      );
    }
  }

  async function criarUsuario(
    login: string,
    perfil: Perfil,
    nome: string,
  ): Promise<string> {
    await usuarios.save(
      usuarios.create({
        login,
        nome,
        email: `${login}@teste.com`,
        senhaHash: await bcrypt.hash('senha-teste-123', 4),
        perfil,
        ativo: true,
      }),
    );
    const res = await request(server())
      .post('/api/auth/login')
      .send({ login, senha: 'senha-teste-123' });
    return (res.body as { data: { accessToken: string } }).data.accessToken;
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
    passosRepo = moduleFixture.get(getRepositoryToken(ProjetoPasso));

    tokens.adm = await criarUsuario('admin', 'ADM', 'Administradora');
    tokens.administrativo = await criarUsuario(
      'adm1',
      'Administrativo',
      'Administrativo Um',
    );
    tokens.coordenador = await criarUsuario(
      'paim',
      'Coordenador',
      'Paim Coordenador',
    );
    tokens.gci = await criarUsuario('gci1', 'GCI', 'GCI Um');
    tokens.consultor = await criarUsuario('cons1', 'Consultor', 'Consultor Um');
  });

  beforeEach(async () => {
    await passosRepo.clear();
    const p = await projetos.save(
      projetos.create({ cliente: 'Cliente de Teste' }),
    );
    projetoId = p.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('lista os 18 passos com responsável e estado', async () => {
    const res = await auth(
      request(server()).get(`/api/projetos/${projetoId}/passos`),
      tokens.administrativo,
    ).expect(200);
    const dados = (res.body as { data: { numero: number }[] }).data;
    expect(dados.length).toBe(18);
    expect(dados[0].numero).toBe(1);
  });

  it('recusa quem não é o responsável pelo passo', async () => {
    await jaConcluido([1]);
    // Passo 2 é do Administrativo; o Consultor não pode concluir.
    await auth(
      request(server()).post(`/api/projetos/${projetoId}/passos/2/concluir`),
      tokens.consultor,
    )
      .send({})
      .expect(403);
  });

  it('recusa concluir passo cuja dependência ainda não foi feita', async () => {
    // Passo 2 depende do 1, que não foi concluído.
    const res = await auth(
      request(server()).post(`/api/projetos/${projetoId}/passos/2/concluir`),
      tokens.administrativo,
    )
      .send({})
      .expect(400);
    expect(JSON.stringify(res.body)).toContain('depende do passo 1');
  });

  it('deixa o Coordenador indicar GCI e técnicos (passo 6)', async () => {
    await jaConcluido([1, 2, 3, 4, 5]);
    await auth(
      request(server()).post(`/api/projetos/${projetoId}/passos/6/concluir`),
      tokens.coordenador,
    )
      .send({})
      .expect(201);
  });

  it('não deixa o Administrativo fazer o passo 6 (mudou na revisão do processo)', async () => {
    await jaConcluido([1, 2, 3, 4, 5]);
    await auth(
      request(server()).post(`/api/projetos/${projetoId}/passos/6/concluir`),
      tokens.administrativo,
    )
      .send({})
      .expect(403);
  });

  it('permite o Cronograma (10) sem o Projeto (8) — trilhas paralelas', async () => {
    await jaConcluido([1, 2, 3, 4, 5, 6, 7]);
    // O passo 10 sai direto do 7; não espera o 8 nem o 9.
    await auth(
      request(server()).post(`/api/projetos/${projetoId}/passos/10/concluir`),
      tokens.consultor,
    )
      .send({})
      .expect(201);
  });

  it('segura o passo 10 enquanto o passo 7 não foi concluído', async () => {
    await jaConcluido([1, 2, 3, 4, 5, 6]);
    await auth(
      request(server()).post(`/api/projetos/${projetoId}/passos/10/concluir`),
      tokens.consultor,
    )
      .send({})
      .expect(400);
  });

  it('exige a conferência do passo 9 antes de liberar o seguinte', async () => {
    await jaConcluido([1, 2, 3, 4, 5, 6, 7, 8]);
    await auth(
      request(server()).post(`/api/projetos/${projetoId}/passos/9/concluir`),
      tokens.administrativo,
    )
      .send({})
      .expect(201);

    const lista = await auth(
      request(server()).get(`/api/projetos/${projetoId}/passos`),
      tokens.administrativo,
    ).expect(200);
    const passo9 = (
      lista.body as { data: { numero: number; conferido: boolean }[] }
    ).data.find((p) => p.numero === 9);
    expect(passo9?.conferido).toBe(false);

    await auth(
      request(server()).post(`/api/projetos/${projetoId}/passos/9/conferir`),
      tokens.administrativo,
    ).expect(201);

    const depois = await auth(
      request(server()).get(`/api/projetos/${projetoId}/passos`),
      tokens.administrativo,
    ).expect(200);
    const passo9Depois = (
      depois.body as { data: { numero: number; conferido: boolean }[] }
    ).data.find((p) => p.numero === 9);
    expect(passo9Depois?.conferido).toBe(true);
  });

  it('não deixa desmarcar passo definitivo (11 em diante)', async () => {
    await jaConcluido([1, 2, 3, 4, 5, 6, 7, 10, 11]);
    const res = await auth(
      request(server()).delete(`/api/projetos/${projetoId}/passos/11`),
      tokens.consultor,
    ).expect(400);
    expect(JSON.stringify(res.body)).toContain('definitivo');
  });

  it('deixa reabrir passo reversível que ainda não travou o seguinte', async () => {
    await jaConcluido([1, 2]);
    await auth(
      request(server()).delete(`/api/projetos/${projetoId}/passos/2`),
      tokens.administrativo,
    ).expect(200);
    const restantes = await passosRepo.find({ where: { projetoId } });
    expect(restantes.map((r) => r.passo)).toEqual([1]);
  });

  it('não reabre passo cujo seguinte já andou', async () => {
    await jaConcluido([1, 2, 3]);
    const res = await auth(
      request(server()).delete(`/api/projetos/${projetoId}/passos/2`),
      tokens.administrativo,
    ).expect(400);
    expect(JSON.stringify(res.body)).toContain('já foi concluído');
  });

  it('recusa concluir duas vezes o mesmo passo', async () => {
    await jaConcluido([1]);
    await auth(
      request(server()).post(`/api/projetos/${projetoId}/passos/2/concluir`),
      tokens.administrativo,
    )
      .send({})
      .expect(201);
    await auth(
      request(server()).post(`/api/projetos/${projetoId}/passos/2/concluir`),
      tokens.administrativo,
    )
      .send({})
      .expect(400);
  });

  describe('ligação com as ações reais do sistema', () => {
    // Sem estas ligações, os 18 passos seriam um checklist manual em paralelo ao sistema:
    // a pessoa faria o trabalho numa tela e teria de marcar a caixinha em outra.

    it('o passo 1 é concluído quando a ficha nasce do e-mail de fechamento', async () => {
      const parse = await auth(
        request(server()).post('/api/fluxo/parse'),
        tokens.administrativo,
      )
        .send({
          texto: [
            'Cliente (Razão Social): Cliente Ligacao LTDA',
            'CNPJ: 11.222.333/0001-44',
            'Módulos contratados (siglas): FAT',
            'Horas cobradas: 10',
          ].join(String.fromCharCode(10)),
        })
        .expect(200);

      const criar = await auth(
        request(server()).post('/api/fluxo/criar'),
        tokens.administrativo,
      )
        .send((parse.body as { data: { campos: unknown } }).data.campos)
        .expect(200);
      const novoId = (criar.body as { data: { projetoId: number } }).data
        .projetoId;

      const lista = await auth(
        request(server()).get(`/api/projetos/${novoId}/passos`),
        tokens.administrativo,
      ).expect(200);
      const passo1 = (
        lista.body as { data: { numero: number; concluido: boolean }[] }
      ).data.find((p) => p.numero === 1);
      expect(passo1?.concluido).toBe(true);
    });

    it('o Administrativo consegue seguir sem depender de um ADM marcar o passo 1', async () => {
      // Era o bloqueio prático: passo 1 é do robô, passo 2 depende dele, e o robô não o
      // concluía — ninguém conseguia começar.
      await jaConcluido([1]);
      await auth(
        request(server()).post(`/api/projetos/${projetoId}/passos/2/concluir`),
        tokens.administrativo,
      )
        .send({})
        .expect(201);
    });

    it('agendar o levantamento conclui o passo 2 sozinho', async () => {
      await jaConcluido([1]);
      await auth(
        request(server()).post(`/api/projetos/${projetoId}/definir-gci`),
        tokens.coordenador,
      )
        .send({ gcis: ['GCI Um'] })
        .expect(200);

      const futuro = new Date();
      futuro.setDate(futuro.getDate() + 10);
      await auth(
        request(server()).post(`/api/projetos/${projetoId}/agendar`),
        tokens.administrativo,
      )
        .send({ dataLevantamento: futuro.toISOString().slice(0, 10) })
        .expect(200);

      const feitos = await passosRepo.find({ where: { projetoId } });
      expect(feitos.map((f) => f.passo).sort((a, b) => a - b)).toEqual([1, 2]);
    });

    it('registra o motivo quando a ação acontece fora de ordem, sem concluir o passo', async () => {
      // Agendar sem a ficha ter passado pelo passo 1: a ação vale, o passo não pode ser
      // dado como feito — e o porquê fica na timeline em vez de sumir.
      await auth(
        request(server()).post(`/api/projetos/${projetoId}/definir-gci`),
        tokens.coordenador,
      )
        .send({ gcis: ['GCI Um'] })
        .expect(200);
      const futuro = new Date();
      futuro.setDate(futuro.getDate() + 10);
      await auth(
        request(server()).post(`/api/projetos/${projetoId}/agendar`),
        tokens.administrativo,
      )
        .send({ dataLevantamento: futuro.toISOString().slice(0, 10) })
        .expect(200);

      const feitos = await passosRepo.find({ where: { projetoId } });
      expect(feitos).toHaveLength(0);
    });
  });

  describe('pessoas do projeto', () => {
    it('aceita MAIS DE UM levantador e mais de um consultor', async () => {
      await auth(
        request(server()).patch(`/api/projetos/${projetoId}/pessoas`),
        tokens.administrativo,
      )
        .send({ papel: 'levantador', pessoas: ['Ana', 'Bruno'] })
        .expect(200);
      await auth(
        request(server()).patch(`/api/projetos/${projetoId}/pessoas`),
        tokens.administrativo,
      )
        .send({ papel: 'consultor', pessoas: ['Carla', 'Diego', 'Carla'] })
        .expect(200);

      const res = await auth(
        request(server()).get(`/api/projetos/${projetoId}/pessoas`),
        tokens.administrativo,
      ).expect(200);
      const dados = (
        res.body as {
          data: {
            levantadores: { pessoa: string }[];
            consultores: { pessoa: string }[];
          };
        }
      ).data;
      expect(dados.levantadores.map((l) => l.pessoa)).toEqual(['Ana', 'Bruno']);
      // "Carla" repetida entra uma vez só.
      expect(dados.consultores.map((c) => c.pessoa)).toEqual([
        'Carla',
        'Diego',
      ]);
    });

    it('mantém Projeto.consultor com a lista consolidada, para as telas antigas', async () => {
      await auth(
        request(server()).patch(`/api/projetos/${projetoId}/pessoas`),
        tokens.administrativo,
      )
        .send({ papel: 'consultor', pessoas: ['Carla', 'Diego'] })
        .expect(200);
      const p = await projetos.findOne({ where: { id: projetoId } });
      expect(p?.consultor).toBe('Carla, Diego');
    });
  });

  describe('RNS do projeto (passo 7)', () => {
    it('aceita quantidade livre de RNS, de tipos diferentes', async () => {
      for (const rns of [
        { tipo: 'RNI', numero: '654321' },
        { tipo: 'COB', numero: '444444-02' },
        { tipo: 'COB', numero: '444444-03' },
        { tipo: 'Conversão', numero: '222222-01' },
      ]) {
        await auth(
          request(server()).post(`/api/projetos/${projetoId}/rns`),
          tokens.administrativo,
        )
          .send(rns)
          .expect(201);
      }
      const res = await auth(
        request(server()).get(`/api/projetos/${projetoId}/rns`),
        tokens.administrativo,
      ).expect(200);
      expect((res.body as { data: unknown[] }).data.length).toBe(4);
    });

    it('recusa tipo de RNS fora do processo', async () => {
      await auth(
        request(server()).post(`/api/projetos/${projetoId}/rns`),
        tokens.administrativo,
      )
        .send({ tipo: 'OUTRA', numero: '1' })
        .expect(400);
    });
  });
});
