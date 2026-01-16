import jwt from 'jsonwebtoken'
import { config } from '../config'
import type { TokenPayload } from '@bifrost/shared'

export function signToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): string {
  const expiresIn = payload.role === 'admin' ? config.jwtAdminExpiry : config.jwtClientExpiry
  return jwt.sign(payload, config.jwtSecret, { expiresIn })
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwtSecret) as TokenPayload
}

export function decodeToken(token: string): TokenPayload | null {
  try {
    return jwt.decode(token) as TokenPayload
  } catch {
    return null
  }
}
