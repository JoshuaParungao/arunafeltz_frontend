function Badge({ children, tone = "default" }) {
  const toneClass =
    tone === "maroon"
      ? "bg-[var(--color-maroon-soft)] text-[var(--color-maroon)]"
      : "bg-[var(--color-soft)] text-[var(--color-text)]"

  return (
    <span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${toneClass}`}>
      {children}
    </span>
  )
}

export default Badge
