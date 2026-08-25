import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import express from 'express';
import helmet from 'helmet';
import { assetsEstaticos } from './common/assets-estaticos';
import { erroDeMiddleware } from './common/filters/erro-de-middleware';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { MetricasInterceptor } from './common/interceptors/metricas.interceptor';
import { correlacaoMiddleware } from './common/observabilidade/correlacao';
import { avisarSeDadosExpostos } from './common/seguranca/checar-acl-dados';
import { AppConfig, ehProducao } from './config/configuration';
import { VAR_PERFIL } from './common/instancia';
import { DadosAppModule } from './dados/dados-app.module';

/** Porta padrão do Portal API. Diferente da 5100 (o Painel) de propósito: as duas
 * podem conviver na mesma máquina durante a transição, e o firewall trata cada uma à sua
 * maneira — a 5100 é o que vai para a nuvem, a 5110 nunca sai da rede interna. */
const PORTA_PADRAO = 5110;

const LIMITE_CORPO = '100kb';

/** **PORTAL API — instância 1** (ver `src/dados/dados-app.module.ts`).
 *
 * Mesmo binário, outra raiz de módulos: sobe só a API de Dados, autenticação, permissões e
 * health. É o processo que fica na rede interna com a credencial do Oracle/MySQL; o Painel
 * publicado na nuvem fala com ele por token, pelo túnel.
 *
 * Sobe com `node dist/main-dados.js` (ou `Iniciar_Portal_Conexoes.bat`). */
async function bootstrap(): Promise<void> {
  // PRIMEIRA linha, antes de o Nest subir: este processo É o Portal API, e o front-end
  // monta o menu a partir disso (`GET /api/instancia`). Identidade do processo, não
  // configuração de operação — por isso é escrita aqui e não vem de fora.
  process.env[VAR_PERFIL] = 'portal-api';

  const app = await NestFactory.create(DadosAppModule, { bodyParser: false });
  const config = app.get(ConfigService<AppConfig, true>);

  app.use(correlacaoMiddleware);
  app.use(express.json({ limit: LIMITE_CORPO }));
  app.use(express.urlencoded({ extended: true, limit: LIMITE_CORPO }));
  app.use(erroDeMiddleware());

  // Mesmas concessões do Painel e pelas mesmas razões (ver main.ts): HTTP puro na rede
  // interna, então HSTS e `upgrade-insecure-requests` ficam fora — ligá-los aqui quebraria
  // o carregamento dos estáticos. Sem `frame-src` de terceiros: este processo não emoldura
  // Portal Rech nem RechEdu.
  app.use(
    helmet({
      hsts: false,
      crossOriginOpenerPolicy: false,
      originAgentCluster: false,
      contentSecurityPolicy: {
        useDefaults: true,
        directives: { 'upgrade-insecure-requests': null },
      },
    }),
  );
  app.use(assetsEstaticos(config.get('frontendDistPath', { infer: true })));

  // CORS próprio: quem chama esta instância pelo navegador é o Painel da NUVEM, que tem
  // outra origem. `MIGRACAO_DADOS_CORS` existe para nomeá-la sem mexer no CORS do Painel
  // interno; sem a variável, vale a mesma lista do Painel.
  const origensProprias = (process.env.MIGRACAO_DADOS_CORS ?? '').trim();
  app.enableCors({
    origin: origensProprias
      ? origensProprias.split(',').map((o) => o.trim())
      : config.get('corsOrigins', { infer: true }),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(
    new MetricasInterceptor(),
    new ResponseInterceptor(),
  );
  app.setGlobalPrefix('api');

  const emProducao = ehProducao(
    config.get('env', { infer: true }),
    process.env.MIGRACAO_DB_URL,
  );
  if (!emProducao) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Portal de Conexões — API de Dados')
      .setDescription(
        'Instância interna da API de Dados (ADR-0003): catálogo de consultas nomeadas, ' +
          'clientes de máquina e administração. Nenhum endpoint aceita SQL.',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, 'api-key')
      .build();
    SwaggerModule.setup(
      'api/docs',
      app,
      SwaggerModule.createDocument(app, swaggerConfig),
    );
  }

  avisarSeDadosExpostos();

  const porta = Number(process.env.MIGRACAO_DADOS_PORT ?? PORTA_PADRAO);
  await app.listen(porta);
  console.log(
    `Portal API rodando em http://localhost:${porta}/api/dados/v1` +
      (emProducao ? '' : ' — docs em /api/docs') +
      `\nTela de administração: http://localhost:${porta}/config/api-dados`,
  );
}

void bootstrap();
