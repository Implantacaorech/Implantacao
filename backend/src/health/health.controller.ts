import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  @ApiOperation({
    summary:
      'Healthcheck — usado pelo Guardião/monitoramento (equivalente a GET /health do Flask)',
  })
  async check() {
    await this.dataSource.query('SELECT 1');
    return { status: 'ok', db: this.dataSource.options.type };
  }
}
