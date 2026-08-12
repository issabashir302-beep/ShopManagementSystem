import { AppError } from '../../errors/AppError.js'

function publicShopkeeper(membership, profile) {
  return {
    id: profile.id,
    membershipId: membership.id,
    fullName: profile.full_name,
    email: profile.email,
    phone: profile.phone,
    username: profile.username,
    userRole: profile.user_role,
    isActive: membership.is_active,
    createdAt: membership.created_at,
    updatedAt: membership.updated_at
  }
}

export class MembershipService {
  constructor({ membershipRepository, shopService, logger }) {
    this.membershipRepository = membershipRepository
    this.shopService = shopService
    this.logger = logger
  }

  async requireOwnerShop(auth) {
    const context = await this.shopService.getCurrentShopContext(auth)
    if (context.membership.role !== 'owner' || context.shop.owner_id !== auth.userId) {
      throw AppError.forbidden('Only the shop owner can manage shopkeepers')
    }
    return context.shop
  }

  async cleanup(userId, requestId) {
    try {
      const { error } = await this.membershipRepository.cleanupCreatedUser(userId)
      if (error) throw error
    } catch {
      this.logger.error('shopkeeper_creation_compensation_failed', { requestId, userId })
    }
  }

  async create(auth, input, requestId) {
    const shop = await this.requireOwnerShop(auth)
    const authUser = await this.membershipRepository.createAuthUser(input)

    try {
      const profile = await this.membershipRepository.reconcileShopkeeperProfile(authUser.id, input)
      if (!profile || profile.user_role !== 'shopkeeper') {
        throw new AppError(500, 'SHOPKEEPER_PROFILE_FAILED', 'Shopkeeper profile setup failed')
      }
      const membership = await this.membershipRepository.createMembership(
        shop.id,
        authUser.id,
        auth.token
      )
      this.logger.info('shopkeeper_created', {
        requestId,
        shopId: shop.id,
        shopkeeperId: authUser.id
      })
      return publicShopkeeper(membership, profile)
    } catch (error) {
      await this.cleanup(authUser.id, requestId)
      throw error
    }
  }

  async list(auth) {
    const shop = await this.requireOwnerShop(auth)
    const memberships = await this.membershipRepository.listMemberships(shop.id, auth.token)
    const profiles = await this.membershipRepository.listProfiles(
      memberships.map((item) => item.user_id),
      auth.token
    )
    const profileMap = new Map(profiles.map((profile) => [profile.id, profile]))
    return memberships
      .filter((membership) => profileMap.has(membership.user_id))
      .map((membership) => publicShopkeeper(membership, profileMap.get(membership.user_id)))
  }

  async requireOwnedShopkeeper(auth, shopkeeperId) {
    const shop = await this.requireOwnerShop(auth)
    const membership = await this.membershipRepository.findMembership(
      shop.id,
      shopkeeperId,
      auth.token
    )
    if (!membership) throw AppError.notFound('SHOPKEEPER_NOT_FOUND', 'Shopkeeper was not found')
    const profiles = await this.membershipRepository.listProfiles([shopkeeperId], auth.token)
    const profile = profiles[0]
    if (!profile || profile.user_role !== 'shopkeeper') {
      throw AppError.notFound('SHOPKEEPER_NOT_FOUND', 'Shopkeeper was not found')
    }
    return { shop, membership, profile }
  }

  async get(auth, shopkeeperId) {
    const { membership, profile } = await this.requireOwnedShopkeeper(auth, shopkeeperId)
    return publicShopkeeper(membership, profile)
  }

  async update(auth, shopkeeperId, changes, requestId) {
    const {
      shop,
      membership,
      profile: oldProfile
    } = await this.requireOwnedShopkeeper(auth, shopkeeperId)
    const profile = await this.membershipRepository.updateProfileAdmin(shopkeeperId, changes)
    if (!profile) throw AppError.notFound('SHOPKEEPER_NOT_FOUND', 'Shopkeeper was not found')
    this.logger.info('shopkeeper_profile_updated', { requestId, shopId: shop.id, shopkeeperId })
    return publicShopkeeper(membership, profile ?? oldProfile)
  }

  async updateStatus(auth, shopkeeperId, isActive, requestId) {
    const { shop, membership, profile } = await this.requireOwnedShopkeeper(auth, shopkeeperId)
    const updated = await this.membershipRepository.updateStatus(
      membership.id,
      isActive,
      auth.token
    )
    if (!updated) throw AppError.notFound('SHOPKEEPER_NOT_FOUND', 'Shopkeeper was not found')
    this.logger.info(isActive ? 'shopkeeper_activated' : 'shopkeeper_deactivated', {
      requestId,
      shopId: shop.id,
      shopkeeperId
    })
    return publicShopkeeper(updated, profile)
  }

  async resetPassword(auth, shopkeeperId, requestId) {
    const { shop, profile } = await this.requireOwnedShopkeeper(auth, shopkeeperId)
    if (!profile.email)
      throw AppError.unprocessable('SHOPKEEPER_EMAIL_MISSING', 'Shopkeeper has no reset email')
    await this.membershipRepository.sendPasswordReset(profile.email)
    this.logger.info('shopkeeper_password_reset_requested', {
      requestId,
      shopId: shop.id,
      shopkeeperId
    })
    return { message: 'Password reset instructions were requested' }
  }
}
