import { getUserEmail } from './gmail'

/**
 * Storage abstraction: uses Vercel KV when authenticated + KV configured,
 * falls back to localStorage otherwise (demo mode, no KV, or API failure).
 */

export async function loadUserData(key) {
  const email = getUserEmail()

  // Not logged in → localStorage
  if (!email) {
    return loadFromLocalStorage(key)
  }

  // Try KV
  try {
    const resp = await fetch(`/api/user-data?email=${encodeURIComponent(email)}&key=${encodeURIComponent(key)}`)
    if (resp.ok) {
      const data = await resp.json()
      return data.value
    }
    // 501 = KV not configured → fallback
    return loadFromLocalStorage(key)
  } catch {
    return loadFromLocalStorage(key)
  }
}

export async function saveUserData(key, value) {
  const email = getUserEmail()

  // Always save to localStorage as cache
  saveToLocalStorage(key, value)

  // If logged in, also save to KV
  if (!email) return

  try {
    await fetch('/api/user-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, key, value }),
    })
  } catch {
    // Silent fail — localStorage is the fallback
  }
}

function loadFromLocalStorage(key) {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    // Try parsing as JSON, fall back to raw string
    try {
      return JSON.parse(raw)
    } catch {
      return raw
    }
  } catch {
    return null
  }
}

function saveToLocalStorage(key, value) {
  try {
    if (typeof value === 'string') {
      localStorage.setItem(key, value)
    } else {
      localStorage.setItem(key, JSON.stringify(value))
    }
  } catch {
    // localStorage full or unavailable
  }
}
