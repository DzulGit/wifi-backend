import { Controller, Post, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Storage } from '@google-cloud/storage';
import { extname } from 'path';

@Controller('avatars')
export class AvatarsController {
  // Inisialisasi GCS
  private storage = new Storage();
  private bucketName = 'wifi-storage-cakrana'; // SESUAI SCREENSHOT LU

  // FUNGSI UTAMA (REUSABLE)
  private async uploadToGcs(file: Express.Multer.File, folder: string): Promise<string> {
    if (!file) throw new BadRequestException('File tidak ditemukan');

    const bucket = this.storage.bucket(this.bucketName);
    
    // Penamaan File: folder/timestamp-random.ext
    const fileName = `${folder}/${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`;
    const blob = bucket.file(fileName);

    const blobStream = blob.createWriteStream({
      resumable: false,
      contentType: file.mimetype,
      metadata: {
        cacheControl: 'public, max-age=31536000', // Standar industri untuk static assets
      },
    });

    return new Promise((resolve, reject) => {
      blobStream.on('error', (err) => reject(err));
      blobStream.on('finish', () => {
        const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${fileName}`;
        resolve(publicUrl);
      });
      blobStream.end(file.buffer);
    });
  }

  // ENDPOINT FOTO PROFIL
  @Post('profile-photo')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(@UploadedFile() file: Express.Multer.File) {
    const url = await this.uploadToGcs(file, 'avatars');
    return {
      message: 'Foto profil berhasil diupload',
      url: url,
    };
  }

  // ENDPOINT BUKTI BAYAR (Pindahkan logic lama lu ke sini)
  @Post('payment-proof')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPayment(@UploadedFile() file: Express.Multer.File) {
    const url = await this.uploadToGcs(file, 'payments');
    return {
      message: 'Bukti pembayaran berhasil diupload',
      url: url,
    };
  }
}