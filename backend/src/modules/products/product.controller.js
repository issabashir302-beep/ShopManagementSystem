import { sendSuccess } from '../../utils/apiResponse.js'

export function createProductController(service) {
  return {
    create: async (req, res) =>
      sendSuccess(res, await service.create(req.auth, req.validated, req.requestId), 201),
    list: async (req, res) => sendSuccess(res, await service.list(req.auth, req.validatedQuery)),
    catalog: async (req, res) => sendSuccess(res, await service.catalog(req.auth)),
    get: async (req, res) => sendSuccess(res, await service.get(req.auth, req.validatedId)),
    update: async (req, res) =>
      sendSuccess(
        res,
        await service.update(req.auth, req.validatedId, req.validated, req.requestId)
      ),
    archive: async (req, res) =>
      sendSuccess(res, await service.archive(req.auth, req.validatedId, req.requestId)),
    restore: async (req, res) =>
      sendSuccess(res, await service.restore(req.auth, req.validatedId, req.requestId))
  }
}
