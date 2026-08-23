import apiClient from "../../lib/apiClient"

export async function getCashBoxes(params = {}) {
  const response = await apiClient.get("/cash-boxes", { params })
  return response.data
}

export async function getCashBoxById(id) {
  const response = await apiClient.get(`/cash-boxes/${id}`)
  return response.data
}

export async function getCashTransactions(id, params = {}) {
  const response = await apiClient.get(`/cash-boxes/${id}/transactions`, { params })
  return response.data
}

export async function getCashTransactionById(id) {
  const response = await apiClient.get(`/cash-boxes/transactions/${id}`)
  return response.data
}

export async function createCashTransaction(id, payload) {
  const response = await apiClient.post(`/cash-boxes/${id}/transactions`, payload)
  return response.data
}

export async function cancelCashTransaction(id, payload) {
  const response = await apiClient.post(`/cash-boxes/transactions/${id}/cancel`, payload)
  return response.data
}

export async function getCashHandovers(params = {}) {
  const response = await apiClient.get("/cash-boxes/handovers", { params })
  return response.data
}

export async function getCashHandoverById(id) {
  const response = await apiClient.get(`/cash-boxes/handovers/${id}`)
  return response.data
}

export async function createCashHandover(id, payload) {
  const response = await apiClient.post(`/cash-boxes/${id}/handovers`, payload)
  return response.data
}

export async function receiveCashHandover(id, payload = {}) {
  const response = await apiClient.post(`/cash-boxes/handovers/${id}/receive`, payload)
  return response.data
}

export async function cancelCashHandover(id, payload) {
  const response = await apiClient.post(`/cash-boxes/handovers/${id}/cancel`, payload)
  return response.data
}

export async function getCashCustodianAssignmentOptions(params = {}) {
  const response = await apiClient.get("/cash-boxes/custodian-assignments/options", {
    params,
  })
  return response.data
}

export async function assignCashCustodian(payload) {
  const response = await apiClient.put("/cash-boxes/custodian-assignment", payload)
  return response.data
}

export async function removeCashCustodianAssignment(payload = {}) {
  const response = await apiClient.delete("/cash-boxes/custodian-assignment", {
    data: payload,
  })
  return response.data
}
