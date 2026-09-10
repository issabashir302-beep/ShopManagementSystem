import { sendSuccess } from '../../utils/apiResponse.js'
export function createExpenseController(service) { return {
  list: async (req, res) => sendSuccess(res, await service.list(req.auth, req.validatedQuery)),
  summary: async (req, res) => sendSuccess(res, await service.summary(req.auth, req.validatedQuery)),
  create: async (req, res) => sendSuccess(res, await service.create(req.auth, req.validated, req.requestId), 201),
  update: async (req, res) => sendSuccess(res, await service.update(req.auth, req.validatedId, req.validated, req.requestId)),
  archive: async (req, res) => sendSuccess(res, await service.archive(req.auth, req.validatedId, req.requestId))
} }
