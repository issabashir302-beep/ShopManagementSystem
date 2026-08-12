export const checkoutFingerprint = (method, items) => JSON.stringify({ method, items: items.map((item) => [item.product.id, item.quantity]).sort() })
export const checkoutPayload = (clientRequestId, method, items) => ({ clientRequestId, payment: { method }, items: items.map((item) => ({ productId: item.product.id, quantity: String(item.quantity) })) })
