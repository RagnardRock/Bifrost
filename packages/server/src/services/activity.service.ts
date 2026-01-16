import { prisma } from '../config/database'

export interface ActivityEntry {
  id: string
  siteId: string
  siteName: string
  siteUrl: string
  type: 'field_update' | 'item_create' | 'item_update' | 'item_delete'
  fieldKey: string | null
  itemId: string | null
  collectionType: string | null
  changedAt: Date
  changedBy: string | null
  userEmail: string | null
  summary: string
}

export interface ActivityFilters {
  siteId?: string
  type?: 'field_update' | 'item_create' | 'item_update' | 'item_delete'
  startDate?: Date
  endDate?: Date
}

export const activityService = {
  /**
   * Get recent activity across all sites
   */
  async getActivity(
    filters: ActivityFilters = {},
    limit: number = 50,
    offset: number = 0
  ): Promise<{ entries: ActivityEntry[]; total: number }> {
    const where: Record<string, unknown> = {}

    if (filters.siteId) {
      where.siteId = filters.siteId
    }

    if (filters.startDate || filters.endDate) {
      where.changedAt = {}
      if (filters.startDate) {
        (where.changedAt as Record<string, Date>).gte = filters.startDate
      }
      if (filters.endDate) {
        (where.changedAt as Record<string, Date>).lte = filters.endDate
      }
    }

    // Get history entries with site info
    const [entries, total] = await Promise.all([
      prisma.contentHistory.findMany({
        where,
        include: {
          site: {
            select: {
              name: true,
              url: true,
            },
          },
          user: {
            select: {
              email: true,
            },
          },
        },
        orderBy: { changedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.contentHistory.count({ where }),
    ])

    // Transform to activity entries
    const activityEntries: ActivityEntry[] = entries.map((entry) => {
      let type: ActivityEntry['type'] = 'field_update'
      let summary = ''

      if (entry.itemId) {
        // Collection item change
        if (entry.oldValue === null) {
          type = 'item_create'
          summary = `Nouvel item ajouté`
        } else if (entry.newValue === null) {
          type = 'item_delete'
          summary = `Item supprimé`
        } else {
          type = 'item_update'
          summary = `Item modifié`
        }
      } else if (entry.fieldKey) {
        type = 'field_update'
        summary = `Champ "${entry.fieldKey}" modifié`
      }

      // Filter by type if specified
      if (filters.type && type !== filters.type) {
        return null
      }

      return {
        id: entry.id,
        siteId: entry.siteId,
        siteName: entry.site.name,
        siteUrl: entry.site.url,
        type,
        fieldKey: entry.fieldKey,
        itemId: entry.itemId,
        collectionType: null, // Would need to join with collection_items to get this
        changedAt: entry.changedAt,
        changedBy: entry.changedBy,
        userEmail: entry.user?.email || null,
        summary,
      }
    }).filter((e): e is ActivityEntry => e !== null)

    return { entries: activityEntries, total }
  },

  /**
   * Get activity summary for a specific site
   */
  async getSiteActivitySummary(siteId: string) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const [recentChanges, uniqueUsers, recentActivity] = await Promise.all([
      prisma.contentHistory.count({
        where: {
          siteId,
          changedAt: { gte: sevenDaysAgo },
        },
      }),
      prisma.contentHistory.findMany({
        where: {
          siteId,
          changedAt: { gte: sevenDaysAgo },
          changedBy: { not: null },
        },
        select: { changedBy: true },
        distinct: ['changedBy'],
      }),
      prisma.contentHistory.findMany({
        where: { siteId },
        include: {
          user: { select: { email: true } },
        },
        orderBy: { changedAt: 'desc' },
        take: 10,
      }),
    ])

    return {
      recentChanges,
      activeUsers: uniqueUsers.length,
      recentActivity: recentActivity.map((entry) => ({
        id: entry.id,
        fieldKey: entry.fieldKey,
        itemId: entry.itemId,
        changedAt: entry.changedAt,
        userEmail: entry.user?.email || null,
      })),
    }
  },
}
