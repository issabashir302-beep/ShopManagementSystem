import assert from 'node:assert/strict'
import { afterEach, before, describe, it } from 'node:test'
import { UserService } from './user.service.js'
import { startTestServer } from '../../../tests/helpers/testServer.js'

before(() => { process.env.NODE_ENV = 'test' })

describe('users API', () => {
  let server
  afterEach(async () => { if (server) await server.close(); server = null })

  it('returns the authenticated profile', async () => {
    server = await startTestServer({ userService: {
      async getOwnProfile(auth) { return { id: auth.userId, userRole: 'owner' } },
      async updateOwnProfile() {}
    } })
    const result = await server.request('/api/v1/users/me', { token: 'valid-token' })
    assert.equal(result.response.status, 200)
    assert.deepEqual(result.body.data, { id: 'user-1', userRole: 'owner' })
  })

  it('rejects unauthenticated profile access', async () => {
    server = await startTestServer()
    const result = await server.request('/api/v1/users/me')
    assert.equal(result.response.status, 401)
  })

  it('maps and updates allowed profile fields', async () => {
    let changes
    server = await startTestServer({ userService: {
      async getOwnProfile() {},
      async updateOwnProfile(_auth, input) { changes = input; return input }
    } })
    const result = await server.request('/api/v1/users/me', {
      method: 'PATCH', token: 'valid-token',
      body: { fullName: 'New Name', phone: '+254 700 000 000', username: 'new.name', profileCompleted: true }
    })
    assert.equal(result.response.status, 200)
    assert.deepEqual(changes, {
      full_name: 'New Name', phone: '+254 700 000 000', username: 'new.name', profile_completed: true
    })
  })

  for (const field of ['id', 'email', 'userRole', 'user_role', 'deletedAt', 'deleted_at']) {
    it(`rejects protected profile field ${field}`, async () => {
      server = await startTestServer()
      const result = await server.request('/api/v1/users/me', {
        method: 'PATCH', token: 'valid-token', body: { [field]: 'malicious' }
      })
      assert.equal(result.response.status, 400)
      assert.equal(result.body.error.code, 'VALIDATION_ERROR')
    })
  }

  it('rejects invalid profile values', async () => {
    server = await startTestServer()
    const result = await server.request('/api/v1/users/me', {
      method: 'PATCH', token: 'valid-token', body: { username: 'bad username!' }
    })
    assert.equal(result.response.status, 400)
  })
})

describe('UserService', () => {
  it('never accepts a target user ID and reports a missing own profile', async () => {
    const repository = { async findById(id) { assert.equal(id, 'self'); return null } }
    const service = new UserService(repository)
    await assert.rejects(() => service.getOwnProfile({ userId: 'self', token: 'token' }), {
      code: 'PROFILE_NOT_FOUND'
    })
  })
})
