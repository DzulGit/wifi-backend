import { Controller, Get, Post, Body, Param, Patch, Query, UseGuards, Request } from '@nestjs/common'
import { RegistrationsService } from './registrations.service'
import { AuthGuard } from '@nestjs/passport'

@Controller('registrations')
export class RegistrationsController {
  constructor(private registrationsService: RegistrationsService) {}

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
  getStats() {
    return this.registrationsService.getStats()
  }

  @UseGuards(AuthGuard('jwt'))
  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.registrationsService.findAll({
      status,
      search,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
    })
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.registrationsService.findOne(id)
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch(':id/approve')
  approve(@Param('id') id: string, @Request() req) {
    return this.registrationsService.approve(id, req.user.id)
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @Request() req,
    @Body() body: { reason: string },
  ) {
    return this.registrationsService.reject(id, req.user.id, body.reason)
  }
}