import { sendSuccess } from '../../utils/apiResponse.js'
export function createReportController(reportService, notificationService) {
  const get = (kind) => async (req, res) => sendSuccess(res, await reportService.generate(req.auth, kind, req.validatedQuery, req.id))
  return {
    daily: get('daily'), monthly: get('monthly'), products: get('products'), inventory: get('inventory'), profit: get('profit'), summary: get('summary'),
    email: async (req, res) => sendSuccess(res, await notificationService.sendManual(req.auth, req.validated.month, req.id))
  }
}
