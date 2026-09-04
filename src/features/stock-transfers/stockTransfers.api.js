import apiClient from "../../lib/apiClient"

export async function getStockTransfers(params = {}) {
  const response = await apiClient.get("/stock-transfers", { params })
  return response.data
}

export async function getStockTransferById(stockTransferId) {
  const response = await apiClient.get(`/stock-transfers/${stockTransferId}`)
  return response.data
}

export async function updateStockTransferStatusById(stockTransferId, payload) {
  const response = await apiClient.patch(`/stock-transfers/${stockTransferId}/status`, payload)
  return response.data
}

export async function updateStockTransferPricingById(stockTransferId, payload) {
  const response = await apiClient.patch(`/stock-transfers/${stockTransferId}/pricing`, payload)
  return response.data
}

export async function dispatchStockTransfer(stockTransferId, payload = {}) {
  const response = await apiClient.post(`/stock-transfers/${stockTransferId}/dispatch`, payload)
  return response.data
}

export async function receiveStockTransfer(stockTransferId, payload = {}) {
  const response = await apiClient.post(`/stock-transfers/${stockTransferId}/receive`, payload)
  return response.data
}
