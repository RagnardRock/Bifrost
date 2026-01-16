/**
 * Admin (developer) who manages Bifrost
 */
export interface Admin {
  id: string
  email: string
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
}
