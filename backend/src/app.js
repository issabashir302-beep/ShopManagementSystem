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

export function createApp({
  config, logger, authService, userService, shopService, membershipService,
  productService, inventoryService, readinessCheck
}) {
  const app = express()
  const allowedOrigins = new Set(config.corsOrigins)

  app.disable('x-powered-by')
  app.use(requestIdMiddleware)
  app.use(requestLoggerMiddleware(logger))
  app.use(securityHeadersMiddleware(config.nodeEnv))
  app.use(cors({
    credentials: false,
    origin(origin, callback) {
      if (!origin || allowedOrigins.has('*') || allowedOrigins.has(origin.replace(/\/$/, ''))) {
        return callback(null, true)
      }
      return callback(AppError.forbidden('Origin is not allowed by CORS policy'))
    }
  }))
  app.use(express.json({ limit: '100kb' }))

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

  app.use(notFoundMiddleware)
  app.use(errorMiddleware({ logger, nodeEnv: config.nodeEnv }))
  return app
}
