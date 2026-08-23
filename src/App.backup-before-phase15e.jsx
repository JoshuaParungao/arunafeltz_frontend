import {
  AlertTriangle,
  BarChart3,
  Boxes,
  Building2,
  ChevronDown,
  ClipboardList,
  ExternalLink,
  LayoutDashboard,
  Menu,
  PackageSearch,
  ReceiptText,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Users,
  Wrench,
} from 'lucide-react'

const dashboardCards = [
  {
    title: 'Sales Today',
    value: '?0.00',
    note: 'Ready for live API data',
    icon: ReceiptText,
  },
  {
    title: 'Low Stock',
    value: '0',
    note: 'Inventory alert monitoring',
    icon: AlertTriangle,
  },
  {
    title: 'Pending Transfers',
    value: '0',
    note: 'Branch stock movement',
    icon: Boxes,
  },
  {
    title: 'Open Services',
    value: '0',
    note: 'Technician workflow',
    icon: Wrench,
  },
]

const quickModules = [
  {
    label: 'POS',
    icon: ShoppingCart,
  },
  {
    label: 'Inventory',
    icon: PackageSearch,
  },
  {
    label: 'Quotations',
    icon: ClipboardList,
  },
  {
    label: 'Customers',
    icon: Users,
  },
  {
    label: 'Reports',
    icon: BarChart3,
  },
  {
    label: 'Security',
    icon: ShieldCheck,
  },
]

const tableRows = [
  {
    code: 'ITEM-0001',
    name: 'Ryzen 5 5600G Processor',
    category: 'Processor',
    stock: 'Ready',
    status: 'Active',
  },
  {
    code: 'QTN-0001',
    name: 'Sample PC Build Quotation',
    category: 'Quotation',
    stock: 'Draft',
    status: 'Pending',
  },
  {
    code: 'WRN-0001',
    name: 'Warranty Claim Monitoring',
    category: 'Warranty',
    stock: 'Checking',
    status: 'Open',
  },
]

