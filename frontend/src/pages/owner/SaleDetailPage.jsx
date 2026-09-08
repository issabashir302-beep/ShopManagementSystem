import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { PageLoading, ErrorState } from '../../components/feedback/States'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/feedback/ToastProvider'
import { shopwiseApi } from '../../services/shopwiseApi'
import { dateTime, friendly, money } from '../../utils/format'

export function SaleDetailPage() {
  const { saleId } = useParams()
  const [action, setAction] = useState(null)
  const queryClient = useQueryClient()
  const toast = useToast()
  const query = useQuery({
    queryKey: ['sale', saleId],
    queryFn: () => shopwiseApi.sales.get(saleId),
  })
  const mutation = useMutation({
    mutationFn: ({ type, reason, items }) =>
      type === 'void'
        ? shopwiseApi.sales.void(saleId, reason)
        : shopwiseApi.sales.returnItems(saleId, items, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sale', saleId] })
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      setAction(null)
      toast.success('Sale updated')
    },
    onError: (error) => toast.error('Unable to update sale', error.message),
  })

  if (query.isLoading) return <PageLoading />
  if (query.error) return <ErrorState error={query.error} />

  const { sale, items, payments, returns = [] } = query.data
  const returned = new Map()
  returns
    .flatMap((itemReturn) => itemReturn.items || [])
    .forEach((item) => {
      returned.set(
        item.saleItemId,
        Number(returned.get(item.saleItemId) || 0) + Number(item.quantity),
      )
    })
  const eligible = sale.status === 'completed'

  return (
    <>
      <Link
        to="/app/sales"
        className="mb-4 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-brand-700"
      >
        <ArrowLeft size={16} />
        Back to sales
      </Link>

      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Sale receipt</p>
          <h1 className="mt-1 break-all text-2xl font-extrabold sm:text-3xl">{sale.receiptNumber}</h1>
          <p className="mt-1 text-sm text-gray-500">{dateTime(sale.createdAt)}</p>
        </div>
        {eligible && (
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-none">
            {!returns.length && (
              <Button variant="danger" onClick={() => setAction('void')}>
                Void sale
              </Button>
            )}
            <Button variant="secondary" onClick={() => setAction('return')}>
              Return items
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="card min-w-0 overflow-hidden rounded-xl">
          <header className="border-b px-4 py-4 font-bold sm:px-5">
            Items <span className="font-normal text-gray-500">({items.length})</span>
          </header>
          <SaleItems items={items} />
          <SaleTotals sale={sale} />
        </section>

        <aside className="grid content-start gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <section className="card rounded-xl p-4 sm:p-5">
            <h2 className="font-bold">Sale status</h2>
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-sm text-gray-500">Sale</span>
              <Badge value={sale.status} />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-sm text-gray-500">Payment</span>
              <Badge value={sale.paymentStatus} />
            </div>
          </section>

          <section className="card rounded-xl p-4 sm:p-5">
            <h2 className="font-bold">Payments</h2>
            <div className="mt-3 divide-y">
              {payments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold">{friendly(payment.method)}</p>
                    <p className="mt-0.5 text-gray-500">{money(payment.amount)}</p>
                  </div>
                  <Badge value={payment.status} />
                </div>
              ))}
            </div>
          </section>

          {returns.length > 0 && (
            <section className="card rounded-xl p-4 sm:p-5 sm:col-span-2 xl:col-span-1">
              <h2 className="font-bold">Returns</h2>
              <p className="mt-2 text-sm text-gray-500">
                {returns.length} compensating return record(s).
              </p>
            </section>
          )}
        </aside>
      </div>

      <ActionModal
        action={action}
        close={() => setAction(null)}
        items={items}
        returned={returned}
        mutation={mutation}
      />
    </>
  )
}

function SaleItems({ items }) {
  return (
    <>
      <div className="divide-y md:hidden">
        {items.map((item) => (
          <article key={item.id} className="p-4">
            <div className="flex items-start justify-between gap-4">
              <h3 className="min-w-0 break-words font-semibold">{item.productName}</h3>
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
              <th>Product snapshot</th>
              <th>Qty</th>
              <th>Unit price</th>
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
    </>
  )
}

function SaleTotals({ sale }) {
  return (
    <div className="border-t bg-gray-50 p-4 sm:p-5">
      <dl className="ml-auto grid max-w-sm gap-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-gray-600">Subtotal</dt>
          <dd className="font-semibold">{money(sale.subtotal)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-gray-600">Tax</dt>
          <dd className="font-semibold">{money(sale.taxAmount)}</dd>
        </div>
        <div className="mt-1 flex justify-between gap-4 border-t pt-3 text-lg">
          <dt className="font-bold">Total</dt>
          <dd className="font-extrabold">{money(sale.totalAmount)}</dd>
        </div>
      </dl>
    </div>
  )
}

function ActionModal({ action, close, items, returned, mutation }) {
  const submit = (event) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const selected = items
      .filter((item) => data.get(`select-${item.id}`))
      .map((item) => ({
        saleItemId: item.id,
        quantity: data.get(`quantity-${item.id}`),
      }))
    mutation.mutate({ type: action, reason: data.get('reason'), items: selected })
  }

  return (
    <Modal
      open={Boolean(action)}
      onClose={close}
      title={action === 'void' ? 'Void sale' : 'Return items'}
      footer={
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:justify-end">
          <Button variant="secondary" onClick={close}>Cancel</Button>
          <Button variant="danger" form="sale-action" loading={mutation.isPending}>
            {action === 'void' ? 'Void sale' : 'Process return'}
          </Button>
        </div>
      }
    >
      <form id="sale-action" onSubmit={submit} className="grid gap-4">
        {action === 'return' && (
          <div className="grid max-h-[50vh] gap-3 overflow-y-auto pr-1">
            {items.map((item) => {
              const remaining = Number(item.quantity) - Number(returned.get(item.id) || 0)
              if (remaining <= 0) return null
              return (
                <div key={item.id} className="rounded-lg border p-3">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input className="mt-1" type="checkbox" name={`select-${item.id}`} />
                    <span className="min-w-0 flex-1 text-sm font-semibold">
                      <span className="block break-words">{item.productName}</span>
                      <small className="block font-normal text-gray-500">Returnable: {remaining}</small>
                    </span>
                  </label>
                  <label className="mt-3 block sm:ml-7">
                    <span className="label">Quantity to return</span>
                    <input
                      className="control"
                      type="number"
                      name={`quantity-${item.id}`}
                      min="0.001"
                      max={remaining}
                      step="0.001"
                      defaultValue="1"
                    />
                  </label>
                </div>
              )
            })}
          </div>
        )}
        {action === 'void' && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
            This will void the entire sale and restore its stock. Add a reason so the change is easy to audit.
          </p>
        )}
        <label>
          <span className="label">Reason</span>
          <textarea className="control min-h-24 py-2" name="reason" required maxLength="500" />
        </label>
      </form>
    </Modal>
  )
}
