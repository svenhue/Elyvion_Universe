import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ElyvionLoggerModule } from '@elyvion/shared';
import { AppController } from './app.controller';
import { SolutionsModule } from './solutions/solutions.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ElyvionLoggerModule.forRoot({ moduleName: process.env.MODULE_NAME ?? 'solutions' }),
    MongooseModule.forRoot(process.env.MONGODB_URI ?? 'mongodb://localhost:27017/elyvion_solutions'),
    SolutionsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
