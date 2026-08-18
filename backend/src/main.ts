import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import express from 'express';
import helmet from 'helmet';
import { createServer as criarServidorHttp } from 'http';
import { createServer as criarServidorHttps } from 'https';
import { AppModule } from './app.module';
import { assetsEstaticos } from './common/assets-estaticos';
import { erroDeMiddleware } from './common/filters/erro-de-middleware';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { MetricasInterceptor } from './common/interceptors/metricas.interceptor';
import { AppConfig, ehProducao } from './config/configuration';
import { correlacaoMiddleware } from './common/observabilidade/correlacao';
import { avisarSeDadosExpostos } from './common/seguranca/checar-acl-dados';
import { httpsPainel } from './config/https';

/** Teto do corpo JSON/urlencoded — o mesmo padrão do Express/Nest. Os DTOs já limitam cada
 * campo bem abaixo disso; quem passar daqui recebe 413. */
const LIMITE_CORPO = '100kb';

async function bootstrap(): Promise<void> {
  // HTTPS é OPCIONAL (ver config/https.ts). Sem ele, o caminho é o de sempre; com ele, o
  // MESMO app express atende HTTP e HTTPS em dois servidores — um processo só.
  const tls = httpsPainel();
  const servidorExpress = tls ? express() : undefined;
  // `bodyParser: false` e o parser montado à mão logo abaixo, por uma razão de ORDEM: o
  // parser que o Nest instala sozinho entra durante o `init()`, DEPOIS de qualquer
  // `app.use()` nosso — e o Express só considera os handlers de erro que estão adiante na
  // pilha de quem falhou. Com o parser do Nest, um corpo acima do limite terminava no 404
  // genérico ("Cannot POST /api/…", dizendo que a rota não existe) em vez de 413, e não
  // havia posição em que o nosso handler pudesse ser registrado para pegá-lo. Montando o
  // parser aqui, ele e o handler de erro ficam lado a lado, na ordem certa.
  const app = servidorExpress
    ? await NestFactory.create(AppModule, new ExpressAdapter(servidorExpress), {
        bodyParser: false,
      })
    : await NestFactory.create(AppModule, { bodyParser: false });
  const config = app.get(ConfigService<AppConfig, true>);

  // PRIMEIRO middleware: dá a cada requisição um correlation-id (M9), disponível para todo o
  // resto do ciclo (parsers, guards, handler, filtro de erro) e ecoado na resposta.
  app.use(correlacaoMiddleware);

  // Mesmos parsers e o mesmo limite padrão que o Nest usaria (100 kb) — o que muda é só
  // quem os registra. Uploads continuam por multipart/multer, que não passa por aqui.
  //
  // EXCEÇÃO consciente, ANTES do parser global (o primeiro que parseia ganha): o envio do
  // painel de visitas por e-mail carrega o PNG do gráfico (data URL) e as linhas filtradas
  // — não cabe nos 100 kb. Só esta rota aceita mais.
  app.use(
    '/api/bi-implantacao/visitas-portal/enviar-email',
    express.json({ limit: '6mb' }),
  );
  app.use(express.json({ limit: LIMITE_CORPO }));
  app.use(express.urlencoded({ extended: true, limit: LIMITE_CORPO }));
  app.use(erroDeMiddleware());

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
  //
  // `hsts` segue DESLIGADO mesmo quando o HTTPS opcional está ligado, de propósito: o
  // Strict-Transport-Security vale por HOST e IGNORA a porta — ligá-lo na 5443 faria o
  // navegador passar a exigir HTTPS também em http://host:5100, derrubando o acesso HTTP
  // que continua publicado para os favoritos antigos.
  app.use(
    helmet({
      hsts: false,
      crossOriginOpenerPolicy: false,
      originAgentCluster: false,
      // `frame-src` com `blob:`: a pré-visualização de documento (Projeto, Conferência,
      // envio para assinatura) baixa o PDF por fetch autenticado e o mostra num
      // <iframe src="blob:…">. O default do Helmet não declara `frame-src`, então ele cai
      // em `default-src 'self'` — e blob: NÃO é 'self'. O navegador trocava o PDF pela
      // página "Este conteúdo está bloqueado. Entre em contato com o proprietário do
      // site", sem erro nenhum no backend. O blob nasce da própria página; liberá-lo aqui
      // não abre a moldura para origem externa (isso é `frame-ancestors`, intocado).
      //
      // `https://portalrech.com.br`: a tela Execução → Protocolo embute o Portal Rech num
      // iframe — sem esta origem no `frame-src`, o navegador mostrava a MESMA página de
      // conteúdo bloqueado (achado de 2026-08-13; o bloqueio era do NOSSO CSP, o site não
      // envia X-Frame-Options/CSP). Libera só este domínio, e só como MOLDURA embutida —
      // quem pode nos emoldurar continua sendo `frame-ancestors`, intocado.
      //
      // `https://www.rechedu.com.br`: mesma situação na tela Execução → RechEdu (o site
      // também não envia X-Frame-Options/CSP — verificado em 2026-08-14).
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'upgrade-insecure-requests': null,
          'frame-src': [
            "'self'",
            'blob:',
            'https://portalrech.com.br',
            'https://www.rechedu.com.br',
          ],
        },
      },
    }),
  );
  // Antes do fallback de SPA do ServeStaticModule: arquivo de build que não existe mais
  // vira 404, e não `index.html`. Sem isto, a aba aberta antes de um rebuild recebe
  // `text/html` no lugar de um chunk e a navegação preguiçosa quebra de forma silenciosa
  // (ver common/assets-estaticos.ts — incidente "os logins não funcionam", 2026-08-03).
  app.use(assetsEstaticos(config.get('frontendDistPath', { infer: true })));

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
  // MetricasInterceptor PRIMEIRO: envolve os demais, então mede a duração total da requisição
  // (eixo 9). O ResponseInterceptor transforma o payload; a métrica não transforma nada.
  app.useGlobalInterceptors(
    new MetricasInterceptor(),
    new ResponseInterceptor(),
  );
  app.setGlobalPrefix('api');

  // M1 (auditoria 2026-08-12): o Swagger em `/api/docs` era público e sem condicional de
  // ambiente — expunha o mapa inteiro da API (rotas, DTOs, exemplos) a qualquer um que
  // alcançasse a porta, um reconhecimento pronto para atacante. Passa a subir só FORA de
  // produção (mesmo sinal do C1: NODE_ENV=production OU banco MariaDB real configurado).
  const emProducao = ehProducao(
    config.get('env', { infer: true }),
    process.env.MIGRACAO_DB_URL,
  );
  if (!emProducao) {
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
  }
  const sufixoDocs = emProducao ? '' : ' — docs em /api/docs';

  // M5 (auditoria 2026-08-12): denuncia no log se a pasta de credenciais (backend/dados) estiver
  // aberta a grupos amplos (Everyone/Users). Best-effort e só em produção Windows.
  avisarSeDadosExpostos();

  const port = config.get('port', { infer: true });
  if (!tls || !servidorExpress) {
    await app.listen(port);
    console.log(
      `Painel API rodando em http://localhost:${port}/api${sufixoDocs}`,
    );
    return;
  }

  // `init()` no lugar de `listen()`: quem abre as portas aqui somos nós, para o mesmo
  // handler atender os dois protocolos.
  await app.init();
  criarServidorHttp(servidorExpress).listen(port);
  criarServidorHttps(tls.opcoes, servidorExpress).listen(tls.porta);
  console.log(
    `Painel API rodando em http://localhost:${port}/api e ` +
      `https://localhost:${tls.porta}/api (${tls.origem})${sufixoDocs}`,
  );
}

void bootstrap();
