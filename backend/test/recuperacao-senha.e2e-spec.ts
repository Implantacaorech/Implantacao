import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Usuario } from '../src/database/entities/usuario.entity';
import { RecuperacaoSenha } from '../src/database/entities/recuperacao-senha.entity';
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

/** "Esqueci minha senha" da tela de login, ponta a ponta: pedir o código, redefinir e
 * entrar com a senha nova. Cobre também as duas garantias de privacidade do endpoint —
 * ele não pode virar um verificador de quem tem acesso ao Painel. */
describe('Recuperação de senha (e2e)', () => {
  let app: INestApplication<App>;
  let usuarios: Repository<Usuario>;
  let pedidos: Repository<RecuperacaoSenha>;
  let mailerFake: MailerServiceFake;

  const server = () => app.getHttpServer();

  function codigoEnviado(): string {
    const ultimo = mailerFake.enviados[mailerFake.enviados.length - 1];
    const m = /(\d{6})/.exec(ultimo.corpo);
    if (!m) throw new Error('Código não encontrado no e-mail simulado.');
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
    pedidos = moduleFixture.get(getRepositoryToken(RecuperacaoSenha));
    mailerFake = moduleFixture.get(MailerService);

    await usuarios.save(
      usuarios.create({
        login: 'carla',
        nome: 'Carla Esquecida',
        email: 'carla@teste.com',
        senhaHash: await bcrypt.hash('senha-antiga-1', 4),
        perfil: 'Consultor',
        ativo: true,
      }),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('fluxo feliz: pede o código, redefine e entra com a senha nova', async () => {
    const pedido = await request(server())
      .post('/api/auth/esqueci-senha')
      .send({ email: 'carla@teste.com' });
    expect(pedido.status).toBe(200);
    expect(mailerFake.enviados).toHaveLength(1);
    expect(mailerFake.enviados[0].assunto).toContain('Redefinição de senha');

    const redefine = await request(server())
      .post('/api/auth/redefinir-senha')
      .send({
        email: 'carla@teste.com',
        codigo: codigoEnviado(),
        senhaNova: 'senha-nova-123',
      });
    expect(redefine.status).toBe(200);

    const entra = await request(server())
      .post('/api/auth/login')
      .send({ login: 'carla', senha: 'senha-nova-123' });
    expect(entra.status).toBe(200);
    expect(entra.body.data.accessToken).toBeDefined();

    // A senha antiga morre junto.
    const antiga = await request(server())
      .post('/api/auth/login')
      .send({ login: 'carla', senha: 'senha-antiga-1' });
    expect(antiga.status).toBe(401);
  });

  it('o mesmo código não serve duas vezes', async () => {
    const res = await request(server()).post('/api/auth/redefinir-senha').send({
      email: 'carla@teste.com',
      codigo: codigoEnviado(),
      senhaNova: 'outra-senha-123',
    });
    expect(res.status).toBe(400);
  });

  it('e-mail desconhecido responde igual a um cadastrado (não revela quem tem acesso)', async () => {
    const enviadosAntes = mailerFake.enviados.length;
    const res = await request(server())
      .post('/api/auth/esqueci-senha')
      .send({ email: 'ninguem@teste.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('Se este e-mail tiver acesso');
    expect(mailerFake.enviados).toHaveLength(enviadosAntes); // nada foi enviado
    expect(await pedidos.count({ where: { email: 'ninguem@teste.com' } })).toBe(
      0,
    );
  });

  it('código errado devolve 400 e não troca a senha', async () => {
    await request(server())
      .post('/api/auth/esqueci-senha')
      .send({ email: 'carla@teste.com' });

    const res = await request(server()).post('/api/auth/redefinir-senha').send({
      email: 'carla@teste.com',
      codigo: '000000',
      senhaNova: 'senha-invasor-1',
    });
    expect(res.status).toBe(400);

    const entra = await request(server())
      .post('/api/auth/login')
      .send({ login: 'carla', senha: 'senha-invasor-1' });
    expect(entra.status).toBe(401);
  });

  it('recusa senha nova curta demais (mesmo mínimo da troca normal)', async () => {
    const res = await request(server()).post('/api/auth/redefinir-senha').send({
      email: 'carla@teste.com',
      codigo: codigoEnviado(),
      senhaNova: 'curta',
    });
    expect(res.status).toBe(400);
  });
});
