import apiClient from "../../lib/apiClient"

export async function getBranches() {
  const response = await apiClient.get("/branches")
  return response.data
}
