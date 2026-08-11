import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.middleware.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { createReportController } from './report.controller.js'
import { validateEmailRequest, validateReportPeriod } from './report.validation.js'
export function createReportRouter({ authService, reportService, notificationService }) {
  const router = Router(), controller = createReportController(reportService, notificationService), authenticated = requireAuth(authService)
  const query = (req, _res, next) => { try { req.validatedQuery = validateReportPeriod(req.query); next() } catch (e) { next(e) } }
  const body = (req, _res, next) => { try { req.validated = validateEmailRequest(req.body); next() } catch (e) { next(e) } }
  router.get('/reports/daily-sales', authenticated, query, asyncHandler(controller.daily))
  router.get('/reports/monthly-sales', authenticated, query, asyncHandler(controller.monthly))
  router.get('/reports/products', authenticated, query, asyncHandler(controller.products))
  router.get('/reports/inventory', authenticated, query, asyncHandler(controller.inventory))
  router.get('/reports/profit', authenticated, query, asyncHandler(controller.profit))
  router.get('/reports/monthly-summary', authenticated, query, asyncHandler(controller.summary))
  router.post('/reports/monthly-summary/email', authenticated, body, asyncHandler(controller.email))
  return router
}
