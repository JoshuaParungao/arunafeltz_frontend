import apiClient from "../../lib/apiClient"

export async function getInventoryOverview(params = {}) {
const response = await apiClient.get("/inventory/overview", { params })
return response.data
}

export async function getInventoryBatches(params = {}) {
const response = await apiClient.get("/inventory/batches", { params })
return response.data
}

export async function getInventorySerials(params = {}) {
const response = await apiClient.get("/inventory/serials", { params })
return response.data
}


export async function getInventoryMovements(params = {}) {
const response = await apiClient.get("/inventory/movements", { params })
return response.data
}
export async function createStockAdjustment(payload) {
const response = await apiClient.post("/inventory/adjustments", payload)
return response.data
}

export async function createStockTransferRequest(payload) {
const response = await apiClient.post("/stock-transfers/requests", payload)
return response.data
}

export async function getRequestableStock(params = {}) {
const response = await apiClient.get("/stock-transfers/requestable-items", { params })
return response.data
}

