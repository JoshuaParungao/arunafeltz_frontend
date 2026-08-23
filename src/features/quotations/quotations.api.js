import apiClient from "../../lib/apiClient"

export async function getQuotations(params = {}) {
  const response = await apiClient.get("/quotations", { params })
  return response.data
}

export async function getQuotationServiceStaff(params = {}) {
  const response = await apiClient.get("/quotations/service-staff", { params })
  return response.data
}

export async function getQuotationById(id) {
  const response = await apiClient.get(`/quotations/${id}`)
  return response.data
}

export async function createQuotation(payload) {
  const response = await apiClient.post("/quotations", payload)
  return response.data
}

export async function updateQuotation(id, payload) {
  const response = await apiClient.patch(`/quotations/${id}`, payload)
  return response.data
}

export async function updateQuotationStatus(id, payload) {
  const response = await apiClient.patch(`/quotations/${id}/status`, payload)
  return response.data
}
