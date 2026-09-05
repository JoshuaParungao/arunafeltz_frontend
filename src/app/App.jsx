import { lazy, Suspense, useEffect, useState } from "react"

import MainLayout from "../layouts/MainLayout"
import LoginPage from "../pages/auth/LoginPage"
import BranchChooserPage from "../pages/branches/BranchChooserPage"
import PagePlaceholder from "../pages/PagePlaceholder"
import {
  APP_MODULES,
  canRoleAccessModule,
  getDefaultModuleForRole,
} from "../constants/appModules"
import { USER_ROLES } from "../constants/roles"
import { getCurrentUser } from "../features/auth/auth.api"
import { getCashBoxes } from "../features/cash-boxes/cashBoxes.api"
import {
  clearSelectedBranch,
  clearSession,
  getAccessToken,
  getActivePage,
  getSelectedBranch,
  getUser,
  saveAccessToken,
  saveActivePage,
  saveSelectedBranch,
  saveUser,
} from "../lib/sessionStorage"
import CommandPaletteModal from "../components/common/CommandPaletteModal"
import QuotationDetailDialog from "../components/quotations/QuotationDetailDialog"
import { getQuotationById } from "../features/quotations/quotations.api"

const StaffDashboardPage = lazy(() => import("../pages/dashboard/StaffDashboardPage"))
const SettingsPage = lazy(() => import("../pages/settings/SettingsPage"))
const ItemsPage = lazy(() => import("../pages/items/ItemsPage"))
const InventoryPage = lazy(() => import("../pages/inventory/InventoryPage"))
const StockTransfersPage = lazy(() => import("../pages/stock-transfers/StockTransfersPage"))
const QuotationsPage = lazy(() => import("../pages/quotations/QuotationsPage"))
const PcBuildsPage = lazy(() => import("../pages/pc-builds/PcBuildsPage"))
const CustomersPage = lazy(() => import("../pages/customers/CustomersPage"))
const ReportsPage = lazy(() => import("../pages/reports/ReportsPage"))
const AlertsPage = lazy(() => import("../pages/alerts/AlertsPage"))
const AuditLogsPage = lazy(() => import("../pages/audit-logs/AuditLogsPage"))
const UsersPage = lazy(() => import("../pages/users/UsersPage"))
const EmployeesPage = lazy(() => import("../pages/employees/EmployeesPage"))
const CashBoxesPage = lazy(() => import("../pages/cash-boxes/CashBoxesPage"))
const CreditsPage = lazy(() => import("../pages/credits/CreditsPage"))
const SuppliersPage = lazy(() => import("../pages/suppliers/SuppliersPage"))
const PurchaseOrdersPage = lazy(() => import("../pages/purchase-orders/PurchaseOrdersPage"))
const PurchaseReceivingsPage = lazy(() => import("../pages/purchase-receivings/PurchaseReceivingsPage"))
const PosSalesPage = lazy(() => import("../pages/sales/PosSalesPage"))
const SerialMonitoringPage = lazy(() => import("../pages/serials/SerialMonitoringPage"))
const ServicesPage = lazy(() => import("../pages/services/ServicesPage"))
const ServicesMaintenancePage = lazy(() => import("../pages/services/ServicesMaintenancePage"))
const WarrantyPage = lazy(() => import("../pages/warranty/WarrantyPage"))
const IncentivesPage = lazy(() => import("../pages/incentives/IncentivesPage"))

function PageLoadingFallback() {
  return (
    <section className="grid min-h-64 place-items-center rounded-3xl border border-[var(--color-border)] bg-white p-6 shadow-card">
      <div className="text-center">
        <div className="mx-auto size-8 animate-spin rounded-full border-4 border-[var(--color-maroon-soft)] border-t-[var(--color-maroon)]" />
        <p className="mt-3 text-sm font-semibold text-[var(--color-muted)]">Loading module...</p>
      </div>
    </section>
  )
}

function needsBranchChooser(currentUser, selectedBranch) {
  return currentUser?.role === USER_ROLES.SUPER_OWNER && !selectedBranch
}

