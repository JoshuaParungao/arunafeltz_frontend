function Card({ children, className = "" }) {
  return (
    <section
      className={`min-w-0 rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-card ${className}`}
    >
      {children}
    </section>
  )
}

export default Card
