import assert from 'node:assert/strict'
import { afterEach, before, describe, it } from 'node:test'
import { AuthService } from './auth.service.js'
import { startTestServer } from '../../../tests/helpers/testServer.js'

before(() => {
  process.env.NODE_ENV = 'test'
})

describe('authentication API', () => {
  let server
  afterEach(async () => {
    if (server) await server.close()
    server = null
  })

  it('accepts valid owner signup without forwarding a role', async () => {
    let received
    server = await startTestServer({
      authService: {
        async signup(input) {
          received = input
          return { profile: { userRole: 'owner' } }
        },
        async verifyAccessToken() {
          return { id: 'user-1', email: 'x@example.com' }
        }
      }
    })
    const result = await server.request('/api/v1/auth/signup', {
      method: 'POST',
      body: { email: 'Owner@Example.com', password: 'password1', fullName: 'Shop Owner' }
    })
    assert.equal(result.response.status, 201)
    assert.equal(received.email, 'owner@example.com')
    assert.equal('role' in received, false)
    assert.equal(result.body.data.profile.userRole, 'owner')
  })

  for (const [name, body] of [
    ['invalid email', { email: 'bad', password: 'password1', fullName: 'Shop Owner' }],
    ['weak password', { email: 'a@example.com', password: 'password', fullName: 'Shop Owner' }],
    [
      'caller role',
      { email: 'a@example.com', password: 'password1', fullName: 'Shop Owner', role: 'owner' }
    ],
    [
      'caller userRole',
      {
        email: 'a@example.com',
        password: 'password1',
        fullName: 'Shop Owner',
        userRole: 'shopkeeper'
      }
    ]
  ]) {
    it(`rejects signup with ${name}`, async () => {
      server = await startTestServer()
      const result = await server.request('/api/v1/auth/signup', { method: 'POST', body })
      assert.equal(result.response.status, 400)
      assert.equal(result.body.error.code, 'VALIDATION_ERROR')
    })
  }

  it('rejects missing, malformed, and invalid authorization', async () => {
    server = await startTestServer()
    const missing = await server.request('/api/v1/auth/session')
    const malformed = await server.request('/api/v1/auth/session', {
      headers: { authorization: 'Basic abc' }
    })
    const invalid = await server.request('/api/v1/auth/session', { token: 'invalid' })
    assert.equal(missing.response.status, 401)
    assert.equal(malformed.response.status, 401)
    assert.equal(invalid.response.status, 401)
  })

  it('returns concise session identity for a verified token', async () => {
    server = await startTestServer()
    const result = await server.request('/api/v1/auth/session', { token: 'valid-token' })
    assert.equal(result.response.status, 200)
    assert.deepEqual(result.body.data.user, { id: 'user-1', email: 'owner@example.com' })
    assert.equal(result.body.requestId.length > 0, true)
  })

  it('requires authentication for logout and invokes server-side logout', async () => {
    let loggedOutToken
    server = await startTestServer({
      authService: {
        async verifyAccessToken(token) {
          return { id: 'user-1', email: 'a@example.com', token }
        },
        async logout(token) {
          loggedOutToken = token
          return { message: 'Session revoked' }
        }
      }
    })
    const missing = await server.request('/api/v1/auth/logout', { method: 'POST' })
    const valid = await server.request('/api/v1/auth/logout', {
      method: 'POST',
      token: 'valid-token'
    })
    assert.equal(missing.response.status, 401)
    assert.equal(valid.response.status, 200)
    assert.equal(loggedOutToken, 'valid-token')
  })
})

describe('AuthService signup consistency', () => {
  function service({ profile, profileError, cleanupError } = {}) {
    let cleanupCalls = 0
    const adminClient = {
      from() {
        return {
          select() {
            return this
          },
          eq() {
            return this
          },
          async maybeSingle() {
            return { data: profile, error: profileError }
          }
        }
      },
      auth: {
        admin: {
          async deleteUser() {
            cleanupCalls += 1
            return { error: cleanupError }
          }
        }
      }
    }
    return {
      instance: new AuthService({
        publicClient: {
          auth: {
            async signUp() {
              return {
                data: { user: { id: 'auth-1', email: 'a@example.com' }, session: null },
                error: null
              }
            }
          }
        },
        adminClient,
        forAccessToken() {},
        logger: { error() {} }
      }),
      cleanupCalls: () => cleanupCalls
    }
  }

  it('accepts the owner profile created by the database trigger', async () => {
    const { instance, cleanupCalls } = service({ profile: { id: 'auth-1', user_role: 'owner' } })
    const result = await instance.signup({
      email: 'a@example.com',
      password: 'password1',
      fullName: 'Owner'
    })
    assert.equal(result.profile.userRole, 'owner')
    assert.equal(cleanupCalls(), 0)
  })

  it('compensates when profile creation fails', async () => {
    const { instance, cleanupCalls } = service({ profile: null })
    await assert.rejects(
      () => instance.signup({ email: 'a@example.com', password: 'password1', fullName: 'Owner' }),
      {
        code: 'PROFILE_CREATION_FAILED'
      }
    )
    assert.equal(cleanupCalls(), 1)
  })

  it('returns only the selected session fields on login', async () => {
    const instance = new AuthService({
      publicClient: {
        auth: {
          async signInWithPassword() {
            return {
              data: {
                user: {
                  id: 'auth-1',
                  email: 'a@example.com',
                  user_metadata: { secret: 'not-returned' }
                },
                session: {
                  access_token: 'access',
                  refresh_token: 'refresh',
                  expires_at: 123,
                  token_type: 'bearer',
                  provider_token: 'not-returned'
                }
              },
              error: null
            }
          }
        }
      },
      adminClient: {},
      forAccessToken() {},
      logger: { error() {} }
    })
    const result = await instance.login({ email: 'a@example.com', password: 'wrong-not-logged' })
    assert.deepEqual(result.user, { id: 'auth-1', email: 'a@example.com' })
    assert.equal(result.session.accessToken, 'access')
    assert.equal('provider_token' in result.session, false)
    assert.equal(JSON.stringify(result).includes('password'), false)
    assert.equal(JSON.stringify(result).includes('not-returned'), false)
  })

  it('uses one safe error for incorrect password or unknown user', async () => {
    const instance = new AuthService({
      publicClient: {
        auth: {
          async signInWithPassword() {
            return { data: {}, error: { message: 'internal auth detail' } }
          }
        }
      },
      adminClient: {},
      forAccessToken() {},
      logger: { error() {} }
    })
    await assert.rejects(
      () => instance.login({ email: 'unknown@example.com', password: 'password1' }),
      {
        code: 'UNAUTHENTICATED',
        message: 'Invalid email or password'
      }
    )
  })
})
