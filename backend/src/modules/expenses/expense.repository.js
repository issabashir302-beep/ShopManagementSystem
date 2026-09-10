import { AppError } from '../../errors/AppError.js'
const FIELDS = 'id, shop_id, category, description, amount, expense_date, payment_method, reference, notes, recorded_by, created_at, updated_at, deleted_at'
function expenseError(error) {
  if (error?.code === '42501') return AppError.forbidden()
  if (error?.code === '23514') return AppError.badRequest('INVALID_EXPENSE', 'Expense violates a database constraint')
  return new AppError(500, 'EXPENSE_QUERY_FAILED', 'Unable to access expense information')
}
export class ExpenseRepository {
  constructor(forAccessToken) { this.forAccessToken = forAccessToken }
  async list(shopId, filters, token) {
    const from = (filters.page - 1) * filters.pageSize
    let query = this.forAccessToken(token).from('expenses').select(FIELDS, { count: 'exact' }).eq('shop_id', shopId).is('deleted_at', null)
    if (filters.dateFrom) query = query.gte('expense_date', filters.dateFrom)
    if (filters.dateTo) query = query.lte('expense_date', filters.dateTo)
    if (filters.category) query = query.eq('category', filters.category)
    if (filters.paymentMethod) query = query.eq('payment_method', filters.paymentMethod)
    const { data, error, count } = await query.order('expense_date', { ascending: false }).order('created_at', { ascending: false }).range(from, from + filters.pageSize - 1)
    if (error) throw expenseError(error)
    return { rows: data ?? [], count: count ?? 0 }
  }
  async create(shopId, userId, input, token) {
    const { data, error } = await this.forAccessToken(token).from('expenses').insert({ ...input, shop_id: shopId, recorded_by: userId }).select(FIELDS).single()
    if (error) throw expenseError(error); return data
  }
  async update(shopId, id, input, token) {
    const { data, error } = await this.forAccessToken(token).from('expenses').update(input).eq('shop_id', shopId).eq('id', id).is('deleted_at', null).select(FIELDS).maybeSingle()
    if (error) throw expenseError(error); return data
  }
  async archive(shopId, id, token) {
    const { data, error } = await this.forAccessToken(token).from('expenses').update({ deleted_at: new Date().toISOString() }).eq('shop_id', shopId).eq('id', id).is('deleted_at', null).select(FIELDS).maybeSingle()
    if (error) throw expenseError(error); return data
  }
  async summary(shopId, start, end, token) {
    const { data, error } = await this.forAccessToken(token).from('expenses').select('category, amount, expense_date').eq('shop_id', shopId).is('deleted_at', null).gte('expense_date', start).lte('expense_date', end)
    if (error) throw expenseError(error); return data ?? []
  }
}
