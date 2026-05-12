import { Controller, Post, UseInterceptors, UploadedFile, BadRequestException, UseGuards, Request } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt')) // Harus login
@Controller('upload')
export class UploadController {
  
  @Post('profile-photo')
  @UseInterceptors(FileInterceptor('file')) // Nama field di FormData frontend harus 'file'
  async uploadProfilePhoto(@UploadedFile() file: Express.Multer.File, @Request() req: any) {
    if (!file) {
      throw new BadRequestException('Harap pilih file foto!');
    }

    // Kita kembalikan URL yang bisa diakses publik
    // Misal: http://localhost:3001/uploads/avatar-12345.jpg
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;
    
    return {
      status: 'success',
      message: 'Foto profil berhasil di-upload!',
      url: fileUrl, // URL inilah yang akan dikirim frontend ke API Update Profile
    };
  }
}