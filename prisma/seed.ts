import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as bcrypt from 'bcrypt'
import * as dotenv from 'dotenv'

dotenv.config()

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Seeding database...')

  // Seed Admin
  const adminPassword = await bcrypt.hash('admin123', 10)
  const admin = await prisma.admin.upsert({
    where: { email: 'admin@wifiapp.com' },
    update: {},
    create: {
      fullName: 'Super Admin',
      email: 'admin@wifiapp.com',
      password: adminPassword,
      role: 'SUPERADMIN',
      isActive: true,
    },
  })
  console.log('✅ Admin created:', admin.email)

  // Seed Paket WiFi
  const packages = await Promise.all([
    prisma.package.upsert({
      where: { slug: 'paket-basic' },
      update: {},
      create: {
        name: 'Paket Basic',
        slug: 'paket-basic',
        description: 'Cocok untuk penggunaan sehari-hari',
        price: 100000,
        speedDown: 10,
        speedUp: 5,
        isUnlimited: true,
        features: ['Tanpa FUP', 'Support via WA', 'Garansi uptime 99%'],
        isActive: true,
        color: '#3B82F6',
        sortOrder: 1,
      },
    }),
    prisma.package.upsert({
      where: { slug: 'paket-pro' },
      update: {},
      create: {
        name: 'Paket Pro',
        slug: 'paket-pro',
        description: 'Untuk keluarga dan work from home',
        price: 150000,
        speedDown: 20,
        speedUp: 10,
        isUnlimited: true,
        features: ['Tanpa FUP', 'Support 24/7', 'Garansi uptime 99%', 'Free instalasi'],
        isActive: true,
        isPopular: true,
        color: '#8B5CF6',
        sortOrder: 2,
      },
    }),
    prisma.package.upsert({
      where: { slug: 'paket-gaming' },
      update: {},
      create: {
        name: 'Paket Gaming',
        slug: 'paket-gaming',
        description: 'Low latency untuk gaming dan streaming',
        price: 250000,
        speedDown: 50,
        speedUp: 25,
        isUnlimited: true,
        features: ['Tanpa FUP', 'Support 24/7', 'Low latency', 'Dedicated bandwidth'],
        isActive: true,
        color: '#EF4444',
        sortOrder: 3,
      },
    }),
  ])
  console.log('✅ Packages created:', packages.map(p => p.name))

  // Seed User (pelanggan dummy)
  const userPassword = await bcrypt.hash('user123', 10)
  const user = await prisma.user.upsert({
    where: { phone: '081234567890' },
    update: {},
    create: {
      fullName: 'Budi Santoso',
      email: 'budi@gmail.com',
      phone: '081234567890',
      address: 'Jl. Merdeka No. 1, Samarinda',
      city: 'Samarinda',
      province: 'Kalimantan Timur',
      customerCode: 'WIFI-00001',
      status: 'ACTIVE',
      password: userPassword,
      activatedAt: new Date(),
      packageId: packages[1].id, // Paket Pro
    },
  })
  console.log('✅ User created:', user.email)

  // Seed Setting
  const settings = [
    { key: 'billing_due_days', value: '10', description: 'Jatuh tempo H+N setelah tagihan dibuat' },
    { key: 'penalty_amount', value: '10000', description: 'Denda keterlambatan (rupiah)' },
    { key: 'otp_expiry_minutes', value: '5', description: 'Expiry OTP dalam menit' },
    { key: 'company_name', value: 'AqraPana Network', description: 'Nama perusahaan' },
    { key: 'company_phone', value: '08xxxxxxxxxx', description: 'Nomor WA support' },
  ]

  for (const s of settings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    })
  }
  console.log('✅ Settings created')

  console.log('\n🎉 Seeding selesai!')
  console.log('─────────────────────────────')
  console.log('Admin  → admin@wifiapp.com / admin123')
  console.log('User   → budisulistiyokds@gmail.com / user123')
  console.log('─────────────────────────────')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })