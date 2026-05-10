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
} from '@nestjs/common'
import { PaymentsService } from './payments.service'
import { AuthGuard } from '@nestjs/passport'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { GcsService } from '../gcs.service'

@UseGuards(AuthGuard('jwt'))
@Controller('payments')
export class PaymentsController {
  constructor(
    private paymentsService: PaymentsService,
    private gcsService: GcsService,
  ) {}

  @Get('stats')
  getStats() {
    return this.paymentsService.getStats()
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
    })
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(id)
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('paymentProof', {
      storage: memoryStorage(),
    }),
  )
  async submit(
    @Request() req: any,
    @UploadedFile() file: any,
    @Body() body: any,
  ) {
    try {
      if (!body.invoiceId) {
        throw new Error('ID Tagihan (invoiceId) tidak ditemukan dari form')
      }

      const proofImageUrl = file ? await this.gcsService.uploadFile(file) : ''

      const paymentData = {
        invoiceId: body.invoiceId,
        method: body.method || 'BANK_TRANSFER',
        notes: body.notes || '',
        amount: body.amount ? Number(body.amount) : 0,
        proofImageUrl,
      }

      return await this.paymentsService.submit(req.user.id, paymentData)
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Gagal memproses pembayaran',
        HttpStatus.BAD_REQUEST,
      )
    }
  }

  @Patch(':id/approve')
  approve(@Param('id') id: string, @Request() req) {
    return this.paymentsService.approve(id, req.user.id)
  }

  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @Request() req,
    @Body() body: { reason: string },
  ) {
    return this.paymentsService.reject(id, req.user.id, body.reason)
  }
}