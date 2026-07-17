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

  // `hsts: false` — este servidor roda em HTTP puro na rede interna, sem TLS/reverse proxy
  // (ver docs/migracao/05-plano-de-virada.md, acesso por http://I7M1700-01-EVE:5100). O
  // header Strict-Transport-Security do Helmet vem ligado por padrão mesmo sobre HTTP; uma
  // vez que o navegador o recebe, ele passa a forçar HTTPS nesse host/porta (cache de HSTS),
  // e como não existe HTTPS aqui, toda visita seguinte quebra com CORS/403 numa URL https://
  // inexistente — tela em branco. Mantém as demais proteções do Helmet.
  app.use(helmet({ hsts: false }));
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
