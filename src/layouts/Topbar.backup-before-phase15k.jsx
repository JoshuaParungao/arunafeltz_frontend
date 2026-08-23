import { Bell, Building2, Menu, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react"

function Topbar({
  activeLabel,
  user,
  selectedBranch,
  onLogout,
  onOpenMobileSidebar,
  onToggleDesktopSidebar,
  isDesktopSidebarCollapsed,
}) {
  return (
    <header className="z-20 shrink-0 border-b border-[var(--color-border)] bg-[var(--color-page)]/95 px-4 py-3 backdrop-blur md:px-6">
      <div className="mx-auto flex w-full max-w-screen-2xl items-center gap-3">
        <button
          className="grid size-10 shrink-0 place-items-center rounded-2xl border border-[var(--color-border)] bg-white lg:hidden"
          onClick={onOpenMobileSidebar}
          type="button"
        >
          <Menu className="size-5" />
        </button>

        <button
          className="hidden size-10 shrink-0 place-items-center rounded-2xl border border-[var(--color-border)] bg-white lg:grid"
          onClick={onToggleDesktopSidebar}
          type="button"
        >
          {isDesktopSidebarCollapsed ? (
            <PanelLeftOpen className="size-5" />
          ) : (
            <PanelLeftClose className="size-5" />
          )}
        </button>

        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[var(--color-text-strong)] sm:text-base">
            {activeLabel}
          </p>
          <p className="hidden text-xs text-[var(--color-muted)] sm:block">
            Arunafeltz Cloud POS and Business Monitoring
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
          </label>
        </div>

        <button
          className="grid size-10 shrink-0 place-items-center rounded-2xl border border-[var(--color-border)] bg-white shadow-card"
          type="button"
        >
          <Bell className="size-4 text-[var(--color-maroon)]" />
        </button>

        <button
          className="hidden items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--color-text-strong)] shadow-card sm:flex"
          type="button"
        >
          <Building2 className="size-4 shrink-0 text-[var(--color-maroon)]" />
          <span className="whitespace-nowrap">{selectedBranch?.code || user?.branch?.code || "ALL"}</span>
        </button>

        <div className="hidden min-w-0 items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white px-3 py-2 shadow-card xl:flex">
          <div className="min-w-0">
            <p className="max-w-36 truncate text-xs font-bold text-[var(--color-text-strong)]">
              {user?.fullName || user?.username || "User"}
            </p>
            <p className="max-w-36 truncate text-[11px] font-semibold text-[var(--color-muted)]">
              {user?.role || "ROLE"}
            </p>
          </div>
        </div>

        <button
          className="rounded-2xl border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-bold text-[var(--color-maroon)] shadow-card transition hover:bg-[var(--color-maroon-soft)]"
          onClick={onLogout}
          type="button"
        >
          Logout
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
  )
}

export default Topbar

