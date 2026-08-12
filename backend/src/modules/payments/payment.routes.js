import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.middleware.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { createPaymentController } from './payment.controller.js'
import express from 'express'
import {
  validateCreateStripeIntent,
  validatePaymentId,
  validatePaymentList,
  validatePaymentSaleId
} from './payment.validation.js'
export function createPaymentRouter({ authService, paymentService }) {
  const router = Router(),
    controller = createPaymentController(paymentService),
    authenticated = requireAuth(authService)
  const saleId = (req, _res, next) => {
    try {
      req.validatedSaleId = validatePaymentSaleId(req.params.saleId)
      next()
    } catch (e) {
      next(e)
    }
  }
  const paymentId = (req, _res, next) => {
    try {
      req.validatedPaymentId = validatePaymentId(req.params.paymentId)
      next()
    } catch (e) {
      next(e)
    }
  }
  const query = (req, _res, next) => {
    try {
      req.validatedQuery = validatePaymentList(req.query)
      next()
    } catch (e) {
      next(e)
    }
  }
  const body = (req, _res, next) => {
    try {
      req.validated = validateCreateStripeIntent(req.body)
      next()
    } catch (e) {
      next(e)
    }
  }
  router.post(
    '/payments/stripe/create-intent',
    authenticated,
    body,
    asyncHandler(controller.createStripeIntent)
  )
  router.get(
    '/sales/:saleId/payments',
    authenticated,
    saleId,
    query,
    asyncHandler(controller.listForSale)
  )
  router.get('/payments/:paymentId', authenticated, paymentId, asyncHandler(controller.get))
  return router
}

export function createStripeWebhookRouter(paymentService) {
  const router = Router(),
    controller = createPaymentController(paymentService)
  router.post(
    '/api/v1/payments/stripe/webhook',
    express.raw({ type: 'application/json', limit: '100kb' }),
    asyncHandler(controller.stripeWebhook)
  )
  return router
}
