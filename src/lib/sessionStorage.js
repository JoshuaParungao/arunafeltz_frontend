const ACCESS_TOKEN_KEY = "arunafeltz_access_token"
const USER_KEY = "arunafeltz_user"
const SELECTED_BRANCH_KEY = "arunafeltz_selected_branch"
const ACTIVE_PAGE_KEY_PREFIX = "arunafeltz_active_page_"

export function saveAccessToken(token) {
  if (!token) return
  try {
    localStorage.setItem(ACCESS_TOKEN_KEY, token)
    sessionStorage.setItem(ACCESS_TOKEN_KEY, token)
  } catch (err) {
    console.warn("Storage save token error:", err)
  }
}

export function getAccessToken() {
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY) || sessionStorage.getItem(ACCESS_TOKEN_KEY)
  } catch {
    return null
  }
}

export function removeAccessToken() {
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  } catch (err) {
    console.warn("Storage remove token error:", err)
  }
}

export function saveUser(user) {
  if (!user) return
  try {
    const raw = JSON.stringify(user)
    localStorage.setItem(USER_KEY, raw)
    sessionStorage.setItem(USER_KEY, raw)
  } catch (err) {
    console.warn("Storage save user error:", err)
  }
}

export function getUser() {
  try {
    const rawUser = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY)
    if (!rawUser) return null
    return JSON.parse(rawUser)
  } catch {
    return null
  }
}

export function removeUser() {
  try {
    localStorage.removeItem(USER_KEY)
    sessionStorage.removeItem(USER_KEY)
  } catch (err) {
    console.warn("Storage remove user error:", err)
  }
}

export function saveSelectedBranch(branch) {
  if (!branch) return
  try {
    const raw = JSON.stringify(branch)
    localStorage.setItem(SELECTED_BRANCH_KEY, raw)
    sessionStorage.setItem(SELECTED_BRANCH_KEY, raw)
  } catch (err) {
    console.warn("Storage save branch error:", err)
  }
}

export function getSelectedBranch() {
  try {
    const rawBranch = localStorage.getItem(SELECTED_BRANCH_KEY) || sessionStorage.getItem(SELECTED_BRANCH_KEY)
    if (!rawBranch) return null
    return JSON.parse(rawBranch)
  } catch {
    return null
  }
}

export function removeSelectedBranch() {
  try {
    localStorage.removeItem(SELECTED_BRANCH_KEY)
    sessionStorage.removeItem(SELECTED_BRANCH_KEY)
  } catch (err) {
    console.warn("Storage remove branch error:", err)
  }
}

export function clearSelectedBranch() {
  removeSelectedBranch()
}

export function saveActivePage(userId, pageKey) {
  if (!pageKey) return
  try {
    const key = userId ? `${ACTIVE_PAGE_KEY_PREFIX}${userId}` : "arunafeltz_active_page_default"
    localStorage.setItem(key, pageKey)
  } catch (err) {
    console.warn("Storage save page error:", err)
  }
}

export function getActivePage(userId) {
  try {
    const key = userId ? `${ACTIVE_PAGE_KEY_PREFIX}${userId}` : "arunafeltz_active_page_default"
    return localStorage.getItem(key) || null
  } catch {
    return null
  }
}

export function removeActivePage(userId) {
  try {
    const key = userId ? `${ACTIVE_PAGE_KEY_PREFIX}${userId}` : "arunafeltz_active_page_default"
    localStorage.removeItem(key)
  } catch (err) {
    console.warn("Storage remove page error:", err)
  }
}

export function saveFormDraft(draftKey, data) {
  if (!draftKey) return
  try {
    if (data === null || data === undefined) {
      localStorage.removeItem(draftKey)
    } else {
      localStorage.setItem(draftKey, JSON.stringify(data))
    }
  } catch (err) {
    console.warn("Storage save draft error:", err)
  }
}

export function getFormDraft(draftKey) {
  if (!draftKey) return null
  try {
    const raw = localStorage.getItem(draftKey)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearFormDraft(draftKey) {
  if (!draftKey) return
  try {
    localStorage.removeItem(draftKey)
  } catch (err) {
    console.warn("Storage clear draft error:", err)
  }
}

export function clearSession() {
  const currentUser = getUser()
  if (currentUser?.id) {
    removeActivePage(currentUser.id)
  }
  removeAccessToken()
  removeUser()
  removeSelectedBranch()
}

