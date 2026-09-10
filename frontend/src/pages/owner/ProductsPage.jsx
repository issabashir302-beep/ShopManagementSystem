import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, Boxes, Edit3, History, PackagePlus, Plus, Printer, RotateCcw, Search, SlidersHorizontal } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Badge } from '../../components/ui/Badge'
import { PageLoading, ErrorState, EmptyState } from '../../components/feedback/States'
import { useToast } from '../../components/feedback/ToastProvider'
import { shopwiseApi } from '../../services/shopwiseApi'
import { dateTime, friendly, money } from '../../utils/format'
import { BarcodeLabelModal } from '../../features/barcode/BarcodeLabel'

const stockState = (item) => Number(item.quantity) <= 0 ? 'out of stock' : item.isLowStock ? 'low stock' : 'in stock'

export function ProductsPage() {
  const [filters, setFilters] = useState({ search: '', category: 'all', stock: 'all', status: 'active' })
  const [editing, setEditing] = useState(undefined)
  const [adjusting, setAdjusting] = useState(null)
  const [history, setHistory] = useState(null)
  const [label, setLabel] = useState(null)
  const [page, setPage] = useState(1)
  useEffect(() => setPage(1), [filters])
  const queryClient = useQueryClient()
  const toast = useToast()
  const [productsQuery, inventoryQuery] = useQueries({ queries: [
    { queryKey: ['products', 'stock-workspace', filters.status], queryFn: () => shopwiseApi.products.list({ status: filters.status, pageSize: 100 }) },
    { queryKey: ['inventory', 'stock-workspace'], queryFn: () => shopwiseApi.inventory.list({ pageSize: 100 }) },
  ] })

  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['products'] }),
    queryClient.invalidateQueries({ queryKey: ['inventory'] }),
  ])
  const save = useMutation({
    mutationFn: async ({ id, body, initialStock }) => {
      if (id) return { product: await shopwiseApi.products.update(id, body), stockInitialized: true }
      const product = await shopwiseApi.products.create(body)
      if (!(Number(initialStock) > 0)) return { product, stockInitialized: true }
      try {
        await shopwiseApi.inventory.adjust(product.id, { movementType: 'INITIAL_STOCK', quantityChange: String(initialStock), reason: 'Opening stock' })
        return { product, stockInitialized: true }
      } catch { return { product, stockInitialized: false } }
    },
    onSuccess: async ({ stockInitialized }) => { await refresh(); setEditing(undefined); stockInitialized ? toast.success('Product saved') : toast.error('Product saved without opening stock', 'Use Adjust stock to add the opening quantity.') },
    onError: (error) => toast.error('Unable to save product', error.message),
  })
  const adjust = useMutation({
    mutationFn: ({ id, body }) => shopwiseApi.inventory.adjust(id, body),
    onSuccess: async () => { await refresh(); setAdjusting(null); toast.success('Stock updated') },
    onError: (error) => toast.error('Unable to update stock', error.message),
  })
  const archive = useMutation({
    mutationFn: shopwiseApi.products.archive,
    onSuccess: async () => { await refresh(); toast.success('Product archived') },
    onError: (error) => toast.error('Unable to archive product', error.message),
  })
  const restore = useMutation({
    mutationFn: shopwiseApi.products.restore,
    onSuccess: async () => { await refresh(); toast.success('Product restored', 'It is available in active products and the POS again.') },
    onError: (error) => toast.error('Unable to restore product', error.message),
  })

  const inventoryByProduct = useMemo(() => new Map((inventoryQuery.data?.items || []).map((item) => [item.productId, item])), [inventoryQuery.data])
  const allItems = useMemo(() => (productsQuery.data?.items || []).map((product) => {
    const inventory = inventoryByProduct.get(product.id)
    return { ...product, productId: product.id, quantity: Number(inventory?.quantity || 0), isLowStock: Boolean(inventory?.isLowStock), updatedAt: inventory?.updatedAt }
  }), [productsQuery.data, inventoryByProduct])
  const categories = useMemo(() => [...new Set(allItems.map((item) => item.category).filter(Boolean))].sort(), [allItems])
  const items = useMemo(() => allItems.filter((item) => {
    const text = `${item.name} ${item.sku || ''} ${item.barcode || ''}`.toLowerCase()
    const matchesSearch = text.includes(filters.search.trim().toLowerCase())
    const matchesCategory = filters.category === 'all' || item.category === filters.category
    const state = stockState(item)
    const matchesStock = filters.stock === 'all' || state === filters.stock
    return matchesSearch && matchesCategory && matchesStock
  }), [allItems, filters])
  const totalPages = Math.max(1, Math.ceil(items.length / 10))
  const currentPage = Math.min(page, totalPages)
  const pagedItems = items.slice((currentPage - 1) * 10, currentPage * 10)

  if (productsQuery.isLoading || inventoryQuery.isLoading) return <PageLoading />
  const error = productsQuery.error || inventoryQuery.error
  if (error) return <ErrorState error={error} retry={() => { productsQuery.refetch(); inventoryQuery.refetch() }} />
  const lowCount = allItems.filter((item) => item.isLowStock).length
  const outCount = allItems.filter((item) => Number(item.quantity) <= 0).length

  return <>
    <PageHeader title="Products & Stock" description="Manage product details, pricing, stock levels, and inventory history in one place." action={<Button onClick={() => setEditing(null)}><Plus size={17} />Add product</Button>} />
    <div className="mb-4 grid gap-3 min-[460px]:grid-cols-3">
      <Summary label="Products" value={allItems.length} icon={Boxes} />
      <Summary label="Low stock" value={lowCount} icon={SlidersHorizontal} tone="text-amber-700" />
      <Summary label="Out of stock" value={outCount} icon={PackagePlus} tone="text-red-700" />
    </div>
    <section className="card mb-4 grid gap-2 rounded-xl p-3 sm:grid-cols-2 lg:grid-cols-[minmax(260px,1fr)_repeat(3,auto)]">
      <label className="relative min-w-0"><span className="sr-only">Search products</span><Search className="absolute left-3 top-3 text-gray-400" size={17} /><input className="control pl-10" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Search name, SKU, or barcode" /></label>
      <select aria-label="Category" className="control lg:w-auto" value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}><option value="all">All categories</option>{categories.map((category) => <option key={category}>{category}</option>)}</select>
      <select aria-label="Stock level" className="control lg:w-auto" value={filters.stock} onChange={(event) => setFilters({ ...filters, stock: event.target.value })}><option value="all">All stock levels</option><option value="in stock">In stock</option><option value="low stock">Low stock</option><option value="out of stock">Out of stock</option></select>
      <select aria-label="Product status" className="control lg:w-auto" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="active">Active products</option><option value="archived">Archived products</option><option value="all">All products</option></select>
    </section>
    {items.length ? <><ProductList items={pagedItems} edit={setEditing} adjust={setAdjusting} history={setHistory} print={setLabel} archive={archive} restore={restore} /><section className="card mt-[-1px] rounded-b-xl"><Pagination data={{ page: currentPage, pageSize: 10, total: items.length, totalPages }} onPage={setPage} /></section></> : <section className="card rounded-xl"><EmptyState title="No matching products" message="Try changing the search or filters, or add a new product." action={<Button onClick={() => setEditing(null)}>Add product</Button>} /></section>}
    <ProductModal value={editing} open={editing !== undefined} close={() => setEditing(undefined)} save={save} />
    <AdjustmentModal item={adjusting} close={() => setAdjusting(null)} mutation={adjust} />
    <MovementModal item={history} close={() => setHistory(null)} />
    <BarcodeLabelModal product={label} close={() => setLabel(null)} />
  </>
}

