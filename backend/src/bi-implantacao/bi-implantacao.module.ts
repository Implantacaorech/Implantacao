import { Module } from '@nestjs/common';
import { DadosModule } from '../dados/dados.module';
import { EmailModule } from '../email/email.module';
import { BiImplantacaoService } from './bi-implantacao.service';
import { BiImplantacaoController } from './bi-implantacao.controller';

/** BI de Implantação — lê as views do schema POWERBI do SICLA pela API de Dados
 * (ADR-0003). Não tem entidade/tabela própria: é tela de leitura sobre dado que vive no
 * SICLA. Exceção: o painel "Visitas do Portal Rech" pede `portal.visitas.listar`, a única
 * consulta do Painel que roda no BANCO DO PORTAL RECH — o SICLA não carrega o nº de
 * protocolo nem a aprovação do Portal de forma confiável (ver o catálogo). */
@Module({
  // EmailModule: o "Enviar por e-mail" do painel de visitas usa o MailerService (envio com
  // o PDF anexo) e o ModeloEmailService (texto padrão editável em Modelos de E-mail).
  imports: [DadosModule, EmailModule],
  controllers: [BiImplantacaoController],
  providers: [BiImplantacaoService],
  exports: [BiImplantacaoService],
})
export class BiImplantacaoModule {}
