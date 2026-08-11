import { randomUUID } from 'node:crypto'

const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,100}$/

export function requestIdMiddleware(req, res, next) {
  const supplied = req.get('x-request-id')
  req.requestId = supplied && SAFE_REQUEST_ID.test(supplied) ? supplied : randomUUID()
  res.setHeader('x-request-id', req.requestId)
  next()
}
