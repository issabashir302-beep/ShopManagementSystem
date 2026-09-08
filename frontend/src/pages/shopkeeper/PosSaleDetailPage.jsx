import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { shopwiseApi } from '../../services/shopwiseApi'
import { PageLoading, ErrorState } from '../../components/feedback/States'
import { Badge } from '../../components/ui/Badge'
import { dateTime, friendly, money } from '../../utils/format'

export function PosSaleDetailPage() {
  const { saleId } = useParams()
  const query = useQuery({
    queryKey: ['sale', saleId],
    queryFn: () => shopwiseApi.sales.get(saleId),
  })

  if (query.isLoading) return <div className="p-4 sm:p-6"><PageLoading /></div>
  if (query.error) return <div className="p-4 sm:p-6"><ErrorState error={query.error} /></div>

  const { sale, items, payments } = query.data

  return (
    <main className="mx-auto w-full max-w-4xl p-3 sm:p-6">
      <Link
        to="/pos/sales"
        className="mb-3 inline-flex min-h-10 items-center gap-2 text-sm font-bold text-brand-700 sm:mb-5"
      >
        <ArrowLeft size={16} />
        Recent sales
      </Link>

      <section className="card min-w-0 overflow-hidden rounded-xl">
        <header className="flex items-start justify-between gap-3 border-b p-4 sm:p-5">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Sale receipt</p>
            <h1 className="mt-1 break-all text-xl font-extrabold sm:text-2xl">{sale.receiptNumber}</h1>
            <p className="mt-1 text-sm text-gray-500">{dateTime(sale.createdAt)}</p>
          </div>
          <div className="shrink-0"><Badge value={sale.status} /></div>
        </header>

        <div className="divide-y md:hidden">
          {items.map((item) => (
            <article key={item.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <h2 className="min-w-0 break-words font-semibold">{item.productName}</h2>
                <strong className="shrink-0">{money(item.subtotal)}</strong>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-3 text-sm">
                <div>
                  <dt className="text-xs text-gray-500">Quantity</dt>
                  <dd className="mt-1 font-semibold">{item.quantity}</dd>
                </div>
                <div className="text-right">
                  <dt className="text-xs text-gray-500">Unit price</dt>
                  <dd className="mt-1 font-semibold">{money(item.unitPrice)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>

        <div className="table-wrap hidden md:block">
          <table className="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Quantity</th>
                <th>Price</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="font-semibold">{item.productName}</td>
                  <td>{item.quantity}</td>
                  <td>{money(item.unitPrice)}</td>
                  <td>{money(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <footer className="grid gap-4 border-t bg-gray-50 p-4 sm:grid-cols-[1fr_auto] sm:items-end sm:p-5">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Payment</p>
            <div className="grid gap-2">
              {payments.map((payment) => (
                <div key={payment.id} className="flex items-center gap-2 text-sm">
                  <span className="font-semibold">{friendly(payment.method)}</span>
                  <Badge value={payment.status} />
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-end justify-between gap-4 border-t pt-4 sm:block sm:border-0 sm:pt-0 sm:text-right">
            <span className="text-sm text-gray-500">Total</span>
            <strong className="text-xl sm:mt-1 sm:block sm:text-2xl">{money(sale.totalAmount)}</strong>
          </div>
        </footer>
      </section>
    </main>
  )
}
