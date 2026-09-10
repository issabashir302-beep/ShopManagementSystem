import { useQueries } from '@tanstack/react-query'
import { Banknote, Boxes, Package, ReceiptText, Smartphone } from 'lucide-react'
import { Link } from 'react-router-dom'
import { shopwiseApi } from '../../services/shopwiseApi'
import { money, dateTime } from '../../utils/format'
import { PageHeader } from '../../components/layout/PageHeader'
import { PageLoading, ErrorState, EmptyState } from '../../components/feedback/States'
import { Badge } from '../../components/ui/Badge'

export function DashboardPage() {
  const [daily, inventoryReport, low, sales, paymentMethods] = useQueries({ queries: [
    { queryKey: ['reports', 'daily'], queryFn: () => shopwiseApi.reports.daily() },
    { queryKey: ['reports', 'inventory'], queryFn: () => shopwiseApi.reports.inventory() },
    { queryKey: ['inventory', 'low', 1], queryFn: () => shopwiseApi.inventory.low({ pageSize: 5 }) },
    { queryKey: ['sales', { limit: 5 }], queryFn: () => shopwiseApi.sales.list({ limit: 5 }) },
    { queryKey: ['payment-methods'], queryFn: shopwiseApi.mpesa.availability },
  ] })
  if ([daily, inventoryReport, low, sales, paymentMethods].some((query) => query.isLoading)) return <PageLoading />
  const error = [daily, inventoryReport, low, sales, paymentMethods].find((query) => query.error)?.error
  if (error) return <ErrorState error={error} />

  const totals = daily.data.totals || {}
  const cards = [
    ['Transactions', totals.transactions ?? totals.salesCount ?? 0, ReceiptText, 'Completed sales today'],
    ['Net operating profit', money(totals.netOperatingProfit ?? totals.grossProfit), Boxes, 'After stock cost and expenses'],
    ['Inventory value', money(inventoryReport.data.inventory?.costValue), Package, `${inventoryReport.data.inventory?.products || 0} ${Number(inventoryReport.data.inventory?.products) === 1 ? 'product' : 'products'}`],
  ]

  return <>
    <PageHeader eyebrow="Overview" title="Your shop today" description="Authoritative activity from persisted sales and inventory." />
    {paymentMethods.data.preference === 'not_selected' && <section className="mb-4 flex flex-col justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:p-5"><div className="flex gap-3"><Smartphone className="mt-0.5 shrink-0 text-brand-700" size={21}/><div><strong>Complete your payment setup</strong><p className="mt-1 text-sm text-emerald-900/75">Connect your Till or Paybill for manual M-Pesa or integrated STK Push.</p></div></div><Link to="/app/settings/payments" className="shrink-0 rounded-lg bg-brand-600 px-4 py-2.5 text-center text-sm font-bold text-white">Continue setup</Link></section>}
    <div className="grid gap-3 min-[460px]:grid-cols-2 xl:grid-cols-5">
      <article className="card min-w-0 rounded-xl p-4 min-[460px]:col-span-2 sm:p-5">
        <div className="flex items-center justify-between gap-3"><span className="text-sm text-gray-500">Today’s cash flow</span><Banknote size={18} className="shrink-0 text-brand-600" /></div>
        <div className="mt-4 grid grid-cols-2 divide-x sm:mt-5">
          <div className="min-w-0 pr-3"><span className="block text-xs font-semibold text-emerald-700">Amount in</span><strong className="mt-1 block break-words text-xl sm:text-2xl">{money(totals.totalSales ?? totals.grossRevenue)}</strong><small className="mt-1 block text-gray-500">Completed sales</small></div>
          <div className="min-w-0 pl-3"><span className="block text-xs font-semibold text-red-700">Amount out</span><strong className="mt-1 block break-words text-xl sm:text-2xl">{money(totals.operatingExpenses)}</strong><small className="mt-1 block text-gray-500">Operating expenses</small></div>
        </div>
      </article>
      {cards.map(([label, value, Icon, supportingText]) => <article className="card min-w-0 rounded-xl p-4 sm:p-5" key={label}>
        <div className="flex justify-between gap-3"><span className="text-sm text-gray-500">{label}</span><Icon size={18} className="shrink-0 text-brand-600" /></div>
        <strong className="mt-4 block break-words text-2xl sm:mt-5">{value}</strong>
        {supportingText && <small className="mt-1.5 block font-medium text-gray-500">{supportingText}</small>}
      </article>)}
    </div>
    <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-2 xl:mt-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,.7fr)] xl:gap-5">
      <section className="card min-w-0 overflow-hidden rounded-xl">
        <header className="flex items-center justify-between border-b px-4 py-4 sm:px-5"><h2 className="font-bold">Recent sales</h2><Link to="/app/sales" className="text-xs font-bold text-brand-700">View all</Link></header>
        {sales.data.items.length ? <>
          <div className="divide-y md:hidden">{sales.data.items.map((sale) => <Link to={`/app/sales/${sale.id}`} className="flex items-center justify-between gap-4 px-4 py-4 hover:bg-gray-50" key={sale.id}><div className="min-w-0"><strong className="block truncate text-sm text-brand-700">{sale.receiptNumber}</strong><span className="mt-1 block text-xs text-gray-500">{dateTime(sale.createdAt)}</span></div><div className="shrink-0 text-right"><strong className="block text-sm">{money(sale.totalAmount)}</strong><span className="mt-1 block"><Badge value={sale.status} /></span></div></Link>)}</div>
          <div className="table-wrap hidden md:block"><table className="data-table"><thead><tr><th>Receipt</th><th>Date</th><th>Total</th><th>Status</th></tr></thead><tbody>{sales.data.items.map((sale) => <tr key={sale.id}><td><Link to={`/app/sales/${sale.id}`} className="font-semibold text-brand-700">{sale.receiptNumber}</Link></td><td>{dateTime(sale.createdAt)}</td><td>{money(sale.totalAmount)}</td><td><Badge value={sale.status} /></td></tr>)}</tbody></table></div>
        </> : <EmptyState title="No sales yet" message="Completed checkout activity will appear here." />}
      </section>
      <section className="card min-w-0 overflow-hidden rounded-xl">
        <header className="flex items-center justify-between border-b px-4 py-4 sm:px-5"><h2 className="font-bold">Low stock</h2><Link to="/app/products" className="text-xs font-bold text-brand-700">View stock</Link></header>
        <div className="divide-y px-4 sm:px-5">{low.data.items.length ? low.data.items.map((item) => <div className="flex min-w-0 items-center justify-between gap-4 py-4" key={item.productId}><div className="min-w-0"><strong className="block truncate text-sm">{item.name}</strong><small className="block truncate text-gray-500">{item.sku || item.unit}</small></div><span className="shrink-0 font-bold text-amber-700">{item.quantity}</span></div>) : <p className="py-8 text-center text-sm text-gray-500">No low-stock items.</p>}</div>
      </section>
    </div>
  </>
}
