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
