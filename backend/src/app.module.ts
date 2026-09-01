import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration, { AppConfig } from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjetosModule } from './projetos/projetos.module';
import { HealthModule } from './health/health.module';
import { CatalogosModule } from './catalogos/catalogos.module';
import { CronogramaModule } from './cronograma/cronograma.module';
import { LevantamentoModule } from './levantamento/levantamento.module';
import { IaModule } from './ia/ia.module';
import { ProtocolosModule } from './protocolos/protocolos.module';
import { RecheduModule } from './rechedu/rechedu.module';
import { AgendaModule } from './agenda/agenda.module';
import { RnsModule } from './rns/rns.module';
import { EmailModule } from './email/email.module';
import { FluxoModule } from './fluxo/fluxo.module';
import { DisponibilidadeModule } from './disponibilidade/disponibilidade.module';
import { MatrizModule } from './matriz/matriz.module';
import { PainelModule } from './painel/painel.module';
import { CadastroModule } from './cadastro/cadastro.module';
import { DesignacaoModule } from './designacao/designacao.module';
import { DigestModule } from './digest/digest.module';
import { PlanoCronogramaModule } from './plano-cronograma/plano-cronograma.module';
import { LegadoModule } from './legado/legado.module';
import { AgentesModule } from './agentes/agentes.module';
import { PassosModule } from './passos/passos.module';
import { ClientesSiclaModule } from './clientes-sicla/clientes-sicla.module';
import { ModulosSiclaModule } from './modulos-sicla/modulos-sicla.module';
import { TecnicosSiclaModule } from './tecnicos-sicla/tecnicos-sicla.module';
import { ContatosSiclaModule } from './contatos-sicla/contatos-sicla.module';
import { PermissoesModule } from './permissoes/permissoes.module';
import { PreferenciasModule } from './preferencias/preferencias.module';
import { MatrizDetalhadaModule } from './matriz-detalhada/matriz-detalhada.module';
import { MatrizFuncoesModule } from './matriz-funcoes/matriz-funcoes.module';
import { BiImplantacaoModule } from './bi-implantacao/bi-implantacao.module';
import { BiIndicadoresModule } from './bi-indicadores/bi-indicadores.module';
import { BiAgendaAlocacaoModule } from './bi-agenda-alocacao/bi-agenda-alocacao.module';
import { BiMovimentosModule } from './bi-movimentos/bi-movimentos.module';
import { SaudeModule } from './saude/saude.module';
import { ProntidaoModule } from './prontidao/prontidao.module';
import { IaTelemetriaModule } from './ia-telemetria/ia-telemetria.module';
import { AutomacaoModule } from './automacao/automacao.module';
import { DadosModule } from './dados/dados.module';
import { DadosConsumoModule } from './dados/consumo/dados-consumo.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ScheduleModule.forRoot(),
    // Rate limit global (Guia Mestre §Segurança). Vale para TODA rota da API; quem precisa
    // de exceção declara @SkipThrottle no controller (é o caso do /api/health, que o
    // guardião/Tarefa Agendada consulta em intervalo curto e não pode ser barrado).
    ThrottlerModule.forRootAsync({
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const { ttlSegundos, limite } = config.get('rateLimit', {
          infer: true,
        });
        return { throttlers: [{ ttl: ttlSegundos * 1000, limit: limite }] };
      },
      inject: [ConfigService],
    }),
    // Serve o build de produção do Angular (`ng build`) direto pelo NestJS — um único
    // processo/porta em produção (ver configuration.ts:frontendDistPath), evitando CORS/
    // reverse proxy para uma ferramenta interna. `/api/*` fica de fora (API real); tudo
    // que não bater em nenhuma rota do Nest cai no fallback de SPA (serve index.html),
    // para o roteador do Angular funcionar em deep link (ex.: recarregar em /projetos/5).
    ServeStaticModule.forRootAsync({
      useFactory: (config: ConfigService<AppConfig, true>) => [
        {
          rootPath: config.get('frontendDistPath', { infer: true }),
          exclude: ['/api/{*splat}'],
        },
      ],
      inject: [ConfigService],
    }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    ProjetosModule,
    HealthModule,
    // Vigilância da própria infraestrutura (backup, Guardião, docservice, e-mail). Irmã do
    // HealthModule, com outro público: `/api/health` responde ao Guardião em uma linha;
    // `/api/saude` é o relatório para gente ler — e vai junto no digest diário.
    SaudeModule,
    ProntidaoModule,
    CatalogosModule,
    CronogramaModule,
    LevantamentoModule,
    IaModule,
    IaTelemetriaModule,
    AutomacaoModule,
    ProtocolosModule,
    RecheduModule,
    AgendaModule,
    RnsModule,
    EmailModule,
    FluxoModule,
    DisponibilidadeModule,
    // API de Dados (ADR-0003): fronteira única entre o Painel e os bancos EXTERNOS.
    DadosModule,
    // Lado CONSUMIDOR: os tokens com que este Painel consulta o Portal API (instância
    // interna). Só o Painel monta isto — o Portal API é a ponta que executa.
    DadosConsumoModule,
    MatrizModule,
    PainelModule,
    CadastroModule,
    DesignacaoModule,
    DigestModule,
    PlanoCronogramaModule,
    LegadoModule,
    AgentesModule,
    PassosModule,
    ClientesSiclaModule,
    ModulosSiclaModule,
    TecnicosSiclaModule,
    ContatosSiclaModule,
    PermissoesModule,
    PreferenciasModule,
    MatrizDetalhadaModule,
    MatrizFuncoesModule,
    BiImplantacaoModule,
    BiIndicadoresModule,
    BiAgendaAlocacaoModule,
    BiMovimentosModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
