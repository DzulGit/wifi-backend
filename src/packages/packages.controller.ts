import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request, ForbiddenException } from '@nestjs/common'
import { PackagesService } from './packages.service'
import { AuthGuard } from '@nestjs/passport'

@Controller('packages')
export class PackagesController {
  constructor(private packagesService: PackagesService) {}

  // SECURITY FIX: Helper untuk memastikan hanya admin yang bisa mengakses
  private requireAdmin(req: any) {
    if (req.user?.type !== 'admin') {
      throw new ForbiddenException('Hanya admin yang boleh mengakses')
    }
  }

  // Public — bisa diakses landing page tanpa login
  @Get()
findAll(@Query('active') active?: string) {
  const onlyActive = active !== 'false'
  return this.packagesService.findAll(onlyActive)
}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.packagesService.findOne(id)
  }

  // Protected — hanya admin
  @UseGuards(AuthGuard('jwt'))
  @Post()
  create(@Request() req: any, @Body() body: {
    name: string
    description?: string
    price: number
    speedDown: number
    speedUp: number
    features?: string[]
    color?: string
    isPopular?: boolean
    sortOrder?: number
  }) {
    this.requireAdmin(req)
    return this.packagesService.create(body)
  }

  @UseGuards(AuthGuard('jwt'))
  @Put(':id')
  update(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    this.requireAdmin(req)
    return this.packagesService.update(id, body)
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: any) {
    this.requireAdmin(req)
    return this.packagesService.remove(id)
  }
}