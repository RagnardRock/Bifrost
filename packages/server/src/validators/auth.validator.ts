import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
})

export const setupSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Mot de passe minimum 8 caractères'),
  setupToken: z.string().min(1, 'Token de setup requis'),
})

export type LoginInput = z.infer<typeof loginSchema>
export type SetupInput = z.infer<typeof setupSchema>