function Summary({ label, value, icon: Icon, tone = 'text-brand-700' }) { return <article className="card flex items-center justify-between rounded-xl p-4"><div><span className="text-xs font-semibold text-gray-500">{label}</span><strong className="mt-1 block text-xl">{value}</strong></div><Icon className={tone} size={20} /></article> }

function ProductList({ items, edit, adjust, history, print, archive, restore }) { return <section className="card overflow-hidden rounded-xl">
  <div className="divide-y lg:hidden">{items.map((item) => <article className="p-4" key={item.id}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><strong className="block truncate">{item.name}</strong><span className="mt-1 block truncate text-xs text-gray-500">{item.sku || item.category || 'Uncategorised'} · {item.unit}</span>{item.barcode && <span className="mt-1 block font-mono text-[11px] text-gray-500">{item.barcode}</span>}</div><StockBadge item={item} /></div><div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-gray-50 p-3 text-sm"><Metric label="Selling" value={money(item.sellingPrice)} /><Metric label="Buying" value={money(item.buyingPrice)} /><Metric label="Quantity" value={`${item.quantity} ${item.unit}`} /></div><div className="mt-3 grid grid-cols-2 gap-2 min-[560px]:grid-cols-5">{item.isActive ? <><Button size="sm" variant="secondary" onClick={() => edit(item)}><Edit3 size={15} />Edit</Button><Button size="sm" variant="secondary" onClick={() => adjust(item)}><Plus size={15} />Stock</Button></> : <Button className="col-span-2" size="sm" onClick={() => restore.mutate(item.id)} loading={restore.isPending}><RotateCcw size={15} />Restore product</Button>}<Button size="sm" variant="ghost" onClick={() => history(item)}><History size={15} />History</Button><Button size="sm" variant="ghost" disabled={!item.barcode} onClick={() => print(item)}><Printer size={15} />Label</Button>{item.isActive && <Button size="sm" variant="ghost" onClick={() => archive.mutate(item.id)}><Archive size={15} />Archive</Button>}</div></article>)}</div>
  <div className="table-wrap hidden lg:block"><table className="data-table"><thead><tr><th>Product</th><th>Prices</th><th>Quantity</th><th>Stock</th><th>Updated</th><th>Actions</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><strong>{item.name}</strong><small className="block text-gray-500">{item.sku || 'No SKU'} · {item.category || 'Uncategorised'} · {item.unit}</small><small className="block font-mono text-gray-500">{item.barcode || 'No barcode'}</small></td><td><strong>{money(item.sellingPrice)}</strong><small className="block text-gray-500">Cost {money(item.buyingPrice)}</small></td><td className="font-bold">{item.quantity} <small className="font-normal text-gray-500">{item.unit}</small></td><td><StockBadge item={item} /></td><td>{dateTime(item.updatedAt)}</td><td><div className="flex justify-end gap-1">{item.isActive ? <><Button size="sm" variant="ghost" onClick={() => edit(item)}><Edit3 size={15} /><span className="sr-only">Edit</span></Button><Button size="sm" variant="ghost" onClick={() => adjust(item)}><Plus size={15} />Stock</Button></> : <Button size="sm" onClick={() => restore.mutate(item.id)} loading={restore.isPending}><RotateCcw size={15} />Restore</Button>}<Button size="sm" variant="ghost" onClick={() => history(item)}><History size={15} /><span className="sr-only">History</span></Button><Button size="sm" variant="ghost" disabled={!item.barcode} onClick={() => print(item)}><Printer size={15} /><span className="sr-only">Print barcode</span></Button>{item.isActive && <Button size="sm" variant="ghost" onClick={() => archive.mutate(item.id)}><Archive size={15} /><span className="sr-only">Archive</span></Button>}</div></td></tr>)}</tbody></table></div>
  <footer className="border-t px-4 py-3 text-xs text-gray-500">Showing {items.length} product{items.length === 1 ? '' : 's'}</footer>
</section> }

