import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.middleware.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { createExpenseController } from './expense.controller.js'
import { validateExpenseCreate, validateExpenseId, validateExpenseList, validateExpenseUpdate } from './expense.validation.js'
const body = (validator) => (req, _res, next) => { try { req.validated = validator(req.body); next() } catch (e) { next(e) } }
const id = (req, _res, next) => { try { req.validatedId = validateExpenseId(req.params.expenseId); next() } catch (e) { next(e) } }
const query = (req, _res, next) => { try { req.validatedQuery = validateExpenseList(req.query); next() } catch (e) { next(e) } }
export function createExpenseRouter({ authService, expenseService }) {
  const router = Router(), controller = createExpenseController(expenseService)
  router.use(requireAuth(authService))
  router.get('/', query, asyncHandler(controller.list))
  router.get('/summary', query, asyncHandler(controller.summary))
  router.post('/', body(validateExpenseCreate), asyncHandler(controller.create))
  router.patch('/:expenseId', id, body(validateExpenseUpdate), asyncHandler(controller.update))
  router.delete('/:expenseId', id, asyncHandler(controller.archive))
  return router
}
