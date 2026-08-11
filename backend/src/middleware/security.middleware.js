export function securityHeadersMiddleware(nodeEnv) {
  return (_req, res, next) => {
    res.setHeader('x-content-type-options', 'nosniff')
    res.setHeader('x-frame-options', 'DENY')
    res.setHeader('referrer-policy', 'no-referrer')
    res.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()')
    res.setHeader('content-security-policy', "default-src 'none'; frame-ancestors 'none'")
    if (nodeEnv === 'production') {
      res.setHeader('strict-transport-security', 'max-age=31536000; includeSubDomains')
    }
    next()
  }
}
