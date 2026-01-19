import { adminRepository } from '../repositories/admin.repository'
import { userRepository } from '../repositories/user.repository'
import { siteRepository } from '../repositories/site.repository'
import { comparePassword, hashPassword } from '../utils/hash'
import { signToken } from '../utils/jwt'
import { Errors } from '../utils/errors'
import type { LoginResponse, TokenPayload, BifrostSchema } from '@bifrost/shared'

export const authService = {
  async adminLogin(email: string, password: string): Promise<LoginResponse> {
    // Find admin by email
    const admin = await adminRepository.findByEmail(email)

    if (!admin) {
      throw Errors.unauthorized('Email ou mot de passe incorrect')
    }

    // Verify password
    const isValid = await comparePassword(password, admin.passwordHash)

    if (!isValid) {
      throw Errors.unauthorized('Email ou mot de passe incorrect')
    }

    // Generate JWT
    const payload: Omit<TokenPayload, 'iat' | 'exp'> = {
      adminId: admin.id,
      role: 'admin',
    }

    const token = signToken(payload)

    // Calculate expiry (7 days from now)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    return {
      token,
      expiresAt,
      user: {
        id: admin.id,
        email: admin.email,
        createdAt: admin.createdAt,
        updatedAt: admin.updatedAt,
      },
    }
  },

  async getAdminById(id: string) {
    const admin = await adminRepository.findById(id)

    if (!admin) {
      throw Errors.notFound('Admin')
    }

    return {
      id: admin.id,
      email: admin.email,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
    }
  },

  async clientLogin(email: string, password: string, siteId: string): Promise<LoginResponse> {
    // Find user by email and site
    const user = await userRepository.findByEmailAndSite(email, siteId)

    if (!user) {
      throw Errors.unauthorized('Email ou mot de passe incorrect')
    }

    // Verify password
    const isValid = await comparePassword(password, user.passwordHash)

    if (!isValid) {
      throw Errors.unauthorized('Email ou mot de passe incorrect')
    }

    // Get site info
    const site = await siteRepository.findById(siteId)
    if (!site) {
      throw Errors.notFound('Site')
    }

    // Generate JWT (24h for clients)
    const payload: Omit<TokenPayload, 'iat' | 'exp'> = {
      userId: user.id,
      siteId: user.siteId,
      role: 'client',
    }

    const token = signToken(payload)

    // Calculate expiry (24h from now)
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24)

    return {
      token,
      expiresAt,
      user: {
        id: user.id,
        email: user.email,
        siteId: user.siteId,
        site: {
          id: site.id,
          name: site.name,
          schema: site.schema as BifrostSchema | null,
        },
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    }
  },

  async getUserById(id: string) {
    const user = await userRepository.findById(id)

    if (!user) {
      throw Errors.notFound('Utilisateur')
    }

    const site = await siteRepository.findById(user.siteId)

    return {
      id: user.id,
      email: user.email,
      siteId: user.siteId,
      siteName: site?.name,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }
  },

  async setup(email: string, password: string, setupToken: string): Promise<LoginResponse> {
    // Verify setup token from environment
    const expectedToken = process.env.SETUP_TOKEN
    if (!expectedToken) {
      throw Errors.forbidden('Setup désactivé (SETUP_TOKEN non configuré)')
    }

    if (setupToken !== expectedToken) {
      throw Errors.forbidden('Token de setup invalide')
    }

    // Check if admin already exists
    const adminCount = await adminRepository.count()
    if (adminCount > 0) {
      throw Errors.forbidden('Un admin existe déjà. Setup désactivé.')
    }

    // Create admin
    const passwordHash = await hashPassword(password)
    const admin = await adminRepository.create(email, passwordHash)

    // Generate JWT and return same response as login
    const payload: Omit<TokenPayload, 'iat' | 'exp'> = {
      adminId: admin.id,
      role: 'admin',
    }

    const token = signToken(payload)

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    return {
      token,
      expiresAt,
      user: {
        id: admin.id,
        email: admin.email,
        createdAt: admin.createdAt,
        updatedAt: admin.updatedAt,
      },
    }
  },
}
