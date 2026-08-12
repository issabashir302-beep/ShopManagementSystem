import { rateLimit } from 'express-rate-limit'

function createLimiter(limit, message) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler(req, res) {
      res.status(429).json({
        success: false,
        error: { code: 'RATE_LIMITED', message },
        requestId: req.requestId
      })
    }
  })
}

export function createRateLimiters() {
  return {
    auth: createLimiter(20, 'Too many authentication attempts; try again later'),
    sensitiveWrite: createLimiter(60, 'Too many sensitive requests; try again later')
  }
}

export function onlyMethods(methods, middleware) {
  const allowedMethods = new Set(methods)
  return (req, res, next) => (allowedMethods.has(req.method) ? middleware(req, res, next) : next())
}
