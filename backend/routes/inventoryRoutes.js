// routes/inventoryRoutes.js
const express = require('express');
const { addItem, getItems, updateItem, deleteItem } = require('../controllers/inventoryController');
const authMiddleware = require('../middleware/authMiddleware');
const router = express.Router();


//protected routes
router.post('/', authMiddleware, addItem);
router.get('/', authMiddleware, getItems);
router.put('/:id', authMiddleware, updateItem);
router.delete('/:id', authMiddleware, deleteItem);

module.exports = router;
