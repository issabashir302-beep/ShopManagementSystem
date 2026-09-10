import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../../components/layout/PageHeader";
import { Button } from "../../components/ui/Button";
import { PageLoading, ErrorState } from "../../components/feedback/States";
import { useToast } from "../../components/feedback/ToastProvider";
import { shopwiseApi } from "../../services/shopwiseApi";
import { supportedCurrencies } from "../../utils/format";
import { Link } from "react-router-dom";
export function SettingsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const query = useQuery({ queryKey: ["shop"], queryFn: shopwiseApi.shop.get });
  const mutation = useMutation({
    mutationFn: shopwiseApi.shop.update,
    onSuccess: (s) => {
      qc.setQueryData(["shop"], s);
      toast.success("Shop settings saved");
    },
    onError: (e) => toast.error("Unable to save settings", e.message),
  });
  if (query.isLoading) return <PageLoading />;
  if (query.error) return <ErrorState error={query.error} />;
  return (
    <>
      <PageHeader
        title="Shop settings"
        description="Details used across operations and receipts."
      />
      <ShopForm shop={query.data} mutation={mutation} />
      <section className="card mt-5 flex max-w-3xl flex-col items-start justify-between gap-4 rounded-xl p-4 sm:flex-row sm:items-center sm:p-6">
        <div><strong>Payments and M-Pesa</strong><p className="mt-1 text-sm text-gray-500">Configure a manual Till or connect Daraja for STK Push.</p></div>
        <Link to="/app/settings/payments"><Button variant="secondary">Configure payments</Button></Link>
      </section>
    </>
  );
}
function ShopForm({ shop, mutation }) {
  const submit = (e) => {
    e.preventDefault();
    mutation.mutate(
      Object.fromEntries(
        [...new FormData(e.currentTarget)].filter(([, v]) => v !== ""),
      ),
    );
  };
  return (
    <form
      onSubmit={submit}
      className="card grid max-w-3xl gap-5 rounded-xl p-4 sm:grid-cols-2 sm:p-6"
    >
      {[
        ["Shop name", "name"],
        ["Shop type", "type"],
        ["Address", "address"],
        ["City", "city"],
        ["Country", "country"],
      ].map(([l, n]) => (
        <label key={n}>
          <span className="label">{l}</span>
          <input
            className="control"
            name={n}
            defaultValue={shop[n] || ""}
            required={n === "name"}
          />
        </label>
      ))}
      <label>
        <span className="label">Currency</span>
        <select
          className="control"
          name="currency"
          defaultValue={shop.currency || "KES"}
          required
        >
          {supportedCurrencies.map(({ code, label }) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
        <small className="mt-1.5 block text-xs leading-5 text-gray-500">
          Used for prices, checkout, sales, payments, dashboards, and reports.
        </small>
      </label>
      <div className="sm:col-span-2">
        <Button className="max-sm:w-full" loading={mutation.isPending}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
