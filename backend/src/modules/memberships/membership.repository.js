import { AppError } from '../../errors/AppError.js'

function membershipError(error) {
  if (error?.code === '23505')
    return AppError.conflict('SHOPKEEPER_ALREADY_EXISTS', 'Shopkeeper already belongs to this shop')
  const mapped =
    error?.code === '42501'
      ? AppError.forbidden()
      : new AppError(500, 'MEMBERSHIP_QUERY_FAILED', 'Unable to access shopkeeper information')
  mapped.cause = error
  return mapped
}

export class MembershipRepository {
  constructor({ forAccessToken, adminClient }) {
    this.forAccessToken = forAccessToken
    this.adminClient = adminClient
  }

  async createAuthUser(input) {
    const { data, error } = await this.adminClient.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      app_metadata: { user_role: 'shopkeeper' },
      user_metadata: {
        full_name: input.fullName,
        ...(input.phone ? { phone: input.phone } : {}),
        ...(input.username ? { username: input.username } : {})
      }
    })
    if (error || !data.user) {
      if (error?.message?.toLowerCase().includes('already')) {
        throw AppError.conflict(
          'SHOPKEEPER_ACCOUNT_EXISTS',
          'An account with this email already exists'
        )
      }
      throw AppError.badRequest(
        'SHOPKEEPER_AUTH_CREATION_FAILED',
        'Unable to create shopkeeper account'
      )
    }
    return data.user
  }

  async findProfileAdmin(userId) {
    const { data, error } = await this.adminClient
      .from('users')
      .select('id, full_name, email, phone, username, user_role, created_at')
      .eq('id', userId)
      .maybeSingle()
    if (error) throw membershipError(error)
    return data
  }

  async reconcileShopkeeperProfile(userId, input) {
    const { data, error } = await this.adminClient
      .from('users')
      .update({
        user_role: 'shopkeeper',
        full_name: input.fullName,
        email: input.email,
        phone: input.phone ?? null,
        username: input.username ?? null
      })
      .eq('id', userId)
      .is('deleted_at', null)
      .select('id, full_name, email, phone, username, user_role, created_at')
      .maybeSingle()
    if (error) throw membershipError(error)
    return data
  }

  async createMembership(shopId, userId, accessToken) {
    const { data, error } = await this.forAccessToken(accessToken)
      .from('shop_memberships')
      .insert({ shop_id: shopId, user_id: userId, role: 'shopkeeper', is_active: true })
      .select('id, shop_id, user_id, role, is_active, created_at, updated_at')
      .single()
    if (error) throw membershipError(error)
    return data
  }

  async cleanupCreatedUser(userId) {
    const membership = await this.adminClient
      .from('shop_memberships')
      .delete()
      .eq('user_id', userId)
    const profile = await this.adminClient.from('users').delete().eq('id', userId)
    const auth = await this.adminClient.auth.admin.deleteUser(userId)
    return { error: membership.error || profile.error || auth.error || null }
  }

  async listMemberships(shopId, accessToken) {
    const { data, error } = await this.forAccessToken(accessToken)
      .from('shop_memberships')
      .select('id, shop_id, user_id, role, is_active, created_at, updated_at')
      .eq('shop_id', shopId)
      .eq('role', 'shopkeeper')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    if (error) throw membershipError(error)
    return data ?? []
  }

  async findMembership(shopId, userId, accessToken) {
    const { data, error } = await this.forAccessToken(accessToken)
      .from('shop_memberships')
      .select('id, shop_id, user_id, role, is_active, created_at, updated_at')
      .eq('shop_id', shopId)
      .eq('user_id', userId)
      .eq('role', 'shopkeeper')
      .is('deleted_at', null)
      .maybeSingle()
    if (error) throw membershipError(error)
    return data
  }

  async listProfiles(userIds, accessToken) {
    if (userIds.length === 0) return []
    const { data, error } = await this.forAccessToken(accessToken)
      .from('users')
      .select('id, full_name, email, phone, username, user_role, created_at')
      .in('id', userIds)
      .is('deleted_at', null)
    if (error) throw membershipError(error)
    return data ?? []
  }

  async updateProfileAdmin(userId, changes) {
    const { data, error } = await this.adminClient
      .from('users')
      .update(changes)
      .eq('id', userId)
      .eq('user_role', 'shopkeeper')
      .is('deleted_at', null)
      .select('id, full_name, email, phone, username, user_role, created_at')
      .maybeSingle()
    if (error) throw membershipError(error)
    return data
  }

  async updateStatus(membershipId, isActive, accessToken) {
    const { data, error } = await this.forAccessToken(accessToken)
      .from('shop_memberships')
      .update({ is_active: isActive })
      .eq('id', membershipId)
      .eq('role', 'shopkeeper')
      .select('id, shop_id, user_id, role, is_active, created_at, updated_at')
      .maybeSingle()
    if (error) throw membershipError(error)
    return data
  }

  async sendPasswordReset(email) {
    const { error } = await this.adminClient.auth.resetPasswordForEmail(email)
    if (error)
      throw AppError.badRequest('PASSWORD_RESET_FAILED', 'Unable to initiate password reset')
  }
}
