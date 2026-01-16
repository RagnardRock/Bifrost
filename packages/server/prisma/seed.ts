import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create admin user
  const passwordHash = await bcrypt.hash('admin123', 10)

  const admin = await prisma.admin.upsert({
    where: { email: 'admin@bifrost.local' },
    update: {},
    create: {
      email: 'admin@bifrost.local',
      passwordHash,
    },
  })

  console.log('Created admin:', admin.email)

  // Create a demo site
  const site = await prisma.site.upsert({
    where: { apiKey: 'demo-api-key-12345' },
    update: {},
    create: {
      name: 'Demo Site',
      url: 'https://demo.example.com',
      apiKey: 'demo-api-key-12345',
      schema: {
        groups: {
          hero: {
            label: 'Section Hero',
            fields: ['hero-title', 'hero-subtitle'],
          },
        },
        fields: {
          'hero-title': {
            type: 'text',
            label: 'Titre principal',
            default: 'Bienvenue',
          },
          'hero-subtitle': {
            type: 'text',
            label: 'Sous-titre',
            default: 'Découvrez notre site',
          },
        },
        collections: {
          'blog-posts': {
            label: 'Articles du blog',
            fields: {
              title: { type: 'text', label: 'Titre' },
              content: { type: 'richtext', label: 'Contenu' },
              published: { type: 'boolean', label: 'Publié', default: true },
            },
          },
        },
      },
    },
  })

  console.log('Created site:', site.name)

  // Create a demo user for the site
  const userPasswordHash = await bcrypt.hash('user123', 10)

  const user = await prisma.user.upsert({
    where: { siteId_email: { siteId: site.id, email: 'user@demo.com' } },
    update: {},
    create: {
      email: 'user@demo.com',
      passwordHash: userPasswordHash,
      siteId: site.id,
    },
  })

  console.log('Created user:', user.email)

  console.log('Seeding completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
