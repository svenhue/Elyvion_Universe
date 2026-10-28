import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ElyvionLoggerModule } from '@elyvion/shared';
import { AppController } from './app.controller';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ElyvionLoggerModule.forRoot({ moduleName: process.env.MODULE_NAME ?? 'chat' }),
    MongooseModule.forRoot(process.env.MONGODB_URI ?? 'mongodb://localhost:27017/elyvion_chat'),
    ChatModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
