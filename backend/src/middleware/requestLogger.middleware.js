export function requestLoggerMiddleware(logger) {
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
