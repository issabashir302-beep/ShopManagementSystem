import { sendSuccess } from '../../utils/apiResponse.js'
export function createPaymentController(service) {
  return {
    listForSale: async (req, res) => sendSuccess(res, await service.listForSale(req.auth, req.validatedSaleId, req.validatedQuery)),
    get: async (req, res) => sendSuccess(res, await service.get(req.auth, req.validatedPaymentId)),
    createStripeIntent: async (req, res) => sendSuccess(res, await service.createStripeIntent(req.auth, req.validated, req.requestId), 201),
    stripeWebhook: async (req, res) => sendSuccess(res, await service.handleStripeWebhook(req.body, req.get('stripe-signature'), req.requestId))
  }
}
