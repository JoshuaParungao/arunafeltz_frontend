const ACCESS_TOKEN_KEY = "arunafeltz_access_token"
const USER_KEY = "arunafeltz_user"
const SELECTED_BRANCH_KEY = "arunafeltz_selected_branch"

export function saveAccessToken(token) {
  if (!token) return
  sessionStorage.setItem(ACCESS_TOKEN_KEY, token)
}

export function getAccessToken() {
  return sessionStorage.getItem(ACCESS_TOKEN_KEY)
}

export function removeAccessToken() {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY)
}

export function saveUser(user) {
  if (!user) return
  sessionStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function getUser() {
  const rawUser = sessionStorage.getItem(USER_KEY)

  if (!rawUser) return null

  try {
    return JSON.parse(rawUser)
  } catch {
    sessionStorage.removeItem(USER_KEY)
    return null
  }
}

export function removeUser() {
  sessionStorage.removeItem(USER_KEY)
}

export function saveSelectedBranch(branch) {
  if (!branch) return
  sessionStorage.setItem(SELECTED_BRANCH_KEY, JSON.stringify(branch))
}

export function getSelectedBranch() {
  const rawBranch = sessionStorage.getItem(SELECTED_BRANCH_KEY)

  if (!rawBranch) return null

  try {
    return JSON.parse(rawBranch)
  } catch {
    sessionStorage.removeItem(SELECTED_BRANCH_KEY)
    return null
  }
}

export function removeSelectedBranch() {
  sessionStorage.removeItem(SELECTED_BRANCH_KEY)
}

export function clearSelectedBranch() {
  removeSelectedBranch()
}

export function clearSession() {
  removeAccessToken()
  removeUser()
  removeSelectedBranch()
}
