import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
})

export const clientLoginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
  siteId: z.string().uuid('Site ID invalide'),
})

export type LoginInput = z.infer<typeof loginSchema>
export type ClientLoginInput = z.infer<typeof clientLoginSchema>
