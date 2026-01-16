import { prisma } from '../config/database'
import type { User } from '@prisma/client'

export type CreateUserData = {
  email: string
  passwordHash: string
  siteId: string
}

export type UpdateUserData = {
  email?: string
  passwordHash?: string
}

export const userRepository = {
  async findBySiteId(siteId: string): Promise<User[]> {
    return prisma.user.findMany({
      where: { siteId },
      orderBy: { createdAt: 'desc' },
    })
  },

  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    })
  },

  async findByEmailAndSite(email: string, siteId: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: {
        siteId_email: { siteId, email },
      },
    })
  },

  async create(data: CreateUserData): Promise<User> {
    return prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        siteId: data.siteId,
      },
    })
  },

  async update(id: string, data: UpdateUserData): Promise<User> {
    return prisma.user.update({
      where: { id },
      data,
    })
  },

  async delete(id: string): Promise<void> {
    await prisma.user.delete({
      where: { id },
    })
  },

  async countBySiteId(siteId: string): Promise<number> {
    return prisma.user.count({
      where: { siteId },
    })
  },
}
