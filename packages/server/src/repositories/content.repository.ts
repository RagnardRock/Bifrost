import { prisma } from '../config/database'
import type { Content } from '@prisma/client'

export type UpsertContentData = {
  siteId: string
  fieldKey: string
  value: unknown
}

export const contentRepository = {
  async findBySiteId(siteId: string): Promise<Content[]> {
    return prisma.content.findMany({
      where: { siteId },
    })
  },

  async findByFieldKey(siteId: string, fieldKey: string): Promise<Content | null> {
    return prisma.content.findUnique({
      where: {
        siteId_fieldKey: { siteId, fieldKey },
      },
    })
  },

  async upsert(data: UpsertContentData): Promise<Content> {
    return prisma.content.upsert({
      where: {
        siteId_fieldKey: {
          siteId: data.siteId,
          fieldKey: data.fieldKey,
        },
      },
      create: {
        siteId: data.siteId,
        fieldKey: data.fieldKey,
        value: data.value as any,
        version: 1,
      },
      update: {
        value: data.value as any,
        version: { increment: 1 },
      },
    })
  },

  async upsertMany(siteId: string, contents: Record<string, unknown>): Promise<void> {
    const operations = Object.entries(contents).map(([fieldKey, value]) =>
      prisma.content.upsert({
        where: {
          siteId_fieldKey: { siteId, fieldKey },
        },
        create: {
          siteId,
          fieldKey,
          value: value as any,
          version: 1,
        },
        update: {
          value: value as any,
          version: { increment: 1 },
        },
      })
    )

    await prisma.$transaction(operations)
  },

  async delete(siteId: string, fieldKey: string): Promise<void> {
    await prisma.content.delete({
      where: {
        siteId_fieldKey: { siteId, fieldKey },
      },
    })
  },

  async deleteAllForSite(siteId: string): Promise<void> {
    await prisma.content.deleteMany({
      where: { siteId },
    })
  },
}
