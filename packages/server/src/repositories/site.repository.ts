import { prisma } from '../config/database'
import type { Site, Prisma } from '@prisma/client'

export type CreateSiteData = {
  name: string
  url: string
  apiKey: string
  webhookUrl?: string | null
}

export type UpdateSiteData = Partial<Omit<CreateSiteData, 'apiKey'>>

export const siteRepository = {
  async findAll(): Promise<Site[]> {
    return prisma.site.findMany({
      orderBy: { createdAt: 'desc' },
    })
  },

  async findById(id: string): Promise<Site | null> {
    return prisma.site.findUnique({
      where: { id },
    })
  },

  async findByApiKey(apiKey: string): Promise<Site | null> {
    return prisma.site.findUnique({
      where: { apiKey },
    })
  },

  async create(data: CreateSiteData): Promise<Site> {
    return prisma.site.create({
      data: {
        name: data.name,
        url: data.url,
        apiKey: data.apiKey,
        webhookUrl: data.webhookUrl,
      },
    })
  },

  async update(id: string, data: UpdateSiteData): Promise<Site> {
    return prisma.site.update({
      where: { id },
      data,
    })
  },

  async delete(id: string): Promise<void> {
    await prisma.site.delete({
      where: { id },
    })
  },

  async count(): Promise<number> {
    return prisma.site.count()
  },
}
