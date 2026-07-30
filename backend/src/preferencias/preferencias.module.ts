import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PreferenciaUsuario } from '../database/entities/preferencia-usuario.entity';
import { PreferenciasController } from './preferencias.controller';
import { PreferenciasService } from './preferencias.service';

@Module({
  imports: [TypeOrmModule.forFeature([PreferenciaUsuario])],
  controllers: [PreferenciasController],
  providers: [PreferenciasService],
  exports: [PreferenciasService],
})
export class PreferenciasModule {}
