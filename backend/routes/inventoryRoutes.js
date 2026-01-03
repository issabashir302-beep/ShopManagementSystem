import express from 'express'
import { requireAuth } from '../middleware/authMiddleware.js'
import {
  getProducts,
  createProduct,
  lowStock
} from '../controllers/inventoryController.js'

const router = express.Router()

router.get('/', requireAuth, getProducts)
router.post('/', requireAuth, createProduct)
router.get('/low-stock', requireAuth, lowStock)

export default router
