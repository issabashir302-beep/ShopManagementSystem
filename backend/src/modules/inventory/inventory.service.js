import { AppError } from '../../errors/AppError.js'

function publicInventory(product, balance) {
  if (!balance) throw new AppError(500, 'INVENTORY_INCONSISTENT', 'Product inventory balance is missing')
  return {
    productId: product.id,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    category: product.category,
    unit: product.unit,
    quantity: balance.quantity,
    lowStockThreshold: product.low_stock_threshold,
    isLowStock: Number(balance.quantity) <= Number(product.low_stock_threshold),
    updatedAt: balance.updated_at
  }
}

function publicLowStock(row) {
  return {
    productId: row.product_id, name: row.name, sku: row.sku, barcode: row.barcode, unit: row.unit,
    quantity: row.quantity, lowStockThreshold: row.low_stock_threshold, isLowStock: true,
    updatedAt: row.updated_at
  }
}

function publicMovement(row) {
  return {
    id: row.id,
    productId: row.product_id,
    movementType: row.movement_type,
    quantityChange: row.quantity_change,
    quantityBefore: row.quantity_before,
    quantityAfter: row.quantity_after,
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    reason: row.reason,
    createdBy: row.created_by,
    createdAt: row.created_at
  }
}

function paginated(rows, count, filters, mapper) {
  return {
    items: rows.map(mapper),
    pagination: {
      page: filters.page, pageSize: filters.pageSize, total: count,
      totalPages: Math.ceil(count / filters.pageSize)
    }
  }
}

export class InventoryService {
  constructor({ inventoryRepository, shopService, logger }) {
    this.inventoryRepository = inventoryRepository
    this.shopService = shopService
    this.logger = logger
  }

  async context(auth) { return this.shopService.getCurrentShopContext(auth) }

  async list(auth, filters) {
    const context = await this.context(auth)
    const result = await this.inventoryRepository.list(context.shop.id, filters, auth.token)
    return paginated(result.rows, result.count, filters, (row) => publicInventory(row.product, row.balance))
  }

  async lowStock(auth, filters) {
    const context = await this.context(auth)
    const result = await this.inventoryRepository.lowStock(context.shop.id, filters, auth.token)
    return paginated(result.rows, result.count, filters, publicLowStock)
  }

  async requireProduct(auth, productId, context) {
    const product = await this.inventoryRepository.findProduct(
      context.shop.id, productId, auth.token, context.membership.role !== 'owner'
    )
    if (!product) throw AppError.notFound('PRODUCT_NOT_FOUND', 'Product was not found')
    return product
  }

  async get(auth, productId) {
    const context = await this.context(auth)
    const product = await this.requireProduct(auth, productId, context)
    const balance = await this.inventoryRepository.findBalance(productId, auth.token)
    if (!balance) throw AppError.notFound('INVENTORY_NOT_FOUND', 'Product inventory was not found')
    return publicInventory(product, balance)
  }

  async movements(auth, productId, filters) {
    const context = await this.context(auth)
    await this.requireProduct(auth, productId, context)
    const result = await this.inventoryRepository.movements(context.shop.id, productId, filters, auth.token)
    return paginated(result.rows, result.count, filters, publicMovement)
  }

  async adjust(auth, productId, adjustment, requestId) {
    const context = await this.context(auth)
    if (context.membership.role !== 'owner' || context.shop.owner_id !== auth.userId) {
      throw AppError.forbidden('Only the owner can adjust inventory')
    }
    const product = await this.inventoryRepository.findProduct(context.shop.id, productId, auth.token, true)
    if (!product) throw AppError.notFound('PRODUCT_NOT_FOUND', 'Product was not found')
    const balance = await this.inventoryRepository.adjust(productId, adjustment, auth.token)
    this.logger.info('inventory_adjusted', {
      requestId, shopId: context.shop.id, productId, movementType: adjustment.movementType
    })
    return publicInventory(product, balance)
  }
}
