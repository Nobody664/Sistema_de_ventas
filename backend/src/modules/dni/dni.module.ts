import { Module } from '@nestjs/common';
import { DniController } from './dni.controller';
import { DniService } from './dni.service';

@Module({
  controllers: [DniController],
  providers: [DniService],
  exports: [DniService],
})
export class DniModule {}
