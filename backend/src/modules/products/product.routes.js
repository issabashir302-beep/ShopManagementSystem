import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.middleware.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { createProductController } from './product.controller.js'
import {
  validateProductCreate,
  validateProductId,
  validateProductList,
  validateProductUpdate
} from './product.validation.js'

function body(validator) {
  return (req, _res, next) => {
    try {
      req.validated = validator(req.body)
      next()
    } catch (error) {
      next(error)
    }
  }
}
function id(req, _res, next) {
  try {
    req.validatedId = validateProductId(req.params.productId)
    next()
  } catch (error) {
    next(error)
  }
}
function query(req, _res, next) {
  try {
    req.validatedQuery = validateProductList(req.query)
    next()
  } catch (error) {
    next(error)
  }
}

export function createProductRouter({ authService, productService }) {
  const router = Router()
  const controller = createProductController(productService)
  router.use(requireAuth(authService))
  router.post('/', body(validateProductCreate), asyncHandler(controller.create))
  router.get('/', query, asyncHandler(controller.list))
  router.get('/:productId', id, asyncHandler(controller.get))
  router.patch('/:productId', id, body(validateProductUpdate), asyncHandler(controller.update))
  router.post('/:productId/restore', id, asyncHandler(controller.restore))
  router.delete('/:productId', id, asyncHandler(controller.archive))
  return router
}
