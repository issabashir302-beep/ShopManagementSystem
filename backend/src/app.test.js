import assert from 'node:assert/strict'
import { afterEach, before, describe, it } from 'node:test'
import { startTestServer } from '../tests/helpers/testServer.js'

before(() => { process.env.NODE_ENV = 'test' })

describe('application foundation', () => {
  let server
  afterEach(async () => { if (server) await server.close(); server = null })

  it('serves health with a correlation ID and security headers', async () => {
    server = await startTestServer()
    const result = await server.request('/api/v1/health', { headers: { 'x-request-id': 'trace-123' } })
    assert.equal(result.response.status, 200)
    assert.equal(result.body.data.status, 'alive')
    assert.equal(result.body.requestId, 'trace-123')
    assert.equal(result.response.headers.get('x-content-type-options'), 'nosniff')
    assert.equal(result.response.headers.get('x-powered-by'), null)
  })

  it('reports readiness success and dependency failure safely', async () => {
    server = await startTestServer()
    const ready = await server.request('/api/v1/readiness')
    assert.equal(ready.response.status, 200)
    await server.close(); server = null

    server = await startTestServer({ readinessCheck: async () => { throw new Error('secret database detail') } })
    const unavailable = await server.request('/api/v1/readiness')
    assert.equal(unavailable.response.status, 503)
    assert.equal(unavailable.body.error.code, 'DEPENDENCY_UNAVAILABLE')
    assert.equal(JSON.stringify(unavailable.body).includes('secret database detail'), false)
  })

  it('returns a consistent 404 response', async () => {
    server = await startTestServer()
    const result = await server.request('/api/v1/not-real')
    assert.equal(result.response.status, 404)
    assert.equal(result.body.success, false)
    assert.equal(result.body.error.code, 'ROUTE_NOT_FOUND')
  })

  it('rejects disallowed browser origins', async () => {
    server = await startTestServer()
    const result = await server.request('/api/v1/health', { headers: { origin: 'https://evil.example' } })
    assert.equal(result.response.status, 403)
    assert.equal(result.body.error.code, 'FORBIDDEN')
  })
})
