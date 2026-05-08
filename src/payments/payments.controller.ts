import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';

// Script untuk otomatis membuat folder simpanan gambar jika belum ada
const uploadDir = './public/uploads/payments';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

@UseGuards(AuthGuard('jwt'))
@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Get('stats')
  getStats() {
    return this.paymentsService.getStats();
  }

  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('userId') userId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.paymentsService.findAll({
      status,
      userId,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(id);
  }

  // --- INI BAGIAN YANG DI-FIX TOTAL ---
  @Post()
  @UseInterceptors(
    FileInterceptor('paymentProof', {
      storage: diskStorage({
        destination: uploadDir,
        filename: (req, file, cb) => {
          // Bikin nama file unik biar gak bentrok
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `bukti-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  async submit(
    @Request() req: any,
    @UploadedFile() file: any,
    @Body() body: any,
  ) {
    try {
      if (!body.invoiceId) {
        throw new Error('ID Tagihan (invoiceId) tidak ditemukan dari form');
      }

      // Rapikan data dari FormData menjadi Object yang rapi
      const paymentData = {
        invoiceId: body.invoiceId,
        // Pastikan 'BANK_TRANSFER' ini sama dengan penulisan Enum di Prisma kamu
        method: body.method || 'BANK_TRANSFER', 
        notes: body.notes || '',
        amount: body.amount ? Number(body.amount) : 0,
        proofImageUrl: file ? `/public/uploads/payments/${file.filename}` : '',
      };

      return await this.paymentsService.submit(req.user.id, paymentData);
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Gagal memproses pembayaran',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
  // ------------------------------------

  @Patch(':id/approve')
  approve(@Param('id') id: string, @Request() req) {
    return this.paymentsService.approve(id, req.user.id);
  }

  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @Request() req,
    @Body() body: { reason: string },
  ) {
    return this.paymentsService.reject(id, req.user.id, body.reason);
  }
}