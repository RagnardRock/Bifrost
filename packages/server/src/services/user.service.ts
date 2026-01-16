import { userRepository } from '../repositories/user.repository'
import { siteRepository } from '../repositories/site.repository'
import { hashPassword } from '../utils/hash'
import { Errors } from '../utils/errors'
import type { User } from '@prisma/client'

export type CreateUserInput = {
  email: string
  password: string
  siteId: string
}

export type UpdateUserInput = {
  email?: string
  password?: string
}

export type UserResponse = {
  id: string
  email: string
  siteId: string
  createdAt: Date
  updatedAt: Date
}

function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    email: user.email,
    siteId: user.siteId,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

export const userService = {
  async listBySite(siteId: string): Promise<UserResponse[]> {
    // Verify site exists
    const site = await siteRepository.findById(siteId)
    if (!site) {
      throw Errors.notFound('Site')
    }

    const users = await userRepository.findBySiteId(siteId)
    return users.map(toUserResponse)
  },

  async getById(id: string): Promise<UserResponse> {
    const user = await userRepository.findById(id)
    if (!user) {
      throw Errors.notFound('Utilisateur')
    }
    return toUserResponse(user)
  },

  async create(input: CreateUserInput): Promise<UserResponse> {
    // Verify site exists
    const site = await siteRepository.findById(input.siteId)
    if (!site) {
      throw Errors.notFound('Site')
    }

    // Check if email already exists for this site
    const existing = await userRepository.findByEmailAndSite(input.email, input.siteId)
    if (existing) {
      throw Errors.validation({ email: 'Cet email est déjà utilisé pour ce site' })
    }

    // Hash password
    const passwordHash = await hashPassword(input.password)

    const user = await userRepository.create({
      email: input.email,
      passwordHash,
      siteId: input.siteId,
    })

    return toUserResponse(user)
  },

  async update(id: string, input: UpdateUserInput): Promise<UserResponse> {
    const existing = await userRepository.findById(id)
    if (!existing) {
      throw Errors.notFound('Utilisateur')
    }

    // Check email uniqueness if changing email
    if (input.email && input.email !== existing.email) {
      const emailExists = await userRepository.findByEmailAndSite(input.email, existing.siteId)
      if (emailExists) {
        throw Errors.validation({ email: 'Cet email est déjà utilisé pour ce site' })
      }
    }

    // Prepare update data
    const updateData: { email?: string; passwordHash?: string } = {}

    if (input.email) {
      updateData.email = input.email
    }

    if (input.password) {
      updateData.passwordHash = await hashPassword(input.password)
    }

    const user = await userRepository.update(id, updateData)
    return toUserResponse(user)
  },

  async delete(id: string): Promise<void> {
    const existing = await userRepository.findById(id)
    if (!existing) {
      throw Errors.notFound('Utilisateur')
    }

    await userRepository.delete(id)
  },

  async countBySite(siteId: string): Promise<number> {
    return userRepository.countBySiteId(siteId)
  },
}
