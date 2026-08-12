import { AppError } from '../../errors/AppError.js'

export class ReturnService {
  constructor({ returnRepository, shopService, logger }) {
    Object.assign(this, { returnRepository, shopService, logger })
  }

  async requireOwner(auth) {
    const context = await this.shopService.getCurrentShopContext(auth)
    if (context.membership.role !== 'owner' || context.shop.owner_id !== auth.userId) {
      throw AppError.forbidden('Only the shop owner can process returns or voids')
    }
    return context
  }

  async voidSale(auth, saleId, input, requestId) {
    const context = await this.requireOwner(auth)
    const result = await this.returnRepository.voidSale(saleId, input.reason, auth.token)
    this.logger.info('sale_voided', {
      requestId,
      shopId: context.shop.id,
      saleId,
      returnId: result.return_id
    })
    return result
  }

  async createReturn(auth, saleId, input, requestId) {
    const context = await this.requireOwner(auth)
    const result = await this.returnRepository.createReturn(saleId, input, auth.token)
    this.logger.info('sale_return_created', {
      requestId,
      shopId: context.shop.id,
      saleId,
      returnId: result.return_id
    })
    return result
  }
}
