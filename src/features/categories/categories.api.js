import apiClient from "../../lib/apiClient"

export async function getItemCategories(params = {}) {
  const response = await apiClient.get("/item-categories", { params })
  return response.data
}

export async function getItemCategoryById(categoryId) {
  const response = await apiClient.get(`/item-categories/${categoryId}`)
  return response.data
}

export async function createItemCategory(payload) {
  const response = await apiClient.post("/item-categories", payload)
  return response.data
}

export async function updateItemCategoryById(categoryId, payload) {
  const response = await apiClient.patch(`/item-categories/${categoryId}`, payload)
  return response.data
}
