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
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '@nestjs/passport';
import { UserStatus } from '@prisma/client';

@UseGuards(AuthGuard('jwt'))
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  // ── Helper: pastikan request dari admin ───────────────────────────────────
  private requireAdmin(req: any) {
    if (req.user?.type !== 'admin') {
      throw new ForbiddenException(
        'Hanya admin yang boleh mengakses endpoint ini',
      );
    }
  }

  // ─── ENDPOINT REQUEST USER ───────────────────────────────────────

  @Post(':id/request-package')
  async requestPackageChange(
    @Param('id') id: string, 
    @Body('newPackageId') newPackageId: string
  ) {
    return this.usersService.requestPackageChange(id, newPackageId);
  }

  @Post(':id/request-cancel')
  async requestCancellation(
    @Param('id') id: string, 
    @Body('reason') reason: string
  ) {
    return this.usersService.requestCancellation(id, reason);
  }

  @Post(':id/request-move')
  async requestAddressMove(
    @Param('id') id: string, 
    @Body('newAddress') newAddress: string
  ) {
    return this.usersService.requestAddressMove(id, newAddress);
  }

  @Get('stats')
  getStats(@Request() req: any) {
    this.requireAdmin(req);
    return this.usersService.getStats();
  }

  @Get()
  findAll(
    @Request() req: any,
    @Query('status') status?: UserStatus,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    this.requireAdmin(req);

    // SECURITY FIX: Batasi limit maksimum agar tidak bisa dump semua data
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    const safeLimit = Math.min(parsedLimit, 100);

    const parsedPage = page ? parseInt(page, 10) : 1;
    if (parsedPage < 1) throw new BadRequestException('Page tidak valid');

    return this.usersService.findAll({
      status,
      search,
      page: parsedPage,
      limit: safeLimit,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    this.requireAdmin(req);
    return this.usersService.findOne(id);
  }

  @Post()
  create(
    @Request() req: any,
    @Body()
    body: {
      fullName: string;
      phone: string;
      email?: string;
      address: string;
      district?: string;
      city?: string;
      province?: string;
      packageId?: string;
      notes?: string;
    },
  ) {
    this.requireAdmin(req);

    // SECURITY FIX: Validasi field wajib sebelum masuk ke service
    if (!body.fullName || !body.phone || !body.address) {
      throw new BadRequestException(
        'Nama lengkap, nomor HP, dan alamat wajib diisi',
      );
    }

    return this.usersService.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    this.requireAdmin(req);
    if (req.user?.type !== 'admin' && req.user?.id !== id) {
      throw new ForbiddenException(
        'Anda hanya bisa merubah profil Anda sendiri',
      );
    }

    if (req.user?.type !== 'admin') {
      delete body.status; 
      delete body.packageId; 
      delete body.customerCode; 
    }

    return this.usersService.update(id, body);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: UserStatus },
    @Request() req: any,
  ) {
    this.requireAdmin(req);

    const validStatuses: UserStatus[] = [
      'ACTIVE',
      'SUSPENDED',
      'INACTIVE',
      'PENDING',
    ];
    if (!body.status || !validStatuses.includes(body.status)) {
      throw new BadRequestException('Status tidak valid');
    }

    return this.usersService.updateStatus(id, body.status);
  }
}
