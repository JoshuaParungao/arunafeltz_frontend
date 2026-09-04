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
  declareCreditAccountDefaulted,
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
  "SKYRO",
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
  if (!value) return "—";
  return String(value)
    .replace(/_/g, " ")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function Status({ value }) {
  const className =
    value === "PAID" || value === "POSTED"
      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
      : value === "ACTIVE"
        ? "bg-amber-50 text-amber-700 border border-amber-200"
        : "bg-rose-50 text-rose-700 border border-rose-200";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${className}`}
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
  const [showDefaultModal, setShowDefaultModal] = useState(false);
  const [defaultReason, setDefaultReason] = useState("");
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

  const handleDeclareDefault = async () => {
    if (!detail) return;
    if (!defaultReason.trim()) {
      setMessage("Please enter a reason for declaring this account as bad debt / write-off.");
      return;
    }
    setIsSaving(true);
    setMessage("");
    try {
      const response = await declareCreditAccountDefaulted(detail.id, {
        reason: defaultReason.trim(),
      });
      const updated = response?.data || response;
      setDetail(updated);
      setShowDefaultModal(false);
      setDefaultReason("");
      setNotice(`Credit account ${updated.creditCode || detail.creditCode} declared as Defaulted / Bad Debt Write-off.`);
      await loadAccounts();
    } catch (error) {
      setMessage(apiError(error, "Could not declare credit account as defaulted."));
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
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-[var(--color-maroon)]">
              Finance
            </p>
            <h1 className="mt-1 text-2xl font-black text-slate-900">
              Accounts Receivable
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Sale and service balances by provider, with auditable partial
              collections and reversals.
            </p>
          </div>
          <button
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
            disabled={isLoading}
            onClick={loadAccounts}
            type="button"
          >
            <RefreshCw className={isLoading ? "animate-spin" : ""} size={14} />
            Refresh
          </button>
        </div>
      </section>

      {message ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
          {message}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-700">
          {notice}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Visible remaining balance
          </p>
          <p className="mt-1 font-mono text-xl font-black text-slate-900">{money(totals.balance)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Visible collections
          </p>
          <p className="mt-1 font-mono text-xl font-black text-slate-900">{money(totals.collected)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Overdue on this page
          </p>
          <p className="mt-1 font-mono text-xl font-black text-rose-600">
            {totals.overdue}
          </p>
        </div>
      </section>

      <section className="grid gap-2.5 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs md:grid-cols-5">
        <label className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={15}
          />
          <input
            aria-label="Search receivables"
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-800 outline-none focus:border-[var(--color-maroon)]"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="AR, customer, sale, service…"
            value={search}
          />
        </label>
        <select
          aria-label="Filter receivables by status"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[var(--color-maroon)]"
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
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[var(--color-maroon)]"
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
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[var(--color-maroon)]"
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
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[var(--color-maroon)]"
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

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 p-8 text-xs font-bold text-slate-400">
            <LoaderCircle className="animate-spin" size={16} />
            Loading receivables…
          </div>
        ) : accounts.length === 0 ? (
          <div className="p-8 text-center">
            <CreditCard
              className="mx-auto text-slate-300"
              size={32}
            />
            <p className="mt-2 text-xs font-bold text-slate-700">No matching receivables</p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Receivables are opened atomically from sale or service settlement
              flows.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[940px] text-left text-xs">
                <thead className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Account</th>
                    <th className="px-4 py-3">Customer / Source</th>
                    <th className="px-4 py-3">Provider / Term</th>
                    <th className="px-4 py-3">Next Due</th>
                    <th className="px-4 py-3 text-right">Remaining</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {accounts.map((account) => (
                    <tr
                      className={`hover:bg-slate-50/50 transition ${isOverdue(account) ? "bg-rose-50/40" : ""}`}
                      key={account.id}
                    >
                      <td className="px-4 py-3">
                        <p className="font-mono font-bold text-slate-900">{account.creditCode}</p>
                        <p className="text-[11px] text-slate-400">
                          {account.branch?.code}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-800">
                          {account.customer?.fullName ||
                            account.serviceJob?.customerNameSnapshot ||
                            "Walk-in / External"}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {account.sale?.receiptCode ||
                            account.serviceJob?.jobCode ||
                            "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{label(account.provider)}</p>
                        <p className="text-[11px] text-slate-400">
                          {account.term
                            ? label(account.term)
                            : "No term"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-700">{dateTime(account.nextDueDate, true)}</p>
                        {isOverdue(account) ? (
                          <p className="text-[10px] font-bold text-rose-600">
                            OVERDUE
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-black text-slate-900">
                        {money(account.remainingBalance)}
                      </td>
                      <td className="px-4 py-3">
                        <Status value={account.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition"
                          onClick={() => openDetail(account)}
                          type="button"
                        >
                          <Eye size={13} />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid gap-2.5 p-3 lg:hidden">
              {accounts.map((account) => (
                <article
                  className={`rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-2xs ${isOverdue(account) ? "border-rose-200 bg-rose-50/40" : ""}`}
                  key={account.id}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono font-bold text-slate-900">{account.creditCode}</p>
                      <p className="mt-0.5 font-bold text-slate-800">
                        {account.customer?.fullName ||
                          account.serviceJob?.customerNameSnapshot ||
                          "Walk-in / External"}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {label(account.provider)} ·{" "}
                        {account.sale?.receiptCode ||
                          account.serviceJob?.jobCode}
                      </p>
                    </div>
                    <Status value={account.status} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-2 text-xs">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">
                        Remaining
                      </p>
                      <p className="font-mono font-black text-slate-900">
                        {money(account.remainingBalance)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">
                        Next Due
                      </p>
                      <p className="font-semibold text-slate-700">
                        {dateTime(account.nextDueDate, true)}
                      </p>
                    </div>
                  </div>
                  <button
                    className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                    onClick={() => openDetail(account)}
                    type="button"
                  >
                    <Eye size={13} />
                    View Account
                  </button>
                </article>
              ))}
            </div>
          </>
        )}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/75 p-3 text-xs text-slate-500">
          <p>
            Page {meta.page || page} of {totalPages} · {meta.total || 0}{" "}
            account(s)
          </p>
          <div className="flex gap-1.5">
            <button
              className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 disabled:opacity-30"
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              type="button"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 disabled:opacity-30"
              disabled={page >= totalPages}
              onClick={() => setPage((value) => value + 1)}
              type="button"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {detail ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-3 sm:p-5 backdrop-blur-xs">
          <section className="my-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50/75 px-5 py-3.5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-maroon)]">
                    {detail.creditCode}
                  </span>
                  <Status value={detail.status} />
                  {isOverdue(detail) ? (
                    <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">
                      OVERDUE
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-0.5 text-base font-black text-slate-900 leading-tight">
                  {detail.customer?.fullName ||
                    detail.serviceJob?.customerNameSnapshot ||
                    "Walk-in / External Provider"}
                </h2>
              </div>
              <button
                className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                onClick={() => setDetail(null)}
                type="button"
              >
                <X size={16} />
              </button>
            </header>
            {isDetailLoading ? (
              <div className="flex items-center justify-center gap-2 p-10 text-xs font-bold text-slate-400">
                <LoaderCircle className="animate-spin" size={16} />
                Loading details…
              </div>
            ) : (
              <div className="max-h-[75vh] overflow-y-auto p-5 space-y-4">
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3 text-xs">
                    <p className="text-[10px] font-bold uppercase text-slate-500">
                      Source Total
                    </p>
                    <p className="mt-1 font-mono font-bold text-slate-900">
                      {money(detail.sourceTotalAmountSnapshot)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3 text-xs">
                    <p className="text-[10px] font-bold uppercase text-slate-500">
                      Initial Settlement
                    </p>
                    <p className="mt-1 font-mono font-bold text-slate-900">
                      {money(detail.downpaymentAmount)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3 text-xs">
                    <p className="text-[10px] font-bold uppercase text-slate-500">
                      Provider
                    </p>
                    <p className="mt-1 font-bold text-slate-900">
                      {label(detail.provider)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3 text-xs">
                    <p className="text-[10px] font-bold uppercase text-slate-500">
                      Remaining
                    </p>
                    <p className="mt-1 font-mono font-black text-[var(--color-maroon)]">
                      {money(detail.remainingBalance)}
                    </p>
                  </div>
                </div>

                <div className="grid gap-2.5 rounded-xl border border-slate-200 bg-white p-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">
                      Term / Basis
                    </p>
                    <p className="mt-0.5 font-bold text-slate-800">
                      {detail.term
                        ? `${label(detail.term)} · ${Number(detail.termBasis).toFixed(4)}`
                        : "Not applicable"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">
                      Due Schedule
                    </p>
                    <p className="mt-0.5 font-bold text-slate-800">
                      {detail.dueDay
                        ? `Day ${detail.dueDay} · ${dateTime(detail.nextDueDate, true)}`
                        : "Not applicable"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">
                      Linked Source
                    </p>
                    <p className="mt-0.5 font-bold text-slate-800">
                      {detail.sale?.receiptCode ||
                        detail.serviceJob?.jobCode ||
                        "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">
                      Total Collected
                    </p>
                    <p className="mt-0.5 font-mono font-bold text-slate-800">{money(detail.totalCollected)}</p>
                  </div>
                </div>

                {detail.status === "ACTIVE" ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-maroon)] px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[var(--color-maroon-hover)] transition"
                      onClick={() => setShowCollectionForm((value) => !value)}
                      type="button"
                    >
                      <Banknote size={14} />
                      Post Collection
                    </button>
                    {canCancelCollections ? (
                      <button
                        className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition shadow-2xs"
                        onClick={() => setShowDefaultModal(true)}
                        type="button"
                      >
                        ⚠️ Declare Bad Debt / Default
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {showCollectionForm && detail.status === "ACTIVE" ? (
                  <form
                    className="grid gap-2.5 rounded-xl border border-slate-200 bg-slate-50/75 p-3.5 md:grid-cols-2 lg:grid-cols-5"
                    onSubmit={submitCollection}
                  >
                    <input
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-800 outline-none focus:border-[var(--color-maroon)]"
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
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[var(--color-maroon)]"
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
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-[var(--color-maroon)]"
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
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-[var(--color-maroon)]"
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
                      className="rounded-xl bg-[var(--color-maroon)] px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[var(--color-maroon-hover)] transition disabled:opacity-50"
                      disabled={isSaving}
                      type="submit"
                    >
                      {isSaving ? "Posting…" : "Save Collection"}
                    </button>
                  </form>
                ) : null}

                <section className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <CalendarClock
                      className="text-[var(--color-maroon)]"
                      size={15}
                    />
                    <h3 className="text-xs font-black text-slate-900">Collection History</h3>
                  </div>
                  <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white text-xs">
                    {(detail.collections || []).map((collection) => (
                      <article
                        className="grid gap-2 p-3 md:grid-cols-[1fr_auto_auto] md:items-center"
                        key={collection.id}
                      >
                        <div>
                          <p className="font-mono font-bold text-slate-900">
                            {collection.collectionCode}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {dateTime(collection.paidAt)} ·{" "}
                            {label(collection.paymentMethod)} ·{" "}
                            {collection.collectedBy?.fullName || "System"}
                          </p>
                          {collection.referenceNo ? (
                            <p className="mt-0.5 text-[10px] text-slate-400">
                              Ref: {collection.referenceNo}
                            </p>
                          ) : null}
                        </div>
                        <div className="md:text-right">
                          <p className="font-mono font-bold text-slate-900">
                            {money(collection.amount)}
                          </p>
                          <Status value={collection.status} />
                        </div>
                        {collection.status === "POSTED" &&
                        canCancelCollections ? (
                          <button
                            className="rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-50 transition"
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
                      <p className="p-6 text-center text-xs font-bold text-slate-400">
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

      {/* Declare Bad Debt / Default Write-off Modal */}
      {showDefaultModal && detail ? (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚠️</span>
                <h3 className="text-base font-black text-slate-900">
                  Declare Bad Debt / Default
                </h3>
              </div>
              <button
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                onClick={() => setShowDefaultModal(false)}
                type="button"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to declare <strong>{detail.creditCode}</strong> ({detail.customer?.fullName || "Customer"}) as <strong>Bad Debt / Defaulted</strong>?
              This will officially close the collection queue and log the remaining uncollected balance of <strong className="text-rose-700 font-mono">{money(detail.remainingBalance)}</strong> as Credit Loss in reports.
            </p>

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                Reason / Explanation <span className="text-rose-600">*</span>
              </label>
              <textarea
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs font-semibold text-slate-900 outline-none focus:border-rose-500 focus:bg-white min-h-[90px]"
                onChange={(e) => setDefaultReason(e.target.value)}
                placeholder="e.g., Customer uncontactable after multiple follow-ups, relocated without notice, or unable to pay..."
                required
                value={defaultReason}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                onClick={() => setShowDefaultModal(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-xl bg-rose-700 px-4 py-2 text-xs font-bold text-white hover:bg-rose-800 transition disabled:opacity-50 shadow-2xs"
                disabled={isSaving || !defaultReason.trim()}
                onClick={handleDeclareDefault}
                type="button"
              >
                {isSaving ? "Declaring..." : "Confirm Bad Debt Write-off"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

