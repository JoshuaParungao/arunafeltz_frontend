import apiClient from "../../lib/apiClient"

export async function getSalesSettlementReport(params = {}) {
  const res = await apiClient.get("/reports/intelligence/sales-settlement", { params })
  return res.data?.data || {}
}

export async function getArAgingReport(params = {}) {
  const res = await apiClient.get("/reports/intelligence/ar-aging", { params })
  return res.data?.data || {}
}

export async function getProviderPerformanceReport(params = {}) {
  const res = await apiClient.get("/reports/intelligence/provider-performance", { params })
  return res.data?.data || {}
}

export async function getTermAnalysisReport(params = {}) {
  const res = await apiClient.get("/reports/intelligence/term-analysis", { params })
  return res.data?.data || {}
}

export async function getDownpaymentAnalysisReport(params = {}) {
  const res = await apiClient.get("/reports/intelligence/downpayment-analysis", { params })
  return res.data?.data || {}
}

export async function getCollectionPerformanceReport(params = {}) {
  const res = await apiClient.get("/reports/intelligence/collection-performance", { params })
  return res.data?.data || {}
}

export async function getFinancingInterestReport(params = {}) {
  const res = await apiClient.get("/reports/intelligence/financing-interest", { params })
  return res.data?.data || {}
}

export async function getCustomerArStatement(customerId, params = {}) {
  const res = await apiClient.get(`/reports/intelligence/customer-statement/${customerId}`, { params })
  return res.data?.data || {}
}

export async function getProductProfitabilityReport(params = {}) {
  const res = await apiClient.get("/reports/intelligence/product-profitability", { params })
  return res.data?.data || {}
}

export async function getServiceProfitabilityReport(params = {}) {
  const res = await apiClient.get("/reports/intelligence/service-profitability", { params })
  return res.data?.data || {}
}

export async function getSixLayerProfitability(params = {}) {
  const res = await apiClient.get("/reports/intelligence/six-layer-profitability", { params })
  return res.data?.data || {}
}

export async function getArProfitabilityReport(params = {}) {
  const res = await apiClient.get("/reports/intelligence/ar-profitability", { params })
  return res.data?.data || {}
}

export async function getPaymentMethodReport(params = {}) {
  const res = await apiClient.get("/reports/intelligence/payment-method", { params })
  return res.data?.data || {}
}

export async function getBranchFinancialComparison(params = {}) {
  const res = await apiClient.get("/reports/intelligence/branch-comparison", { params })
  return res.data?.data || {}
}
