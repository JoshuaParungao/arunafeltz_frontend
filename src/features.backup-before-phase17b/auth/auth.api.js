import apiClient from "../../lib/apiClient"

export async function loginUser(payload) {
  const response = await apiClient.post("/auth/login", payload)
  return response.data
}

export async function getCurrentUser() {
  const response = await apiClient.get("/auth/me")
  return response.data
}
