import { Controller, Get, Post, Delete, UseGuards, Query, Param, Body, BadRequestException } from '@nestjs/common'
import { AdminNotificationsService } from './admin-notifications.service'
import { AuthGuard } from '@nestjs/passport'
import { AdminNotificationCategory } from '@prisma/client'

@UseGuards(AuthGuard('jwt'))
@Controller('admin/notifications')
export class AdminNotificationsController {
  constructor(private service: AdminNotificationsService) {}

  /**
   * GET /admin/notifications
   * Get all admin notifications with optional filtering
   * Query params:
   *   - category: AdminNotificationCategory (optional)
   *   - isRead: boolean (optional)
   *   - page: number (default: 1)
   *   - limit: number (default: 20)
   */
  @Get()
  async getAll(
    @Query('category') category?: AdminNotificationCategory,
    @Query('isRead') isRead?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getAll({
      category: category as AdminNotificationCategory,
      isRead: isRead === 'true' ? true : isRead === 'false' ? false : undefined,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? Math.min(parseInt(limit, 10), 100) : 20,
    })
  }

  /**
   * GET /admin/notifications/summary
   * Get summary stats (unread counts by category)
   */
  @Get('summary')
  async getSummary() {
    return this.service.getSummary()
  }

  /**
   * GET /admin/notifications/unread
   * Get only unread notifications with pagination
   */
  @Get('unread')
  async getUnread(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.service.getUnread(
      page ? parseInt(page, 10) : 1,
      limit ? Math.min(parseInt(limit, 10), 100) : 20,
    )
  }

  /**
   * GET /admin/notifications/category/:category
   * Get notifications filtered by category
   */
  @Get('category/:category')
  async getByCategory(
    @Param('category') category: AdminNotificationCategory,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const validCategories = ['FINANCE', 'SUPPORT', 'SYSTEM', 'ACCOUNT', 'BILLING']
    if (!validCategories.includes(category)) {
      throw new BadRequestException(`Invalid category: ${category}`)
    }

    return this.service.getByCategory(
      category as AdminNotificationCategory,
      page ? parseInt(page, 10) : 1,
      limit ? Math.min(parseInt(limit, 10), 100) : 20,
    )
  }

  /**
   * POST /admin/notifications/:id/read
   * Mark a single notification as read
   */
  @Post(':id/read')
  async markAsRead(@Param('id') id: string) {
    return this.service.markAsRead(id)
  }

  /**
   * POST /admin/notifications/read/many
   * Mark multiple notifications as read
   * Body: { ids: string[] }
   */
  @Post('read/many')
  async markManyAsRead(@Body() body: { ids: string[] }) {
    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      throw new BadRequestException('ids must be a non-empty array')
    }
    return this.service.markManyAsRead(body.ids)
  }

  /**
   * POST /admin/notifications/read/all
   * Mark all unread notifications as read
   */
  @Post('read/all')
  async markAllAsRead() {
    return this.service.markAllAsRead()
  }

  /**
   * DELETE /admin/notifications/:id
   * Delete a single notification
   */
  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.service.delete(id)
    return { message: 'Notification deleted' }
  }

  /**
   * DELETE /admin/notifications
   * Delete multiple notifications
   * Body: { ids: string[] }
   */
  @Delete()
  async deleteMany(@Body() body: { ids: string[] }) {
    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      throw new BadRequestException('ids must be a non-empty array')
    }
    return this.service.deleteMany(body.ids)
  }
}