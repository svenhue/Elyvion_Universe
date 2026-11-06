import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TrafficController } from './traffic.controller';
import { TrafficService } from './traffic.service';

@Module({
  imports: [PrismaModule],
  controllers: [TrafficController],
  providers: [TrafficService],
})
export class TrafficModule {}
