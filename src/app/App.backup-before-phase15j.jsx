import { useEffect, useState } from "react"

import MainLayout from "../layouts/MainLayout"
import LoginPage from "../pages/auth/LoginPage"
import OwnerDashboardPage from "../pages/dashboard/OwnerDashboardPage"
import SettingsPage from "../pages/settings/SettingsPage"
import PagePlaceholder from "../pages/PagePlaceholder"
import { APP_MODULES } from "../constants/appModules"
import { getCurrentUser } from "../features/auth/auth.api"
import {
  clearSession,
  getAccessToken,
  getUser,
  saveAccessToken,
  saveUser,
} from "../lib/sessionStorage"

function App() {
  const [activePage, setActivePage] = useState("owner-dashboard")
  const [user, setUser] = useState(() => getUser())
  const [isCheckingSession, setIsCheckingSession] = useState(() => Boolean(getAccessToken()))

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
      } catch {
        clearSession()
        setUser(null)
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
    setActivePage("owner-dashboard")
  }

  const handleLogout = () => {
    clearSession()
    setUser(null)
    setActivePage("owner-dashboard")
  }

  const page = APP_MODULES.find((item) => item.key === activePage)

  const renderPage = () => {
    if (activePage === "owner-dashboard") return <OwnerDashboardPage />
    if (activePage === "settings") return <SettingsPage />

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

  return (
    <MainLayout
      activePage={activePage}
      onChangePage={setActivePage}
      onLogout={handleLogout}
      user={user}
    >
      {renderPage()}
    </MainLayout>
  )
}

export default App
