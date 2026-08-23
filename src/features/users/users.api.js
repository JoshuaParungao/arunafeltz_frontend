import apiClient from "../../lib/apiClient"

export async function getUsers(params = {}) {
  const response = await apiClient.get("/users", { params })
  return response.data
}

export async function getUserById(id) {
  const response = await apiClient.get(`/users/${id}`)
  return response.data
}

export async function createUser(payload) {
  const response = await apiClient.post("/users", payload)
  return response.data
}

export async function updateUserById(id, payload) {
  const response = await apiClient.patch(`/users/${id}`, payload)
  return response.data
}

export async function approveUser(id) {
  const response = await apiClient.patch(`/users/${id}/approve`)
  return response.data
}

export async function rejectUser(id) {
  const response = await apiClient.patch(`/users/${id}/reject`)
  return response.data
}

export async function disableUser(id) {
  const response = await apiClient.patch(`/users/${id}/disable`)
  return response.data
}
