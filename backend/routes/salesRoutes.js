import express from 'express'
import { requireAuth } from '../middleware/authMiddleware.js'
import {
  createSale,
  addSaleItems,
  dailySales
} from '../controllers/salesController.js'

const router = express.Router()

router.post('/', requireAuth, createSale)
router.post('/items', requireAuth, addSaleItems)
router.get('/daily', requireAuth, dailySales)

export default router
