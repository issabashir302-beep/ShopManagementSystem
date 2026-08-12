import { createApp } from '../../src/app.js'

const silentLogger = { debug() {}, info() {}, warn() {}, error() {} }

export async function startTestServer(overrides = {}) {
  if (process.env.NODE_ENV !== 'test') throw new Error('Test server requires NODE_ENV=test')

  const authService = overrides.authService ?? {
    async verifyAccessToken(token) {
      if (token !== 'valid-token')
        throw (await import('../../src/errors/AppError.js')).AppError.unauthorized()
      return { id: 'user-1', email: 'owner@example.com' }
    },
    async signup(input) {
      return input
    },
    async login(input) {
      return input
    },
    async refresh() {
      return {}
    },
    async logout() {
      return { message: 'Session revoked' }
    }
  }

  const app = createApp({
    config: {
      nodeEnv: 'test',
      corsOrigins: ['http://localhost:5173']
    },
    logger: silentLogger,
    authService,
    userService: overrides.userService ?? {
      async getOwnProfile() {
        return {}
      },
      async updateOwnProfile(_auth, changes) {
        return changes
      }
    },
    shopService: overrides.shopService ?? {
      async createShop(_auth, input) {
        return input
      },
      async getCurrentShop() {
        return {}
      },
      async updateCurrentShop(_auth, changes) {
        return changes
      }
    },
    membershipService: overrides.membershipService ?? {
      async create(_auth, input) {
        return input
      },
      async list() {
        return []
      },
      async get() {
        return {}
      },
      async update(_auth, _id, input) {
        return input
      },
      async updateStatus(_auth, _id, active) {
        return { isActive: active }
      },
      async resetPassword() {
        return { message: 'Password reset instructions were requested' }
      }
    },
    productService: overrides.productService ?? {
      async create(_auth, input) {
        return input
      },
      async list() {
        return { items: [] }
      },
      async get() {
        return {}
      },
      async update(_auth, _id, input) {
        return input
      },
      async archive() {
        return { isActive: false }
      }
    },
    inventoryService: overrides.inventoryService ?? {
      async list() {
        return { items: [] }
      },
      async lowStock() {
        return { items: [] }
      },
      async get() {
        return {}
      },
      async movements() {
        return { items: [] }
      },
      async adjust(_auth, _id, input) {
        return input
      }
    },
    saleService: overrides.saleService ?? {
      async checkout(_auth, input) {
        return input
      },
      async list() {
        return { items: [] }
      },
      async get() {
        return {}
      }
    },
    paymentService: overrides.paymentService ?? {
      async listForSale() {
        return { items: [] }
      },
      async get() {
        return {}
      },
      async createStripeIntent() {
        return {}
      },
      async handleStripeWebhook() {
        return { received: true }
      }
    },
    reportService: overrides.reportService ?? {
      async generate() {
        return {}
      }
    },
    notificationService: overrides.notificationService ?? {
      async sendManual() {
        return { sent: true }
      }
    },
    returnService: overrides.returnService ?? {
      async voidSale(_auth, saleId) {
        return { sale_id: saleId }
      },
      async createReturn(_auth, saleId) {
        return { sale_id: saleId }
      }
    },
    readinessCheck: overrides.readinessCheck ?? (async () => {})
  })

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
  })
  const address = server.address()
  const baseUrl = `http://127.0.0.1:${address.port}`

  return {
    async request(path, { method = 'GET', token, body, headers = {} } = {}) {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...headers
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {})
      })
      return { response, body: await response.json() }
    },
    close: () =>
      new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  }
}
