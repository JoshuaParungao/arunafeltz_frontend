import apiClient from "../../lib/apiClient"

export async function getUnits(params = {}) {
  const response = await apiClient.get("/units", { params })
  return response.data
}

export async function getUnitById(unitId) {
  const response = await apiClient.get(`/units/${unitId}`)
  return response.data
}

export async function createUnit(payload) {
  const response = await apiClient.post("/units", payload)
  return response.data
}

export async function updateUnitById(unitId, payload) {
  const response = await apiClient.patch(`/units/${unitId}`, payload)
  return response.data
}
