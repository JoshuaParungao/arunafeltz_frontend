import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Eye,
  LoaderCircle,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

import {
  cancelCreditCollection,
  createCreditCollection,
  getCreditAccountById,
  getCreditAccounts,
} from "../../features/credit-accounts/creditAccounts.api";
import { generateUUID } from "../../utils/uuid";

const TERMS = [
  "STRAIGHT",
  "MONTH_3",
  "MONTH_6",
  "MONTH_9",
  "MONTH_12",
  "MONTH_18",
  "MONTH_24",
];
const PAYMENT_METHODS = ["CASH", "GCASH", "BANK_TRANSFER", "OTHER"];
const PROVIDERS = [
  "CREDIT_CARD",
  "DEBIT_CARD",
  "HOMECREDIT",
  "SALMON",
  "KYRO",
  "OTHER_FINANCING",
  "IN_HOUSE_INSTALLMENT",
];
const SOURCE_TYPES = ["SALE", "SERVICE_JOB"];
const COLLECTION_CANCELLER_ROLES = new Set([
  "SUPER_OWNER",
  "BRANCH_OWNER",
  "ADMIN",
]);

function money(value) {
  return `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dateTime(value, dateOnly = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return dateOnly
    ? date.toLocaleDateString("en-PH", { timeZone: "Asia/Manila" })
    : date.toLocaleString("en-PH", { timeZone: "Asia/Manila" });
}

function apiError(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error?.message ||
    fallback
  );
}

function label(value) {
  return String(value || "—").replaceAll("_", " ");
}

function Status({ value }) {
  const className =
    value === "PAID" || value === "POSTED"
      ? "bg-emerald-50 text-emerald-700"
      : value === "ACTIVE"
        ? "bg-amber-50 text-amber-700"
        : "bg-rose-50 text-rose-700";
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-black ${className}`}
    >
      {label(value)}
    </span>
  );
}

function isOverdue(account) {
  if (account.status !== "ACTIVE" || !account.nextDueDate) return false;
  const due = new Date(account.nextDueDate);
  return !Number.isNaN(due.getTime()) && due.getTime() < Date.now();
}

