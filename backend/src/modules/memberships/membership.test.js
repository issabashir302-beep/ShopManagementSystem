import assert from 'node:assert/strict'
import { afterEach, before, describe, it } from 'node:test'
import { MembershipRepository } from './membership.repository.js'
import { MembershipService } from './membership.service.js'
import { startTestServer } from '../../../tests/helpers/testServer.js'

before(() => { process.env.NODE_ENV = 'test' })
const OWNER = { userId: '10000000-0000-4000-8000-000000000001', token: 'token' }
const KEEPER_ID = '20000000-0000-4000-8000-000000000002'
const shop = { id: '30000000-0000-4000-8000-000000000003', owner_id: OWNER.userId }
const membership = { id: '40000000-0000-4000-8000-000000000004', shop_id: shop.id, user_id: KEEPER_ID, role: 'shopkeeper', is_active: true, created_at: 'now', updated_at: 'now' }
const profile = { id: KEEPER_ID, full_name: 'Cashier', email: 'cashier@example.com', phone: null, username: null, user_role: 'shopkeeper', created_at: 'now' }

function fixture({ callerRole = 'owner', ownedMembership = membership, createMembershipError } = {}) {
  let cleanup = 0
  let status
  const repository = {
    async createAuthUser() { return { id: KEEPER_ID } },
    async findProfileAdmin() { return profile },
    async createMembership() { if (createMembershipError) throw createMembershipError; return membership },
    async cleanupCreatedUser() { cleanup += 1; return { error: null } },
    async listMemberships() { return ownedMembership ? [ownedMembership] : [] },
    async listProfiles() { return ownedMembership ? [profile] : [] },
    async findMembership() { return ownedMembership },
    async updateProfileAdmin(_id, changes) { return { ...profile, ...changes } },
    async updateStatus(_id, isActive) { status = isActive; return { ...membership, is_active: isActive } },
    async sendPasswordReset(email) { assert.equal(email, profile.email) }
  }
  return {
    service: new MembershipService({
      membershipRepository: repository,
      shopService: { async getCurrentShopContext() {
        return { shop, membership: { role: callerRole } }
      } },
      logger: { info() {}, error() {} }
    }),
    cleanup: () => cleanup,
    status: () => status
  }
}

describe('MembershipService', () => {
  it('creates a shopkeeper linked to the owner shop with fixed role', async () => {
    const { service } = fixture()
    const result = await service.create(OWNER, { email: profile.email, password: 'Password123' }, 'req')
    assert.equal(result.userRole, 'shopkeeper')
    assert.equal(result.membershipId, membership.id)
  })

  it('rejects shopkeeper staff management', async () => {
    const { service } = fixture({ callerRole: 'shopkeeper' })
    await assert.rejects(() => service.list(OWNER), { code: 'FORBIDDEN' })
  })

  it('compensates Auth/profile creation when membership setup fails', async () => {
    const fixtureValue = fixture({ createMembershipError: new Error('membership failed') })
    await assert.rejects(() => fixtureValue.service.create(OWNER, { email: profile.email, password: 'Password123' }, 'req'))
    assert.equal(fixtureValue.cleanup(), 1)
  })

  it('does not expose another shop membership', async () => {
    const { service } = fixture({ ownedMembership: null })
    await assert.rejects(() => service.get(OWNER, KEEPER_ID), { code: 'SHOPKEEPER_NOT_FOUND' })
  })

  it('updates only supplied safe profile fields', async () => {
    const { service } = fixture()
    const result = await service.update(OWNER, KEEPER_ID, { full_name: 'New Cashier' }, 'req')
    assert.equal(result.fullName, 'New Cashier')
    assert.equal(result.userRole, 'shopkeeper')
  })

  it('deactivates/reactivates canonical membership access', async () => {
    const value = fixture()
    assert.equal((await value.service.updateStatus(OWNER, KEEPER_ID, false, 'req')).isActive, false)
    assert.equal(value.status(), false)
    assert.equal((await value.service.updateStatus(OWNER, KEEPER_ID, true, 'req')).isActive, true)
  })

  it('initiates provider-supported recovery without returning credentials', async () => {
    const { service } = fixture()
    const result = await service.resetPassword(OWNER, KEEPER_ID, 'req')
    assert.deepEqual(result, { message: 'Password reset instructions were requested' })
    assert.equal(JSON.stringify(result).includes('password'), false)
  })
})

describe('MembershipRepository Auth contract', () => {
  it('forces trusted shopkeeper app metadata', async () => {
    let attributes
    const repository = new MembershipRepository({
      forAccessToken() {},
      adminClient: { auth: { admin: { async createUser(input) {
        attributes = input
        return { data: { user: { id: KEEPER_ID } }, error: null }
      } } } }
    })
    await repository.createAuthUser({ email: profile.email, password: 'Password123', fullName: 'Cashier' })
    assert.equal(attributes.app_metadata.user_role, 'shopkeeper')
    assert.equal(attributes.email_confirm, true)
  })
})

describe('shopkeeper API security', () => {
  let server
  afterEach(async () => { if (server) await server.close(); server = null })

  it('requires authentication', async () => {
    server = await startTestServer()
    assert.equal((await server.request('/api/v1/shopkeepers')).response.status, 401)
  })

  for (const field of ['role', 'userRole', 'shopId', 'shop_id', 'isActive']) {
    it(`rejects creation field ${field}`, async () => {
      server = await startTestServer()
      const result = await server.request('/api/v1/shopkeepers', {
        method: 'POST', token: 'valid-token',
        body: { email: 'cashier@example.com', password: 'Password123', fullName: 'Cashier', [field]: 'owner' }
      })
      assert.equal(result.response.status, 400)
    })
  }

  for (const field of ['userRole', 'user_role', 'shopId', 'shop_id', 'id', 'deletedAt']) {
    it(`rejects shopkeeper update field ${field}`, async () => {
      server = await startTestServer()
      const result = await server.request(`/api/v1/shopkeepers/${KEEPER_ID}`, {
        method: 'PATCH', token: 'valid-token', body: { [field]: 'malicious' }
      })
      assert.equal(result.response.status, 400)
    })
  }
})
