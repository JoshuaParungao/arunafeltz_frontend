import apiClient from "../../lib/apiClient"

export async function getIncentives(params = {}) {
  const response = await apiClient.get("/incentives", { params })
  return response.data
}

export async function updateIncentiveRules(value) {
  const response = await apiClient.patch("/incentives/rules", value)
  return response.data
}

export async function getIncentiveConfiguration() {
  const response = await apiClient.get("/incentives/configuration")
  return response.data
}

export async function createIncentiveRateVersion(value) {
  const response = await apiClient.post("/incentives/rate-versions", value)
  return response.data
}

export async function previewIncentiveSchedule(value) {
  const response = await apiClient.post("/incentives/schedule/preview", value)
  return response.data
}

export async function createIncentiveScheduleVersion(value) {
  const response = await apiClient.post("/incentives/schedule-versions", value)
  return response.data
}

export async function initializeEnterpriseIncentives(value) {
  const response = await apiClient.post("/incentives/initialize-from-legacy", value)
  return response.data
}

export async function createManualIncentiveCycle(value) {
  const response = await apiClient.post("/incentives/cycles/manual", value)
  return response.data
}

export async function getIncentiveCalendar(params = {}) {
  const response = await apiClient.get("/incentives/calendar", { params })
  return response.data
}

export async function getIncentiveCycles(params = {}) {
  const response = await apiClient.get("/incentives/cycles", { params })
  return response.data
}

export async function claimIncentiveCycle(cycleId, value = {}) {
  const response = await apiClient.post(`/incentives/cycles/${cycleId}/claim`, value)
  return response.data
}

export async function getIncentiveClaims(params = {}) {
  const response = await apiClient.get("/incentives/claims", { params })
  return response.data
}

export async function approveIncentiveClaim(claimId, value = {}) {
  const response = await apiClient.patch(`/incentives/claims/${claimId}/approve`, value)
  return response.data
}

export async function markIncentiveClaimPaid(claimId, value = {}) {
  const response = await apiClient.patch(`/incentives/claims/${claimId}/paid`, value)
  return response.data
}
/*
 * ============================================================
 * Incentive Settings V2
 *
 * These APIs belong to the new Settings architecture:
 * - per-account incentive configuration
 * - per-branch program rules
 * - independent per-branch/program schedules
 *
 * Legacy enterprise incentive APIs above remain untouched for
 * existing monitoring/cycle compatibility during the migration.
 * ============================================================
 */

export async function getIncentiveAccountConfigurations() {
  const response =
    await apiClient.get(
      "/incentives/account-configurations",
    )

  return response.data
}

export async function createIncentiveAccountConfigurationVersion(
  accountId,
  value,
) {
  const encodedAccountId =
    encodeURIComponent(accountId)

  const response =
    await apiClient.post(
      `/incentives/account-configurations/${encodedAccountId}/versions`,
      value,
    )

  return response.data
}

export async function getIncentiveProgramRules(
  params = {},
) {
  const response =
    await apiClient.get(
      "/incentives/program-rules",
      {
        params,
      },
    )

  return response.data
}

export async function createIncentiveProgramRuleVersion(
  programType,
  value,
) {
  const encodedProgramType =
    encodeURIComponent(programType)

  const response =
    await apiClient.post(
      `/incentives/program-rules/${encodedProgramType}/versions`,
      value,
    )

  return response.data
}

export async function getIncentiveProgramSchedules(
  params = {},
) {
  const response =
    await apiClient.get(
      "/incentives/program-schedules",
      {
        params,
      },
    )

  return response.data
}

export async function previewIncentiveProgramSchedule(
  programType,
  value,
) {
  const encodedProgramType =
    encodeURIComponent(programType)

  const response =
    await apiClient.post(
      `/incentives/program-schedules/${encodedProgramType}/preview`,
      value,
    )

  return response.data
}

export async function createIncentiveProgramScheduleVersion(
  programType,
  value,
) {
  const encodedProgramType =
    encodeURIComponent(programType)

  const response =
    await apiClient.post(
      `/incentives/program-schedules/${encodedProgramType}/versions`,
      value,
    )

  return response.data
}
