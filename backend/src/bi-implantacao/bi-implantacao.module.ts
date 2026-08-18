import { Module } from '@nestjs/common';
import { DisponibilidadeModule } from '../disponibilidade/disponibilidade.module';
import { EmailModule } from '../email/email.module';
import { BiImplantacaoService } from './bi-implantacao.service';
import { BiImplantacaoController } from './bi-implantacao.controller';

/** BI de Implantação — lê as views do schema POWERBI do SICLA pela conexão Oracle que o
 * DisponibilidadeModule já expõe (`executarSql`). Não tem entidade/tabela própria: é tela
 * de leitura sobre dado que vive no SICLA. Exceção: o painel "Visitas do Portal Rech" roda
 * a consulta `bi_visitas_portal` (Consultas BD) no BANCO DO PORTAL RECH (`PortalDbService`,
 * também do DisponibilidadeModule) — o SICLA não carrega o nº de protocolo nem a aprovação
 * do Portal de forma confiável (ver bi-implantacao.constants.ts). */
@Module({
  // EmailModule: o "Enviar por e-mail" do painel de visitas usa o MailerService (envio com
  // o PDF anexo) e o ModeloEmailService (texto padrão editável em Modelos de E-mail).
  imports: [DisponibilidadeModule, EmailModule],
  controllers: [BiImplantacaoController],
  providers: [BiImplantacaoService],
  exports: [BiImplantacaoService],
})
export class BiImplantacaoModule {}
