import { Injectable, BadRequestException } from '@nestjs/common'
import { Storage } from '@google-cloud/storage'
import { extname } from 'path'

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
  private storage = new Storage()
  // FIX: Ganti ke nama bucket baru lu
  private bucketName = 'wifi-storage-cakrana'
  private bucket = this.storage.bucket(this.bucketName)

  private validateFileMagicBytes(file: Express.Multer.File): void {
    const { buffer, mimetype } = file
    const signatures = ALLOWED_SIGNATURES[mimetype]

    if (!signatures) {
      throw new BadRequestException('Tipe file tidak diizinkan')
    }

    const isValid = signatures.some((sig) => buffer.slice(0, sig.length).equals(sig))

    if (!isValid) {
      throw new BadRequestException(
        'File terdeteksi tidak sesuai dengan formatnya. Upload file gambar yang valid.',
      )
    }
  }

  // MODIFIKASI: Tambahkan parameter 'folder' agar reusable
  async uploadFile(file: Express.Multer.File, folder: string): Promise<string> {
    this.validateFileMagicBytes(file)

    const safeExt = SAFE_EXTENSIONS[file.mimetype] ?? '.bin'
    
    // Penamaan file lebih general sesuai folder
    const filePrefix = folder === 'payments' ? 'bukti' : 'img'
    const uniqueName = `${folder}/${filePrefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`

    const blob = this.bucket.file(uniqueName)

    await blob.save(file.buffer, {
      contentType: file.mimetype,
      resumable: false, // Penting buat file kecil agar lebih cepat
      metadata: {
        uploadedAt: new Date().toISOString(),
        cacheControl: 'public, max-age=31536000',
      },
    })

    // Mengembalikan URL dinamis berdasarkan nama bucket
    return `https://storage.googleapis.com/${this.bucketName}/${uniqueName}`
  }
}