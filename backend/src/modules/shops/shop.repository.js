import { AppError } from '../../errors/AppError.js'

const SHOP_FIELDS =
  'id, owner_id, name, type, location, address, city, country, currency, created_at, updated_at'

function shopError(error) {
  if (error?.code === '23505')
    return AppError.conflict('SHOP_ALREADY_EXISTS', 'This owner already has a shop')
  const mapped =
    error?.code === '42501'
      ? AppError.forbidden()
      : new AppError(500, 'SHOP_QUERY_FAILED', 'Unable to access shop information')
  mapped.cause = error
  return mapped
}

export class ShopRepository {
  constructor(forAccessToken) {
    this.forAccessToken = forAccessToken
  }

  async findOwnedShops(ownerId, accessToken) {
    const { data, error } = await this.forAccessToken(accessToken)
      .from('shops')
      .select(SHOP_FIELDS)
      .eq('owner_id', ownerId)
      .is('deleted_at', null)
      .limit(2)

    if (error) throw shopError(error)
    return data ?? []
  }

  async findMemberships(userId, accessToken) {
    const { data, error } = await this.forAccessToken(accessToken)
      .from('shop_memberships')
      .select('shop_id, role')
      .eq('user_id', userId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .limit(2)

    if (error) throw shopError(error)
    return data ?? []
  }

  async findShopById(shopId, accessToken) {
    const { data, error } = await this.forAccessToken(accessToken)
      .from('shops')
      .select(SHOP_FIELDS)
      .eq('id', shopId)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) throw shopError(error)
    return data
  }

  async create(shop, accessToken) {
    const { data, error } = await this.forAccessToken(accessToken)
      .from('shops')
      .insert(shop)
      .select(SHOP_FIELDS)
      .single()

    if (error) throw shopError(error)
    return data
  }

  async update(shopId, changes, accessToken) {
    const { data, error } = await this.forAccessToken(accessToken)
      .from('shops')
      .update(changes)
      .eq('id', shopId)
      .is('deleted_at', null)
      .select(SHOP_FIELDS)
      .maybeSingle()

    if (error) throw shopError(error)
    return data
  }
}
