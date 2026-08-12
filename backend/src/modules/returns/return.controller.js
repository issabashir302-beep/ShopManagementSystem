import { sendSuccess } from '../../utils/apiResponse.js'

export function createReturnController(service) {
  return {
    voidSale: async (req, res) =>
      sendSuccess(
        res,
        await service.voidSale(req.auth, req.validatedId, req.validated, req.requestId),
        201
      ),
    createReturn: async (req, res) =>
      sendSuccess(
        res,
        await service.createReturn(req.auth, req.validatedId, req.validated, req.requestId),
        201
      )
  }
}
