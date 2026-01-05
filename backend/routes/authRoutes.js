import express from 'express'
import { signup, login, logout, getMe } from '../controllers/authController.js'
import { requireAuth } from '../middleware/authMiddleware.js'

const router = express.Router()

router.post('/signup', signup)
router.post('/login', login)
// Logout - invalidates the session on the server
router.post('/logout', requireAuth, logout)

// ✅ ADD THIS
router.get('/me', requireAuth, getMe)

export default router