function getInitialBranch(currentUser) {
  if (currentUser?.branch) return currentUser.branch
  return null
}

function App() {
  const [user, setUser] = useState(() => getUser())
  const [activePage, setActivePage] = useState(() => {
    const cachedUser = getUser()
    const saved = cachedUser ? getActivePage(cachedUser.id) : null
    if (saved) return saved
    return cachedUser ? getDefaultModuleForRole(cachedUser.role) : "pos"
  })
  const [selectedBranch, setSelectedBranch] = useState(() => getSelectedBranch())
  const [isCheckingSession, setIsCheckingSession] = useState(() => Boolean(getAccessToken()))
  const [hasAssignedCashBoxAccess, setHasAssignedCashBoxAccess] = useState(false)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [omniPreviewQuotation, setOmniPreviewQuotation] = useState(null)
  const [pageContext, setPageContext] = useState(null)

  // Global Ctrl + K / Cmd + K shortcut listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setIsCommandPaletteOpen((prev) => !prev)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const isCashBoxStaff = [
    USER_ROLES.CASHIER,
    USER_ROLES.TECHNICIAN,
  ].includes(user?.role)

  const isCashBoxManager = [
    USER_ROLES.SUPER_OWNER,
    USER_ROLES.ADMIN,
  ].includes(user?.role)

  const canAccessCashBox =
    isCashBoxManager ||
    (isCashBoxStaff && hasAssignedCashBoxAccess)

  const allowedModules = user
    ? APP_MODULES.filter(
      (item) =>
        canRoleAccessModule(user.role, item.key) ||
        (item.key === "cash-box" && canAccessCashBox),
    )
    : []

  const page = APP_MODULES.find((item) => item.key === activePage)

  const setSafeActivePage = (pageKey, currentUser = user, context = null) => {
    if (!currentUser) return

    const canAccessRequestedPage =
      canRoleAccessModule(currentUser.role, pageKey) ||
      (pageKey === "cash-box" && canAccessCashBox)

    if (canAccessRequestedPage) {
      setActivePage(pageKey)
      setPageContext(context)
      saveActivePage(currentUser.id, pageKey)
      return
    }

    const defaultPage = getDefaultModuleForRole(currentUser.role)
    setActivePage(defaultPage)
    setPageContext(null)
    saveActivePage(currentUser.id, defaultPage)
  }

  useEffect(() => {
    const verifySession = async () => {
      const token = getAccessToken()

      if (!token) {
        setIsCheckingSession(false)
        return
      }

      try {
        const response = await getCurrentUser()
        const authenticatedUser = response?.data?.user || response?.user || response

        if (!response?.success && !authenticatedUser?.id) {
          throw new Error("Invalid session response.")
        }

        saveUser(authenticatedUser)
        setUser(authenticatedUser)

        const savedPage = getActivePage(authenticatedUser.id)
        if (savedPage && canRoleAccessModule(authenticatedUser.role, savedPage)) {
          setActivePage(savedPage)
        } else {
          setActivePage(getDefaultModuleForRole(authenticatedUser.role))
        }

        if (authenticatedUser.role !== USER_ROLES.SUPER_OWNER) {
          const branch = getInitialBranch(authenticatedUser)

          if (branch) {
            saveSelectedBranch(branch)
            setSelectedBranch(branch)
          }
        } else {
          const savedBranch = getSelectedBranch()
          if (savedBranch) {
            setSelectedBranch(savedBranch)
          }
        }
      } catch {
        clearSession()
        setUser(null)
        setSelectedBranch(null)
        setActivePage("pos")
      } finally {
        setIsCheckingSession(false)
      }
    }

    verifySession()
  }, [])

  useEffect(() => {
    if (!isCashBoxStaff) {
      const timer = window.setTimeout(() => {
        setHasAssignedCashBoxAccess(false)
      }, 0)

      return () => window.clearTimeout(timer)
    }

    let cancelled = false

    const branchId =
      user?.branchId ||
      user?.branch?.id ||
      ""

    const timer = window.setTimeout(async () => {
      try {
        await getCashBoxes({
          ...(branchId ? { branchId } : {}),
          status: "ACTIVE",
          limit: 1,
        })

        if (!cancelled) {
          setHasAssignedCashBoxAccess(true)
        }
      } catch {
        if (!cancelled) {
          setHasAssignedCashBoxAccess(false)
        }
      }
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [
    isCashBoxStaff,
    user?.branch?.id,
    user?.branchId,
    user?.id,
  ])

  const handleLogin = async ({ token, user: loginUser }) => {
    saveAccessToken(token)
    saveUser(loginUser)

    const response = await getCurrentUser()
    const currentUser = response?.data?.user || response?.user || loginUser

    if (!currentUser) {
      clearSession()
      throw new Error("Unable to verify logged-in user.")
    }

    saveUser(currentUser)
    setUser(currentUser)

    const savedPage = getActivePage(currentUser.id)
    const targetPage =
      savedPage && canRoleAccessModule(currentUser.role, savedPage)
        ? savedPage
        : getDefaultModuleForRole(currentUser.role)

    setActivePage(targetPage)
    saveActivePage(currentUser.id, targetPage)

    if (currentUser.role !== USER_ROLES.SUPER_OWNER) {
      const branch = getInitialBranch(currentUser)

      if (branch) {
        saveSelectedBranch(branch)
        setSelectedBranch(branch)
      }
    } else {
      clearSelectedBranch()
      setSelectedBranch(null)
    }
  }

  const handleSelectBranch = (branch) => {
    saveSelectedBranch(branch)
    setSelectedBranch(branch)
    setActivePage(getDefaultModuleForRole(user.role))
  }

  const handleSwitchBranch = () => {
    if (user?.role !== USER_ROLES.SUPER_OWNER) return

    clearSelectedBranch()
    setSelectedBranch(null)
    setActivePage(getDefaultModuleForRole(user.role))
  }

  const handleLogout = () => {
    clearSession()
    setUser(null)
    setSelectedBranch(null)
    setActivePage("pos")
  }

  const renderPage = () => {
    if (activePage === "staff-dashboard") {
      return (
        <StaffDashboardPage
          onNavigate={setSafeActivePage}
          selectedBranch={selectedBranch}
          user={user}
        />
      )
    }

    if (activePage === "items") {
      return <ItemsPage selectedBranch={selectedBranch} user={user} />
    }

    if (activePage === "services-maintenance") {
      return <ServicesMaintenancePage selectedBranch={selectedBranch} user={user} />
    }

    if (activePage === "inventory") {
      return (
        <InventoryPage
          initialContext={pageContext}
          selectedBranch={selectedBranch}
          user={user}
        />
      )
    }

    if (activePage === "pos") {
      return <PosSalesPage selectedBranch={selectedBranch} user={user} />
    }

    if (activePage === "serials") {
      return <SerialMonitoringPage onNavigate={setSafeActivePage} selectedBranch={selectedBranch} user={user} />
    }

    if (activePage === "services") {
      return <ServicesPage selectedBranch={selectedBranch} user={user} />
    }

    if (activePage === "warranty") {
      return (
        <WarrantyPage
          initialContext={pageContext}
          selectedBranch={selectedBranch}
          user={user}
        />
      )
    }

    if (activePage === "stock-transfers") {
      return (
        <StockTransfersPage
          initialContext={pageContext}
          selectedBranch={selectedBranch}
          user={user}
        />
      )
    }

    if (activePage === "quotations") {
      return <QuotationsPage selectedBranch={selectedBranch} user={user} />
    }

    if (activePage === "pc-builds") {
      return <PcBuildsPage selectedBranch={selectedBranch} user={user} />
    }

    if (activePage === "customers") {
      return <CustomersPage selectedBranch={selectedBranch} user={user} />
    }

    if (activePage === "reports") {
      return <ReportsPage selectedBranch={selectedBranch} user={user} />
    }

    if (activePage === "alerts") {
      return (
        <AlertsPage
          onNavigate={(pageKey, ctx) => setSafeActivePage(pageKey, user, ctx)}
          selectedBranch={selectedBranch}
          user={user}
        />
      )
    }

    if (activePage === "audit-logs") {
      return <AuditLogsPage selectedBranch={selectedBranch} user={user} />
    }

    if (activePage === "employees") {
      return <EmployeesPage selectedBranch={selectedBranch} user={user} />
    }

    if (activePage === "users") {
      return <UsersPage selectedBranch={selectedBranch} user={user} />
    }

    if (activePage === "cash-box") {
      return (
        <CashBoxesPage
          hasCashBoxAccess={canAccessCashBox}
          initialContext={pageContext}
          selectedBranch={selectedBranch}
          user={user}
        />
      )
    }

    if (activePage === "credits") {
      return (
        <CreditsPage
          initialContext={pageContext}
          selectedBranch={selectedBranch}
          user={user}
        />
      )
    }

    if (activePage === "incentives") {
      return <IncentivesPage selectedBranch={selectedBranch} user={user} />
    }

    if (activePage === "suppliers") {
      return (
        <SuppliersPage
          onNavigate={setSafeActivePage}
          selectedBranch={selectedBranch}
          user={user}
        />
      )
    }

    if (activePage === "purchase-orders") {
      return (
        <PurchaseOrdersPage
          initialContext={pageContext}
          onNavigate={setSafeActivePage}
          selectedBranch={selectedBranch}
          user={user}
        />
      )
    }

    if (activePage === "receivings") {
      return (
        <PurchaseReceivingsPage
          initialContext={pageContext}
          selectedBranch={selectedBranch}
          user={user}
        />
      )
    }

    if (activePage === "settings") return <SettingsPage user={user} />

    return (
      <PagePlaceholder
        title={page?.label || "Module"}
        description="This module is unavailable for the current session. Return to the dashboard or choose another module."
      />
    )
  }

  if (isCheckingSession) {
    return (
      <main className="grid min-h-svh place-items-center bg-[var(--color-page)] px-4">
        <section className="rounded-3xl border border-[var(--color-border)] bg-white p-6 text-center shadow-card">
          <p className="brand-text text-xl font-bold text-[var(--color-text-strong)]">
            Arunafeltz
          </p>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Checking session...</p>
        </section>
      </main>
    )
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />
  }

  if (needsBranchChooser(user, selectedBranch)) {
    return (
      <BranchChooserPage
        onLogout={handleLogout}
        onSelectBranch={handleSelectBranch}
        user={user}
      />
    )
  }

  return (
    <>
      <MainLayout
        activePage={activePage}
        canSwitchBranch={user?.role === USER_ROLES.SUPER_OWNER}
        modules={allowedModules}
        onChangePage={(pageKey, ctx) => setSafeActivePage(pageKey, user, ctx)}
        onLogout={handleLogout}
        onOpenSearch={() => setIsCommandPaletteOpen(true)}
        onSwitchBranch={handleSwitchBranch}
        selectedBranch={selectedBranch}
        user={user}
      >
        <Suspense fallback={<PageLoadingFallback />}>
          {renderPage()}
        </Suspense>
      </MainLayout>

      <CommandPaletteModal
        allowedModules={allowedModules}
        branchId={selectedBranch?.id || user?.branch?.id}
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={(pageKey) => setSafeActivePage(pageKey)}
        onSelectQuotation={async (quoteSummary) => {
          setIsCommandPaletteOpen(false)
          try {
            const res = await getQuotationById(quoteSummary.id)
            const detail = res?.data || res
            if (detail?.id) {
              setOmniPreviewQuotation(detail)
            }
          } catch (err) {
            console.warn("Unable to load quotation for omni preview:", err)
            setSafeActivePage("quotations")
          }
        }}
        onSelectSale={() => {
          setIsCommandPaletteOpen(false)
          setSafeActivePage("pos")
        }}
      />

      {omniPreviewQuotation ? (
        <QuotationDetailDialog
          onClose={() => setOmniPreviewQuotation(null)}
          quotation={omniPreviewQuotation}
        />
      ) : null}
    </>
  )
}

export default App









