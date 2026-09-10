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
import { SaleRepository } from './modules/sales/sale.repository.js'
import { SaleService } from './modules/sales/sale.service.js'
import { PaymentRepository } from './modules/payments/payment.repository.js'
import { PaymentService } from './modules/payments/payment.service.js'
import { StripeGateway } from './modules/payments/stripe.gateway.js'
import { ReportRepository } from './modules/reports/report.repository.js'
import { ReportService } from './modules/reports/report.service.js'
import { NotificationRepository } from './modules/notifications/notification.repository.js'
import { NotificationService } from './modules/notifications/notification.service.js'
import { createResendClient } from './config/resend.js'
import { createMonthlyReportJob } from './jobs/monthlyReport.job.js'
import { ReturnRepository } from './modules/returns/return.repository.js'
import { ReturnService } from './modules/returns/return.service.js'
import { ExpenseRepository } from './modules/expenses/expense.repository.js'
import { ExpenseService } from './modules/expenses/expense.service.js'
import { MpesaRepository } from './modules/mpesa/mpesa.repository.js'
import { MpesaService } from './modules/mpesa/mpesa.service.js'
import { DarajaGateway } from './modules/mpesa/daraja.gateway.js'
import { createCredentialCipher } from './modules/mpesa/credentialCipher.js'

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
  const saleRepository = new SaleRepository(clients.forAccessToken)
  const paymentRepository = new PaymentRepository({
    forAccessToken: clients.forAccessToken,
    adminClient: clients.adminClient
  })
  const reportRepository = new ReportRepository(clients.forAccessToken)
  const notificationRepository = new NotificationRepository(clients.adminClient)
  const returnRepository = new ReturnRepository(clients.forAccessToken)
  const expenseRepository = new ExpenseRepository(clients.forAccessToken)
  const mpesaRepository = new MpesaRepository({ adminClient: clients.adminClient, forAccessToken: clients.forAccessToken })
  const stripeGateway = new StripeGateway({
    secretKey: config.stripeSecretKey,
    webhookSecret: config.stripeWebhookSecret
  })

  const authService = new AuthService({ ...clients, logger })
  const userService = new UserService(userRepository)
  const shopService = new ShopService({ shopRepository, userRepository })
  const membershipService = new MembershipService({ membershipRepository, shopService, logger })
  const productService = new ProductService({ productRepository, shopService, logger })
  const inventoryService = new InventoryService({ inventoryRepository, shopService, logger })
  const saleService = new SaleService({ saleRepository, shopService, logger })
  const paymentService = new PaymentService({
    paymentRepository,
    shopService,
    stripeGateway,
    logger
  })
  const reportService = new ReportService({
    reportRepository,
    shopService,
    timezone: config.appTimezone,
    logger
  })
  const notificationService = new NotificationService({
    repository: notificationRepository,
    reportService,
    emailClient: createResendClient(config.resendApiKey),
    fromEmail: config.resendFromEmail,
    timezone: config.appTimezone,
    logger
  })
  const monthlyReportJob = createMonthlyReportJob(notificationService, logger)
  const returnService = new ReturnService({ returnRepository, shopService, logger })
  const expenseService = new ExpenseService({ expenseRepository, shopService, logger })
  const mpesaService = new MpesaService({ repository: mpesaRepository, shopService, gateway: new DarajaGateway(), cipher: createCredentialCipher(config.mpesaCredentialsEncryptionKey), publicApiUrl: config.publicApiUrl, logger })

  const readinessCheck = async () => {
    const { error } = await clients.adminClient.from('users').select('id').limit(1)
    if (error) throw new Error('Supabase dependency is unavailable')
  }

  return {
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
    monthlyReportJob,
    readinessCheck
  }
}
