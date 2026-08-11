import { AppError } from '../../errors/AppError.js'

function returnError(error) {
  const message = error?.message ?? ''
  if (message.includes('Sale was not found')) {
    return AppError.notFound('SALE_NOT_FOUND', 'Sale was not found')
  }
  if (message.includes('Only the shop owner')) return AppError.forbidden('Owner access required')
  if (message.includes('already voided')) {
    return AppError.conflict('SALE_ALREADY_VOIDED', 'Sale has already been voided')
  }
  if (message.includes('not eligible') || message.includes('existing returns')) {
    return AppError.conflict('INVALID_SALE_STATUS', 'Sale is not eligible for this operation')
  }
  if (message.includes('exceeds') || message.includes('sale item')) {
    return AppError.unprocessable(
      'RETURN_EXCEEDS_PURCHASE',
      'Return quantity exceeds the remaining sold quantity'
    )
  }
  if (message.includes('positive') || message.includes('must be')) {
    return AppError.badRequest('INVALID_RETURN_QUANTITY', 'Return quantities must be positive')
  }
  return new AppError(500, 'RETURN_OPERATION_FAILED', 'Unable to process the sale operation')
}

export class ReturnRepository {
  constructor(forAccessToken) {
    this.forAccessToken = forAccessToken
  }

  async voidSale(saleId, reason, token) {
    const { data, error } = await this.forAccessToken(token).rpc('void_sale', {
      p_sale_id: saleId,
      p_reason: reason
    })
    if (error) throw returnError(error)
    return data
  }

  async createReturn(saleId, input, token) {
    const { data, error } = await this.forAccessToken(token).rpc('create_sale_return', {
      p_sale_id: saleId,
      p_items: input.items,
      p_reason: input.reason
    })
    if (error) throw returnError(error)
    return data
  }
}
