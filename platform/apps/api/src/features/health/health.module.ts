import { Controller, Get, Module } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@ApiTags('health')
@Controller('health')
class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  check() {
    const database = this.connection.readyState === 1 ? 'connected' : 'unavailable';
    return {
      status: database === 'connected' ? 'ok' : 'degraded',
      database,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    };
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
