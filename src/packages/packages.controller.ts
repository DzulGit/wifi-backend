import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common'
import { PackagesService } from './packages.service'
import { AuthGuard } from '@nestjs/passport'

@Controller('packages')
export class PackagesController {
  constructor(private packagesService: PackagesService) {}

  // Public — bisa diakses landing page tanpa login
  @Get()
  findAll(@Query('active') active?: string) {
    return this.packagesService.findAll(active === 'true')
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.packagesService.findOne(id)
  }

  // Protected — hanya admin
  @UseGuards(AuthGuard('jwt'))
  @Post()
  create(@Body() body: {
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
    return this.packagesService.create(body)
  }

  @UseGuards(AuthGuard('jwt'))
  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.packagesService.update(id, body)
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.packagesService.remove(id)
  }
}