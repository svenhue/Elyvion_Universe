import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

/**
 * Example scheduled job — replace with real business logic. Any module can
 * run its own cron jobs independently; they don't need to go through the
 * Gateway or Registry.
 */
@Injectable()
export class ExampleCronService {
  private readonly logger = new Logger(ExampleCronService.name);

  @Cron(CronExpression.EVERY_MINUTE)
  handleCron() {
    this.logger.log('Example cron job tick');
  }
}
