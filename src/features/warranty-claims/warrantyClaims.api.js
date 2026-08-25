import apiClient from "../../lib/apiClient"

export async function getWarrantyClaims(params = {}) {
  const response = await apiClient.get("/warranty-claims", { params })
  return response.data
}

export async function getWarrantyClaimById(id) {
  const response = await apiClient.get(`/warranty-claims/${id}`)
  return response.data
}

export async function createWarrantyClaim(payload) {
  const response = await apiClient.post("/warranty-claims", payload)
  return response.data
}

export async function updateWarrantyClaimStatus(id, payload) {
  const response = await apiClient.patch(`/warranty-claims/${id}/status`, payload)
  return response.data
}

export async function releaseWarrantyClaim(id, payload = {}) {
  const response = await apiClient.post(`/warranty-claims/${id}/release`, payload)
  return response.data
}

export async function processImmediateReplacement(id, payload) {
  const response = await apiClient.post(`/warranty-claims/${id}/replace`, payload)
  return response.data
}

export async function dispatchToSupplier(id, payload) {
  const response = await apiClient.post(`/warranty-claims/${id}/dispatch-supplier`, payload)
  return response.data
}

export async function resolveSupplierRma(id, payload) {
  const response = await apiClient.post(`/warranty-claims/${id}/resolve-supplier`, payload)
  return response.data
}

export async function rejectCustomerClaim(id, payload) {
  const response = await apiClient.post(`/warranty-claims/${id}/reject`, payload)
  return response.data
}
