import { useQueries } from '@tanstack/react-query'
import { AlertTriangle, Banknote, Boxes, ReceiptText } from 'lucide-react'
import { Link } from 'react-router-dom'
import { shopwiseApi } from '../../services/shopwiseApi'
import { money, dateTime } from '../../utils/format'
import { PageHeader } from '../../components/layout/PageHeader'
import { PageLoading, ErrorState, EmptyState } from '../../components/feedback/States'
import { Badge } from '../../components/ui/Badge'

export function DashboardPage() {
  const [daily, low, sales] = useQueries({ queries: [
    { queryKey: ['reports', 'daily'], queryFn: () => shopwiseApi.reports.daily() },
    { queryKey: ['inventory', 'low', 1], queryFn: () => shopwiseApi.inventory.low({ pageSize: 5 }) },
    { queryKey: ['sales', { limit: 5 }], queryFn: () => shopwiseApi.sales.list({ limit: 5 }) },
  ] })
  if ([daily, low, sales].some((query) => query.isLoading)) return <PageLoading />
  const error = [daily, low, sales].find((query) => query.error)?.error
  if (error) return <ErrorState error={error} />

  const totals = daily.data.totals || {}
  const cards = [
    ['Today’s sales', money(totals.totalSales ?? totals.grossRevenue), Banknote],
    ['Transactions', totals.transactions ?? totals.salesCount ?? 0, ReceiptText],
    ['Gross profit', money(totals.grossProfit), Boxes],
    ['Low stock', low.data.pagination.total, AlertTriangle],
  ]

  return <>
    <PageHeader eyebrow="Overview" title="Your shop today" description="Authoritative activity from persisted sales and inventory." />
    <div className="grid gap-3 min-[460px]:grid-cols-2 xl:grid-cols-4">
      {cards.map(([label, value, Icon]) => <article className="card min-w-0 rounded-xl p-4 sm:p-5" key={label}>
        <div className="flex justify-between gap-3"><span className="text-sm text-gray-500">{label}</span><Icon size={18} className="shrink-0 text-brand-600" /></div>
        <strong className="mt-4 block break-words text-2xl sm:mt-5">{value}</strong>
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
        <header className="flex items-center justify-between border-b px-4 py-4 sm:px-5"><h2 className="font-bold">Low stock</h2><Link to="/app/inventory" className="text-xs font-bold text-brand-700">View inventory</Link></header>
        <div className="divide-y px-4 sm:px-5">{low.data.items.length ? low.data.items.map((item) => <div className="flex min-w-0 items-center justify-between gap-4 py-4" key={item.productId}><div className="min-w-0"><strong className="block truncate text-sm">{item.name}</strong><small className="block truncate text-gray-500">{item.sku || item.unit}</small></div><span className="shrink-0 font-bold text-amber-700">{item.quantity}</span></div>) : <p className="py-8 text-center text-sm text-gray-500">No low-stock items.</p>}</div>
      </section>
    </div>
  </>
}
