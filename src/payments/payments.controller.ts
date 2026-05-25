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
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { GcsService } from '../gcs.service';

// SECURITY FIX: Definisi konstanta validasi file upload
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

@UseGuards(AuthGuard('jwt'))
@Controller('payments')
export class PaymentsController {
  constructor(
    private paymentsService: PaymentsService,
    private gcsService: GcsService,
  ) {}

  private requireAdmin(req: any) {
    if (req.user?.type !== 'admin') {
      throw new ForbiddenException(
        'Hanya admin yang boleh mengakses endpoint ini',
      );
    }
  }

  @Get('stats')
  getStats(@Request() req: any) {
    this.requireAdmin(req);
    return this.paymentsService.getStats();
  }

  @Get()
  findAll(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('userId') userId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    // User hanya bisa lihat pembayarannya sendiri; admin bisa lihat semua
    const filterUserId = req.user?.type === 'admin' ? userId : req.user.id;

    return this.paymentsService.findAll({
      status,
      userId: filterUserId,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    const payment = await this.paymentsService.findOne(id);
    // SECURITY FIX: Cegah IDOR — user hanya boleh lihat pembayaran miliknya sendiri
    if (req.user?.type !== 'admin' && payment.userId !== req.user.id) {
      throw new ForbiddenException('Tidak memiliki akses ke pembayaran ini');
    }
    return payment;
  }

  // ── Submit pembayaran (user) ───────────────────────────────────────────────
  @Post()
  @UseInterceptors(
    FileInterceptor('paymentProof', {
      storage: memoryStorage(),
      // SECURITY FIX: Batasi ukuran file di level multer
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        // SECURITY FIX: Validasi MIME type file bukti pembayaran
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          return callback(
            new BadRequestException(
              'Hanya file JPG, PNG, dan WebP yang diizinkan',
            ),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async submit(
    @Request() req: any,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: any,
  ) {
    try {
      if (!body.invoiceId) {
        throw new BadRequestException(
          'ID Tagihan (invoiceId) tidak ditemukan dari form',
        );
      }

      let proofImageUrl = '';

      if (file) {
        // SECURITY FIX: Double-check ukuran file setelah upload
        if (file.size > MAX_FILE_SIZE_BYTES) {
          throw new BadRequestException('Ukuran file maksimal 5 MB');
        }
        proofImageUrl = await this.gcsService.uploadFile(file, 'payments');
      }

      const paymentData = {
        invoiceId: body.invoiceId,
        method: body.method || 'BANK_TRANSFER',
        notes: body.notes || '',
        proofImageUrl,
        // SECURITY FIX: Hapus amount dari input — amount diambil dari invoice di service
        // (mencegah user manipulasi jumlah pembayaran)
      };

      return await this.paymentsService.submit(req.user.id, paymentData);
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Gagal memproses pembayaran',
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  // ── Approve / Reject — hanya admin ───────────────────────────────────────
  @Patch(':id/approve')
  approve(@Param('id') id: string, @Request() req: any) {
    this.requireAdmin(req);
    return this.paymentsService.approve(id, req.user.id);
  }

  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { reason: string },
  ) {
    this.requireAdmin(req);
    if (!body.reason || body.reason.trim().length === 0) {
      throw new BadRequestException('Alasan penolakan wajib diisi');
    }
    return this.paymentsService.reject(id, req.user.id, body.reason);
  }
}
