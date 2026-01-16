export class AppError extends Error {
  constructor(
    public code: string,
    public override message: string,
    public statusCode: number = 400,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'AppError'
  }
}

// Common errors
export const Errors = {
  unauthorized: (message = 'Non autorisé') => new AppError('UNAUTHORIZED', message, 401),
  forbidden: (message = 'Accès interdit') => new AppError('FORBIDDEN', message, 403),
  notFound: (resource = 'Ressource') => new AppError('NOT_FOUND', `${resource} non trouvé`, 404),
  validation: (details: Record<string, unknown>) =>
    new AppError('VALIDATION_ERROR', 'Données invalides', 400, details),
  rateLimited: () => new AppError('RATE_LIMITED', 'Trop de requêtes, réessayez plus tard', 429),
} as const
