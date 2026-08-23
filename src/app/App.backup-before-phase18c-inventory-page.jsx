import { useEffect, useState } from "react"

import MainLayout from "../layouts/MainLayout"
import LoginPage from "../pages/auth/LoginPage"
import BranchChooserPage from "../pages/branches/BranchChooserPage"
import OwnerDashboardPage from "../pages/dashboard/OwnerDashboardPage"
import StaffDashboardPage from "../pages/dashboard/StaffDashboardPage"
import SettingsPage from "../pages/settings/SettingsPage"
import ItemsPage from "../pages/items/ItemsPage"
import PagePlaceholder from "../pages/PagePlaceholder"
import {
  APP_MODULES,
  canRoleAccessModule,
  getDefaultModuleForRole,
  getModulesForRole,
} from "../constants/appModules"
import { USER_ROLES } from "../constants/roles"
import { getCurrentUser } from "../features/auth/auth.api"
import {
  clearSelectedBranch,
  clearSession,
  getAccessToken,
  getSelectedBranch,
  getUser,
  saveAccessToken,
  saveSelectedBranch,
  saveUser,
} from "../lib/sessionStorage"

function needsBranchChooser(currentUser, selectedBranch) {
  return currentUser?.role === USER_ROLES.SUPER_OWNER && !selectedBranch
}

function getInitialBranch(currentUser) {
  if (currentUser?.branch) return currentUser.branch
  return null
}

function App() {
  const [activePage, setActivePage] = useState("owner-dashboard")
  const [user, setUser] = useState(() => getUser())
  const [selectedBranch, setSelectedBranch] = useState(() => getSelectedBranch())
  const [isCheckingSession, setIsCheckingSession] = useState(() => Boolean(getAccessToken()))

  const allowedModules = user ? getModulesForRole(user.role) : []
  const page = APP_MODULES.find((item) => item.key === activePage)

  const setSafeActivePage = (pageKey, currentUser = user) => {
    if (!currentUser) return

    if (canRoleAccessModule(currentUser.role, pageKey)) {
      setActivePage(pageKey)
      return
    }

    setActivePage(getDefaultModuleForRole(currentUser.role))
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
        const currentUser = response?.data?.user

        if (!response?.success || !currentUser) {
          throw new Error("Invalid session response.")
        }

        saveUser(currentUser)
        setUser(currentUser)
        setSafeActivePage(activePage, currentUser)

        if (currentUser.role !== USER_ROLES.SUPER_OWNER) {
          const branch = getInitialBranch(currentUser)

          if (branch) {
            saveSelectedBranch(branch)
            setSelectedBranch(branch)
          }
        }
      } catch {
        clearSession()
        setUser(null)
        setSelectedBranch(null)
      } finally {
        setIsCheckingSession(false)
      }
    }

    verifySession()
  }, [])

  const handleLogin = async ({ token, user: loginUser }) => {
    saveAccessToken(token)
    saveUser(loginUser)

    const response = await getCurrentUser()
    const currentUser = response?.data?.user

    if (!response?.success || !currentUser) {
      clearSession()
      throw new Error("Unable to verify logged-in user.")
    }

    saveUser(currentUser)
    setUser(currentUser)
    setActivePage(getDefaultModuleForRole(currentUser.role))

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
    setActivePage("owner-dashboard")
  }

  const renderPage = () => {
    if (activePage === "owner-dashboard") {
      return (
        <OwnerDashboardPage
          onNavigate={setSafeActivePage}
          selectedBranch={selectedBranch}
          user={user}
        />
      )
    }

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

    if (activePage === "settings") return <SettingsPage user={user} />

    return (
      <PagePlaceholder
        title={page?.label || "Module"}
        description="This module is part of the enterprise frontend track. It will be implemented and tested in its own phase."
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
    <MainLayout
      activePage={activePage}
      canSwitchBranch={user?.role === USER_ROLES.SUPER_OWNER}
      modules={allowedModules}
      onChangePage={(pageKey) => setSafeActivePage(pageKey)}
      onLogout={handleLogout}
      onSwitchBranch={handleSwitchBranch}
      selectedBranch={selectedBranch}
      user={user}
    >
      {renderPage()}
    </MainLayout>
  )
}

export default App



