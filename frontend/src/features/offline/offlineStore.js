const DB_NAME = 'shopwise-offline'
const DB_VERSION = 1
const CACHE = 'cache'
const SALES = 'sales'

function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(CACHE)) db.createObjectStore(CACHE)
      if (!db.objectStoreNames.contains(SALES)) db.createObjectStore(SALES, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function transaction(storeName, mode, action) {
  const db = await database()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode)
    const request = action(tx.objectStore(storeName))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => db.close()
  })
}

export const offlineStore = {
  get: (key) => transaction(CACHE, 'readonly', (store) => store.get(key)),
  set: (key, value) => transaction(CACHE, 'readwrite', (store) => store.put({ value, cachedAt: new Date().toISOString() }, key)),
  async cached(key) { return (await this.get(key))?.value },
  queue(sale) { return transaction(SALES, 'readwrite', (store) => store.put(sale)) },
  allSales: () => transaction(SALES, 'readonly', (store) => store.getAll()),
  removeSale: (id) => transaction(SALES, 'readwrite', (store) => store.delete(id)),
  async pendingSales(userId) { return (await this.allSales()).filter((sale) => sale.status !== 'synced' && sale.userId === userId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)) },
  async reduceInventory(key, items) {
    const entry = await this.get(key)
    if (!entry?.value?.items) return
    const quantities = new Map(items.map((item) => [item.productId, Number(item.quantity)]))
    entry.value.items = entry.value.items.map((item) => quantities.has(item.productId) ? { ...item, quantity: Math.max(0, Number(item.quantity) - quantities.get(item.productId)), updatedAt: new Date().toISOString() } : item)
    await this.set(key, entry.value)
  },
}

export async function cachedRequest(key, request) {
  try {
    const value = await request()
    await offlineStore.set(key, value)
    return value
  } catch (error) {
    const cached = await offlineStore.cached(key)
    if (cached) return cached
    throw error
  }
}

export function provisionalReference(id) { return `OFF-${id.slice(0, 8).toUpperCase()}` }
