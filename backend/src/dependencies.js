import { createSupabaseClients } from './config/supabase.js'
import { createLogger } from './utils/logger.js'
import { AuthService } from './modules/auth/auth.service.js'
import { UserRepository } from './modules/users/user.repository.js'
import { UserService } from './modules/users/user.service.js'
import { ShopRepository } from './modules/shops/shop.repository.js'
import { ShopService } from './modules/shops/shop.service.js'
import { MembershipRepository } from './modules/memberships/membership.repository.js'
import { MembershipService } from './modules/memberships/membership.service.js'
import { ProductRepository } from './modules/products/product.repository.js'
import { ProductService } from './modules/products/product.service.js'
import { InventoryRepository } from './modules/inventory/inventory.repository.js'
import { InventoryService } from './modules/inventory/inventory.service.js'

export function buildDependencies(config) {
  const logger = createLogger({ level: config.logLevel })
  const clients = createSupabaseClients(config)
  const userRepository = new UserRepository(clients.forAccessToken)
  const shopRepository = new ShopRepository(clients.forAccessToken)
  const membershipRepository = new MembershipRepository({
    forAccessToken: clients.forAccessToken,
    adminClient: clients.adminClient
  })
  const productRepository = new ProductRepository(clients.forAccessToken)
  const inventoryRepository = new InventoryRepository(clients.forAccessToken)

  const authService = new AuthService({ ...clients, logger })
  const userService = new UserService(userRepository)
  const shopService = new ShopService({ shopRepository, userRepository })
  const membershipService = new MembershipService({ membershipRepository, shopService, logger })
  const productService = new ProductService({ productRepository, shopService, logger })
  const inventoryService = new InventoryService({ inventoryRepository, shopService, logger })

  const readinessCheck = async () => {
    const { error } = await clients.adminClient.from('users').select('id').limit(1)
    if (error) throw new Error('Supabase dependency is unavailable')
  }

  return {
    logger, authService, userService, shopService, membershipService, productService,
    inventoryService, readinessCheck
  }
}
