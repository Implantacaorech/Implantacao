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

/** Prova das REGRAS do processo de 19 passos contra a aplicação de verdade: guards, banco e
 * serviço. O que está aqui é o que o usuário especificou, não o que o código faz.
 *
 * A numeração foi atualizada em 2026-07-29: a inserção do passo 3 ("Realizar o Levantamento
 * de Processo", 2026-07-28) empurrou todos os seguintes em um, e este arquivo tinha ficado
 * para trás — ele não roda no CI (`npm test` cobre só os unitários), então envelheceu em
 * silêncio. Mapa antigo → novo: 3→4, 4→5, 5→6, 6→7, 7→8, 8→9, 9→10, 10→11, 11→12. */
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

  /** Designa a pessoa no projeto — sem isso, Consultor/GCI não podem executar os passos
   * deles (regra: "os demais só alteram as atividades a eles designadas"). */
  async function designar(
    papel: 'levantador' | 'consultor',
    pessoas: string[],
  ) {
    await auth(
      request(server()).patch(`/api/projetos/${projetoId}/pessoas`),
      tokens.adm,
    )
      .send({ papel, pessoas })
      .expect(200);
  }

  /** Cria o usuário e devolve o token. `perfis` cobre quem ACUMULA cargos (o GCI que também
   * é Levantador) — sem isso não dá para provar que os papéis múltiplos chegam inteiros ao
   * serviço. */
  async function criarUsuario(
    login: string,
    perfil: Perfil,
    nome: string,
    perfis: Perfil[] = [],
  ): Promise<string> {
    await usuarios.save(
      usuarios.create({
        login,
        nome,
        email: `${login}@teste.com`,
        senhaHash: await bcrypt.hash('senha-teste-123', 4),
        perfil,
        perfis: perfis.join(', '),
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
    // Caso real de produção: perfil PRINCIPAL GCI, acumulando o papel de Levantador.
    tokens.gciLevantador = await criarUsuario(
      'gcilev',
      'GCI',
      'GCI Levantador',
      ['GCI', 'Levantador'],
    );
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

  it('lista os 19 passos com responsável e estado', async () => {
    const res = await auth(
      request(server()).get(`/api/projetos/${projetoId}/passos`),
      tokens.administrativo,
    ).expect(200);
    const dados = (res.body as { data: { numero: number }[] }).data;
    expect(dados.length).toBe(19);
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

  it('deixa o Coordenador indicar GCI e técnicos (passo 7)', async () => {
    await jaConcluido([1, 2, 3, 4, 5, 6]);
    await auth(
      request(server()).post(`/api/projetos/${projetoId}/passos/7/concluir`),
      tokens.coordenador,
    )
      .send({})
      .expect(201);
  });

  it('não deixa o Administrativo fazer o passo 7 (mudou na revisão do processo)', async () => {
    await jaConcluido([1, 2, 3, 4, 5, 6]);
    await auth(
      request(server()).post(`/api/projetos/${projetoId}/passos/7/concluir`),
      tokens.administrativo,
    )
      .send({})
      .expect(403);
  });

  it('permite o Cronograma (11) sem o Projeto (9) — trilhas paralelas', async () => {
    await jaConcluido([1, 2, 3, 4, 5, 6, 7, 8]);
    await designar('consultor', ['Consultor Um']);
    // O passo 11 sai direto do 8; não espera o 9 nem o 10.
    await auth(
      request(server()).post(`/api/projetos/${projetoId}/passos/11/concluir`),
      tokens.consultor,
    )
      .send({})
      .expect(201);
  });

  it('segura o passo 11 enquanto o passo 8 não foi concluído', async () => {
    await jaConcluido([1, 2, 3, 4, 5, 6, 7]);
    await designar('consultor', ['Consultor Um']);
    await auth(
      request(server()).post(`/api/projetos/${projetoId}/passos/11/concluir`),
      tokens.consultor,
    )
      .send({})
      .expect(400);
  });

  it('exige a conferência do passo 10 antes de liberar o seguinte', async () => {
    await jaConcluido([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    await auth(
      request(server()).post(`/api/projetos/${projetoId}/passos/10/concluir`),
      tokens.administrativo,
    )
      .send({})
      .expect(201);

    const lista = await auth(
      request(server()).get(`/api/projetos/${projetoId}/passos`),
      tokens.administrativo,
    ).expect(200);
    const passo10 = (
      lista.body as { data: { numero: number; conferido: boolean }[] }
    ).data.find((p) => p.numero === 10);
    expect(passo10?.conferido).toBe(false);

    await auth(
      request(server()).post(`/api/projetos/${projetoId}/passos/10/conferir`),
      tokens.administrativo,
    ).expect(201);

    const depois = await auth(
      request(server()).get(`/api/projetos/${projetoId}/passos`),
      tokens.administrativo,
    ).expect(200);
    const passo10Depois = (
      depois.body as { data: { numero: number; conferido: boolean }[] }
    ).data.find((p) => p.numero === 10);
    expect(passo10Depois?.conferido).toBe(true);
  });

  it('não deixa desmarcar passo definitivo (12 em diante)', async () => {
    await jaConcluido([1, 2, 3, 4, 5, 6, 7, 8, 11, 12]);
    const res = await auth(
      request(server()).delete(`/api/projetos/${projetoId}/passos/12`),
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

  describe('permissão por designação (só mexe no que é seu)', () => {
    it('Consultor NÃO designado no projeto é recusado', async () => {
      await jaConcluido([1, 2, 3, 4, 5, 6, 7, 8]);
      const res = await auth(
        request(server()).post(`/api/projetos/${projetoId}/passos/11/concluir`),
        tokens.consultor,
      )
        .send({})
        .expect(403);
      expect(JSON.stringify(res.body)).toContain('não está designado');
    });

    it('Consultor designado consegue', async () => {
      await jaConcluido([1, 2, 3, 4, 5, 6, 7, 8]);
      await designar('consultor', ['Consultor Um']);
      await auth(
        request(server()).post(`/api/projetos/${projetoId}/passos/11/concluir`),
        tokens.consultor,
      )
        .send({})
        .expect(201);
    });

    it('GCI só age no projeto em que é o GCI', async () => {
      await jaConcluido([1, 2, 3, 4, 5, 6, 7, 8]);
      // Sem `Projeto.gci` apontando para ele, o passo 9 é recusado.
      await auth(
        request(server()).post(`/api/projetos/${projetoId}/passos/9/concluir`),
        tokens.gci,
      )
        .send({})
        .expect(403);

      await auth(
        request(server()).post(`/api/projetos/${projetoId}/definir-gci`),
        tokens.coordenador,
      )
        .send({ gcis: ['GCI Um'] })
        .expect(200);
      await auth(
        request(server()).post(`/api/projetos/${projetoId}/passos/9/concluir`),
        tokens.gci,
      )
        .send({})
        .expect(201);
    });

    it('ADM faz tudo, mesmo sem estar designado', async () => {
      await jaConcluido([1, 2, 3, 4, 5, 6, 7, 8]);
      await auth(
        request(server()).post(`/api/projetos/${projetoId}/passos/11/concluir`),
        tokens.adm,
      )
        .send({})
        .expect(201);
    });

    it('a lista explica o motivo de não poder — não some o botão sem dizer por quê', async () => {
      await jaConcluido([1, 2, 3, 4, 5, 6, 7, 8]);
      const res = await auth(
        request(server()).get(`/api/projetos/${projetoId}/passos`),
        tokens.consultor,
      ).expect(200);
      const passo11 = (
        res.body as { data: { numero: number; motivos: string[] }[] }
      ).data.find((p) => p.numero === 11);
      expect(passo11?.motivos.join(' ')).toContain('não está designado');
    });
  });

  /** O passo 3 é a tarefa do Levantador — e foi onde estourou o bug de produção de
   * 2026-07-29: o controller recortava o usuário em `{ nome, perfil }` e o papel de
   * Levantador de quem tem GCI como perfil PRINCIPAL sumia no caminho. */
  describe('passo 3 — Realizar o Levantamento (Levantador designado)', () => {
    it('o levantador designado conclui, mesmo com GCI como perfil principal', async () => {
      await jaConcluido([1, 2]);
      await designar('levantador', ['GCI Levantador']);
      await auth(
        request(server()).post(`/api/projetos/${projetoId}/passos/3/concluir`),
        tokens.gciLevantador,
      )
        .send({})
        .expect(201);
    });

    it('quem tem o papel mas não está designado no projeto é recusado', async () => {
      await jaConcluido([1, 2]);
      const res = await auth(
        request(server()).post(`/api/projetos/${projetoId}/passos/3/concluir`),
        tokens.gciLevantador,
      )
        .send({})
        .expect(403);
      expect(JSON.stringify(res.body)).toContain('não está designado');
    });

    it('quem não tem o papel de Levantador é recusado', async () => {
      await jaConcluido([1, 2]);
      await designar('levantador', ['Consultor Um']);
      const res = await auth(
        request(server()).post(`/api/projetos/${projetoId}/passos/3/concluir`),
        tokens.consultor,
      )
        .send({})
        .expect(403);
      expect(JSON.stringify(res.body)).toContain('Só o responsável');
    });

    it('abrir a tela do Levantamento não exige ser o Levantador designado', async () => {
      // `podeAbrir` é a permissão da TELA; o GCI preenche o questionário mesmo sem poder
      // concluir o passo. Antes o botão "Abrir" seguia a permissão de concluir e não levava
      // a lugar nenhum.
      await jaConcluido([1, 2]);
      const res = await auth(
        request(server()).get(`/api/projetos/${projetoId}/passos`),
        tokens.gci,
      ).expect(200);
      const passo3 = (
        res.body as {
          data: { numero: number; liberado: boolean; podeAbrir: boolean }[];
        }
      ).data.find((p) => p.numero === 3);
      expect(passo3?.liberado).toBe(false);
      expect(passo3?.podeAbrir).toBe(true);
    });
  });

  describe('alinhamento com o processo revisado (bugs reportados)', () => {
    it('agendar o levantamento (passo 2) NÃO exige GCI — ele só entra no passo 6', async () => {
      // Era o bug: `agendar` herdou do fluxo antigo a exigência de GCI definido, mas no
      // processo novo o GCI é indicado só no passo 6. O passo 2 nunca gravava.
      await jaConcluido([1]);
      const futuro = new Date();
      futuro.setDate(futuro.getDate() + 10);

      const projetoAntes = await projetos.findOne({ where: { id: projetoId } });
      expect(projetoAntes?.gci).toBe('');

      await auth(
        request(server()).post(`/api/projetos/${projetoId}/agendar`),
        tokens.administrativo,
      )
        .send({
          dataLevantamento: futuro.toISOString().slice(0, 10),
          levantadores: ['GCI Um'],
        })
        .expect(200);

      const feitos = await passosRepo.find({ where: { projetoId } });
      expect(feitos.map((f) => f.passo).sort((a, b) => a - b)).toEqual([1, 2]);
    });

    it('grava os levantadores junto com a data', async () => {
      await jaConcluido([1]);
      const futuro = new Date();
      futuro.setDate(futuro.getDate() + 10);
      await auth(
        request(server()).post(`/api/projetos/${projetoId}/agendar`),
        tokens.administrativo,
      )
        .send({
          dataLevantamento: futuro.toISOString().slice(0, 10),
          levantadores: ['GCI Um'],
        })
        .expect(200);

      const res = await auth(
        request(server()).get(`/api/projetos/${projetoId}/pessoas`),
        tokens.administrativo,
      ).expect(200);
      const dados = (
        res.body as { data: { levantadores: { pessoa: string }[] } }
      ).data;
      expect(dados.levantadores.map((l) => l.pessoa)).toEqual(['GCI Um']);
    });

    it('o passo 7 conclui ao salvar GCI + técnicos pelo formulário do passo', async () => {
      // O formulário do passo grava por `definir-gci` + `pessoas`; antes só
      // `designarConsultores` (a tela antiga) concluía o passo, então ele ficava pendente.
      await jaConcluido([1, 2, 3, 4, 5, 6]);
      await auth(
        request(server()).post(`/api/projetos/${projetoId}/definir-gci`),
        tokens.coordenador,
      )
        .send({ gcis: ['GCI Um'] })
        .expect(200);
      await auth(
        request(server()).patch(`/api/projetos/${projetoId}/pessoas`),
        tokens.coordenador,
      )
        .send({ papel: 'consultor', pessoas: ['Consultor Um'] })
        .expect(200);

      const feitos = await passosRepo.find({ where: { projetoId } });
      expect(feitos.map((f) => f.passo)).toContain(7);
    });

    it('não conclui o passo 7 se ainda não há GCI', async () => {
      await jaConcluido([1, 2, 3, 4, 5, 6]);
      await auth(
        request(server()).patch(`/api/projetos/${projetoId}/pessoas`),
        tokens.coordenador,
      )
        .send({ papel: 'consultor', pessoas: ['Consultor Um'] })
        .expect(200);
      const feitos = await passosRepo.find({ where: { projetoId } });
      expect(feitos.map((f) => f.passo)).not.toContain(7);
    });
  });

  describe('ligação com as ações reais do sistema', () => {
    // Sem estas ligações, os 19 passos seriam um checklist manual em paralelo ao sistema:
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
        .send(
          (parse.body as { data: { campos: Record<string, unknown> } }).data
            .campos,
        )
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
      // Era o bloqueio prático: o passo 1 (hoje do Comercial, na consulta ao SICLA; antes
      // do robô da caixa de entrada) não se concluía sozinho e o passo 2 depende dele —
      // ninguém conseguia começar.
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

  describe('RNS do projeto (passo 8)', () => {
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
