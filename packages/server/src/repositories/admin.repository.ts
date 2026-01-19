import { prisma } from '../config/database'
import type { Admin } from '@prisma/client'

export const adminRepository = {
  async findByEmail(email: string): Promise<Admin | null> {
    return prisma.admin.findUnique({
      where: { email },
    })
  },

  async findById(id: string): Promise<Admin | null> {
    return prisma.admin.findUnique({
      where: { id },
    })
  },

  async create(email: string, passwordHash: string): Promise<Admin> {
    return prisma.admin.create({
      data: { email, passwordHash },
    })
  },

  async count(): Promise<number> {
    return prisma.admin.count()
  },
}
