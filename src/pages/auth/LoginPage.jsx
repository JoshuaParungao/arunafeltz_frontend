import { useState } from "react"

import { loginUser } from "../../features/auth/auth.api"

function getErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "Login failed. Please check your username and password."
  )
}

function LoginPage({ onLogin }) {
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage("")

    if (!identifier.trim() || !password) {
      setErrorMessage("Username/email and password are required.")
      return
    }

    setIsLoading(true)

    try {
      const response = await loginUser({
        identifier: identifier.trim(),
        password,
      })

      const token = response?.data?.token
      const user = response?.data?.user

      if (!response?.success || !token || !user) {
        throw new Error("Invalid login response from server.")
      }

      await onLogin({ token, user })
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="grid min-h-svh place-items-center bg-[var(--color-page)] px-4 py-8">
      <section className="w-full max-w-md rounded-3xl border border-[var(--color-border)] bg-white p-6 shadow-card">
        <div>
          <p className="brand-text text-2xl font-bold text-[var(--color-text-strong)]">
            Arunafeltz
          </p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Cloud POS and Business Monitoring
          </p>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-sm font-semibold text-[var(--color-text-strong)]">
              Username or email
            </span>
            <input
              autoComplete="username"
              className="mt-2 h-12 w-full rounded-2xl border border-[var(--color-border)] px-4 text-sm outline-none transition focus:border-[var(--color-maroon)]"
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="superowner"
              type="text"
              value={identifier}
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-[var(--color-text-strong)]">
              Password
            </span>
            <input
              autoComplete="current-password"
              className="mt-2 h-12 w-full rounded-2xl border border-[var(--color-border)] px-4 text-sm outline-none transition focus:border-[var(--color-maroon)]"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
              type="password"
              value={password}
            />
          </label>

          {errorMessage ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {errorMessage}
            </div>
          ) : null}

          <button
            className="h-12 w-full rounded-2xl bg-[var(--color-maroon)] text-sm font-bold text-white shadow-soft transition hover:bg-[var(--color-maroon-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading}
            type="submit"
          >
            {isLoading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-5 text-xs leading-5 text-[var(--color-muted)]">
          Use an active Arunafeltz account. Your role and branch determine the workspace you can access.
        </p>
      </section>
    </main>
  )
}

export default LoginPage
