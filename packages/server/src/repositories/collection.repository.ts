import { prisma } from '../config/database'
import type { CollectionItem } from '@prisma/client'

export type CreateCollectionItemData = {
  siteId: string
  collectionType: string
  data: Record<string, unknown>
  position?: number
}

export type UpdateCollectionItemData = {
  data?: Record<string, unknown>
  position?: number
}

export const collectionRepository = {
  async findBySiteAndType(siteId: string, collectionType: string): Promise<CollectionItem[]> {
    return prisma.collectionItem.findMany({
      where: { siteId, collectionType },
      orderBy: { position: 'asc' },
    })
  },

  async findById(id: string): Promise<CollectionItem | null> {
    return prisma.collectionItem.findUnique({
      where: { id },
    })
  },

  async create(data: CreateCollectionItemData): Promise<CollectionItem> {
    // Get max position for this collection
    const maxPosition = await prisma.collectionItem.aggregate({
      where: {
        siteId: data.siteId,
        collectionType: data.collectionType,
      },
      _max: { position: true },
    })

    const position = data.position ?? (maxPosition._max.position ?? -1) + 1

    return prisma.collectionItem.create({
      data: {
        siteId: data.siteId,
        collectionType: data.collectionType,
        data: data.data as any,
        position,
      },
    })
  },

  async update(id: string, data: UpdateCollectionItemData): Promise<CollectionItem> {
    return prisma.collectionItem.update({
      where: { id },
      data: {
        ...(data.data !== undefined && { data: data.data as any }),
        ...(data.position !== undefined && { position: data.position }),
      },
    })
  },

  async delete(id: string): Promise<void> {
    await prisma.collectionItem.delete({
      where: { id },
    })
  },

  async reorder(_siteId: string, _collectionType: string, itemIds: string[]): Promise<void> {
    const operations = itemIds.map((id, index) =>
      prisma.collectionItem.update({
        where: { id },
        data: { position: index },
      })
    )

    await prisma.$transaction(operations)
  },

  async countByType(siteId: string, collectionType: string): Promise<number> {
    return prisma.collectionItem.count({
      where: { siteId, collectionType },
    })
  },
}
