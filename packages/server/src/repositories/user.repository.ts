import { prisma } from '../config/database'
import type { User } from '@prisma/client'

export const userRepository = {
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } })
  },
}
