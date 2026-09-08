import { AppError } from '../../errors/AppError.js'
import { generateInternalBarcode } from './barcode.js'

function publicProduct(product) {
  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    category: product.category,
    unit: product.unit,
    buyingPrice: product.buying_price,
    sellingPrice: product.selling_price,
    lowStockThreshold: product.low_stock_threshold,
    isActive: product.is_active,
    createdAt: product.created_at,
    updatedAt: product.updated_at
  }
}

export class ProductService {
  constructor({ productRepository, shopService, logger }) {
    this.productRepository = productRepository
    this.shopService = shopService
    this.logger = logger
  }

  async context(auth) {
    return this.shopService.getCurrentShopContext(auth)
  }

  async create(auth, input, requestId) {
    const context = await this.context(auth)
    if (context.membership.role !== 'owner' || context.shop.owner_id !== auth.userId) {
      throw AppError.forbidden('Only the owner can create products')
    }
    const product = await this.productRepository.create(
      context.shop.id,
      { ...input, barcode: input.barcode || generateInternalBarcode() },
      auth.token
    )
    this.logger.info('product_created', {
      requestId,
      shopId: context.shop.id,
      productId: product.id
    })
    return publicProduct(product)
  }

  async list(auth, filters) {
    const context = await this.context(auth)
    if (context.membership.role !== 'owner' && filters.status !== 'active') {
      throw AppError.forbidden('Shopkeepers can only view active products')
    }
    const result = await this.productRepository.list(context.shop.id, filters, auth.token)
    return {
      items: result.rows.map(publicProduct),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total: result.count,
        totalPages: Math.ceil(result.count / filters.pageSize)
      }
    }
  }

  async get(auth, productId) {
    const context = await this.context(auth)
    const product = await this.productRepository.findById(context.shop.id, productId, auth.token, {
      activeOnly: context.membership.role !== 'owner'
    })
    if (!product) throw AppError.notFound('PRODUCT_NOT_FOUND', 'Product was not found')
    return publicProduct(product)
  }

  async update(auth, productId, changes, requestId) {
    const context = await this.context(auth)
    if (context.membership.role !== 'owner' || context.shop.owner_id !== auth.userId) {
      throw AppError.forbidden('Only the owner can update products')
    }
    const product = await this.productRepository.update(
      context.shop.id,
      productId,
      changes,
      auth.token
    )
    if (!product) throw AppError.notFound('PRODUCT_NOT_FOUND', 'Product was not found')
    this.logger.info('product_updated', { requestId, shopId: context.shop.id, productId })
    return publicProduct(product)
  }

  async archive(auth, productId, requestId) {
    const context = await this.context(auth)
    if (context.membership.role !== 'owner' || context.shop.owner_id !== auth.userId) {
      throw AppError.forbidden('Only the owner can archive products')
    }
    const product = await this.productRepository.archive(context.shop.id, productId, auth.token)
    if (!product) throw AppError.notFound('PRODUCT_NOT_FOUND', 'Product was not found')
    this.logger.info('product_archived', { requestId, shopId: context.shop.id, productId })
    return publicProduct(product)
  }

  async restore(auth, productId, requestId) {
    const context = await this.context(auth)
    if (context.membership.role !== 'owner' || context.shop.owner_id !== auth.userId) {
      throw AppError.forbidden('Only the owner can restore products')
    }
    const product = await this.productRepository.restore(
      context.shop.id,
      productId,
      auth.token
    )
    if (!product) throw AppError.notFound('PRODUCT_NOT_FOUND', 'Archived product was not found')
    this.logger.info('product_restored', { requestId, shopId: context.shop.id, productId })
    return publicProduct(product)
  }
}
