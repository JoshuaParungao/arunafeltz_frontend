import apiClient from "../../lib/apiClient"

const REPORT_PATHS = Object.freeze({
  financial: "financial-summary",
  inventory: "inventory-summary",
  sales: "sales-summary",
  services: "service-summary",
  warranty: "warranty-summary",
  cash: "cash-summary",
  suppliers: "supplier-summary",
  purchaseOrders: "purchase-order-summary",
  receivings: "purchase-receiving-summary",
  transfers: "stock-transfer-summary",
  credits: "credit-summary",
  staff: "staff-performance-summary",
  alerts: "alert-summary",
})

export async function getReport(reportKey, params = {}) {
  if (reportKey === "incentiveClaims") {
    const response = await apiClient.get("/incentives/claims", { params })
    const envelope = response.data || {}
    const result = envelope.data || {}
    const claims = Array.isArray(result.claims) ? result.claims : []
    const pageTotals = claims.reduce((summary, claim) => {
      summary.totalClaims += 1
      summary.totalProductBasis += Number(claim.productBasis || 0)
      summary.totalServiceBasis += Number(claim.serviceBasis || 0)
      summary.totalProductIncentive += Number(claim.productIncentive || 0)
      summary.totalServiceIncentive += Number(claim.serviceIncentive || 0)
      summary.totalIncentive += Number(claim.totalIncentive || 0)
      return summary
    }, {
      totalClaims: 0,
      totalProductBasis: 0,
      totalServiceBasis: 0,
      totalProductIncentive: 0,
      totalServiceIncentive: 0,
      totalIncentive: 0,
    })
    const totals = result.totals
      ? {
          totalClaims: Number(result.totals.claims || 0),
          totalProductBasis: Number(result.totals.productBasis || 0),
          totalServiceBasis: Number(result.totals.serviceBasis || 0),
          totalProductIncentive: Number(result.totals.productIncentive || 0),
          totalServiceIncentive: Number(result.totals.serviceIncentive || 0),
          totalIncentive: Number(result.totals.totalIncentive || 0),
        }
      : pageTotals

    return {
      ...envelope,
      data: {
        report: {
          name: "Incentive Claim Summary",
          generatedAt: new Date().toISOString(),
          filters: params,
          totals,
        },
        records: claims,
      },
      meta: {
        ...(result.meta || {}),
        totalItems: result.meta?.total ?? claims.length,
        hasPreviousPage: Number(result.meta?.page || 1) > 1,
        hasNextPage: Number(result.meta?.page || 1) < Number(result.meta?.totalPages || 1),
      },
    }
  }

  if (reportKey === "incentives") {
    const response = await apiClient.get("/incentives", { params })
    const envelope = response.data || {}
    const result = envelope.data || {}
    return {
      ...envelope,
      data: {
        report: {
          name: "Incentive Summary",
          generatedAt: new Date().toISOString(),
          filters: params,
          totals: result.totals || {},
        },
        records: result.entries || [],
      },
      meta: {
        ...(result.meta || {}),
        totalItems: result.meta?.total ?? 0,
        hasPreviousPage: Number(result.meta?.page || 1) > 1,
        hasNextPage: Number(result.meta?.page || 1) < Number(result.meta?.totalPages || 1),
      },
    }
  }

  const path = REPORT_PATHS[reportKey]

  if (!path) throw new Error(`Unknown report: ${reportKey}`)

  const response = await apiClient.get(`/reports/${path}`, { params })
  return response.data
}

export async function getAlertSummary(params = {}) {
  return getReport("alerts", params)
}

export { REPORT_PATHS }
