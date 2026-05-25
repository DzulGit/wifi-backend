import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { GcsService } from '../gcs.service';

@Controller('avatars')
export class AvatarsController {
  constructor(private readonly gcsService: GcsService) {}

  @Post('profile-photo')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(@UploadedFile() file: Express.Multer.File) {
    const url = await this.gcsService.uploadFile(file, 'avatars');
    return {
      message: 'Foto profil berhasil diupload',
      url,
    };
  }

  @Post('payment-proof')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPayment(@UploadedFile() file: Express.Multer.File) {
    const url = await this.gcsService.uploadFile(file, 'payments');
    return {
      message: 'Bukti pembayaran berhasil diupload',
      url,
    };
  }
}
