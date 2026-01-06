import express from 'express'
import { requireAuth } from '../middleware/authMiddleware.js'
import { createShop, getShopDetails, inviteShopkeeper, addShopkeeper, getShopkeepers, updateShopkeeper, toggleShopkeeperStatus, resetShopkeeperPassword } from '../controllers/shopController.js'

const router = express.Router()

// Create a new shop and assign it to the authenticated user
router.post('/', requireAuth, createShop)

// Get shop details for current user (basic)
router.get('/me', requireAuth, getShopDetails)

// Invite shopkeeper (service role flow)
router.post('/invite', requireAuth, inviteShopkeeper)

// Add shopkeeper with credentials
router.post('/shopkeepers', requireAuth, addShopkeeper)

// Get all shopkeepers for the owner's shop
router.get('/shopkeepers', requireAuth, getShopkeepers)

// Update shopkeeper profile (name, phone)
router.patch('/shopkeepers/:id', requireAuth, updateShopkeeper)

// Toggle status (disabled)
router.patch('/shopkeepers/:id/status', requireAuth, toggleShopkeeperStatus)

// Reset password (returns new temp password)
router.post('/shopkeepers/:id/reset-password', requireAuth, resetShopkeeperPassword)

export default router
