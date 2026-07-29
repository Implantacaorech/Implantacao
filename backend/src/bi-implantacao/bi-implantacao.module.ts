import { Module } from '@nestjs/common';
import { DisponibilidadeModule } from '../disponibilidade/disponibilidade.module';
import { BiImplantacaoService } from './bi-implantacao.service';
import { BiImplantacaoController } from './bi-implantacao.controller';

/** BI de Implantação — lê as views do schema POWERBI do SICLA pela conexão Oracle que o
 * DisponibilidadeModule já expõe (`executarSql`). Não tem entidade/tabela própria: é tela
 * de leitura sobre dado que vive no SICLA. */
@Module({
  imports: [DisponibilidadeModule],
  controllers: [BiImplantacaoController],
  providers: [BiImplantacaoService],
  exports: [BiImplantacaoService],
})
export class BiImplantacaoModule {}
