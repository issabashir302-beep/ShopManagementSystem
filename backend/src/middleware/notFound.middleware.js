import { AppError } from '../errors/AppError.js'

export function notFoundMiddleware(req, _res, next) {
  next(AppError.notFound('ROUTE_NOT_FOUND', `Route ${req.method} ${req.originalUrl} was not found`))
}
