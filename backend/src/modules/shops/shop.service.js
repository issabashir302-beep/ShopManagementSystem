import { AppError } from '../../errors/AppError.js'

function toPublicShop(shop) {
  return {
    id: shop.id,
    ownerId: shop.owner_id,
    name: shop.name,
    type: shop.type,
    location: shop.location,
    address: shop.address,
    city: shop.city,
    country: shop.country,
    currency: shop.currency,
    createdAt: shop.created_at,
    updatedAt: shop.updated_at
  }
}

export class ShopService {
  constructor({ shopRepository, userRepository }) {
    this.shopRepository = shopRepository
    this.userRepository = userRepository
  }

  async requireProfile(auth) {
    const profile = await this.userRepository.findById(auth.userId, auth.token)
    if (!profile) throw AppError.notFound('PROFILE_NOT_FOUND', 'User profile was not found')
    return profile
  }

  async createShop(auth, input) {
    const profile = await this.requireProfile(auth)
    if (profile.user_role !== 'owner') throw AppError.forbidden('Only owners can create a shop')

    const existing = await this.shopRepository.findOwnedShops(auth.userId, auth.token)
    if (existing.length) throw AppError.conflict('SHOP_ALREADY_EXISTS', 'This owner already has a shop')

    const shop = await this.shopRepository.create({ ...input, owner_id: auth.userId }, auth.token)
    return toPublicShop(shop)
  }

  async getCurrentShopContext(auth) {
    await this.requireProfile(auth)
    const memberships = await this.shopRepository.findMemberships(auth.userId, auth.token)
    if (memberships.length === 0) throw AppError.notFound('SHOP_NOT_FOUND', 'No active shop is assigned to this user')
    if (memberships.length > 1) {
      throw AppError.conflict('MULTIPLE_SHOPS_NOT_SUPPORTED', 'MiniPOS supports one active shop per user')
    }

    const membership = memberships[0]
    const shop = await this.shopRepository.findShopById(membership.shop_id, auth.token)
    if (!shop) throw AppError.notFound('SHOP_NOT_FOUND', 'Assigned shop was not found')
    return { shop, membership }
  }

  async getCurrentShop(auth) {
    const { shop } = await this.getCurrentShopContext(auth)
    return toPublicShop(shop)
  }

  async updateCurrentShop(auth, changes) {
    const { shop, membership } = await this.getCurrentShopContext(auth)
    if (membership.role !== 'owner' || shop.owner_id !== auth.userId) {
      throw AppError.forbidden('Only the shop owner can update shop settings')
    }

    const updated = await this.shopRepository.update(shop.id, changes, auth.token)
    if (!updated) throw AppError.notFound('SHOP_NOT_FOUND', 'Shop was not found')
    return toPublicShop(updated)
  }
}
