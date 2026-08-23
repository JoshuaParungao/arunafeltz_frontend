function PagePlaceholder({ title }) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-strong)]">
          {title}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          This module is not available in the current workspace.
        </p>
      </div>

      <section className="rounded-3xl border border-dashed border-[var(--color-border)] bg-white p-6 shadow-card">
        <p className="text-sm font-semibold text-[var(--color-text-strong)]">
          Unavailable
        </p>
        <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
          Choose another module from the navigation.
        </p>
      </section>
    </div>
  )
}

export default PagePlaceholder
