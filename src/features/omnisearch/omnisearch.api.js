import apiClient from "../../lib/apiClient"

export async function searchOmni({ q, branchId }) {
  const params = {}
  if (q) params.q = q
  if (branchId) params.branchId = branchId

  const response = await apiClient.get("/api/search/omni", { params })
  return response?.data || response
}
