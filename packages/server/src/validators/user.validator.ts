import { z } from 'zod'

export const createUserSchema = z.object({
  email: z
    .string()
    .email('Email invalide')
    .max(255, "L'email ne peut pas dépasser 255 caractères"),
  password: z
    .string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
    .max(100, 'Le mot de passe ne peut pas dépasser 100 caractères'),
})

export const updateUserSchema = z.object({
  email: z
    .string()
    .email('Email invalide')
    .max(255, "L'email ne peut pas dépasser 255 caractères")
    .optional(),
  password: z
    .string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
    .max(100, 'Le mot de passe ne peut pas dépasser 100 caractères')
    .optional(),
})

export type CreateUserDto = z.infer<typeof createUserSchema>
export type UpdateUserDto = z.infer<typeof updateUserSchema>
