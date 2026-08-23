import apiClient from "../../lib/apiClient"

export async function getCustomers(params = {}) {
  const response = await apiClient.get("/customers", { params })
  return response.data
}

export async function getCustomerById(id) {
  const response = await apiClient.get(`/customers/${id}`)
  return response.data
}

export async function getCustomerHistory(id, params = {}) {
  const response = await apiClient.get(`/customers/${id}/history`, { params })
  return response.data
}

export async function createCustomer(payload) {
  const response = await apiClient.post("/customers", payload)
  return response.data
}

export async function updateCustomerById(id, payload) {
  const response = await apiClient.patch(`/customers/${id}`, payload)
  return response.data
}
