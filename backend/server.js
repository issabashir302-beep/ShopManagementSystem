import express from 'express'
import cors from 'cors'

import authRoutes from './routes/authRoutes.js'
import inventoryRoutes from './routes/inventoryRoutes.js'
import salesRoutes from './routes/salesRoutes.js'

const app = express()
app.use(cors())
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/inventory', inventoryRoutes)
app.use('/api/sales', salesRoutes)

//health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' })
})  

app.listen(5000, () =>
  console.log('Backend running on port 5000')
)
