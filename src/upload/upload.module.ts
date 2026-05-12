import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';

@Module({
  imports: [
    MulterModule.register({
      storage: diskStorage({
        destination: join(__dirname, '..', '..', 'uploads'), // Folder tujuan: /backend/uploads
        filename: (req, file, callback) => {
          // Buat nama file unik: IDUser-Timestamp.ext
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          callback(null, `avatar-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        // Validasi tipe file: Hanya JPG/PNG/WEBP
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
          return callback(new Error('Hanya diperbolehkan mengupload gambar (JPG, PNG, WEBP)!'), false);
        }
        callback(null, true);
      },
      limits: {
        fileSize: 2 * 1024 * 1024, // Limit ukuran: 2MB
      },
    }),
  ],
  controllers: [UploadController],
})
export class UploadModule {}