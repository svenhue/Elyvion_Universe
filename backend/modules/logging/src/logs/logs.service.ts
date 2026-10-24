import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLogDto, ListLogsQuery } from './dto/logs.dto';

@Injectable()
export class LogsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateLogDto) {
    return this.prisma.logEntry.create({
      data: {
        source: dto.source,
        level: dto.level,
        message: dto.message,
        actionKey: dto.actionKey,
        context: dto.context as Prisma.InputJsonValue | undefined,
      },
    });
  }

  list(query: ListLogsQuery) {
    return this.prisma.logEntry.findMany({
      where: {
        source: query.source,
        level: query.level,
        actionKey: query.actionKey,
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit,
    });
  }
}
