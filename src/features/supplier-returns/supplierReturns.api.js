import apiClient from "../../lib/apiClient"

export async function getSupplierReturns(params = {}) {
  const response = await apiClient.get("/supplier-returns", { params })
  return response.data
}

export async function getSupplierReturnById(id) {
  const response = await apiClient.get(`/supplier-returns/${id}`)
  return response.data
}

export async function getEligibleDefects(params = {}) {
  const response = await apiClient.get("/supplier-returns/eligible-defects", { params })
  return response.data
}

export async function createSupplierReturn(payload) {
  const response = await apiClient.post("/supplier-returns", payload)
  return response.data
}

export async function updateSupplierReturn(id, payload) {
  const response = await apiClient.put(`/supplier-returns/${id}`, payload)
  return response.data
}

export async function approveSupplierReturn(id, payload = {}) {
  const response = await apiClient.post(`/supplier-returns/${id}/approve`, payload)
  return response.data
}

export async function dispatchSupplierReturn(id, payload = {}) {
  const response = await apiClient.post(`/supplier-returns/${id}/dispatch`, payload)
  return response.data
}

export async function resolveSupplierReturn(id, payload) {
  const response = await apiClient.post(`/supplier-returns/${id}/resolve`, payload)
  return response.data
}

export async function cancelSupplierReturn(id, payload) {
  const response = await apiClient.post(`/supplier-returns/${id}/cancel`, payload)
  return response.data
}

