/**
 * Admin (developer) who manages Bifrost
 */
export interface Admin {
  id: string
  email: string
  /** Double authentification obligatoire pas encore activée : seul « Mon compte » est ouvert */
  doubleAuthAActiver?: boolean
  createdAt: Date
  updatedAt: Date
}

export interface AdminCreateInput {
  email: string
  password: string
}

export interface AdminLoginInput {
  email: string
  password: string
  /** Code de double authentification, si elle est active */
  code?: string
}
