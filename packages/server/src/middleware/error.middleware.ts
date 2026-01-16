import type { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { AppError } from '../utils/errors'
import { error } from '../utils/response'
import { logger } from '../utils/logger'

export function errorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  // Log error
  logger.error({ err, path: req.path, method: req.method }, 'Request error')

  // Handle AppError
  if (err instanceof AppError) {
    return res.status(err.statusCode).json(error(err.code, err.message, err.details))
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json(
      error('VALIDATION_ERROR', 'Données invalides', err.flatten().fieldErrors)
    )
  }

  // Unknown errors
  res.status(500).json(error('INTERNAL_ERROR', 'Une erreur interne est survenue'))
}
