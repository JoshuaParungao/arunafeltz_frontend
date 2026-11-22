import axios from "axios"

import { API_CONFIG } from "../config/api.config"
import { clearSession, getAccessToken } from "./sessionStorage"

const apiClient = axios.create({
  baseURL: API_CONFIG.baseURL,
  timeout: API_CONFIG.timeout,
  headers: {
    "Content-Type": "application/json",
  },
})

const isTechnicalErrorString = (str) => {
  if (typeof str !== "string") return false
  return (
    str.includes("prisma.") ||
    str.includes("invocation:") ||
    str.includes("UserWhereInput") ||
    str.includes("WhereUniqueInput") ||
    str.includes("TypeError") ||
    str.includes("ReferenceError") ||
    str.includes("SyntaxError") ||
    str.includes("Cannot read property") ||
    str.includes("Cannot read properties") ||
    str.includes("is not a function") ||
    str.includes("SELECT ") ||
    str.includes("INSERT INTO") ||
    str.includes("UPDATE ") ||
    str.includes("DELETE FROM") ||
    str.includes("at Object.") ||
    str.includes(".js:") ||
    str.includes("{\n") ||
    str.includes("}\n")
  )
}

apiClient.interceptors.request.use(
  (config) => {
    const token = getAccessToken()

    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  },
  (error) => Promise.reject(error),
)

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status

    if (status === 401) {
      clearSession()
    }

    // Sanitize any raw technical error messages in the response payload
    const friendlyFallback =
      "Hindi maproseso ang transaksyon dahil sa maling detalye o validation error. Pakisuri ang mga nakalagay na impormasyon at subukan muli."

    if (error?.response?.data?.error?.message && isTechnicalErrorString(error.response.data.error.message)) {
      error.response.data.error.message = friendlyFallback
    }

    if (error?.response?.data?.message && isTechnicalErrorString(error.response.data.message)) {
      error.response.data.message = friendlyFallback
    }

    if (typeof error?.response?.data?.error === "string" && isTechnicalErrorString(error.response.data.error)) {
      error.response.data.error = friendlyFallback
    }

    if (error?.message && isTechnicalErrorString(error.message)) {
      error.message = friendlyFallback
    }

    if (error?.code === "ERR_NETWORK" || error?.message === "Network Error") {
      error.message = "Hindi makakonekta sa server. Pakisuri ang iyong koneksyon sa internet."
    }

    return Promise.reject(error)
  },
)

export default apiClient
