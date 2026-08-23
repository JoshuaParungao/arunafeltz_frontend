import { Bell, Building2, Menu, Moon, PanelLeftClose, PanelLeftOpen, Search, Sun } from "lucide-react"

import { getRoleLabel } from "../constants/roles"
import { useTheme } from "../context/ThemeContext"

function Topbar({
  activeLabel,
  user,
  selectedBranch,
  canSwitchBranch = false,
  onSwitchBranch,
  onLogout,
  onOpenMobileSidebar,
  onToggleDesktopSidebar,
  isDesktopSidebarCollapsed,
}) {
  const branchCode = selectedBranch?.code || user?.branch?.code || "ALL"
  const { resolvedTheme, toggleTheme } = useTheme()

  return (
    <header className="z-20 shrink-0 border-b border-[var(--color-border)] bg-[var(--color-page)]/95 px-4 py-3 backdrop-blur md:px-6">
      <div className="mx-auto flex w-full max-w-screen-2xl items-center gap-3">
        <button
          aria-label="Open navigation"
          className="grid size-10 shrink-0 place-items-center rounded-2xl border border-[var(--color-border)] bg-white lg:hidden"
          onClick={onOpenMobileSidebar}
          type="button"
        >
          <Menu className="size-5" />
        </button>

        <button
          aria-label={isDesktopSidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
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
            Arunafeltz Computer Cloud POS and Business Monitoring
          </p>
        </div>

        <div className="ml-auto hidden min-w-0 flex-1 justify-center px-4 md:flex">
          <label className="flex h-11 w-full max-w-2xl items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-white px-4 shadow-card">
            <Search className="size-4 shrink-0 text-[var(--color-muted)]" />
            <input
              aria-label="Module search is available inside each workspace"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-muted)]"
              disabled
              placeholder="Use search inside a module"
              type="search"
            />
          </label>
        </div>

        <button
          aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="grid size-10 shrink-0 place-items-center rounded-2xl border border-[var(--color-border)] bg-white text-[var(--color-text-strong)] shadow-card transition hover:bg-[var(--color-soft)]"
          onClick={toggleTheme}
          title={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          type="button"
        >
          {resolvedTheme === "dark" ? (
            <Sun className="size-4 text-amber-400" />
          ) : (
            <Moon className="size-4 text-[var(--color-maroon)]" />
          )}
        </button>

        <button
          aria-label="Notifications are available in Action Alerts"
          className="grid size-10 shrink-0 place-items-center rounded-2xl border border-[var(--color-border)] bg-white opacity-60 shadow-card"
          disabled
          title="Open Action Alerts from the navigation"
          type="button"
        >
          <Bell className="size-4 text-[var(--color-maroon)]" />
        </button>

        <button
          className={`hidden items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--color-text-strong)] shadow-card sm:flex ${
            canSwitchBranch ? "hover:bg-[var(--color-maroon-soft)]" : "cursor-default"
          }`}
          onClick={canSwitchBranch ? onSwitchBranch : undefined}
          title={canSwitchBranch ? "Switch branch" : "Assigned branch"}
          type="button"
        >
          <Building2 className="size-4 shrink-0 text-[var(--color-maroon)]" />
          <span className="whitespace-nowrap">{branchCode}</span>
        </button>

        <div className="hidden min-w-0 items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white px-3 py-2 shadow-card xl:flex">
          <div className="min-w-0">
            <p className="max-w-36 truncate text-xs font-bold text-[var(--color-text-strong)]">
              {user?.fullName || user?.username || "User"}
            </p>
            <p className="max-w-36 truncate text-[11px] font-semibold text-[var(--color-muted)]">
              {getRoleLabel(user?.role)}
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
            aria-label="Module search is available inside each workspace"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-muted)]"
            disabled
            placeholder="Use search inside a module"
            type="search"
          />
        </label>

        <button
          className={`mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white px-4 text-sm font-bold text-[var(--color-text-strong)] shadow-card ${
            canSwitchBranch ? "hover:bg-[var(--color-maroon-soft)]" : "cursor-default"
          }`}
          onClick={canSwitchBranch ? onSwitchBranch : undefined}
          type="button"
        >
          <Building2 className="size-4 shrink-0 text-[var(--color-maroon)]" />
          <span className="whitespace-nowrap">
            {canSwitchBranch ? `Switch Branch: ${branchCode}` : `Branch: ${branchCode}`}
          </span>
        </button>
      </div>
    </header>
  )
}

export default Topbar
