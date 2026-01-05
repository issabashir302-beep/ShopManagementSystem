import express from 'express'
import { requireAuth } from '../middleware/authMiddleware.js'
import { createShop, getShopDetails, inviteShopkeeper } from '../controllers/shopController.js'

const router = express.Router()

// Create a new shop and assign it to the authenticated user
router.post('/', requireAuth, createShop)

// Get shop details for current user (basic)
router.get('/me', requireAuth, getShopDetails)

// Invite shopkeeper (service role flow)
router.post('/invite', requireAuth, inviteShopkeeper)

export default router
