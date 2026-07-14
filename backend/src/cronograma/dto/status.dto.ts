import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { CRONO_STATUS_AGENDA } from '../../database/entities/atividade-cronograma.entity';

export class StatusDto {
  @ApiProperty({ enum: CRONO_STATUS_AGENDA })
  @IsIn(CRONO_STATUS_AGENDA)
  status: string;
}
