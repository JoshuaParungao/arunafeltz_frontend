import apiClient from "../../lib/apiClient"

export async function getItems(params = {}) {
  const response = await apiClient.get("/items", { params })
  return response.data
}

export async function getItemById(itemId) {
  const response = await apiClient.get(`/items/${itemId}`)
  return response.data
}

export async function getItemCategories(params = {}) {
  const response = await apiClient.get("/item-categories", { params })
  return response.data
}

export async function getUnits(params = {}) {
  const response = await apiClient.get("/units", { params })
  return response.data
}
export async function updateItemById(itemId, payload) {
  const response = await apiClient.patch(`/items/${itemId}`, payload)
  return response.data
}

export async function createItem(payload) {
  const response = await apiClient.post("/items", payload)
  return response.data
}

