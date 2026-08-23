import apiClient from "../../lib/apiClient"

export async function getSuppliers(params = {}) {
  const response = await apiClient.get("/suppliers", { params })
  return response.data
}

export async function getSupplierById(id) {
  const response = await apiClient.get(`/suppliers/${id}`)
  return response.data
}

export async function createSupplier(payload) {
  const response = await apiClient.post("/suppliers", payload)
  return response.data
}

export async function updateSupplier(id, payload) {
  const response = await apiClient.patch(`/suppliers/${id}`, payload)
  return response.data
}

export async function updateSupplierStatus(id, status) {
  const response = await apiClient.patch(`/suppliers/${id}/status`, { status })
  return response.data
}
