import { Controller, Get, Post, Body, Param, Patch, Query, UseGuards, Request, ForbiddenException } from '@nestjs/common'
import { RegistrationsService } from './registrations.service'
import { AuthGuard } from '@nestjs/passport'

@Controller('registrations')
export class RegistrationsController {
  constructor(private registrationsService: RegistrationsService) {}

  // SECURITY FIX: Helper untuk memastikan hanya admin yang bisa mengakses
  private requireAdmin(req: any) {
    if (req.user?.type !== 'admin') {
      throw new ForbiddenException('Hanya admin yang boleh mengakses')
    }
  }

  // Public — dari landing page
  @Post()
  submit(@Body() body: {
    fullName: string
    phone: string
    email?: string
    address: string
    district?: string
    city?: string
    packageId: string
    notes?: string
    latitude?: number
    longitude?: number
  }) {
    return this.registrationsService.submit(body)
  }

  // Protected — admin only
  @UseGuards(AuthGuard('jwt'))
  @Get('stats')
  getStats(@Request() req: any) {
    this.requireAdmin(req)
    return this.registrationsService.getStats()
  }

  @UseGuards(AuthGuard('jwt'))
  @Get()
  findAll(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    this.requireAdmin(req)
    return this.registrationsService.findAll({
      status,
      search,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
    })
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    this.requireAdmin(req)
    return this.registrationsService.findOne(id)
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch(':id/approve')
  approve(@Param('id') id: string, @Request() req: any) {
    this.requireAdmin(req)
    return this.registrationsService.approve(id, req.user.id)
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { reason: string },
  ) {
    this.requireAdmin(req)
    return this.registrationsService.reject(id, req.user.id, body.reason)
  }
}