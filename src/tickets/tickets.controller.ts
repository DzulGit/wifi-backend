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
import { TicketsService } from './tickets.service';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('tickets')
export class TicketsController {
  constructor(private ticketsService: TicketsService) {}

  // SECURITY FIX: Helper untuk memastikan hanya admin yang bisa mengakses
  private requireAdmin(req: any) {
    if (req.user?.type !== 'admin') {
      throw new ForbiddenException('Hanya admin yang boleh mengakses');
    }
  }

  @Get('stats')
  getStats(@Request() req: any) {
    this.requireAdmin(req);
    return this.ticketsService.getStats();
  }

  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('userId') userId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ticketsService.findAll({
      status,
      priority,
      userId,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ticketsService.findOne(id);
  }

  @Post()
  create(
    @Request() req: any,
    @Body()
    body: {
      title: string;
      description: string;
      category: string;
      priority?: string;
      attachmentUrl?: string;
    },
  ) {
    return this.ticketsService.create(req.user.id, body);
  }

  @Post(':id/reply')
  reply(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { message: string; attachmentUrl?: string },
  ) {
    const isAdmin = req.user.type === 'admin';
    return this.ticketsService.reply(id, {
      message: body.message,
      isFromAdmin: isAdmin,
      userId: req.user.id,
      adminId: isAdmin ? req.user.id : undefined,
      attachmentUrl: body.attachmentUrl,
    });
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
    @Request() req: any,
  ) {
    // SECURITY FIX: Hanya admin yang bisa ubah status tiket
    if (req.user?.type !== 'admin') {
      throw new ForbiddenException(
        'Hanya admin yang bisa mengubah status tiket',
      );
    }
    // SECURITY FIX: Validasi status agar tidak bisa diisi string sembarang
    const validStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
    if (!validStatuses.includes(body.status)) {
      throw new BadRequestException('Status tiket tidak valid');
    }
    return this.ticketsService.updateStatus(id, body.status);
  }
}
