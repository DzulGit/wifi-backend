import { Injectable, BadRequestException } from '@nestjs/common'
import { Storage } from '@google-cloud/storage'
import { extname } from 'path'

// SECURITY FIX: Magic bytes validasi file — mencegah polyglot file / bypass ekstensi
const ALLOWED_SIGNATURES: Record<string, Buffer[]> = {
  'image/jpeg': [Buffer.from([0xff, 0xd8, 0xff])],
  'image/png': [Buffer.from([0x89, 0x50, 0x4e, 0x47])],
  'image/webp': [Buffer.from('RIFF'), Buffer.from('WEBP')],
}

const SAFE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
}

@Injectable()
export class GcsService {
  private storage = new Storage() // Pakai credentials Cloud Run otomatis
  private bucket = this.storage.bucket('wifi-payments-cakrana')

  // ── Validasi file berdasarkan magic bytes ──────────────────────────────────
  private validateFileMagicBytes(file: Express.Multer.File): void {
    const { buffer, mimetype } = file
    const signatures = ALLOWED_SIGNATURES[mimetype]

    if (!signatures) {
      throw new BadRequestException('Tipe file tidak diizinkan')
    }

    // Cek apakah buffer dimulai dengan salah satu signature yang valid
    const isValid = signatures.some((sig) => buffer.slice(0, sig.length).equals(sig))

    if (!isValid) {
      throw new BadRequestException(
        'File terdeteksi tidak sesuai dengan formatnya. Upload file gambar yang valid.',
      )
    }
  }

  async uploadFile(file: Express.Multer.File): Promise<string> {
    // SECURITY FIX: Validasi magic bytes sebelum upload ke GCS
    this.validateFileMagicBytes(file)

    // SECURITY FIX: Gunakan ekstensi dari MIME type yang tervalidasi,
    // bukan dari originalname (mencegah path traversal / ekstensi berbahaya)
    const safeExt = SAFE_EXTENSIONS[file.mimetype] ?? '.bin'

    // SECURITY FIX: Jangan gunakan originalname sama sekali di path GCS
    const uniqueName = `payments/bukti-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`

    const blob = this.bucket.file(uniqueName)

    await blob.save(file.buffer, {
      contentType: file.mimetype,
      metadata: {
        // Tambah metadata untuk audit trail
        uploadedAt: new Date().toISOString(),
      },
    })

    return `https://storage.googleapis.com/wifi-payments-cakrana/${uniqueName}`
  }
}
