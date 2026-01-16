import { api } from './api'
import type { User, ApiResponse } from '@bifrost/shared'

export interface CreateUserInput {
  email: string
  password: string
}

export interface UpdateUserInput {
  email?: string
  password?: string
}

export const usersService = {
  async listBySite(siteId: string): Promise<User[]> {
    const response = await api.get<unknown, ApiResponse<User[]>>(
      `/admin/sites/${siteId}/users`
    )
    return response.data
  },

  async getById(siteId: string, userId: string): Promise<User> {
    const response = await api.get<unknown, ApiResponse<User>>(
      `/admin/sites/${siteId}/users/${userId}`
    )
    return response.data
  },

  async create(siteId: string, input: CreateUserInput): Promise<User> {
    const response = await api.post<unknown, ApiResponse<User>>(
      `/admin/sites/${siteId}/users`,
      input
    )
    return response.data
  },

  async update(siteId: string, userId: string, input: UpdateUserInput): Promise<User> {
    const response = await api.put<unknown, ApiResponse<User>>(
      `/admin/sites/${siteId}/users/${userId}`,
      input
    )
    return response.data
  },

  async delete(siteId: string, userId: string): Promise<void> {
    await api.delete(`/admin/sites/${siteId}/users/${userId}`)
  },
}
