import { prisma } from '../config/database'
import type { WebhookLog } from '@prisma/client'

export type CreateWebhookLogData = {
  siteId: string
  payload: object
  status?: string
}

export type UpdateWebhookLogData = {
  status: string
  attempts: number
  lastAttempt: Date
  responseCode?: number | null
  errorMessage?: string | null
}

export const webhookRepository = {
  async create(data: CreateWebhookLogData): Promise<WebhookLog> {
    return prisma.webhookLog.create({
      data: {
        siteId: data.siteId,
        payload: data.payload,
        status: data.status || 'pending',
      },
    })
  },

  async findById(id: string): Promise<WebhookLog | null> {
    return prisma.webhookLog.findUnique({
      where: { id },
    })
  },

  async update(id: string, data: UpdateWebhookLogData): Promise<WebhookLog> {
    return prisma.webhookLog.update({
      where: { id },
      data,
    })
  },

  async findPending(limit: number = 10): Promise<WebhookLog[]> {
    return prisma.webhookLog.findMany({
      where: {
        status: { in: ['pending', 'failed'] },
        attempts: { lt: 3 }, // Max 3 attempts
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
      include: {
        site: {
          select: {
            webhookUrl: true,
          },
        },
      },
    })
  },

  async findBySiteId(siteId: string, limit: number = 50): Promise<WebhookLog[]> {
    return prisma.webhookLog.findMany({
      where: { siteId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  },

  async deleteOld(daysOld: number = 30): Promise<number> {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - daysOld)

    const result = await prisma.webhookLog.deleteMany({
      where: {
        createdAt: { lt: cutoff },
        status: 'success',
      },
    })

    return result.count
  },
}
