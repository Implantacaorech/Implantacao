import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Usuario } from '../src/database/entities/usuario.entity';
import { CadastroPendente } from '../src/database/entities/cadastro-pendente.entity';
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

describe('Auto-cadastro (e2e)', () => {
  let app: INestApplication<App>;
  let usuarios: Repository<Usuario>;
  let pendentes: Repository<CadastroPendente>;
  let mailerFake: MailerServiceFake;

  const server = () => app.getHttpServer();

  function codigoEnviado(): string {
    const ultimo = mailerFake.enviados[mailerFake.enviados.length - 1];
    const m = /(\d{6})/.exec(ultimo.corpo);
    if (!m) throw new Error('Código não encontrado no corpo do e-mail simulado.');
    return m[1];
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
    pendentes = moduleFixture.get(getRepositoryToken(CadastroPendente));
    mailerFake = moduleFixture.get(MailerService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('fluxo feliz completo: pede código, confirma e já recebe os tokens (login imediato)', async () => {
    const inicio = await request(server()).post('/api/cadastro').send({
      nome: 'Ana Nova',
      email: 'ana.nova@teste.com',
      senha: 'senha123',
      codigoSicla: '077',
    });
    expect(inicio.status).toBe(200);
    expect(inicio.body.data.email).toBe('ana.nova@teste.com');
    expect(mailerFake.enviados).toHaveLength(1);
    expect(mailerFake.enviados[0].assunto).toContain('Código de validação');

    const codigo = codigoEnviado();
    const confirma = await request(server())
      .post('/api/cadastro/confirmar')
      .send({ email: 'ana.nova@teste.com', codigo });

    expect(confirma.status).toBe(200);
    expect(confirma.body.data.accessToken).toBeDefined();
    expect(confirma.body.data.usuario.perfil).toBe('Consultor'); // sempre o de menor privilégio

    const criado = await usuarios.findOne({ where: { email: 'ana.nova@teste.com' } });
    expect(criado?.ativo).toBe(true);
    expect(criado?.codigoSicla).toBe('077');
  });

  it('rejeita e-mail já cadastrado', async () => {
    const res = await request(server()).post('/api/cadastro').send({
      nome: 'Ana Nova',
      email: 'ana.nova@teste.com', // já virou Usuario no teste anterior
      senha: 'senha123',
      codigoSicla: '077',
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('já tem acesso');
  });

  it('código incorreto não confirma e incrementa tentativas (sem apagar o pendente)', async () => {
    await request(server()).post('/api/cadastro').send({
      nome: 'Beto Novo',
      email: 'beto.novo@teste.com',
      senha: 'senha123',
      codigoSicla: '078',
    });
    const errado = await request(server())
      .post('/api/cadastro/confirmar')
      .send({ email: 'beto.novo@teste.com', codigo: '000000' });
    expect(errado.status).toBe(400);
    expect(errado.body.message).toContain('incorreto');

    const pendente = await pendentes.findOne({ where: { email: 'beto.novo@teste.com' } });
    expect(pendente?.tentativas).toBe(1);
  });

  it('reenviar gera um novo código e reseta as tentativas', async () => {
    const antes = await pendentes.findOne({ where: { email: 'beto.novo@teste.com' } });
    const codigoAntigo = antes?.codigo;

    const reenviar = await request(server())
      .post('/api/cadastro/reenviar')
      .send({ email: 'beto.novo@teste.com' });
    expect(reenviar.status).toBe(200);

    const depois = await pendentes.findOne({ where: { email: 'beto.novo@teste.com' } });
    expect(depois?.tentativas).toBe(0);
    expect(depois?.codigo).not.toBe(codigoAntigo);

    const confirma = await request(server())
      .post('/api/cadastro/confirmar')
      .send({ email: 'beto.novo@teste.com', codigo: codigoEnviado() });
    expect(confirma.status).toBe(200);
  });

  it('reenviar para e-mail sem cadastro pendente devolve erro', async () => {
    const res = await request(server())
      .post('/api/cadastro/reenviar')
      .send({ email: 'ninguem-pendente@teste.com' });
    expect(res.status).toBe(400);
  });
});
