import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request, ForbiddenException } from '@nestjs/common'
import { BillingService } from './billing.service'
import { AuthGuard } from '@nestjs/passport'

@UseGuards(AuthGuard('jwt'))
@Controller('billing')
export class BillingController {
  constructor(private billingService: BillingService) {}

  // SECURITY FIX: Helper untuk memastikan hanya admin yang bisa mengakses
  private requireAdmin(req: any) {
    if (req.user?.type !== 'admin') {
      throw new ForbiddenException('Hanya admin yang boleh mengakses')
    }
  }

  @Get('stats')
  getStats(@Request() req: any) {
    this.requireAdmin(req)
    return this.billingService.getStats()
  }

  @Get()
  findAll(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('userId') userId?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    this.requireAdmin(req)
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
  findOne(@Param('id') id: string, @Request() req: any) {
    this.requireAdmin(req)
    return this.billingService.findOne(id)
  }

  @Post('generate/:userId')
  generateInvoice(
    @Param('userId') userId: string,
    @Request() req: any,
    @Body() body: { billingMonth?: number; billingYear?: number },
  ) {
    this.requireAdmin(req)
    return this.billingService.generateInvoice(userId, req.user.id, body.billingMonth, body.billingYear)
  }

  @Post('generate-bulk')
  generateBulk(
    @Request() req: any,
    @Body() body: { billingMonth?: number; billingYear?: number },
  ) {
    this.requireAdmin(req)
    return this.billingService.generateBulkInvoices(req.user.id, body.billingMonth, body.billingYear)
  }

  @Patch(':id/penalty')
  addPenalty(@Param('id') id: string, @Request() req: any) {
    this.requireAdmin(req)
    return this.billingService.addPenalty(id)
  }
}