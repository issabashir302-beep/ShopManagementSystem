const DB_NAME = "shopwise-offline";
const DB_VERSION = 1;
const CACHE = "cache";
const SALES = "sales";
const MAX_PENDING_SALES = 100;
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CACHE)) db.createObjectStore(CACHE);
      if (!db.objectStoreNames.contains(SALES))
        db.createObjectStore(SALES, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transaction(storeName, mode, action) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const request = action(tx.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error || new Error("Offline storage transaction was aborted"));
    };
  });
}

export const offlineStore = {
  get: (key) => transaction(CACHE, "readonly", (store) => store.get(key)),
  set: (key, value) =>
    transaction(CACHE, "readwrite", (store) =>
      store.put({ value, cachedAt: new Date().toISOString() }, key),
    ),
  async cached(key, maxAgeMs = CACHE_MAX_AGE_MS) {
    const entry = await this.get(key);
    if (!entry?.cachedAt || Date.now() - Date.parse(entry.cachedAt) > maxAgeMs)
      return undefined;
    return entry.value;
  },
  async queue(sale) {
    if (!sale?.id || !sale?.userId || !sale?.payload || !sale?.createdAt) {
      throw new Error("Offline sale is incomplete");
    }
    const existing = await this.allSales();
    if (
      !existing.some((entry) => entry.id === sale.id) &&
      existing.filter((entry) => entry.status !== "synced").length >=
        MAX_PENDING_SALES
    ) {
      throw new Error(
        "This device has reached the offline sale limit. Connect and sync before taking another sale.",
      );
    }
    return transaction(SALES, "readwrite", (store) => store.put(sale));
  },
  allSales: () => transaction(SALES, "readonly", (store) => store.getAll()),
  removeSale: (id) =>
    transaction(SALES, "readwrite", (store) => store.delete(id)),
  async clearUserCache(userId) {
    if (!userId) return;
    await Promise.all(
      ["shop", "catalog", "inventory"].map((prefix) =>
        transaction(CACHE, "readwrite", (store) =>
          store.delete(`${prefix}:${userId}`),
        ),
      ),
    );
  },
  async pendingSales(userId) {
    return (await this.allSales())
      .filter((sale) => sale.status !== "synced" && sale.userId === userId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },
  async reduceInventory(key, items) {
    const entry = await this.get(key);
    if (!entry?.value?.items) return;
    const quantities = new Map(
      items.map((item) => [item.productId, Number(item.quantity)]),
    );
    entry.value.items = entry.value.items.map((item) =>
      quantities.has(item.productId)
        ? {
            ...item,
            quantity: Math.max(
              0,
              Number(item.quantity) - quantities.get(item.productId),
            ),
            updatedAt: new Date().toISOString(),
          }
        : item,
    );
    await this.set(key, entry.value);
  },
};

export async function cachedRequest(key, request) {
  try {
    const value = await request();
    await offlineStore.set(key, value);
    return value;
  } catch (error) {
    if (
      error?.status &&
      error.status !== 503 &&
      error.code !== "DEPENDENCY_UNAVAILABLE"
    )
      throw error;
    const cached = await offlineStore.cached(key);
    if (cached) return cached;
    throw error;
  }
}

export function provisionalReference(id) {
  return `OFF-${id.slice(0, 8).toUpperCase()}`;
}
