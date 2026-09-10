import { useEffect, useRef, useState } from 'react'
import JsBarcode from 'jsbarcode'
import { Printer } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { money } from '../../utils/format'

export function BarcodeGraphic({ value }) {
  const ref = useRef(null)
  const [invalid, setInvalid] = useState(false)
  useEffect(() => {
    const normalized = String(value || '').trim()
    try {
      const format = /^\d{13}$/.test(normalized) ? 'EAN13' : 'CODE128'
      JsBarcode(ref.current, normalized, { format, width: 2, height: 64, margin: 8, fontSize: 14, displayValue: true })
      setInvalid(false)
    } catch {
      try {
        JsBarcode(ref.current, normalized, { format: 'CODE128', width: 2, height: 64, margin: 8, fontSize: 14, displayValue: true })
        setInvalid(false)
      } catch { setInvalid(true) }
    }
  }, [value])
  return invalid ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">This barcode cannot be rendered. Edit the product and use a standard numeric or Code 128 value.</p> : <svg ref={ref} className="mx-auto max-w-full" aria-label={`Barcode ${value}`} />
}

export function BarcodeLabelModal({ product, close }) {
  return <Modal open={Boolean(product)} onClose={close} title="Print barcode label" footer={<><Button variant="secondary" onClick={close}>Close</Button><Button onClick={() => window.print()}><Printer size={16} />Print label</Button></>}>
    <div className="barcode-print-area mx-auto w-full max-w-sm rounded-xl border bg-white p-5 text-center">
      <strong className="block truncate text-lg">{product?.name}</strong>
      <span className="mt-1 block text-sm text-gray-500">{product?.sku || product?.category || 'Dukani product'}</span>
      {product?.barcode && <div className="mt-3"><BarcodeGraphic value={product.barcode} /></div>}
      <strong className="mt-2 block text-xl">{money(product?.sellingPrice)}</strong>
    </div>
  </Modal>
}
