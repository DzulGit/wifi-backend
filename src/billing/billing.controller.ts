import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common'
import { BillingService } from './billing.service'
import { AuthGuard } from '@nestjs/passport'

@UseGuards(AuthGuard('jwt'))
@Controller('billing')
export class BillingController {
  constructor(private billingService: BillingService) {}

  @Get('stats')
  getStats() {
    return this.billingService.getStats()
  }

  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('userId') userId?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.billingService.findAll({
      status,
      userId,
      month: month ? parseInt(month) : undefined,
      year: year ? parseInt(year) : undefined,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
    })
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.billingService.findOne(id)
  }

  @Post('generate/:userId')
  generateInvoice(
    @Param('userId') userId: string,
    @Request() req,
    @Body() body: { billingMonth?: number; billingYear?: number },
  ) {
    return this.billingService.generateInvoice(userId, req.user.id, body.billingMonth, body.billingYear)
  }

  @Post('generate-bulk')
  generateBulk(
    @Request() req,
    @Body() body: { billingMonth?: number; billingYear?: number },
  ) {
    return this.billingService.generateBulkInvoices(req.user.id, body.billingMonth, body.billingYear)
  }

  @Patch(':id/penalty')
  addPenalty(@Param('id') id: string) {
    return this.billingService.addPenalty(id)
  }
}