import apiClient from "../../lib/apiClient"

export async function getCreditAccounts(params = {}) {
  const response = await apiClient.get("/credit-accounts", { params })
  return response.data
}

export async function getCreditAccountById(id) {
  const response = await apiClient.get(`/credit-accounts/${id}`)
  return response.data
}

export async function createCreditCollection(id, payload) {
  const response = await apiClient.post(`/credit-accounts/${id}/collections`, payload)
  return response.data
}

export async function cancelCreditCollection(id, payload) {
  const response = await apiClient.post(`/credit-accounts/collections/${id}/cancel`, payload)
  return response.data
}

export async function declareCreditAccountDefaulted(id, payload) {
  const response = await apiClient.post(`/credit-accounts/${id}/default`, payload)
  return response.data
}
