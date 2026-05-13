import { Module } from '@nestjs/common';
import { AvatarsController } from './avatars.controller';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer'; // Pake memory biar simple

@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(), // File disimpen di RAM sementara
    }),
  ],
  controllers: [AvatarsController],
})
export class AvatarsModule {}