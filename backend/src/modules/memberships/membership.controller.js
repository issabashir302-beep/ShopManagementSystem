import { sendSuccess } from '../../utils/apiResponse.js'

export function createMembershipController(service) {
  return {
    create: async (req, res) =>
      sendSuccess(res, await service.create(req.auth, req.validated, req.requestId), 201),
    list: async (req, res) => sendSuccess(res, await service.list(req.auth)),
    get: async (req, res) => sendSuccess(res, await service.get(req.auth, req.validatedId)),
    update: async (req, res) =>
      sendSuccess(
        res,
        await service.update(req.auth, req.validatedId, req.validated, req.requestId)
      ),
    status: async (req, res) =>
      sendSuccess(
        res,
        await service.updateStatus(
          req.auth,
          req.validatedId,
          req.validated.is_active,
          req.requestId
        )
      ),
    resetPassword: async (req, res) =>
      sendSuccess(res, await service.resetPassword(req.auth, req.validatedId, req.requestId))
  }
}
