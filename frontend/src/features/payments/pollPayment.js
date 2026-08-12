export async function pollPaymentStatus(saleId, loadSale, { attempts = 10, interval = 2000, wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const detail = await loadSale(saleId)
    const payment = detail.payments?.[0]
    if (payment?.status === 'completed' || payment?.status === 'failed') return { detail, payment }
    if (attempt < attempts - 1) await wait(interval)
  }
  return null
}
