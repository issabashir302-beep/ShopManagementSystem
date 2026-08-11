import { sendSuccess } from '../../utils/apiResponse.js'

export function createInventoryController(service) {
  return {
    list: async (req, res) => sendSuccess(res, await service.list(req.auth, req.validatedQuery)),
    lowStock: async (req, res) => sendSuccess(res, await service.lowStock(req.auth, req.validatedQuery)),
    get: async (req, res) => sendSuccess(res, await service.get(req.auth, req.validatedId)),
    movements: async (req, res) => sendSuccess(res, await service.movements(
      req.auth, req.validatedId, req.validatedQuery
    )),
    adjust: async (req, res) => sendSuccess(res, await service.adjust(
      req.auth, req.validatedId, req.validated, req.requestId
    ))
  }
}
