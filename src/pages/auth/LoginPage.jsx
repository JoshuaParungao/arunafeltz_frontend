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
          <h1 className="text-2xl font-black text-[var(--color-text-strong)]">
            Arunafeltz Computer
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Cloud POS and Business Monitoring
          </p>
        </div>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label
              className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]"
              htmlFor="identifier"
            >
              Username or email
            </label>
            <input
              autoComplete="username"
              className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-maroon)]"
              disabled={isLoading}
              id="identifier"
              name="identifier"
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="Username or email"
              required
              type="text"
              value={identifier}
            />
          </div>

          <div>
            <label
              className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]"
              htmlFor="password"
            >
              Password
            </label>
            <input
              autoComplete="current-password"
              className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-maroon)]"
              disabled={isLoading}
              id="password"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••••••"
              required
              type="password"
              value={password}
            />
          </div>

          {errorMessage ? (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">
              {errorMessage}
            </p>
          ) : null}

          <button
            className="w-full rounded-2xl bg-[var(--color-maroon)] px-4 py-3 text-sm font-bold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading}
            type="submit"
          >
            {isLoading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-xs text-[var(--color-muted)]">
          Use an active Arunafeltz Computer account. Your role and branch determine the
          workspace you can access.
        </p>
      </section>
    </main>
  )
}

export default LoginPage
