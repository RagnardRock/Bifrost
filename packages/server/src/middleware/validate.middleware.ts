import type { Request, Response, NextFunction } from 'express'
import type { ZodSchema } from 'zod'
import { ZodError } from 'zod'

export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body)
      next()
    } catch (error) {
      if (error instanceof ZodError) {
        next(error)
      } else {
        next(error)
      }
    }
  }
}
