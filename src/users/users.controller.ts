import { Controller, Get, Post, Put, Patch, Body, Param, Query, UseGuards } from '@nestjs/common'
import { UsersService } from './users.service'
import { AuthGuard } from '@nestjs/passport'
import { UserStatus } from '@prisma/client'

@UseGuards(AuthGuard('jwt'))
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('stats')
  getStats() {
    return this.usersService.getStats()
  }

  @Get()
  findAll(
    @Query('status') status?: UserStatus,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.usersService.findAll({
      status,
      search,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
    })
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id)
  }

  @Post()
  create(@Body() body: {
    fullName: string
    phone: string
    email?: string
    address: string
    district?: string
    city?: string
    province?: string
    packageId?: string
    notes?: string
  }) {
    return this.usersService.create(body)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.usersService.update(id, body)
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: UserStatus },
  ) {
    return this.usersService.updateStatus(id, body.status)
  }


}