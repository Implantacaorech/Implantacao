import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChecklistModelo } from '../database/entities/checklist-modelo.entity';
import { ChecklistModeloService } from './checklist-modelo.service';

@Module({
  imports: [TypeOrmModule.forFeature([ChecklistModelo])],
  providers: [ChecklistModeloService],
  exports: [ChecklistModeloService],
})
export class CatalogosModule {}
