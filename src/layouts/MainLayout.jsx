import { useState } from "react"

import { APP_MODULES } from "../constants/appModules"
import Sidebar from "./Sidebar"
import Topbar from "./Topbar"

function MainLayout({
  activePage,
  onChangePage,
  user,
  selectedBranch,
  modules,
  canSwitchBranch = false,
  onSwitchBranch,
  onLogout,
  children,
}) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false)

  const activeLabel =
    APP_MODULES.find((item) => item.key === activePage)?.label || "Arunafeltz"

  return (
    <main className="h-svh overflow-hidden bg-[var(--color-page)] text-[var(--color-text)]">
      <div className="flex h-svh w-full overflow-hidden">
        <div className="hidden lg:block">
          <Sidebar
            activePage={activePage}
            isCollapsed={isDesktopSidebarCollapsed}
            modules={modules}
            onChangePage={onChangePage}
          />
        </div>

        {isMobileSidebarOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              aria-label="Close sidebar overlay"
              className="absolute inset-0 bg-black/45"
              onClick={() => setIsMobileSidebarOpen(false)}
              type="button"
            />
            <div className="absolute inset-y-0 left-0">
              <Sidebar
                activePage={activePage}
                modules={modules}
                onChangePage={onChangePage}
                onClose={() => setIsMobileSidebarOpen(false)}
              />
            </div>
          </div>
        ) : null}

        <section className="flex h-svh min-w-0 flex-1 flex-col overflow-hidden">
          <Topbar
            activeLabel={activeLabel}
            canSwitchBranch={canSwitchBranch}
            isDesktopSidebarCollapsed={isDesktopSidebarCollapsed}
            onLogout={onLogout}
            onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
            onSwitchBranch={onSwitchBranch}
            onToggleDesktopSidebar={() =>
              setIsDesktopSidebarCollapsed((currentValue) => !currentValue)
            }
            selectedBranch={selectedBranch}
            user={user}
          />

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-screen-2xl px-4 py-5 md:px-6 lg:py-7">
              {children}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

export default MainLayout

