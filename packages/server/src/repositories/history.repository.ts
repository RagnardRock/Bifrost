import { prisma } from '../config/database'
import type { ContentHistory } from '@prisma/client'

export type CreateHistoryData = {
  siteId: string
  fieldKey?: string
  itemId?: string
  oldValue?: unknown
  newValue: unknown
  changedBy?: string
}

export const historyRepository = {
  async create(data: CreateHistoryData): Promise<ContentHistory> {
    return prisma.contentHistory.create({
      data: {
        siteId: data.siteId,
        fieldKey: data.fieldKey,
        itemId: data.itemId,
        oldValue: data.oldValue as any,
        newValue: data.newValue as any,
        changedBy: data.changedBy,
      },
    })
  },

  async findBySiteId(siteId: string, limit: number = 50): Promise<ContentHistory[]> {
    return prisma.contentHistory.findMany({
      where: { siteId },
      orderBy: { changedAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: { email: true },
        },
      },
    })
  },

  async findByFieldKey(
    siteId: string,
    fieldKey: string,
    limit: number = 20
  ): Promise<ContentHistory[]> {
    return prisma.contentHistory.findMany({
      where: { siteId, fieldKey },
      orderBy: { changedAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: { email: true },
        },
      },
    })
  },

  async findByItemId(itemId: string, limit: number = 20): Promise<ContentHistory[]> {
    return prisma.contentHistory.findMany({
      where: { itemId },
      orderBy: { changedAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: { email: true },
        },
      },
    })
  },

  async findById(id: string): Promise<ContentHistory | null> {
    return prisma.contentHistory.findUnique({
      where: { id },
      include: {
        user: {
          select: { email: true },
        },
      },
    })
  },

  async deleteOld(siteId: string, keepLast: number = 50): Promise<number> {
    // Get IDs to keep (most recent)
    const toKeep = await prisma.contentHistory.findMany({
      where: { siteId },
      orderBy: { changedAt: 'desc' },
      take: keepLast,
      select: { id: true },
    })

    const keepIds = toKeep.map((h) => h.id)

    // Delete all except those
    const result = await prisma.contentHistory.deleteMany({
      where: {
        siteId,
        id: { notIn: keepIds },
      },
    })

    return result.count
  },

  async countBySiteId(siteId: string): Promise<number> {
    return prisma.contentHistory.count({
      where: { siteId },
    })
  },
}
