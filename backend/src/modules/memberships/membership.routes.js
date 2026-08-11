import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.middleware.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { createMembershipController } from './membership.controller.js'
import {
  validateShopkeeperCreate, validateShopkeeperId, validateShopkeeperUpdate, validateStatusUpdate
} from './membership.validation.js'

function body(validator) {
  return (req, _res, next) => {
    try { req.validated = validator(req.body); next() } catch (error) { next(error) }
  }
}

function id(req, _res, next) {
  try { req.validatedId = validateShopkeeperId(req.params.shopkeeperId); next() } catch (error) { next(error) }
}

export function createMembershipRouter({ authService, membershipService }) {
  const router = Router()
  const controller = createMembershipController(membershipService)
  const authenticated = requireAuth(authService)
  router.use(authenticated)
  router.post('/', body(validateShopkeeperCreate), asyncHandler(controller.create))
  router.get('/', asyncHandler(controller.list))
  router.get('/:shopkeeperId', id, asyncHandler(controller.get))
  router.patch('/:shopkeeperId', id, body(validateShopkeeperUpdate), asyncHandler(controller.update))
  router.patch('/:shopkeeperId/status', id, body(validateStatusUpdate), asyncHandler(controller.status))
  router.post('/:shopkeeperId/reset-password', id, asyncHandler(controller.resetPassword))
  return router
}
