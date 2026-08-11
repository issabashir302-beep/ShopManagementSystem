import { sendSuccess } from '../../utils/apiResponse.js'
export function createSaleController(service) {
  return {
    checkout: async (req, res) => sendSuccess(res, await service.checkout(req.auth, req.validated, req.requestId), 201),
    list: async (req, res) => sendSuccess(res, await service.list(req.auth, req.validatedQuery)),
    get: async (req, res) => sendSuccess(res, await service.get(req.auth, req.validatedId))
  }
}
