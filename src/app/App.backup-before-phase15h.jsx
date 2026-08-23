import { useState } from "react"

import MainLayout from "../layouts/MainLayout"
import OwnerDashboardPage from "../pages/dashboard/OwnerDashboardPage"
import SettingsPage from "../pages/settings/SettingsPage"
import PagePlaceholder from "../pages/PagePlaceholder"
import { APP_MODULES } from "../constants/appModules"

function App() {
  const [activePage, setActivePage] = useState("owner-dashboard")

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

  return (
    <MainLayout activePage={activePage} onChangePage={setActivePage}>
      {renderPage()}
    </MainLayout>
  )
}

export default App
