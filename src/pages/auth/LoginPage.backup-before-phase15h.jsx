function LoginPage() {
  return (
    <main className="grid min-h-svh place-items-center bg-[var(--color-page)] px-4 py-8">
      <section className="w-full max-w-md rounded-3xl border border-[var(--color-border)] bg-white p-6 shadow-card">
        <p className="brand-text text-2xl font-bold text-[var(--color-text-strong)]">
          Arunafeltz
        </p>
        <p className="mt-1 text-sm text-[var(--color-muted)]">Login UI placeholder</p>

        <div className="mt-6 space-y-3">
          <input
            className="h-12 w-full rounded-2xl border border-[var(--color-border)] px-4 text-sm outline-none"
            placeholder="Username or email"
            type="text"
          />
          <input
            className="h-12 w-full rounded-2xl border border-[var(--color-border)] px-4 text-sm outline-none"
            placeholder="Password"
            type="password"
          />
          <button
            className="h-12 w-full rounded-2xl bg-[var(--color-maroon)] text-sm font-bold text-white"
            type="button"
          >
            Sign in
          </button>
        </div>
      </section>
    </main>
  )
}

export default LoginPage
