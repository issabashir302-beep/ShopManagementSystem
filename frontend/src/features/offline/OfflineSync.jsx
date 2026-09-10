import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { shopwiseApi } from "../../services/shopwiseApi";
import { offlineStore } from "./offlineStore";
import { useAuth } from "../auth/AuthContext";

export function useConnectivity() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    addEventListener("online", update);
    addEventListener("offline", update);
    return () => {
      removeEventListener("online", update);
      removeEventListener("offline", update);
    };
  }, []);
  return online;
}

export function OfflineSyncStatus() {
  const online = useConnectivity();
  const auth = useAuth();
  const userId = auth.user?.id;
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(0);
  const [attention, setAttention] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);
  const refresh = useCallback(async () => {
    const sales = userId ? await offlineStore.pendingSales(userId) : [];
    setPending(sales.length);
    setAttention(sales.filter((sale) => sale.status === "attention").length);
  }, [userId]);
  const sync = useCallback(async () => {
    if (!userId || !navigator.onLine || syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    const run = async () => {
      for (const sale of await offlineStore.pendingSales(userId)) {
        try {
          await shopwiseApi.sales.checkout(sale.payload);
          await offlineStore.removeSale(sale.id);
        } catch (error) {
          await offlineStore.queue({
            ...sale,
            status:
              error.status >= 400 && error.status < 500
                ? "attention"
                : "pending",
            attempts: (sale.attempts || 0) + 1,
            lastAttemptAt: new Date().toISOString(),
            error: error.message,
          });
          if (!navigator.onLine || !error.status) break;
        }
      }
      await refresh();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["inventory"] }),
        queryClient.invalidateQueries({ queryKey: ["sales"] }),
      ]);
    };
    try {
      if (navigator.locks?.request)
        await navigator.locks.request(
          "dukani-offline-sales-sync",
          { ifAvailable: true },
          (lock) => (lock ? run() : undefined),
        );
      else await run();
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [queryClient, refresh, userId]);
  useEffect(() => {
    refresh();
    const queued = () => refresh();
    const onlineHandler = () => sync();
    addEventListener("shopwise:offline-sale", queued);
    addEventListener("online", onlineHandler);
    return () => {
      removeEventListener("shopwise:offline-sale", queued);
      removeEventListener("online", onlineHandler);
    };
  }, [refresh, sync]);
  return (
    <button
      onClick={sync}
      disabled={!online || syncing || !pending}
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-bold ${attention ? "bg-red-50 text-red-700" : online ? (pending ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700") : "bg-gray-100 text-gray-600"}`}
      title={
        attention
          ? `${attention} sale(s) need attention`
          : pending
            ? `${pending} sale(s) waiting to sync`
            : online
              ? "Online"
              : "Offline"
      }
    >
      {syncing ? (
        <RefreshCw className="animate-spin" size={14} />
      ) : online ? (
        <Wifi size={14} />
      ) : (
        <WifiOff size={14} />
      )}
      <span className="hidden sm:inline">
        {syncing
          ? "Syncing"
          : attention
            ? `${attention} attention`
            : online
              ? pending
                ? `${pending} pending`
                : "Online"
              : "Offline"}
      </span>
    </button>
  );
}
