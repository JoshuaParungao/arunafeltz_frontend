import { useState } from "react"
import { Bell, Building2, Edit3, Eye, EyeOff, Menu, Moon, PanelLeftClose, PanelLeftOpen, Search, Sun, User, X } from "lucide-react"

import { getRoleLabel } from "../constants/roles"
import { useTheme } from "../context/ThemeContext"
import { updateUserById } from "../features/users/users.api"
import { saveUser } from "../lib/sessionStorage"

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
  onOpenSearch,
}) {
  const branchCode = selectedBranch?.code || user?.branch?.code || "ALL"
  const { resolvedTheme, toggleTheme } = useTheme()

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [profileForm, setProfileForm] = useState({
    firstName: user?.firstName || "",
    middleName: user?.middleName || "",
    lastName: user?.lastName || "",
    username: user?.username || "",
    email: user?.email || "",
    password: "",
    confirmPassword: "",
  })
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState("")

  const openProfileModal = () => {
    setProfileForm({
      firstName: user?.firstName || "",
      middleName: user?.middleName || "",
      lastName: user?.lastName || "",
      username: user?.username || "",
      email: user?.email || "",
      password: "",
      confirmPassword: "",
    })
    setShowPassword(false)
    setProfileError("")
    setIsProfileModalOpen(true)
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setProfileError("")

    if (!profileForm.firstName.trim() || !profileForm.lastName.trim()) {
      setProfileError("First name and last name are required.")
      return
    }

    if (profileForm.password.trim()) {
      if (profileForm.password.trim().length < 8) {
        setProfileError("New password must be at least 8 characters.")
        return
      }
      if (profileForm.password.trim() !== profileForm.confirmPassword.trim()) {
        setProfileError("Passwords do not match. Please re-type your new password.")
        return
      }
    }

    try {
      setIsSavingProfile(true)
      const payload = {
        firstName: profileForm.firstName.trim(),
        middleName: profileForm.middleName.trim() || null,
        lastName: profileForm.lastName.trim(),
        username: profileForm.username.trim(),
        email: profileForm.email.trim() || null,
      }
      if (profileForm.password.trim()) {
        payload.password = profileForm.password.trim()
      }

      const response = await updateUserById(user.id, payload)
      if (response?.data) {
        saveUser(response.data)
      }
      setIsProfileModalOpen(false)
      window.location.reload()
    } catch (err) {
      setProfileError(err?.response?.data?.message || err?.message || "Failed to update profile.")
    } finally {
      setIsSavingProfile(false)
    }
  }

  return (
    <>
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
            <button
              aria-label="Open Omnisearch (Ctrl+K)"
              className="flex h-11 w-full max-w-2xl items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-white px-4 text-left shadow-card transition hover:border-[#002060]/50"
              onClick={onOpenSearch}
              type="button"
            >
              <div className="flex items-center gap-3 text-slate-400">
                <Search className="size-4 shrink-0 text-[var(--color-muted)]" />
                <span className="text-sm font-normal text-[var(--color-muted)]">
                  Search products, serials, receipts, quotations...
                </span>
              </div>
              <kbd className="hidden items-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-500 sm:inline-flex">
                Ctrl + K
              </kbd>
            </button>
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

          {/* Clickable Profile Widget */}
          <button
            type="button"
            onClick={openProfileModal}
            title="Click to edit your profile name"
            className="hidden min-w-0 items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white px-3 py-1.5 shadow-card xl:flex hover:border-[var(--color-maroon)] hover:bg-slate-50 transition cursor-pointer text-left"
          >
            <div className="grid size-7 place-items-center rounded-xl bg-red-100 text-[var(--color-maroon)]">
              <User size={15} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="max-w-44 truncate text-xs font-bold text-[var(--color-text-strong)]">
                  {[user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.fullName || user?.username || "User"}
                </p>
                <Edit3 size={11} className="text-slate-400 hover:text-[var(--color-maroon)]" />
              </div>
            </div>
          </button>

          <button
            className="rounded-2xl border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-bold text-[var(--color-maroon)] shadow-card transition hover:bg-[var(--color-maroon-soft)]"
            onClick={onLogout}
            type="button"
          >
            Logout
          </button>
        </div>

        <div className="mx-auto mt-3 w-full max-w-screen-2xl md:hidden">
          <button
            aria-label="Open Omnisearch"
            className="flex h-11 w-full items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-white px-4 text-left shadow-card"
            onClick={onOpenSearch}
            type="button"
          >
            <Search className="size-4 shrink-0 text-[var(--color-muted)]" />
            <span className="text-sm font-normal text-[var(--color-muted)]">
              Search products, serials, receipts...
            </span>
          </button>

          <div className="mt-3 flex gap-2">
            <button
              className={`flex-1 flex h-11 items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white px-4 text-sm font-bold text-[var(--color-text-strong)] shadow-card ${
                canSwitchBranch ? "hover:bg-[var(--color-maroon-soft)]" : "cursor-default"
              }`}
              onClick={canSwitchBranch ? onSwitchBranch : undefined}
              type="button"
            >
              <Building2 className="size-4 shrink-0 text-[var(--color-maroon)]" />
              <span className="whitespace-nowrap">
                {canSwitchBranch ? `Branch: ${branchCode}` : `Branch: ${branchCode}`}
              </span>
            </button>

            <button
              type="button"
              onClick={openProfileModal}
              className="flex h-11 items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white px-4 text-xs font-bold text-[var(--color-text-strong)] shadow-card hover:bg-slate-50"
            >
              <User size={15} className="text-[var(--color-maroon)]" />
              <span>Edit Profile</span>
            </button>
          </div>
        </div>
      </header>

      {/* Profile Edit Modal */}
      {isProfileModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-maroon)]">Account Settings</span>
                <h3 className="text-lg font-black text-slate-900">Edit My Profile Name</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            {profileError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">
                {profileError}
              </div>
            ) : null}

            <form onSubmit={handleSaveProfile} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={profileForm.firstName}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, firstName: e.target.value }))}
                    placeholder="e.g. Joshua"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:border-[var(--color-maroon)] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={profileForm.lastName}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, lastName: e.target.value }))}
                    placeholder="e.g. Parungao"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:border-[var(--color-maroon)] focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Middle Name <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={profileForm.middleName}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, middleName: e.target.value }))}
                  placeholder="e.g. Ople"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:border-[var(--color-maroon)] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={profileForm.username}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, username: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:border-[var(--color-maroon)] focus:bg-white"
                />
              </div>

              {/* Password Update Section */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 uppercase">Change Password</span>
                  <span className="text-[10px] text-slate-400 font-semibold">(Leave blank to keep current)</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={profileForm.password}
                        onChange={(e) => setProfileForm((prev) => ({ ...prev, password: e.target.value }))}
                        placeholder="Min 8 characters"
                        className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3 py-2 pr-8 text-xs font-semibold text-slate-900 outline-none focus:border-[var(--color-maroon)] focus:bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                      Confirm Password
                    </label>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={profileForm.confirmPassword}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="Repeat new password"
                      className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:border-[var(--color-maroon)] focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSavingProfile}
                  onClick={() => setIsProfileModalOpen(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="rounded-xl bg-[var(--color-maroon)] px-5 py-2 text-xs font-bold text-white hover:opacity-90 transition disabled:opacity-50 shadow-xs"
                >
                  {isSavingProfile ? "Saving..." : "Save Profile & Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}

export default Topbar
