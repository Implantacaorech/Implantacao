import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AppConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<AppConfig, true>);

  // Este servidor roda em HTTP puro na rede interna, sem TLS/reverse proxy (ver
  // docs/migracao/05-plano-de-virada.md, acesso por http://I7M1700-01-EVE:5100). Vários
  // cabeçalhos padrão do Helmet só fazem sentido — ou só funcionam — sobre HTTPS:
  // - `hsts` (Strict-Transport-Security): uma vez recebido, o navegador passa a forçar
  //   HTTPS nesse host/porta dali em diante (cache de HSTS) — como não existe HTTPS aqui,
  //   toda visita seguinte quebra.
  // - CSP `upgrade-insecure-requests` (default do Helmet): instrui o navegador a
  //   reescrever TODO carregamento de sub-recurso (script/CSS/imagem) de http:// para
  //   https:// antes mesmo de tentar — achado real: quebrava o carregamento de
  //   main.js/styles.css em produção (ERR_BLOCKED_BY_ORB), mesmo a navegação direta ao
  //   arquivo funcionando normalmente (só sub-recurso é afetado, não navegação de topo).
  // - `crossOriginOpenerPolicy`/`originAgentCluster`: o próprio Chrome ignora e avisa no
  //   console ("origin was untrustworthy... use HTTPS") — não bloqueiam nada, mas são
  //   ruído sem efeito real aqui.
  // Mantém as demais proteções do Helmet (CSP continua ativo, só sem a diretiva que
  // pressupõe HTTPS).
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
  app.enableCors({
    origin: config.get('corsOrigins', { infer: true }),
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
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.setGlobalPrefix('api');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Painel de Implantação — API')
    .setDescription(
      'API NestJS do Painel de Implantação (migração do backend Flask)',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = config.get('port', { infer: true });
  await app.listen(port);

  console.log(
    `Painel API rodando em http://localhost:${port}/api — docs em /api/docs`,
  );
}

void bootstrap();
