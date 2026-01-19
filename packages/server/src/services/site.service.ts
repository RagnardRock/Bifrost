import crypto from 'crypto'
import { siteRepository } from '../repositories/site.repository'
import { Errors } from '../utils/errors'
import type { Site } from '@prisma/client'

export type CreateSiteInput = {
  name: string
  url: string
  webhookUrl?: string
}

export type SiteResponse = {
  id: string
  name: string
  url: string
  apiKey: string
  webhookUrl: string | null
  createdAt: Date
  updatedAt: Date
}

function generateApiKey(): string {
  // Format: bf_live_xxxxxxxxxxxxxxxxxxxx (32 chars random)
  const randomPart = crypto.randomBytes(24).toString('base64url')
  return `bf_live_${randomPart}`
}

function toSiteResponse(site: Site): SiteResponse {
  return {
    id: site.id,
    name: site.name,
    url: site.url,
    apiKey: site.apiKey,
    webhookUrl: site.webhookUrl,
    createdAt: site.createdAt,
    updatedAt: site.updatedAt,
  }
}

export const siteService = {
  async list(): Promise<SiteResponse[]> {
    const sites = await siteRepository.findAll()
    return sites.map(toSiteResponse)
  },

  async getById(id: string): Promise<SiteResponse> {
    const site = await siteRepository.findById(id)
    if (!site) {
      throw Errors.notFound('Site')
    }
    return toSiteResponse(site)
  },

  async create(input: CreateSiteInput): Promise<SiteResponse> {
    const apiKey = generateApiKey()

    const site = await siteRepository.create({
      name: input.name,
      url: input.url,
      apiKey,
      webhookUrl: input.webhookUrl || null,
    })

    return toSiteResponse(site)
  },

  async update(id: string, input: Partial<CreateSiteInput>): Promise<SiteResponse> {
    // Check site exists
    const existing = await siteRepository.findById(id)
    if (!existing) {
      throw Errors.notFound('Site')
    }

    const site = await siteRepository.update(id, {
      name: input.name,
      url: input.url,
      webhookUrl: input.webhookUrl,
    })

    return toSiteResponse(site)
  },

  async delete(id: string): Promise<void> {
    const existing = await siteRepository.findById(id)
    if (!existing) {
      throw Errors.notFound('Site')
    }

    await siteRepository.delete(id)
  },

  async regenerateApiKey(id: string): Promise<SiteResponse> {
    const existing = await siteRepository.findById(id)
    if (!existing) {
      throw Errors.notFound('Site')
    }

    const newApiKey = generateApiKey()
    // Need to update via raw prisma for apiKey
    const { prisma } = await import('../config/database')
    const updated = await prisma.site.update({
      where: { id },
      data: { apiKey: newApiKey },
    })

    return toSiteResponse(updated)
  },
}
