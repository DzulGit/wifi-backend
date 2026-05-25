import { AdminNotificationCategory } from '@prisma/client';
import { AdminNotificationsService } from './admin-notifications.service';

/**
 * Helper class to emit admin notifications from business logic services
 * Usage: await AdminNotificationHelper.paymentReceived(adminNotificationsService, user, invoice)
 */
export class AdminNotificationHelper {
  // ───────────────────────────────────────────────────────────────
  // FINANCE CATEGORY
  // ───────────────────────────────────────────────────────────────

  static async paymentReceived(
    service: AdminNotificationsService,
    data: {
      userName: string;
      customerCode: string;
      invoiceNumber: string;
      paymentCode: string;
      amount: number;
      paymentId: string;
      invoiceId: string;
    },
  ) {
    return service.create({
      title: '💰 Pembayaran Masuk',
      message: `${data.userName} (${data.customerCode}) mengirim bukti pembayaran untuk ${data.invoiceNumber}. Kode pembayaran: ${data.paymentCode}`,
      category: 'FINANCE',
      link: `/admin/pembayaran/${data.paymentId}`,
      isUrgent: false,
      metadata: { paymentId: data.paymentId, invoiceId: data.invoiceId },
    });
  }

  static async paymentApproved(
    service: AdminNotificationsService,
    data: {
      userName: string;
      customerCode: string;
      invoiceNumber: string;
      amount: number;
      paymentId: string;
      invoiceId: string;
    },
  ) {
    return service.create({
      title: '✅ Pembayaran Disetujui',
      message: `Pembayaran dari ${data.userName} (${data.customerCode}) untuk ${data.invoiceNumber} sebesar Rp${data.amount.toLocaleString('id-ID')} telah divalidasi.`,
      category: 'FINANCE',
      link: `/admin/pembayaran/${data.paymentId}`,
      isUrgent: false,
      metadata: { paymentId: data.paymentId, invoiceId: data.invoiceId },
    });
  }

  static async paymentRejected(
    service: AdminNotificationsService,
    data: {
      userName: string;
      customerCode: string;
      invoiceNumber: string;
      reason: string;
      paymentId: string;
      invoiceId: string;
    },
  ) {
    return service.create({
      title: '❌ Pembayaran Ditolak',
      message: `Pembayaran dari ${data.userName} (${data.customerCode}) untuk ${data.invoiceNumber} ditolak. Alasan: ${data.reason}`,
      category: 'FINANCE',
      link: `/admin/pembayaran/${data.paymentId}`,
      isUrgent: true,
      metadata: { paymentId: data.paymentId, invoiceId: data.invoiceId },
    });
  }

  // ───────────────────────────────────────────────────────────────
  // SUPPORT CATEGORY
  // ───────────────────────────────────────────────────────────────

  static async ticketCreated(
    service: AdminNotificationsService,
    data: {
      userName: string;
      ticketNumber: string;
      title: string;
      priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      ticketId: string;
    },
  ) {
    const isUrgent = data.priority === 'HIGH' || data.priority === 'CRITICAL';
    return service.create({
      title: `🎫 Tiket Baru (${data.priority})`,
      message: `${data.userName} membuat tiket #${data.ticketNumber}: "${data.title}"`,
      category: 'SUPPORT',
      link: `/admin/tiket/${data.ticketId}`,
      isUrgent,
      metadata: { ticketId: data.ticketId },
    });
  }

  static async ticketReplied(
    service: AdminNotificationsService,
    data: {
      ticketNumber: string;
      replierName: string;
      ticketId: string;
    },
  ) {
    return service.create({
      title: '💬 Tiket Dibalas',
      message: `${data.replierName} membalas tiket #${data.ticketNumber}.`,
      category: 'SUPPORT',
      link: `/admin/tiket/${data.ticketId}`,
      isUrgent: false,
      metadata: { ticketId: data.ticketId },
    });
  }

  // ───────────────────────────────────────────────────────────────
  // BILLING CATEGORY
  // ───────────────────────────────────────────────────────────────

  static async invoiceCreated(
    service: AdminNotificationsService,
    data: {
      invoiceNumber: string;
      userName: string;
      customerCode: string;
      amount: number;
      dueDate: Date;
      invoiceId: string;
    },
  ) {
    return service.create({
      title: '📄 Tagihan Terbit',
      message: `Tagihan ${data.invoiceNumber} untuk ${data.userName} (${data.customerCode}) sebesar Rp${data.amount.toLocaleString('id-ID')} jatuh tempo ${data.dueDate.toLocaleDateString('id-ID')}.`,
      category: 'BILLING',
      link: `/admin/tagihan/${data.invoiceId}`,
      isUrgent: false,
      metadata: { invoiceId: data.invoiceId },
    });
  }

  static async invoiceOverdue(
    service: AdminNotificationsService,
    data: {
      invoiceNumber: string;
      userName: string;
      customerCode: string;
      totalAmount: number;
      daysOverdue: number;
      invoiceId: string;
    },
  ) {
    return service.create({
      title: '⚠️ Tagihan Jatuh Tempo',
      message: `${data.userName} (${data.customerCode}) memiliki tagihan ${data.invoiceNumber} yang jatuh tempo ${data.daysOverdue} hari lalu sebesar Rp${data.totalAmount.toLocaleString('id-ID')}.`,
      category: 'BILLING',
      link: `/admin/tagihan/${data.invoiceId}`,
      isUrgent: true,
      metadata: { invoiceId: data.invoiceId },
    });
  }

  // ───────────────────────────────────────────────────────────────
  // ACCOUNT CATEGORY
  // ───────────────────────────────────────────────────────────────

  static async accountActivated(
    service: AdminNotificationsService,
    data: {
      userName: string;
      customerCode: string;
      userId: string;
    },
  ) {
    return service.create({
      title: '✅ Akun Diaktifkan',
      message: `Akun pelanggan ${data.userName} (${data.customerCode}) berhasil diaktifkan.`,
      category: 'ACCOUNT',
      link: `/admin/pelanggan/${data.userId}`,
      isUrgent: false,
      metadata: { userId: data.userId },
    });
  }

  static async accountSuspended(
    service: AdminNotificationsService,
    data: {
      userName: string;
      customerCode: string;
      reason: string;
      userId: string;
    },
  ) {
    return service.create({
      title: '🚫 Akun Disuspend',
      message: `Akun pelanggan ${data.userName} (${data.customerCode}) disuspend. Alasan: ${data.reason}`,
      category: 'ACCOUNT',
      link: `/admin/pelanggan/${data.userId}`,
      isUrgent: true,
      metadata: { userId: data.userId },
    });
  }

  // ───────────────────────────────────────────────────────────────
  // SYSTEM CATEGORY
  // ───────────────────────────────────────────────────────────────

  static async registrationCreated(
    service: AdminNotificationsService,
    data: {
      fullName: string;
      phone: string;
      packageName: string;
      registrationId: string;
    },
  ) {
    return service.create({
      title: '📝 Pendaftar Baru',
      message: `${data.fullName} (${data.phone}) mendaftar untuk paket ${data.packageName}.`,
      category: 'SYSTEM',
      link: `/admin/pendaftar/${data.registrationId}`,
      isUrgent: false,
      metadata: { registrationId: data.registrationId },
    });
  }

  static async systemAlert(
    service: AdminNotificationsService,
    data: {
      title: string;
      message: string;
      link?: string;
    },
  ) {
    return service.create({
      title: `🔔 ${data.title}`,
      message: data.message,
      category: 'SYSTEM',
      link: data.link,
      isUrgent: false,
      metadata: {},
    });
  }
}
