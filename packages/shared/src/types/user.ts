import type { Site } from './site'

/**
 * User (client) who can edit content for their site
 */
export interface User {
  id: string
  email: string
  siteId: string
  createdAt: Date
  updatedAt: Date
}

export interface UserCreateInput {
  email: string
  password: string
  siteId: string
}

export interface UserLoginInput {
  email: string
  password: string
}

/**
 * User with site info (for frontend client dashboard)
 */
export interface UserWithSite extends User {
  site: Pick<Site, 'id' | 'name' | 'schema'>
}
