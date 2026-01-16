import { prisma } from '../config/database'

export interface DashboardStats {
  sites: {
    total: number
    withSchema: number
    withWebhook: number
  }
  users: {
    total: number
    admins: number
    clients: number
  }
  content: {
    totalFields: number
    totalCollectionItems: number
  }
  activity: {
    recentChanges: number
    webhooksSent: number
    webhooksSuccess: number
    webhooksFailed: number
  }
  recentSites: Array<{
    id: string
    name: string
    url: string
    createdAt: Date
    usersCount: number
  }>
}

export const statsService = {
  /**
   * Get dashboard statistics
   */
  async getDashboardStats(): Promise<DashboardStats> {
    // Run all queries in parallel
    const [
      sitesTotal,
      sitesWithSchema,
      sitesWithWebhook,
      adminsCount,
      clientsCount,
      contentFields,
      collectionItems,
      recentChanges,
      webhookStats,
      recentSites,
    ] = await Promise.all([
      // Sites stats
      prisma.site.count(),
      prisma.site.count({ where: { schema: { not: null } } }),
      prisma.site.count({ where: { webhookUrl: { not: null } } }),

      // Users stats
      prisma.admin.count(),
      prisma.user.count(),

      // Content stats
      prisma.content.count(),
      prisma.collectionItem.count(),

      // Activity - changes in last 7 days
      prisma.contentHistory.count({
        where: {
          changedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),

      // Webhook stats in last 7 days
      prisma.webhookLog.groupBy({
        by: ['status'],
        _count: true,
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),

      // Recent sites with user count
      prisma.site.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { users: true },
          },
        },
      }),
    ])

    // Process webhook stats
    let webhooksSent = 0
    let webhooksSuccess = 0
    let webhooksFailed = 0

    for (const stat of webhookStats) {
      webhooksSent += stat._count
      if (stat.status === 'success') {
        webhooksSuccess = stat._count
      } else if (stat.status === 'failed') {
        webhooksFailed = stat._count
      }
    }

    return {
      sites: {
        total: sitesTotal,
        withSchema: sitesWithSchema,
        withWebhook: sitesWithWebhook,
      },
      users: {
        total: adminsCount + clientsCount,
        admins: adminsCount,
        clients: clientsCount,
      },
      content: {
        totalFields: contentFields,
        totalCollectionItems: collectionItems,
      },
      activity: {
        recentChanges,
        webhooksSent,
        webhooksSuccess,
        webhooksFailed,
      },
      recentSites: recentSites.map((site) => ({
        id: site.id,
        name: site.name,
        url: site.url,
        createdAt: site.createdAt,
        usersCount: site._count.users,
      })),
    }
  },

  /**
   * Get stats for a specific site
   */
  async getSiteStats(siteId: string) {
    const [
      usersCount,
      contentFields,
      collectionItems,
      recentChanges,
      webhookLogs,
    ] = await Promise.all([
      prisma.user.count({ where: { siteId } }),
      prisma.content.count({ where: { siteId } }),
      prisma.collectionItem.count({ where: { siteId } }),
      prisma.contentHistory.count({
        where: {
          siteId,
          changedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.webhookLog.count({
        where: {
          siteId,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ])

    return {
      users: usersCount,
      contentFields,
      collectionItems,
      recentChanges,
      webhookLogs,
    }
  },
}