function Metric({ label, value }) { return <div className="min-w-0"><span className="block text-[11px] text-gray-500">{label}</span><strong className="mt-0.5 block truncate text-xs">{value}</strong></div> }
function StockBadge({ item }) { if (!item.isActive) return <Badge value="archived" />; const state = stockState(item); const tone = state === 'out of stock' ? 'bg-red-50 text-red-700' : state === 'low stock' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'; return <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{friendly(state)}</span> }

function ProductModal({ value, open, close, save }) { const submit = (event) => { event.preventDefault(); const values = Object.fromEntries([...new FormData(event.currentTarget)].filter(([, fieldValue]) => fieldValue !== '')); const { initialStock, ...body } = values; save.mutate({ id: value?.id, body, initialStock }) }; return <Modal open={open} onClose={close} title={value ? 'Edit product' : 'Add product'} footer={<><Button variant="secondary" onClick={close}>Cancel</Button><Button form="product-form" loading={save.isPending}>Save product</Button></>}><form id="product-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2"><h3 className="font-bold sm:col-span-2">Basic information</h3>{[['Name', 'name'], ['SKU', 'sku'], ['Category', 'category'], ['Unit', 'unit']].map(([label, name]) => <label key={name}><span className="label">{label}</span><input className="control" name={name} defaultValue={value?.[name] || ''} required={name === 'name' || name === 'unit'} /></label>)}<label className="sm:col-span-2"><span className="label">Barcode <small className="font-normal text-gray-500">(optional)</small></span><input className="control font-mono" name="barcode" defaultValue={value?.barcode || ''} placeholder="Scan an existing barcode or leave blank to generate one" /><small className="mt-1.5 block text-xs text-gray-500">Manufacturer barcodes are kept. A printable EAN-13 barcode is generated automatically when blank.</small></label><h3 className="mt-2 font-bold sm:col-span-2">Pricing and stock</h3>{[['Buying price', 'buyingPrice', '0.01'], ['Selling price', 'sellingPrice', '0.01'], ['Low-stock threshold', 'lowStockThreshold', '0.001']].map(([label, name, step]) => <label key={name}><span className="label">{label}</span><input className="control" name={name} type="number" min="0" step={step} defaultValue={value?.[name] ?? '0'} required /></label>)}{!value && <label><span className="label">Opening stock <small className="font-normal text-gray-500">(optional)</small></span><input className="control" name="initialStock" type="number" min="0" step="0.001" defaultValue="0" /></label>}</form></Modal> }

function AdjustmentModal({ item, close, mutation }) { const submit = (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); let quantity = Number(data.quantity); if (data.movementType === 'DAMAGE') quantity = -Math.abs(quantity); mutation.mutate({ id: item.id, body: { movementType: data.movementType, quantityChange: String(quantity), reason: data.reason } }) }; return <Modal open={Boolean(item)} onClose={close} title={`Adjust stock · ${item?.name || ''}`} footer={<><Button variant="secondary" onClick={close}>Cancel</Button><Button form="adjust-form" loading={mutation.isPending}>Update stock</Button></>}><form id="adjust-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2"><div className="rounded-lg bg-gray-50 p-3 text-sm sm:col-span-2"><span className="text-gray-500">Current quantity</span><strong className="ml-2">{item?.quantity} {item?.unit}</strong></div><label><span className="label">Movement</span><select className="control" name="movementType"><option value="RESTOCK">Restock / receive</option><option value="ADJUSTMENT">Stock correction</option><option value="DAMAGE">Damaged / lost</option></select></label><label><span className="label">Quantity</span><input className="control" name="quantity" type="number" step="0.001" required /></label><label className="sm:col-span-2"><span className="label">Reason</span><input className="control" name="reason" required placeholder="e.g. Supplier delivery" /></label></form></Modal> }

