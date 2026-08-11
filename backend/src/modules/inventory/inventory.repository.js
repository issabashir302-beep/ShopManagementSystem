import { AppError } from '../../errors/AppError.js'

const PRODUCT_FIELDS =
  'id, name, sku, barcode, category, unit, low_stock_threshold, is_active, deleted_at'
const MOVEMENT_FIELDS =
  'id, product_id, movement_type, quantity_change, quantity_before, quantity_after, reference_type, reference_id, reason, created_by, created_at'

function inventoryError(error) {
  const message = error?.message ?? ''
  if (message.includes('Owner access required')) return AppError.forbidden('Owner access required')
  if (message.includes('Insufficient stock') || message.includes('cannot become negative')) {
    return AppError.unprocessable('INSUFFICIENT_STOCK', 'Inventory balance cannot become negative')
  }
  if (message.includes('Initial stock has already')) {
    return AppError.conflict('INITIAL_STOCK_ALREADY_SET', 'Initial stock has already been recorded')
  }
  if (message.includes('Product or inventory balance not found')) {
    return AppError.notFound('INVENTORY_NOT_FOUND', 'Product inventory was not found')
  }
  if (message.includes('Unsupported manual') || message.includes('requires a')) {
    return AppError.badRequest('INVALID_STOCK_ADJUSTMENT', 'Invalid stock adjustment')
  }
  if (error?.code === '42501') return AppError.forbidden()
  return new AppError(500, 'INVENTORY_QUERY_FAILED', 'Unable to access inventory information')
}

export class InventoryRepository {
  constructor(forAccessToken) {
    this.forAccessToken = forAccessToken
  }

  async list(shopId, filters, token) {
    const from = (filters.page - 1) * filters.pageSize
    let productsQuery = this.forAccessToken(token)
      .from('products')
      .select(PRODUCT_FIELDS, { count: 'exact' })
      .eq('shop_id', shopId)
      .eq('is_active', true)
      .is('deleted_at', null)
    if (filters.category) productsQuery = productsQuery.eq('category', filters.category)
    if (filters.search) {
      const term = `*${filters.search}*`
      productsQuery = productsQuery.or(`name.ilike.${term},sku.ilike.${term},barcode.ilike.${term}`)
    }
    const productsResult = await productsQuery
      .order('name')
      .range(from, from + filters.pageSize - 1)
    if (productsResult.error) throw inventoryError(productsResult.error)
    const products = productsResult.data ?? []
    if (products.length === 0) return { rows: [], count: productsResult.count ?? 0 }

    const { data: balances, error } = await this.forAccessToken(token)
      .from('inventory')
      .select('product_id, quantity, updated_at')
      .in(
        'product_id',
        products.map((product) => product.id)
      )
    if (error) throw inventoryError(error)
    const balancesByProduct = new Map(
      (balances ?? []).map((balance) => [balance.product_id, balance])
    )
    return {
      rows: products.map((product) => ({
        product,
        balance: balancesByProduct.get(product.id) ?? null
      })),
      count: productsResult.count ?? 0
    }
  }

  async findProduct(shopId, productId, token, activeOnly) {
    let query = this.forAccessToken(token)
      .from('products')
      .select(PRODUCT_FIELDS)
      .eq('shop_id', shopId)
      .eq('id', productId)
    if (activeOnly) query = query.eq('is_active', true).is('deleted_at', null)
    const { data, error } = await query.maybeSingle()
    if (error) throw inventoryError(error)
    return data
  }

  async findBalance(productId, token) {
    const { data, error } = await this.forAccessToken(token)
      .from('inventory')
      .select('product_id, quantity, updated_at')
      .eq('product_id', productId)
      .maybeSingle()
    if (error) throw inventoryError(error)
    return data
  }

  async lowStock(shopId, filters, token) {
    const from = (filters.page - 1) * filters.pageSize
    const { data, error, count } = await this.forAccessToken(token)
      .from('low_stock_alerts')
      .select(
        'shop_id, product_id, name, sku, barcode, unit, quantity, low_stock_threshold, updated_at',
        {
          count: 'exact'
        }
      )
      .eq('shop_id', shopId)
      .order('name')
      .range(from, from + filters.pageSize - 1)
    if (error) throw inventoryError(error)
    return { rows: data ?? [], count: count ?? 0 }
  }

  async movements(shopId, productId, filters, token) {
    const from = (filters.page - 1) * filters.pageSize
    const { data, error, count } = await this.forAccessToken(token)
      .from('inventory_movements')
      .select(MOVEMENT_FIELDS, { count: 'exact' })
      .eq('shop_id', shopId)
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .range(from, from + filters.pageSize - 1)
    if (error) throw inventoryError(error)
    return { rows: data ?? [], count: count ?? 0 }
  }

  async adjust(productId, adjustment, token) {
    const { data, error } = await this.forAccessToken(token).rpc('adjust_inventory', {
      p_product_id: productId,
      p_quantity_change: adjustment.quantityChange,
      p_movement_type: adjustment.movementType,
      p_reason: adjustment.reason,
      p_reference_id: adjustment.referenceId
    })
    if (error) throw inventoryError(error)
    return Array.isArray(data) ? data[0] : data
  }
}
