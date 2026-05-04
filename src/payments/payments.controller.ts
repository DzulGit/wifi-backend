import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common'
import { PaymentsService } from './payments.service'
import { AuthGuard } from '@nestjs/passport'

@UseGuards(AuthGuard('jwt'))
@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

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
  submit(@Request() req, @Body() body: {
    invoiceId: string
    method: string
    proofImageUrl?: string
    notes?: string
  }) {
    return this.paymentsService.submit(req.user.id, body)
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