import { z } from 'zod'

export const createSiteSchema = z.object({
  name: z
    .string()
    .min(1, 'Le nom est requis')
    .max(100, 'Le nom ne peut pas dépasser 100 caractères'),
  url: z
    .string()
    .url('URL invalide')
    .max(255, 'L\'URL ne peut pas dépasser 255 caractères'),
  webhookUrl: z
    .string()
    .url('URL de webhook invalide')
    .max(255, 'L\'URL de webhook ne peut pas dépasser 255 caractères')
    .optional()
    .or(z.literal('')),
})

export const updateSiteSchema = z.object({
  name: z
    .string()
    .min(1, 'Le nom est requis')
    .max(100, 'Le nom ne peut pas dépasser 100 caractères')
    .optional(),
  url: z
    .string()
    .url('URL invalide')
    .max(255, 'L\'URL ne peut pas dépasser 255 caractères')
    .optional(),
  webhookUrl: z
    .string()
    .url('URL de webhook invalide')
    .max(255, 'L\'URL de webhook ne peut pas dépasser 255 caractères')
    .optional()
    .nullable()
    .or(z.literal('')),
})

export type CreateSiteDto = z.infer<typeof createSiteSchema>
export type UpdateSiteDto = z.infer<typeof updateSiteSchema>
