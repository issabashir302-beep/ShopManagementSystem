import { AppError } from '../errors/AppError.js'

export function errorMiddleware({ logger, nodeEnv }) {
  return (error, req, res, _next) => {
    const parseError = error?.type === 'entity.parse.failed'
    const normalized = parseError
      ? AppError.badRequest('INVALID_JSON', 'Request body contains invalid JSON')
      : error
    const operational = normalized instanceof AppError
    const statusCode = operational ? normalized.statusCode : 500
    const code = operational ? normalized.code : 'INTERNAL_SERVER_ERROR'
    const message = operational ? normalized.message : 'An unexpected error occurred'

    logger.error('request_failed', {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      status: statusCode,
      error: normalized
    })

    const body = {
      success: false,
      error: {
        code,
        message,
        ...(operational && normalized.details ? { details: normalized.details } : {}),
        ...(!operational && nodeEnv === 'development' ? { stack: normalized.stack } : {})
      },
      requestId: req.requestId
    }

    res.status(statusCode).json(body)
  }
}
