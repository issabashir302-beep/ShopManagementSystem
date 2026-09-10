import express from 'express'
import cors from 'cors'
import { AppError } from './errors/AppError.js'
import { requestIdMiddleware } from './middleware/requestId.middleware.js'
import { requestLoggerMiddleware } from './middleware/requestLogger.middleware.js'
import { securityHeadersMiddleware } from './middleware/security.middleware.js'
import { notFoundMiddleware } from './middleware/notFound.middleware.js'
import { errorMiddleware } from './middleware/error.middleware.js'
import { sendSuccess } from './utils/apiResponse.js'
import { createAuthRouter } from './modules/auth/auth.routes.js'
import { createUserRouter } from './modules/users/user.routes.js'
import { createShopRouter } from './modules/shops/shop.routes.js'
import { createMembershipRouter } from './modules/memberships/membership.routes.js'
import { createProductRouter } from './modules/products/product.routes.js'
import { createInventoryRouter } from './modules/inventory/inventory.routes.js'
import { createSaleRouter } from './modules/sales/sale.routes.js'
import {
  createPaymentRouter,
  createStripeWebhookRouter
} from './modules/payments/payment.routes.js'
import { createReportRouter } from './modules/reports/report.routes.js'
import { createReturnRouter } from './modules/returns/return.routes.js'
import { createExpenseRouter } from './modules/expenses/expense.routes.js'
import { createMpesaRouter, createMpesaWebhookRouter } from './modules/mpesa/mpesa.routes.js'
import { createRateLimiters, onlyMethods } from './middleware/rateLimit.middleware.js'

export function createApp({
  config,
  logger,
  authService,
  userService,
  shopService,
  membershipService,
  productService,
  inventoryService,
  saleService,
  paymentService,
  reportService,
  notificationService,
  returnService,
  expenseService,
  mpesaService,
  readinessCheck
}) {
  const app = express()
  const allowedOrigins = new Set(config.corsOrigins)
  const rateLimits = createRateLimiters()

  app.disable('x-powered-by')
  app.use(requestIdMiddleware)
  app.use(requestLoggerMiddleware({ logger, nodeEnv: config.nodeEnv }))
  app.use(securityHeadersMiddleware(config.nodeEnv))
  app.use(
    cors({
      credentials: false,
      origin(origin, callback) {
        if (!origin || allowedOrigins.has('*') || allowedOrigins.has(origin.replace(/\/$/, ''))) {
          return callback(null, true)
        }
        return callback(AppError.forbidden('Origin is not allowed by CORS policy'))
      }
    })
  )
  app.use(createStripeWebhookRouter(paymentService))
  app.use(express.json({ limit: '100kb' }))
  if (mpesaService) app.use(createMpesaWebhookRouter(mpesaService))

  app.use(['/api/v1/auth/signup', '/api/v1/auth/login'], rateLimits.auth)
  app.use('/api/v1/shopkeepers', onlyMethods(['POST'], rateLimits.sensitiveWrite))
  app.use('/api/v1/payments/stripe/create-intent', rateLimits.sensitiveWrite)
  app.use('/api/v1/reports/monthly-summary/email', rateLimits.sensitiveWrite)

  app.get('/api/v1/health', (req, res) => sendSuccess(res, { status: 'alive' }))
  app.get('/api/v1/readiness', async (req, res, next) => {
    try {
      await readinessCheck()
      sendSuccess(res, { status: 'ready' })
    } catch {
      next(new AppError(503, 'DEPENDENCY_UNAVAILABLE', 'A required dependency is unavailable'))
    }
  })

  app.use('/api/v1/auth', createAuthRouter(authService))
  app.use('/api/v1/users', createUserRouter({ authService, userService }))
  app.use('/api/v1/shops', createShopRouter({ authService, shopService }))
  app.use('/api/v1/shopkeepers', createMembershipRouter({ authService, membershipService }))
  app.use('/api/v1/products', createProductRouter({ authService, productService }))
  app.use('/api/v1', createInventoryRouter({ authService, inventoryService }))
  app.use('/api/v1', createSaleRouter({ authService, saleService }))
  app.use('/api/v1', createPaymentRouter({ authService, paymentService }))
  app.use('/api/v1', createReportRouter({ authService, reportService, notificationService }))
  app.use('/api/v1', createReturnRouter({ authService, returnService }))
  app.use('/api/v1/expenses', createExpenseRouter({ authService, expenseService }))
  if (mpesaService) app.use('/api/v1', createMpesaRouter({ authService, mpesaService }))

  app.use(notFoundMiddleware)
  app.use(errorMiddleware({ logger, nodeEnv: config.nodeEnv }))
  return app
}
