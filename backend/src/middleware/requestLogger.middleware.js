import morgan from 'morgan'

morgan.token('request-id', (req) => req.requestId ?? '-')

const DEVELOPMENT_FORMAT =
  ':method :url :status :response-time ms - :res[content-length] bytes [request :request-id]'

export function requestLoggerMiddleware({ logger, nodeEnv }) {
  if (nodeEnv === 'development') {
    return morgan(DEVELOPMENT_FORMAT)
  }

  return (req, res, next) => {
    const startedAt = process.hrtime.bigint()
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6
      logger.info('http_request', {
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: Number(durationMs.toFixed(2))
      })
    })
    next()
  }
}
