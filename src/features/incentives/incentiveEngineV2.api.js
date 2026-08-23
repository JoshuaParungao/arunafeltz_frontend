import apiClient from "../../lib/apiClient"

export async function getIncentiveProgramReadiness(params = {}) {
  const response = await apiClient.get("/incentives/program-readiness", {
    params,
  })

  return response.data
}

export async function getIncentiveProgramCycles(params = {}) {
  const response = await apiClient.get("/incentives/program-cycles", {
    params,
  })

  return response.data
}

export async function createManualIncentiveProgramCycle(value) {
  const response = await apiClient.post(
    "/incentives/program-cycles/manual",
    value,
  )

  return response.data
}

export async function materializeItemIncentiveCycleForDate(value) {
  const response = await apiClient.post(
    "/incentives/program-cycles/item/materialize",
    value,
  )

  return response.data
}

export async function materializeItemIncentiveCycle(cycleId, value = {}) {
  const response = await apiClient.post(
    `/incentives/program-cycles/${encodeURIComponent(cycleId)}/materialize`,
    value,
  )

  return response.data
}

export async function claimIncentiveProgramCycle(cycleId, value = {}) {
  const response = await apiClient.post(
    `/incentives/program-cycles/${encodeURIComponent(cycleId)}/claim`,
    value,
  )

  return response.data
}