function MovementModal({ item, close }) { const query = useQuery({ queryKey: ['inventory', 'movements', item?.id], queryFn: () => shopwiseApi.inventory.movements(item.id), enabled: Boolean(item) }); return <Modal open={Boolean(item)} onClose={close} title={`${item?.name || 'Product'} stock history`}>{query.isLoading ? <PageLoading /> : query.error ? <ErrorState error={query.error} /> : query.data?.items.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Date</th><th>Type</th><th>Change</th><th>After</th><th>Reason</th></tr></thead><tbody>{query.data.items.map((movement) => <tr key={movement.id}><td>{dateTime(movement.createdAt)}</td><td>{friendly(movement.movementType)}</td><td>{movement.quantityChange}</td><td>{movement.quantityAfter}</td><td>{movement.reason || '—'}</td></tr>)}</tbody></table></div> : <EmptyState title="No stock movements" message="Stock activity for this product will appear here." />}</Modal> }

export function Pagination({ data, onPage }) { return <footer className="flex flex-col gap-3 border-t px-4 py-3 text-xs text-gray-500 min-[440px]:flex-row min-[440px]:items-center min-[440px]:justify-between"><span>{data.total} records</span><div className="flex items-center justify-between gap-2"><Button size="sm" variant="secondary" disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}>Previous</Button><span className="whitespace-nowrap">Page {data.page} of {Math.max(data.totalPages, 1)}</span><Button size="sm" variant="secondary" disabled={data.page >= data.totalPages} onClick={() => onPage(data.page + 1)}>Next</Button></div></footer> }