function App() {
  return (
    <main className="min-h-svh bg-[var(--color-page)] text-[var(--color-text)]">
      <div className="flex min-h-svh w-full overflow-hidden">
        <aside className="hidden w-72 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-sidebar)] px-5 py-5 text-white lg:block">
          <div className="flex items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--color-maroon)] text-lg font-bold shadow-soft">
              A
            </div>
            <div className="min-w-0">
              <p className="brand-text text-lg font-bold tracking-tight">Arunafeltz</p>
              <p className="truncate text-xs text-white/60">Cloud POS Dashboard</p>
            </div>
          </div>

          <nav className="mt-8 space-y-1">
            {quickModules.map((item) => {
              const Icon = item.icon

              return (
                <button
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium text-white/75 transition hover:bg-white/10 hover:text-white"
                  key={item.label}
                  type="button"
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              )
            })}
          </nav>

          
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[var(--color-page)]/90 px-4 py-3 backdrop-blur md:px-6">
            <div className="mx-auto flex w-full max-w-screen-2xl items-center gap-3">
              <button
                className="grid size-10 shrink-0 place-items-center rounded-2xl border border-[var(--color-border)] bg-white lg:hidden"
                type="button"
              >
                <Menu className="size-5" />
              </button>

              <div className="min-w-0">
                <p className="brand-text text-base font-bold text-[var(--color-text-strong)] sm:text-lg">
                  Arunafeltz
                </p>
                <p className="hidden text-xs text-[var(--color-muted)] sm:block">
                  Real-world POS and Business Monitoring System
                </p>
              </div>

              <div className="ml-auto hidden min-w-0 flex-1 justify-center px-4 md:flex">
                <label className="flex h-11 w-full max-w-2xl items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-white px-4 shadow-card">
                  <Search className="size-4 shrink-0 text-[var(--color-muted)]" />
                  <input
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-muted)]"
                    placeholder="Search item, receipt, quote, serial, customer..."
                    type="search"
                  />
                  <span className="hidden whitespace-nowrap rounded-full bg-[var(--color-soft)] px-3 py-1 text-xs font-medium text-[var(--color-muted)] xl:inline">
                    Smart Search
                  </span>
                </label>
              </div>

              <button
                className="hidden items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--color-text-strong)] shadow-card sm:flex"
                type="button"
              >
                <Building2 className="size-4 shrink-0 text-[var(--color-maroon)]" />
                <span className="whitespace-nowrap">MAIN</span>
                <ChevronDown className="size-4 shrink-0 text-[var(--color-muted)]" />
              </button>
            </div>

            <div className="mx-auto mt-3 w-full max-w-screen-2xl md:hidden">
              <label className="flex h-11 w-full items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-white px-4 shadow-card">
                <Search className="size-4 shrink-0 text-[var(--color-muted)]" />
                <input
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-muted)]"
                  placeholder="Search..."
                  type="search"
                />
              </label>
            </div>
          </header>

          <div className="mx-auto w-full max-w-screen-2xl flex-1 px-4 py-5 md:px-6 lg:py-7">
            <section className="overflow-hidden rounded-[2rem] border border-[var(--color-border)] bg-white p-5 shadow-card md:p-7">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                <div className="min-w-0">
                  <div className="inline-flex max-w-full items-center gap-2 rounded-full bg-[var(--color-maroon-soft)] px-3 py-1 text-xs font-bold text-[var(--color-maroon)]">
                    <Sparkles className="size-3.5 shrink-0" />
                    <span className="truncate">Pearl White / Charcoal / Maroon UI</span>
                  </div>
                  <h1 className="mt-4 max-w-4xl text-balance text-3xl font-bold tracking-tight text-[var(--color-text-strong)] sm:text-4xl lg:text-5xl">
                    Clean, fast, and secure dashboard for Arunafeltz operations.
                  </h1>
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--color-muted)] sm:text-base">
                    Built for real shop workflow: responsive layout, smart searching, draft
                    recovery planning, branch-safe caching, and role-based security.
                  </p>
                </div>

                <div className="grid shrink-0 grid-cols-2 gap-3 sm:flex">
                  <button className="rounded-2xl bg-[var(--color-maroon)] px-4 py-3 text-sm font-bold text-white shadow-soft transition hover:bg-[var(--color-maroon-hover)]">
                    Open POS
                  </button>
                  <button className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] transition hover:bg-white">
                    View Alerts
                  </button>
                </div>
              </div>
            </section>

            <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {dashboardCards.map((card) => {
                const Icon = card.icon

                return (
                  <article
                    className="min-w-0 rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-card"
                    key={card.title}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--color-muted)]">
                          {card.title}
                        </p>
                        <p className="mt-2 truncate text-2xl font-bold text-[var(--color-text-strong)]">
                          {card.value}
                        </p>
                      </div>
                      <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--color-maroon-soft)] text-[var(--color-maroon)]">
                        <Icon className="size-5" />
                      </div>
                    </div>
                    <p className="mt-4 line-clamp-2 text-sm text-[var(--color-muted)]">
                      {card.note}
                    </p>
                  </article>
                )
              })}
            </section>

            <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_420px]">
              <article className="min-w-0 rounded-3xl border border-[var(--color-border)] bg-white p-4 shadow-card md:p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold text-[var(--color-text-strong)]">
                      Search-friendly table preview
                    </h2>
                    <p className="mt-1 text-sm text-[var(--color-muted)]">
                      Sort arrows, filters, pagination, and mobile cards later.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {['All', 'Active', 'Low Stock', 'Draft'].map((filter) => (
                      <button
                        className="whitespace-nowrap rounded-full border border-[var(--color-border)] bg-[var(--color-soft)] px-3 py-2 text-xs font-bold text-[var(--color-text)]"
                        key={filter}
                        type="button"
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-5 hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[680px] border-separate border-spacing-0 text-left text-sm">
                    <thead>
                      <tr className="text-xs uppercase tracking-[0.12em] text-[var(--color-muted)]">
                        <th className="border-b border-[var(--color-border)] px-3 py-3">Code ?</th>
                        <th className="border-b border-[var(--color-border)] px-3 py-3">Name ?</th>
                        <th className="border-b border-[var(--color-border)] px-3 py-3">
                          Category
                        </th>
                        <th className="border-b border-[var(--color-border)] px-3 py-3">
                          Stock ?
                        </th>
                        <th className="border-b border-[var(--color-border)] px-3 py-3">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.map((row) => (
                        <tr key={row.code}>
                          <td className="whitespace-nowrap border-b border-[var(--color-border)] px-3 py-4 font-semibold">
                            {row.code}
                          </td>
                          <td className="max-w-[260px] truncate border-b border-[var(--color-border)] px-3 py-4 font-semibold text-[var(--color-text-strong)]">
                            {row.name}
                          </td>
                          <td className="whitespace-nowrap border-b border-[var(--color-border)] px-3 py-4">
                            {row.category}
                          </td>
                          <td className="whitespace-nowrap border-b border-[var(--color-border)] px-3 py-4">
                            {row.stock}
                          </td>
                          <td className="border-b border-[var(--color-border)] px-3 py-4">
                            <span className="whitespace-nowrap rounded-full bg-[var(--color-maroon-soft)] px-3 py-1 text-xs font-bold text-[var(--color-maroon)]">
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-5 grid gap-3 md:hidden">
                  {tableRows.map((row) => (
                    <div
                      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4"
                      key={row.code}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="whitespace-nowrap text-xs font-bold text-[var(--color-maroon)]">
                            {row.code}
                          </p>
                          <p className="mt-1 line-clamp-2 font-bold text-[var(--color-text-strong)]">
                            {row.name}
                          </p>
                        </div>
                        <span className="whitespace-nowrap rounded-full bg-white px-3 py-1 text-xs font-bold text-[var(--color-text)]">
                          {row.status}
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-[var(--color-muted)]">
                        {row.category} • {row.stock}
                      </p>
                    </div>
                  ))}
                </div>
              </article>

              <aside className="min-w-0 rounded-3xl border border-[var(--color-border)] bg-[var(--color-sidebar)] p-5 text-white shadow-card">
                <h2 className="text-xl font-bold">Responsive rules locked</h2>
                <div className="mt-4 space-y-3 text-sm text-white/75">
                  <p>No broken brand names.</p>
                  <p>No horizontal page overflow.</p>
                  <p>Tables become cards on phones.</p>
                  <p>Search must support suggestions and filters.</p>
                  <p>Cache must be branch-safe and role-safe.</p>
                </div>
              </aside>
            </section>
          </div>
        </section>
      </div>
    </main>
  )
}

export default App



