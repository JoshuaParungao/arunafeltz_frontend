import { APP_MODULES } from "../constants/appModules"
import Sidebar from "./Sidebar"
import Topbar from "./Topbar"

function MainLayout({ activePage, onChangePage, user, onLogout, children }) {
  const activeLabel =
    APP_MODULES.find((item) => item.key === activePage)?.label || "Arunafeltz"

  return (
    <main className="min-h-svh bg-[var(--color-page)] text-[var(--color-text)]">
      <div className="flex min-h-svh w-full overflow-hidden">
        <Sidebar activePage={activePage} onChangePage={onChangePage} />

        <section className="flex min-w-0 flex-1 flex-col">
          <Topbar activeLabel={activeLabel} user={user} onLogout={onLogout} />

          <div className="mx-auto w-full max-w-screen-2xl flex-1 px-4 py-5 md:px-6 lg:py-7">
            {children}
          </div>
        </section>
      </div>
    </main>
  )
}

export default MainLayout