export default function CreditsPage({ selectedBranch, user }) {
  const branchId =
    selectedBranch?.id || user?.branchId || user?.branch?.id || "";
  const [accounts, setAccounts] = useState([]);
  const [meta, setMeta] = useState({});
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [term, setTerm] = useState("");
  const [provider, setProvider] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [detail, setDetail] = useState(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [showCollectionForm, setShowCollectionForm] = useState(false);
  const [collectionForm, setCollectionForm] = useState({
    amount: "",
    paymentMethod: "CASH",
    referenceNo: "",
    remarks: "",
    paidAt: "",
  });
  const collectionRequestRef = useRef({ signature: "", key: "" });
  const canCancelCollections = COLLECTION_CANCELLER_ROLES.has(user?.role);

  const loadAccounts = useCallback(async () => {
    setIsLoading(true);
    setMessage("");
    try {
      const response = await getCreditAccounts({
        ...(branchId ? { branchId } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(status ? { status } : {}),
        ...(term ? { term } : {}),
        ...(provider ? { provider } : {}),
        ...(sourceType ? { sourceType } : {}),
        page,
        limit: 20,
      });
      const result = response?.data || {};
      setAccounts(result.data || []);
      setMeta(result.meta || {});
    } catch (error) {
      setAccounts([]);
      setMeta({});
      setMessage(apiError(error, "Could not load credit accounts."));
    } finally {
      setIsLoading(false);
    }
  }, [branchId, page, provider, search, sourceType, status, term]);

  useEffect(() => {
    const timer = window.setTimeout(loadAccounts, 200);
    return () => window.clearTimeout(timer);
  }, [loadAccounts]);

  const openDetail = async (account) => {
    setDetail(account);
    setIsDetailLoading(true);
    setMessage("");
    setShowCollectionForm(false);
    try {
      const response = await getCreditAccountById(account.id);
      setDetail(response?.data || account);
    } catch (error) {
      setMessage(apiError(error, "Could not load credit account details."));
    } finally {
      setIsDetailLoading(false);
    }
  };

  const refreshDetail = async () => {
    if (!detail?.id) return;
    const response = await getCreditAccountById(detail.id);
    setDetail(response?.data || detail);
  };

  const submitCollection = async (event) => {
    event.preventDefault();
    if (!detail || isSaving) return;
    setIsSaving(true);
    setMessage("");
    try {
      const collectionPayload = {
        amount: Number(collectionForm.amount),
        paymentMethod: collectionForm.paymentMethod,
        referenceNo: collectionForm.referenceNo.trim() || undefined,
        remarks: collectionForm.remarks.trim() || undefined,
        paidAt: collectionForm.paidAt || undefined,
      };
      const requestSignature = JSON.stringify({
        creditAccountId: detail.id,
        ...collectionPayload,
      });

      if (collectionRequestRef.current.signature !== requestSignature) {
        collectionRequestRef.current = {
          signature: requestSignature,
          key: generateUUID(),
        };
      }

      await createCreditCollection(detail.id, {
        ...collectionPayload,
        idempotencyKey: collectionRequestRef.current.key,
      });
      setNotice(`Collection posted to ${detail.creditCode}.`);
      collectionRequestRef.current = { signature: "", key: "" };
      setCollectionForm({
        amount: "",
        paymentMethod: "CASH",
        referenceNo: "",
        remarks: "",
        paidAt: "",
      });
      setShowCollectionForm(false);
      await Promise.all([refreshDetail(), loadAccounts()]);
    } catch (error) {
      setMessage(apiError(error, "Could not post credit collection."));
    } finally {
      setIsSaving(false);
    }
  };

  const reverseCollection = async (collection) => {
    const reason = window.prompt(
      `Reason for reversing ${collection.collectionCode}?`,
    );
    if (!reason?.trim() || isSaving) return;
    setIsSaving(true);
    setMessage("");
    try {
      await cancelCreditCollection(collection.id, {
        cancellationReason: reason.trim(),
      });
      setNotice(
        `${collection.collectionCode} reversed with linked cash adjustment where applicable.`,
      );
      await Promise.all([refreshDetail(), loadAccounts()]);
    } catch (error) {
      setMessage(apiError(error, "Could not reverse credit collection."));
    } finally {
      setIsSaving(false);
    }
  };

  const totals = useMemo(
    () =>
      accounts.reduce(
        (summary, account) => ({
          balance: summary.balance + Number(account.remainingBalance || 0),
          collected: summary.collected + Number(account.totalCollected || 0),
          overdue: summary.overdue + (isOverdue(account) ? 1 : 0),
        }),
        { balance: 0, collected: 0, overdue: 0 },
      ),
    [accounts],
  );
  const totalPages = Math.max(1, meta.totalPages || 1);

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-maroon)]">
              Finance
            </p>
            <h1 className="mt-2 text-2xl font-black text-[var(--color-text-strong)]">
              Accounts Receivable
            </h1>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Sale and service balances by provider, with auditable partial
              collections and reversals.
            </p>
          </div>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-bold"
            disabled={isLoading}
            onClick={loadAccounts}
            type="button"
          >
            <RefreshCw className={isLoading ? "animate-spin" : ""} size={16} />
            Refresh
          </button>
        </div>
      </section>

      {message ? (
        <div className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">
          {message}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
          {notice}
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border bg-white p-5 shadow-card">
          <p className="text-sm font-semibold text-[var(--color-muted)]">
            Visible remaining balance
          </p>
          <p className="mt-2 text-2xl font-black">{money(totals.balance)}</p>
        </div>
        <div className="rounded-3xl border bg-white p-5 shadow-card">
          <p className="text-sm font-semibold text-[var(--color-muted)]">
            Visible collections
          </p>
          <p className="mt-2 text-2xl font-black">{money(totals.collected)}</p>
        </div>
        <div className="rounded-3xl border bg-white p-5 shadow-card">
          <p className="text-sm font-semibold text-[var(--color-muted)]">
            Overdue on this page
          </p>
          <p className="mt-2 text-2xl font-black text-rose-700">
            {totals.overdue}
          </p>
        </div>
      </section>

      <section className="grid gap-3 rounded-3xl border border-[var(--color-border)] bg-white p-4 shadow-card md:grid-cols-5">
        <label className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
            size={16}
          />
          <input
            aria-label="Search receivables"
            className="w-full rounded-xl border py-3 pl-10 pr-3 text-sm"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="AR, customer, sale, service"
            value={search}
          />
        </label>
        <select
          aria-label="Filter receivables by status"
          className="rounded-xl border px-3 py-3 text-sm"
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          value={status}
        >
          <option value="">All statuses</option>
          {["ACTIVE", "PAID", "CANCELLED", "DEFAULTED"].map((value) => (
            <option key={value} value={value}>
              {label(value)}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter receivables by source"
          className="rounded-xl border px-3 py-3 text-sm"
          onChange={(event) => {
            setSourceType(event.target.value);
            setPage(1);
          }}
          value={sourceType}
        >
          <option value="">All sources</option>
          {SOURCE_TYPES.map((value) => (
            <option key={value} value={value}>
              {label(value)}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter receivables by provider"
          className="rounded-xl border px-3 py-3 text-sm"
          onChange={(event) => {
            setProvider(event.target.value);
            setPage(1);
          }}
          value={provider}
        >
          <option value="">All providers</option>
          {PROVIDERS.map((value) => (
            <option key={value} value={value}>
              {label(value)}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter receivables by installment term"
          className="rounded-xl border px-3 py-3 text-sm"
          onChange={(event) => {
            setTerm(event.target.value);
            setPage(1);
          }}
          value={term}
        >
          <option value="">All terms</option>
          {TERMS.map((value) => (
            <option key={value} value={value}>
              {label(value)}
            </option>
          ))}
        </select>
      </section>

      <section className="overflow-hidden rounded-3xl border border-[var(--color-border)] bg-white shadow-card">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm font-bold text-[var(--color-muted)]">
            <LoaderCircle className="animate-spin" size={18} />
            Loading receivables...
          </div>
        ) : accounts.length === 0 ? (
          <div className="p-10 text-center">
            <CreditCard
              className="mx-auto text-[var(--color-muted)]"
              size={38}
            />
            <p className="mt-3 font-black">No matching receivables</p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Receivables are opened atomically from sale or service settlement
              flows.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[940px] text-left text-sm">
                <thead className="bg-[var(--color-soft)] text-xs uppercase text-[var(--color-muted)]">
                  <tr>
                    <th className="px-4 py-3">Account</th>
                    <th className="px-4 py-3">Customer / source</th>
                    <th className="px-4 py-3">Provider / term</th>
                    <th className="px-4 py-3">Next due</th>
                    <th className="px-4 py-3 text-right">Remaining</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {accounts.map((account) => (
                    <tr
                      className={isOverdue(account) ? "bg-rose-50/40" : ""}
                      key={account.id}
                    >
                      <td className="px-4 py-4">
                        <p className="font-black">{account.creditCode}</p>
                        <p className="text-xs text-[var(--color-muted)]">
                          {account.branch?.code}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-semibold">
                          {account.customer?.fullName ||
                            account.serviceJob?.customerNameSnapshot ||
                            "Walk-in / external provider"}
                        </p>
                        <p className="text-xs text-[var(--color-muted)]">
                          {account.sale?.receiptCode ||
                            account.serviceJob?.jobCode ||
                            "Source unavailable"}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <p>{label(account.provider)}</p>
                        <p className="text-xs text-[var(--color-muted)]">
                          {account.term
                            ? label(account.term)
                            : "No installment term"}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <p>{dateTime(account.nextDueDate, true)}</p>
                        {isOverdue(account) ? (
                          <p className="text-xs font-black text-rose-700">
                            OVERDUE
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-right font-black">
                        {money(account.remainingBalance)}
                      </td>
                      <td className="px-4 py-4">
                        <Status value={account.status} />
                      </td>
                      <td className="px-4 py-4">
                        <button
                          className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-bold"
                          onClick={() => openDetail(account)}
                          type="button"
                        >
                          <Eye size={14} />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid gap-3 p-4 lg:hidden">
              {accounts.map((account) => (
                <article
                  className={`rounded-2xl border p-4 ${isOverdue(account) ? "border-rose-200 bg-rose-50/40" : ""}`}
                  key={account.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black">{account.creditCode}</p>
                      <p className="mt-1 text-sm">
                        {account.customer?.fullName ||
                          account.serviceJob?.customerNameSnapshot ||
                          "Walk-in / external provider"}
                      </p>
                      <p className="text-xs text-[var(--color-muted)]">
                        {label(account.provider)} ·{" "}
                        {account.sale?.receiptCode ||
                          account.serviceJob?.jobCode}
                      </p>
                    </div>
                    <Status value={account.status} />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-[var(--color-muted)]">
                        Remaining
                      </p>
                      <p className="font-black">
                        {money(account.remainingBalance)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--color-muted)]">
                        Next due
                      </p>
                      <p className="font-bold">
                        {dateTime(account.nextDueDate, true)}
                      </p>
                    </div>
                  </div>
                  <button
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold"
                    onClick={() => openDetail(account)}
                    type="button"
                  >
                    <Eye size={15} />
                    View account
                  </button>
                </article>
              ))}
            </div>
          </>
        )}
        <div className="flex items-center justify-between border-t p-4">
          <p className="text-sm text-[var(--color-muted)]">
            Page {meta.page || page} of {totalPages} · {meta.total || 0}{" "}
            account(s)
          </p>
          <div className="flex gap-2">
            <button
              className="rounded-xl border p-2 disabled:opacity-30"
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              type="button"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              className="rounded-xl border p-2 disabled:opacity-30"
              disabled={page >= totalPages}
              onClick={() => setPage((value) => value + 1)}
              type="button"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {detail ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 p-3 sm:p-6">
          <section className="mx-auto max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b p-5">
              <div>
                <p className="text-xs font-black text-[var(--color-maroon)]">
                  {detail.creditCode}
                </p>
                <h2 className="mt-1 text-xl font-black">
                  {detail.customer?.fullName ||
                    detail.serviceJob?.customerNameSnapshot ||
                    "Walk-in / external provider"}
                </h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Status value={detail.status} />
                  {isOverdue(detail) ? (
                    <span className="rounded-full bg-rose-600 px-2.5 py-1 text-xs font-black text-white">
                      OVERDUE
                    </span>
                  ) : null}
                </div>
              </div>
              <button
                className="rounded-xl border p-2"
                onClick={() => setDetail(null)}
                type="button"
              >
                <X size={18} />
              </button>
            </header>
            {isDetailLoading ? (
              <div className="flex items-center justify-center gap-2 p-10">
                <LoaderCircle className="animate-spin" size={18} />
                Loading details...
              </div>
            ) : (
              <div className="space-y-5 p-5">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-2xl bg-[var(--color-soft)] p-4">
                    <p className="text-xs text-[var(--color-muted)]">
                      Source total
                    </p>
                    <p className="mt-1 font-black">
                      {money(detail.sourceTotalAmountSnapshot)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-[var(--color-soft)] p-4">
                    <p className="text-xs text-[var(--color-muted)]">
                      Initial settlement
                    </p>
                    <p className="mt-1 font-black">
                      {money(detail.downpaymentAmount)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-[var(--color-soft)] p-4">
                    <p className="text-xs text-[var(--color-muted)]">
                      Provider
                    </p>
                    <p className="mt-1 font-black">
                      {label(detail.provider)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-[var(--color-soft)] p-4">
                    <p className="text-xs text-[var(--color-muted)]">
                      Remaining
                    </p>
                    <p className="mt-1 font-black text-[var(--color-maroon)]">
                      {money(detail.remainingBalance)}
                    </p>
                  </div>
                </div>
                <div className="grid gap-4 rounded-2xl border p-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-xs text-[var(--color-muted)]">
                      Term / saved basis
                    </p>
                    <p className="font-bold">
                      {detail.term
                        ? `${label(detail.term)} · ${Number(detail.termBasis).toFixed(4)}`
                        : "Not applicable"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--color-muted)]">
                      Due schedule
                    </p>
                    <p className="font-bold">
                      {detail.dueDay
                        ? `Day ${detail.dueDay} · ${dateTime(detail.nextDueDate, true)}`
                        : "Not applicable"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--color-muted)]">
                      Linked source
                    </p>
                    <p className="font-bold">
                      {detail.sale?.receiptCode ||
                        detail.serviceJob?.jobCode ||
                        "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--color-muted)]">
                      Total collected
                    </p>
                    <p className="font-bold">{money(detail.totalCollected)}</p>
                  </div>
                </div>
                {detail.status === "ACTIVE" ? (
                  <div>
                    <button
                      className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-maroon)] px-4 py-3 text-sm font-bold text-white"
                      onClick={() => setShowCollectionForm((value) => !value)}
                      type="button"
                    >
                      <Banknote size={16} />
                      Post collection
                    </button>
                  </div>
                ) : null}
                {showCollectionForm && detail.status === "ACTIVE" ? (
                  <form
                    className="grid gap-3 rounded-2xl border bg-[var(--color-soft)] p-4 md:grid-cols-2 lg:grid-cols-5"
                    onSubmit={submitCollection}
                  >
                    <input
                      className="rounded-xl border px-3 py-3 text-sm"
                      max={Number(detail.remainingBalance)}
                      min="0.01"
                      onChange={(event) =>
                        setCollectionForm((form) => ({
                          ...form,
                          amount: event.target.value,
                        }))
                      }
                      placeholder="Amount"
                      required
                      step="0.01"
                      type="number"
                      value={collectionForm.amount}
                    />
                    <select
                      className="rounded-xl border px-3 py-3 text-sm"
                      onChange={(event) =>
                        setCollectionForm((form) => ({
                          ...form,
                          paymentMethod: event.target.value,
                        }))
                      }
                      value={collectionForm.paymentMethod}
                    >
                      {PAYMENT_METHODS.map((value) => (
                        <option key={value} value={value}>
                          {label(value)}
                        </option>
                      ))}
                    </select>
                    <input
                      className="rounded-xl border px-3 py-3 text-sm"
                      onChange={(event) =>
                        setCollectionForm((form) => ({
                          ...form,
                          referenceNo: event.target.value,
                        }))
                      }
                      placeholder="Reference (optional)"
                      value={collectionForm.referenceNo}
                    />
                    <input
                      className="rounded-xl border px-3 py-3 text-sm"
                      onChange={(event) =>
                        setCollectionForm((form) => ({
                          ...form,
                          remarks: event.target.value,
                        }))
                      }
                      placeholder="Remarks (optional)"
                      value={collectionForm.remarks}
                    />
                    <button
                      className="rounded-xl bg-[var(--color-maroon)] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                      disabled={isSaving}
                      type="submit"
                    >
                      {isSaving ? "Posting..." : "Save collection"}
                    </button>
                  </form>
                ) : null}
                <section>
                  <div className="flex items-center gap-2">
                    <CalendarClock
                      className="text-[var(--color-maroon)]"
                      size={18}
                    />
                    <h3 className="font-black">Payment history</h3>
                  </div>
                  <div className="mt-3 divide-y overflow-hidden rounded-2xl border">
                    {(detail.collections || []).map((collection) => (
                      <article
                        className="grid gap-3 p-4 md:grid-cols-[1fr_auto_auto] md:items-center"
                        key={collection.id}
                      >
                        <div>
                          <p className="font-black">
                            {collection.collectionCode}
                          </p>
                          <p className="mt-1 text-xs text-[var(--color-muted)]">
                            {dateTime(collection.paidAt)} ·{" "}
                            {label(collection.paymentMethod)} ·{" "}
                            {collection.collectedBy?.fullName || "System"}
                          </p>
                          {collection.referenceNo ? (
                            <p className="mt-1 text-xs">
                              Ref: {collection.referenceNo}
                            </p>
                          ) : null}
                        </div>
                        <div className="md:text-right">
                          <p className="font-black">
                            {money(collection.amount)}
                          </p>
                          <Status value={collection.status} />
                        </div>
                        {collection.status === "POSTED" &&
                        canCancelCollections ? (
                          <button
                            className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700"
                            disabled={isSaving}
                            onClick={() => reverseCollection(collection)}
                            type="button"
                          >
                            Reverse
                          </button>
                        ) : (
                          <span />
                        )}
                      </article>
                    ))}
                    {(detail.collections || []).length === 0 ? (
                      <p className="p-6 text-center text-sm text-[var(--color-muted)]">
                        No collections posted yet.
                      </p>
                    ) : null}
                  </div>
                </section>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
