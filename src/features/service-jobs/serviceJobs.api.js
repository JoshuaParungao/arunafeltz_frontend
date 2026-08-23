import apiClient from "../../lib/apiClient"

export async function getServiceJobs(params = {}) {
  const response = await apiClient.get("/service-jobs", { params })
  return response.data
}

export async function getServiceTechnicians(params = {}) {
  const response = await apiClient.get("/service-jobs/technicians", { params })
  return response.data
}

export async function getServiceJobById(id) {
  const response = await apiClient.get(`/service-jobs/${id}`)
  return response.data
}

export async function createServiceJob(payload) {
  const response = await apiClient.post("/service-jobs", payload)
  return response.data
}

export async function updateServiceJobStatus(id, payload) {
  const response = await apiClient.patch(`/service-jobs/${id}/status`, payload)
  return response.data
}

export async function updateServiceJobAssignment(id, payload) {
  const response = await apiClient.patch(`/service-jobs/${id}/assignment`, payload)
  return response.data
}

export async function releaseServiceJob(id, payload) {
  const response = await apiClient.post(`/service-jobs/${id}/release`, payload)
  return response.data
}

export async function createServicePayment(id, payload) {
  const response = await apiClient.post(`/service-jobs/${id}/payment`, payload)
  return response.data
}

export async function cancelServicePayment(paymentId, payload) {
  const response = await apiClient.post(
    `/service-jobs/payments/${paymentId}/cancel`,
    payload,
  )
  return response.data
}
