import test from 'node:test'
import assert from 'node:assert/strict'
import { validateExpenseCreate, validateExpenseList } from './expense.validation.js'
test('validates and maps an expense', () => { const value = validateExpenseCreate({ category: 'rent', description: 'September rent', amount: '25000.00', expenseDate: '2026-09-01', paymentMethod: 'bank' }); assert.equal(value.expense_date, '2026-09-01'); assert.equal(value.amount, '25000.00') })
test('rejects invalid expense categories', () => assert.throws(() => validateExpenseCreate({ category: 'stock', description: 'Stock', amount: '10', expenseDate: '2026-09-01', paymentMethod: 'cash' })))
test('validates expense filters', () => assert.equal(validateExpenseList({ page: '2', category: 'utilities' }).page, 2))
