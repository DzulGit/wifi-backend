import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer'; // Pake memory biar simple

@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(), // File disimpen di RAM sementara
    }),
  ],
  controllers: [UploadController],
})
export class UploadModule {}