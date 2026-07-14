import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChecklistModelo } from '../database/entities/checklist-modelo.entity';
import { IndiceTopico } from '../database/entities/indice-topico.entity';
import { ModeloDocumento } from '../database/entities/modelo-documento.entity';
import { ModeloDocumentoVersao } from '../database/entities/modelo-documento-versao.entity';
import { ModeloDocumentoCampo } from '../database/entities/modelo-documento-campo.entity';
import { ChecklistModeloService } from './checklist-modelo.service';
import { IndiceTopicoService } from './indice-topico.service';
import { ModeloDocumentoService } from './modelo-documento.service';
import { CatalogosController } from './catalogos.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChecklistModelo,
      IndiceTopico,
      ModeloDocumento,
      ModeloDocumentoVersao,
      ModeloDocumentoCampo,
    ]),
  ],
  controllers: [CatalogosController],
  providers: [
    ChecklistModeloService,
    IndiceTopicoService,
    ModeloDocumentoService,
  ],
  exports: [
    ChecklistModeloService,
    IndiceTopicoService,
    ModeloDocumentoService,
  ],
})
export class CatalogosModule {}
