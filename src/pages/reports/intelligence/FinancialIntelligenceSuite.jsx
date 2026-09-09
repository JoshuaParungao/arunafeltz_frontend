import { useState } from "react"
import {
  Sparkles,
  TrendingUp,
  Layers,
  CreditCard,
  Banknote,
  DollarSign,
  Package,
  ShieldCheck,
  Calendar,
  Building2,
} from "lucide-react"

import ProductProfitabilityView from "./ProductProfitabilityView"
import SixLayerExecutiveView from "./SixLayerExecutiveView"
import ArAgingView from "./ArAgingView"
import SettlementCashflowView from "./SettlementCashflowView"

export default function FinancialIntelligenceSuite({ selectedBranch, user, dateRange }) {
  const [activeSuiteTab, setActiveSuiteTab] = useState("PRODUCTS") // PRODUCTS | SIX_LAYER | AR_AGING | SETTLEMENTS

  const TABS = [
    {
      id: "PRODUCTS",
      label: "Product Profitability (Tubo per Item)",
      badge: "REPORT 06 · Kita per Item",
      icon: Package,
      desc: "Item-by-item cost (puhunan), Base SRP, mark-up, pure tubo, and total net profit.",
    },
    {
      id: "SIX_LAYER",
      label: "Six-Layer Executive Profitability",
      badge: "REPORT 08 · Executive Matrix",
      icon: Layers,
      desc: "Puhunan, Pure Base Tubo, Mark-up, Tubo w/ Markup, Financing Interest, and Overall Total Kita.",
    },
    {
      id: "AR_AGING",
      label: "AR Aging & Financing Intelligence",
      badge: "REPORT 02 · Aging Buckets",
      icon: CreditCard,
      desc: "Current to 120+ days aging buckets, provider performance, term yields, and collection movement.",
    },
    {
      id: "SETTLEMENTS",
      label: "Settlement & Cashflow Intelligence",
      badge: "REPORT 01 & 16 · Cash vs AR",
      icon: Banknote,
      desc: "Good-as-Cash vs. AR Financing head-to-head comparison and payment tender metrics.",
    },
  ]

  return (
    <div className="space-y-6">
      {/* Intelligence Suite Banner */}
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-rose-300">
              <Sparkles size={13} />
              Financial Reporting & AR Intelligence Suite (20-Report Architecture)
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
              Executive Financial & Tubo Intelligence
            </h1>
            <p className="mt-1 max-w-2xl text-xs font-medium text-slate-300">
              Complete visibility into your business: real product cost (puhunan), separated item mark-up, financing interest, AR aging buckets, and consolidated enterprise kita.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-2xl bg-white/5 p-2 border border-white/10 self-start md:self-auto">
            <span className="grid size-9 place-items-center rounded-xl bg-white/10 text-white font-mono text-xs font-black">
              {selectedBranch?.code || user?.branch?.code || "ALL"}
            </span>
            <div className="pr-2">
              <p className="text-[10px] uppercase font-bold text-slate-400">Branch Scope</p>
              <p className="text-xs font-black text-white">{selectedBranch?.name || user?.branch?.name || "All Branches"}</p>
            </div>
          </div>
        </div>

        {/* 4 Main Intelligence Navigation Tabs */}
        <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeSuiteTab === tab.id

            return (
              <button
                className={`flex flex-col justify-between rounded-2xl p-4 text-left transition ${
                  isActive
                    ? "bg-white text-slate-900 shadow-lg ring-2 ring-rose-400"
                    : "bg-white/5 text-white hover:bg-white/10 border border-white/10"
                }`}
                key={tab.id}
                onClick={() => setActiveSuiteTab(tab.id)}
                type="button"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span
                      className={`grid size-8 place-items-center rounded-xl ${
                        isActive ? "bg-rose-50 text-[var(--color-maroon)]" : "bg-white/10 text-slate-300"
                      }`}
                    >
                      <Icon size={16} />
                    </span>
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase ${
                        isActive ? "bg-slate-100 text-slate-600" : "bg-white/10 text-slate-300"
                      }`}
                    >
                      {tab.badge}
                    </span>
                  </div>
                  <p className="mt-2.5 text-xs font-black leading-snug">{tab.label}</p>
                </div>
                <p
                  className={`mt-2 text-[10px] line-clamp-2 ${
                    isActive ? "text-slate-500 font-medium" : "text-slate-400"
                  }`}
                >
                  {tab.desc}
                </p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Active Intelligence Module View */}
      {activeSuiteTab === "PRODUCTS" && (
        <ProductProfitabilityView
          dateRange={dateRange}
          selectedBranch={selectedBranch}
          user={user}
        />
      )}

      {activeSuiteTab === "SIX_LAYER" && (
        <SixLayerExecutiveView
          dateRange={dateRange}
          selectedBranch={selectedBranch}
          user={user}
        />
      )}

      {activeSuiteTab === "AR_AGING" && (
        <ArAgingView
          dateRange={dateRange}
          selectedBranch={selectedBranch}
          user={user}
        />
      )}

      {activeSuiteTab === "SETTLEMENTS" && (
        <SettlementCashflowView
          dateRange={dateRange}
          selectedBranch={selectedBranch}
          user={user}
        />
      )}
    </div>
  )
}
