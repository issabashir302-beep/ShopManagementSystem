import { AppError } from '../../errors/AppError.js'

const FIELDS =
  'id, shop_id, name, sku, barcode, category, unit, buying_price, selling_price, low_stock_threshold, is_active, created_at, updated_at, deleted_at'

function productError(error) {
  if (error?.code === '23505') {
    const detail = `${error.message || ''} ${error.details || ''}`.toLowerCase()
    if (detail.includes('barcode'))
      return AppError.conflict('BARCODE_ALREADY_EXISTS', 'This barcode is already assigned to another product in this shop')
    if (detail.includes('sku'))
      return AppError.conflict('SKU_ALREADY_EXISTS', 'This SKU is already assigned to another product in this shop')
    return AppError.conflict('PRODUCT_ALREADY_EXISTS', 'SKU or barcode already exists in this shop')
  }
  if (error?.code === '42501') return AppError.forbidden()
  if (error?.code === '23514')
    return AppError.badRequest('INVALID_PRODUCT', 'Product violates a database constraint')
  return new AppError(500, 'PRODUCT_QUERY_FAILED', 'Unable to access product information')
}

export class ProductRepository {
  constructor(forAccessToken) {
    this.forAccessToken = forAccessToken
  }

  async create(shopId, input, token) {
    const { data, error } = await this.forAccessToken(token)
      .from('products')
      .insert({ ...input, shop_id: shopId })
      .select(FIELDS)
      .single()
    if (error) throw productError(error)
    return data
  }

  async list(shopId, filters, token) {
    const from = (filters.page - 1) * filters.pageSize
    let query = this.forAccessToken(token)
      .from('products')
      .select(FIELDS, { count: 'exact' })
      .eq('shop_id', shopId)
    if (filters.status === 'active') query = query.eq('is_active', true).is('deleted_at', null)
    if (filters.status === 'archived') query = query.or('is_active.eq.false,deleted_at.not.is.null')
    if (filters.category) query = query.eq('category', filters.category)
    if (filters.search) {
      const term = `*${filters.search}*`
      query = query.or(`name.ilike.${term},sku.ilike.${term},barcode.ilike.${term}`)
    }
    const { data, error, count } = await query
      .order('name')
      .range(from, from + filters.pageSize - 1)
    if (error) throw productError(error)
    return { rows: data ?? [], count: count ?? 0 }
  }

  async findById(shopId, productId, token, { activeOnly = false } = {}) {
    let query = this.forAccessToken(token)
      .from('products')
      .select(FIELDS)
      .eq('shop_id', shopId)
      .eq('id', productId)
    if (activeOnly) query = query.eq('is_active', true).is('deleted_at', null)
    const { data, error } = await query.maybeSingle()
    if (error) throw productError(error)
    return data
  }

  async update(shopId, productId, changes, token) {
    const { data, error } = await this.forAccessToken(token)
      .from('products')
      .update(changes)
      .eq('shop_id', shopId)
      .eq('id', productId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .select(FIELDS)
      .maybeSingle()
    if (error) throw productError(error)
    return data
  }

  async archive(shopId, productId, token) {
    const { data, error } = await this.forAccessToken(token)
      .from('products')
      .update({ is_active: false, deleted_at: new Date().toISOString() })
      .eq('shop_id', shopId)
      .eq('id', productId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .select(FIELDS)
      .maybeSingle()
    if (error) throw productError(error)
    return data
  }

  async restore(shopId, productId, token) {
    const { data, error } = await this.forAccessToken(token)
      .from('products')
      .update({ is_active: true, deleted_at: null })
      .eq('shop_id', shopId)
      .eq('id', productId)
      .eq('is_active', false)
      .select(FIELDS)
      .maybeSingle()
    if (error) throw productError(error)
    return data
  }
}
