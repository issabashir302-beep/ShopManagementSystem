import { useCallback, useMemo, useRef, useState } from "react";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Minus,
  Plus,
  Printer,
  ScanLine,
  Search,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { shopwiseApi } from "../../services/shopwiseApi";
import {
  PageLoading,
  ErrorState,
  EmptyState,
} from "../../components/feedback/States";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { useToast } from "../../components/feedback/ToastProvider";
import { useCart } from "../../features/pos/useCart";
import {
  checkoutFingerprint,
  checkoutPayload,
} from "../../features/pos/checkout";
import { CardPaymentModal } from "../../features/payments/CardPaymentModal";
import { pollPaymentStatus } from "../../features/payments/pollPayment";
import { CameraScanner } from "../../features/barcode/CameraScanner";
import {
  cachedRequest,
  offlineStore,
  provisionalReference,
} from "../../features/offline/offlineStore";
import { dateTime, money } from "../../utils/format";
import { useAuth } from "../../features/auth/AuthContext";
import { playItemAdded, playSaleComplete } from "../../features/pos/feedback";

export function PosPage() {
  const [search, setSearch] = useState("");
  const [scanning, setScanning] = useState(false);
  const [method, setMethod] = useState("cash");
  const [cash, setCash] = useState("");
  const [result, setResult] = useState(null);
  const [card, setCard] = useState(null);
  const [mobileCart, setMobileCart] = useState(false);
  const request = useRef(null);
  const queryClient = useQueryClient();
  const toast = useToast();
  const auth = useAuth();
  const userId = auth.user?.id;
  const inventoryCacheKey = `inventory:${userId}`;
  const [productsQuery] = useQueries({
    queries: [
      {
        queryKey: ["products", "pos-catalog"],
        queryFn: () =>
          cachedRequest(`catalog:${userId}`, shopwiseApi.products.catalog),
        staleTime: 120_000,
      },
    ],
  });
  const products = useMemo(
    () =>
      (productsQuery.data?.items || []).map((product) => ({
        ...product,
        stock: Number(product.quantity || 0),
      })),
    [productsQuery.data],
  );
  const cart = useCart(products);
  const addProduct = useCallback(
    (product) => {
      if (product.stock <= 0) {
        toast.error("Product is out of stock", product.name);
        return;
      }
      const nextQuantity =
        (cart.items.find((item) => item.product.id === product.id)?.quantity ||
          0) + 1;
      cart.add(product);
      toast.success(
        "Added to cart",
        `${product.name} · ${nextQuantity} in cart`,
      );
      playItemAdded();
    },
    [cart, toast],
  );
  const addBarcode = useCallback(
    (barcode) => {
      const normalized = String(barcode).trim();
      const product = products.find((item) => item.barcode === normalized);
      setScanning(false);
      if (!product) {
        setSearch(normalized);
        toast.error(
          "Barcode not found",
          "No active product uses this barcode.",
        );
        return;
      }
      if (product.stock <= 0) {
        toast.error("Product is out of stock", product.name);
        return;
      }
      addProduct(product);
      setSearch("");
      toast.success("Added to cart", product.name);
    },
    [addProduct, products, toast],
  );
  const checkout = useMutation({
    mutationFn: async () => {
      const fingerprint = checkoutFingerprint(method, cart.items);
      if (request.current?.fingerprint !== fingerprint)
        request.current = { fingerprint, id: crypto.randomUUID() };
      const payload = checkoutPayload(request.current.id, method, cart.items);
      if (method === "cash") {
        try {
          return await shopwiseApi.sales.checkout(payload);
        } catch (error) {
          if (
            error.status &&
            error.status !== 503 &&
            error.code !== "DEPENDENCY_UNAVAILABLE"
          )
            throw error;
          const localReference = provisionalReference(request.current.id);
          await offlineStore.queue({
            id: request.current.id,
            userId,
            payload,
            localReference,
            status: "pending",
            attempts: 0,
            createdAt: new Date().toISOString(),
          });
          await offlineStore.reduceInventory(inventoryCacheKey, payload.items);
          dispatchEvent(new Event("shopwise:offline-sale"));
          return {
            offline: true,
            sale: {
              id: request.current.id,
              receiptNumber: localReference,
              totalAmount: cart.total,
            },
            payment: { status: "pending", method: "cash" },
          };
        }
      }
      return shopwiseApi.sales.checkout(payload);
    },
    onSuccess: async (data) => {
      request.current = null;
      cart.clear();
      setCash("");
      setMobileCart(false);
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      if (!data.offline) queryClient.invalidateQueries({ queryKey: ["sales"] });
      if (method === "card") {
        try {
          const intent = await shopwiseApi.payments.intent(data.sale.id);
          setCard({ clientSecret: intent.clientSecret, saleId: data.sale.id });
        } catch {
          setResult(data);
          toast.error(
            "Card setup unavailable",
            "The sale remains pending. Review it before retrying.",
          );
        }
      } else {
        setResult(data);
        if (!data.offline && data.payment?.status === "completed")
          playSaleComplete();
      }
    },
    onError: (error) => {
      if (
        error.status >= 400 &&
        error.status < 500 &&
        error.status !== 408 &&
        error.status !== 429
      )
        request.current = null;
      toast.error(
        error.code === "INSUFFICIENT_STOCK"
          ? "Insufficient stock"
          : "Checkout failed",
        error.message,
      );
    },
  });
  if (productsQuery.isLoading) return <PageLoading />;
  const error = productsQuery.error;
  if (error)
    return (
      <div className="p-6">
        <ErrorState error={error} />
      </div>
    );
  const filtered = products.filter((product) =>
    `${product.name}${product.sku || ""}${product.barcode || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const submit = () => {
    if (!navigator.onLine && method !== "cash")
      return toast.error(
        "Offline payment unavailable",
        "Only cash sales can be queued while this device is offline.",
      );
    if (method === "cash" && Number(cash) < cart.total)
      return toast.error(
        "Insufficient cash received",
        "Cash received must cover the amount due.",
      );
    if (method === "card" && !import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
      return toast.error(
        "Card payments unavailable",
        "Configure VITE_STRIPE_PUBLISHABLE_KEY with a Stripe test publishable key.",
      );
    checkout.mutate();
  };
  return (
    <main className="pos-layout h-[calc(100dvh-64px)] overflow-hidden lg:pr-[390px]">
      <section className="min-w-0 p-4 sm:p-6">
        <div className="mb-5 flex items-center gap-2 sm:gap-3">
          <label className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-3 text-gray-400" size={18} />
            <input
              className="control pl-10"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addBarcode(search);
                }
              }}
              placeholder="Search or scan barcode"
              autoFocus
            />
          </label>
          <Button
            variant="secondary"
            onClick={() => setScanning(true)}
            aria-label="Scan with camera"
          >
            <ScanLine size={18} />
            <span className="hidden sm:inline">Scan</span>
          </Button>
          <Button className="lg:hidden" onClick={() => setMobileCart(true)}>
            <ShoppingCart size={17} />
            {cart.count}
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.length ? (
            filtered.map((product) => (
              <button
                key={product.id}
                disabled={product.stock <= 0}
                onClick={() => addProduct(product)}
                className="card min-h-36 rounded-xl p-4 text-left transition hover:border-brand-500 disabled:cursor-not-allowed disabled:opacity-55"
              >
                <strong className="block">{product.name}</strong>
                <small className="mt-1 block text-gray-500">
                  {product.sku || product.category || "Product"}
                </small>
                {product.barcode && (
                  <small className="mt-1 block font-mono text-[10px] text-gray-400">
                    {product.barcode}
                  </small>
                )}
                <div className="mt-7 flex items-end justify-between">
                  <span className="text-lg font-extrabold text-brand-700">
                    {money(product.sellingPrice)}
                  </span>
                  <span
                    className={`text-xs ${product.isLowStock ? "text-amber-700" : "text-gray-500"}`}
                  >
                    {product.stock} {product.unit}
                  </span>
                </div>
              </button>
            ))
          ) : (
            <div className="sm:col-span-2 xl:col-span-3">
              <EmptyState
                title="No products found"
                message="Try another name, SKU, or barcode."
              />
            </div>
          )}
        </div>
      </section>
      <aside
        className={`pos-cart fixed inset-y-0 right-0 z-[60] w-[min(390px,100%)] border-l bg-white transition-transform lg:bottom-0 lg:top-16 lg:z-40 lg:w-[390px] lg:translate-x-0 ${mobileCart ? "translate-x-0" : "translate-x-full"}`}
      >
        <Cart
          cart={cart}
          method={method}
          setMethod={setMethod}
          cash={cash}
          setCash={setCash}
          submit={submit}
          loading={checkout.isPending}
          close={() => setMobileCart(false)}
        />
      </aside>
      {mobileCart && (
        <button
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setMobileCart(false)}
          aria-label="Close cart"
        />
      )}
      <CameraScanner
        open={scanning}
        close={() => setScanning(false)}
        onDetected={addBarcode}
      />
      <ReceiptModal result={result} close={() => setResult(null)} />
      {card && (
        <CardPaymentModal
          {...card}
          onClose={() => setCard(null)}
          onConfirmed={async (saleId) => {
            const settled = await pollPaymentStatus(
              saleId,
              shopwiseApi.sales.get,
            );
            const detail =
              settled?.detail || (await shopwiseApi.sales.get(saleId));
            setResult({
              sale: detail.sale,
              items: detail.items,
              payment: detail.payments?.[0],
            });
            if (detail.payments?.[0]?.status === "completed")
              playSaleComplete();
            setCard(null);
          }}
        />
      )}
    </main>
  );
}

function Cart({
  cart,
  method,
  setMethod,
  cash,
  setCash,
  submit,
  loading,
  close,
}) {
  return (
    <div className="flex h-full min-h-[100dvh] flex-col lg:min-h-[calc(100dvh-64px)]">
      <header className="flex h-16 shrink-0 items-center justify-between border-b px-4 sm:px-5">
        <div>
          <h2 className="font-extrabold">Current sale</h2>
          <small className="text-gray-500">{cart.count} items</small>
        </div>
        <button
          className="grid size-11 place-items-center rounded-lg lg:hidden"
          onClick={close}
          aria-label="Close cart"
        >
          <X />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-5">
        {cart.items.length ? (
          cart.items.map((item) => (
            <article className="border-b py-4" key={item.product.id}>
              <div className="flex justify-between gap-3">
                <div className="min-w-0">
                  <strong className="block break-words text-sm">
                    {item.product.name}
                  </strong>
                  <small className="block text-gray-500">
                    {money(item.product.sellingPrice)} each
                  </small>
                </div>
                <strong className="shrink-0">
                  {money(Number(item.product.sellingPrice) * item.quantity)}
                </strong>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center rounded-lg border">
                  <button
                    className="grid size-11 place-items-center"
                    aria-label={`Decrease ${item.product.name}`}
                    onClick={() => cart.change(item.product, -1)}
                  >
                    <Minus size={14} />
                  </button>
                  <span className="min-w-8 text-center text-sm">
                    {item.quantity}
                  </span>
                  <button
                    className="grid size-11 place-items-center"
                    aria-label={`Increase ${item.product.name}`}
                    onClick={() => cart.change(item.product, 1)}
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <button
                  className="grid size-11 place-items-center text-red-600"
                  aria-label={`Remove ${item.product.name}`}
                  onClick={() => cart.remove(item.product.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))
        ) : (
          <EmptyState
            title="Cart is empty"
            message="Tap a product or scan a barcode to begin a sale."
          />
        )}
      </div>
      <footer className="safe-bottom shrink-0 border-t p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="text-sm text-gray-500">Amount due</span>
          <strong className="break-words text-right text-2xl">
            {money(cart.total)}
          </strong>
        </div>
        <div className="mb-4 grid grid-cols-3 gap-1 rounded-lg bg-gray-100 p-1">
          {["cash", "mpesa", "card"].map((value) => (
            <button
              key={value}
              onClick={() => setMethod(value)}
              className={`rounded-md px-2 py-2 text-xs font-bold uppercase ${method === value ? "bg-white text-brand-700 shadow-sm" : "text-gray-500"}`}
            >
              {value}
            </button>
          ))}
        </div>
        {method === "cash" && (
          <div className="mb-4 grid gap-2 min-[360px]:grid-cols-2">
            <label>
              <span className="label text-xs">Cash received</span>
              <input
                className="control"
                type="number"
                min={cart.total}
                value={cash}
                onChange={(event) => setCash(event.target.value)}
              />
            </label>
            <div>
              <span className="label text-xs">Change</span>
              <div className="control flex items-center bg-gray-50 font-semibold">
                {money(Math.max(0, Number(cash || 0) - cart.total))}
              </div>
            </div>
          </div>
        )}
        {method !== "cash" && (
          <p className="mb-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            {method === "mpesa"
              ? "M-Pesa remains pending until supported confirmation is available."
              : "Stripe Elements collects card details after the backend records a pending sale."}
          </p>
        )}
        <Button
          size="lg"
          className="w-full"
          disabled={!cart.items.length}
          loading={loading}
          onClick={submit}
        >
          Charge {money(cart.total)}
        </Button>
      </footer>
    </div>
  );
}

function ReceiptModal({ result, close }) {
  const payment = result?.payment || result?.payments?.[0],
    confirmed = payment?.status === "completed",
    items = result?.items || [];
  const title = result?.offline
    ? "Provisional receipt"
    : payment?.status === "pending"
      ? "Payment pending"
      : payment?.status === "failed"
        ? "Payment failed"
        : "Payment received";
  return (
    <Modal
      open={Boolean(result)}
      onClose={close}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer size={16} />
            Print
          </Button>
          <Button onClick={close}>New sale</Button>
        </>
      }
    >
      <div className="receipt-print-area text-center">
        <div className="hidden print:block">
          <strong className="text-xl">Dukani</strong>
          <p className="mt-1 text-xs">Sales receipt</p>
        </div>
        {confirmed ? (
          <CheckCircle2
            className="mx-auto text-brand-600 print:hidden"
            size={52}
          />
        ) : (
          <AlertTriangle
            className="mx-auto text-amber-600 print:hidden"
            size={52}
          />
        )}
        <div className="mt-3 print:hidden">
          <Badge value={result?.offline ? "pending sync" : payment?.status} />
        </div>
        <h3 className="mt-4 text-2xl font-extrabold">
          {result?.sale?.receiptNumber}
        </h3>
        <p className="mt-1 text-xs text-gray-500">
          {result?.sale?.createdAt
            ? dateTime(result.sale.createdAt)
            : dateTime(new Date())}
        </p>
        {items.length > 0 && (
          <div className="mt-5 border-y py-2 text-left">
            {items.map((item) => (
              <div
                className="flex justify-between gap-3 py-1 text-xs"
                key={item.id || item.productId}
              >
                <span>
                  {item.productName || item.name} × {item.quantity}
                </span>
                <strong>
                  {money(
                    item.subtotal ??
                      Number(item.unitPrice || 0) * Number(item.quantity || 0),
                  )}
                </strong>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 flex items-center justify-between">
          <strong>Total</strong>
          <strong className="text-2xl text-brand-700">
            {money(result?.sale?.totalAmount)}
          </strong>
        </div>
        <p className="mt-2 text-xs">
          Payment: {payment?.method?.toUpperCase() || "—"} ·{" "}
          {result?.offline
            ? "PENDING SYNC"
            : payment?.status?.toUpperCase() || "—"}
        </p>
        {result?.offline ? (
          <p className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            This cash sale is saved on this device and is pending
            synchronization. The final receipt number will be assigned by the
            server.
          </p>
        ) : (
          payment?.status === "pending" && (
            <p className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              Payment is not confirmed yet. Refresh its status before handing
              over goods.
            </p>
          )
        )}
        <p className="mt-6 hidden border-t pt-3 text-xs print:block">
          Thank you for shopping with us.
        </p>
      </div>
    </Modal>
  );
}
