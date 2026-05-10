import { Injectable } from '@nestjs/common'
import { Storage } from '@google-cloud/storage'
import { extname } from 'path'


@Injectable()
export class GcsService {
  private storage = new Storage() // otomatis pakai kredensial Cloud Run
  private bucket = this.storage.bucket('wifi-payments-cakrana')

  async uploadFile(file: Express.Multer.File): Promise<string> {
    const uniqueName = `payments/bukti-${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`
    const blob = this.bucket.file(uniqueName)

    await blob.save(file.buffer, {
      contentType: file.mimetype,
    })

    return `https://storage.googleapis.com/wifi-payments-cakrana/${uniqueName}`
  }
}