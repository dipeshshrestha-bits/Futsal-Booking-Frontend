import axios from 'axios'

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'https://dipeshstha-001-site1.etempurl.com/api'

const STORAGE_KEYS = {
  owner: {
    token: 'owner_token',
    user: 'owner_user',
    mustChange: 'owner_must_change_password',
  },
  admin: {
    token: 'admin_token',
    user: 'admin_user',
    mustChange: 'admin_must_change_password',
  },
}

const AREA_ROLE = { owner: 'Owner', admin: 'Admin' }

/* ------------------------------------------------------------------ */
/*  Token helpers                                                      */
/* ------------------------------------------------------------------ */

export function areaFromPath(pathname = window.location.pathname) {
  if (pathname.startsWith('/owner')) return 'owner'
  if (pathname.startsWith('/admin')) return 'admin'
  return null
}

export function decodeJwt(token) {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}

const ROLE_CLAIM_KEYS = [
  'role',
  'roles',
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
]

/**
 * A token is valid for an area if it isn't expired and, when it carries
 * a role claim (ASP.NET uses the long schema URI), that role matches the area.
 */
export function isTokenValid(token, area) {
  if (!token || typeof token !== 'string') return false
  const payload = decodeJwt(token)
  if (!payload) return true // opaque token: let the backend decide

  if (payload.exp && payload.exp * 1000 <= Date.now()) return false

  if (area) {
    const expected = AREA_ROLE[area].toLowerCase()
    for (const key of ROLE_CLAIM_KEYS) {
      if (payload[key] === undefined) continue
      const roles = Array.isArray(payload[key]) ? payload[key] : [payload[key]]
      if (!roles.map((r) => String(r).toLowerCase()).includes(expected)) return false
    }
  }
  return true
}

function safeStorage(fn, fallback = null) {
  try {
    return fn()
  } catch {
    return fallback
  }
}

export const tokenStore = {
  read(area) {
    const keys = STORAGE_KEYS[area]
    if (!keys) return null
    const token = safeStorage(() => localStorage.getItem(keys.token))
    if (!token) return null
    if (!isTokenValid(token, area)) {
      tokenStore.clear(area)
      return null
    }
    const user = safeStorage(() => JSON.parse(localStorage.getItem(keys.user) || 'null'))
    const mustChangePassword =
      safeStorage(() => localStorage.getItem(keys.mustChange)) === 'true'
    return { token, role: AREA_ROLE[area], user, mustChangePassword }
  },

  write(area, session) {
    const keys = STORAGE_KEYS[area]
    if (!keys) throw new Error(`Unknown area "${area}"`)

    const { token, role, user, mustChangePassword } = session ?? {}

    if (role && String(role).toLowerCase() !== AREA_ROLE[area].toLowerCase()) {
      throw new Error('This account cannot sign in here.')
    }
    if (!isTokenValid(token, area)) {
      throw new Error('The server returned an invalid session. Please try again.')
    }

    safeStorage(() => {
      localStorage.setItem(keys.token, token)
      localStorage.setItem(keys.user, JSON.stringify(user ?? null))
      localStorage.setItem(keys.mustChange, String(Boolean(mustChangePassword)))
    })

    return {
      token,
      role: AREA_ROLE[area],
      user: user ?? null,
      mustChangePassword: Boolean(mustChangePassword),
    }
  },

  setMustChangePassword(area, value) {
    const keys = STORAGE_KEYS[area]
    if (keys) safeStorage(() => localStorage.setItem(keys.mustChange, String(Boolean(value))))
  },

  clear(area) {
    const keys = STORAGE_KEYS[area]
    if (!keys) return
    safeStorage(() => {
      localStorage.removeItem(keys.token)
      localStorage.removeItem(keys.user)
      localStorage.removeItem(keys.mustChange)
    })
  },
}

/* ------------------------------------------------------------------ */
/*  Axios instance                                                     */
/* ------------------------------------------------------------------ */

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
})

// Attach the Bearer token for the area the request belongs to.
// Pass { area: 'owner' | 'admin' } in config to override route detection.
api.interceptors.request.use((config) => {
  const area = config.area !== undefined ? config.area : areaFromPath()
  if (area) {
    const session = tokenStore.read(area)
    if (session?.token) {
      config.headers = config.headers ?? {}
      config.headers.Authorization = `Bearer ${session.token}`
    }
  }
  return config
})

// On 401 inside a protected area: clear that area's session and go to its login.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const area = error.config?.area !== undefined ? error.config.area : areaFromPath()
    const url = error.config?.url ?? ''
    const isLoginCall = url.includes('/auth/') && url.includes('/login')

    if (status === 401 && area && !isLoginCall) {
      tokenStore.clear(area)
      const loginPath = `/${area}/login`
      if (window.location.pathname !== loginPath) {
        window.location.assign(`${loginPath}?expired=1`)
      }
    }
    return Promise.reject(error)
  }
)

export default api

/* ------------------------------------------------------------------ */
/*  Error helper (handles the { success, data, error } envelope)       */
/* ------------------------------------------------------------------ */

export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback
  if (error.code === 'ECONNABORTED') return 'The server took too long to respond. Please try again.'
  if (!error.response) {
    return error.message && !error.isAxiosError
      ? error.message
      : 'Cannot reach the server. Check your connection or that the API is running.'
  }

  const data = error.response.data
  if (typeof data === 'string' && data.trim()) return data

  // Backend envelope
  if (data?.error?.message) return data.error.message
  if (data?.error?.details && typeof data.error.details === 'object') {
    const first = Object.values(data.error.details).flat()[0]
    if (first) return String(first)
  }

  // ASP.NET ProblemDetails / other shapes
  if (data?.message) return data.message
  if (data?.errors && typeof data.errors === 'object') {
    const first = Object.values(data.errors).flat()[0]
    if (first) return String(first)
  }
  if (data?.detail) return data.detail
  if (data?.title) return data.title

  if (error.response.status === 403) return 'You do not have permission to do that.'
  if (error.response.status === 404) return 'Not found.'
  return fallback
}

/* ------------------------------------------------------------------ */
/*  Endpoints                                                          */
/* ------------------------------------------------------------------ */

/** Backend replies with { success, data, error }; return the inner data. */
const unwrap = (res) => {
  const body = res.data
  if (body && typeof body === 'object' && 'success' in body && 'data' in body) {
    return body.data
  }
  return body
}

export const authApi = {
  adminLogin: (payload) =>
    api.post('/auth/admin/login', payload, { area: 'admin' }).then(unwrap),
  ownerLogin: (payload) =>
    api.post('/auth/owner/login', payload, { area: 'owner' }).then(unwrap),
  // payload: { currentPassword, newPassword }
  ownerChangePassword: (payload) =>
    api.post('/auth/owner/change-password', payload, { area: 'owner' }).then(unwrap),
}

const asAdmin = { area: 'admin' }
export const adminApi = {
  dashboard: () => api.get('/admin/dashboard', asAdmin).then(unwrap),
  owners: (params) => api.get('/admin/owners', { ...asAdmin, params }).then(unwrap),
  createOwner: (payload) => api.post('/admin/owners', payload, asAdmin).then(unwrap),
  setOwnerStatus: (id, isActive) =>
    api.patch(`/admin/owners/${id}/status`, { isActive }, asAdmin).then(unwrap),
  resetOwnerPassword: (id) =>
    api.post(`/admin/owners/${id}/reset-password`, null, asAdmin).then(unwrap),
  futsals: (params) => api.get('/admin/futsals', { ...asAdmin, params }).then(unwrap),
  setFutsalStatus: (id, isActive) =>
    api.patch(`/admin/futsals/${id}/status`, { isActive }, asAdmin).then(unwrap),
  bookings: (params) => api.get('/admin/bookings', { ...asAdmin, params }).then(unwrap),
  transactions: (params) =>
    api.get('/admin/transactions', { ...asAdmin, params }).then(unwrap),
}

const asOwner = { area: 'owner' }
export const ownerApi = {
  profile: () => api.get('/owner/profile', asOwner).then(unwrap),
  updateProfile: (payload) => api.put('/owner/profile', payload, asOwner).then(unwrap),

  courts: () => api.get('/owner/courts', asOwner).then(unwrap),
  createCourt: (payload) => api.post('/owner/courts', payload, asOwner).then(unwrap),
  updateCourt: (id, payload) => api.put(`/owner/courts/${id}`, payload, asOwner).then(unwrap),
  deleteCourt: (id) => api.delete(`/owner/courts/${id}`, asOwner).then(unwrap),

  dashboard: () => api.get('/owner/dashboard', asOwner).then(unwrap),
  bookings: (params) => api.get('/owner/bookings', { ...asOwner, params }).then(unwrap),
  createBooking: (payload) => api.post('/owner/bookings', payload, asOwner).then(unwrap),
  markPaid: (id) => api.patch(`/owner/bookings/${id}/mark-paid`, null, asOwner).then(unwrap),
  cancelBooking: (id, payload) =>
    api.patch(`/owner/bookings/${id}/cancel`, payload ?? null, asOwner).then(unwrap),

  blockSlot: (payload) => api.post('/owner/slots/block', payload, asOwner).then(unwrap),

  reviews: (params) => api.get('/owner/reviews', { ...asOwner, params }).then(unwrap),
  replyToReview: (id, payload) =>
    api.post(`/owner/reviews/${id}/reply`, payload, asOwner).then(unwrap),
}

// Public endpoints never attach a token (area: null)
const asPublic = { area: null }
export const publicApi = {
  // params: { city, search, minPrice, maxPrice, sort }
  futsals: (params) => api.get('/futsals', { ...asPublic, params }).then(unwrap),
  futsal: (id) => api.get(`/futsals/${id}`, asPublic).then(unwrap),
  availability: (futsalId, courtId, date) =>
    api
      .get(`/futsals/${futsalId}/courts/${courtId}/availability`, {
        ...asPublic,
        params: { date },
      })
      .then(unwrap),
  createReview: (futsalId, payload) =>
    api.post(`/futsals/${futsalId}/reviews`, payload, asPublic).then(unwrap),

  createBooking: (payload) => api.post('/bookings', payload, asPublic).then(unwrap),
  lookupBooking: (referenceCode, contact) =>
    api
      .get('/bookings/lookup', { ...asPublic, params: { referenceCode, contact } })
      .then(unwrap),
  cancelBooking: (referenceCode, contact) =>
    api
      .patch(`/bookings/${encodeURIComponent(referenceCode)}/cancel`, null, {
        ...asPublic,
        params: { contact },
      })
      .then(unwrap),
}

/* ------------------------------------------------------------------ */
/*  eSewa hand-off                                                     */
/* ------------------------------------------------------------------ */

/**
 * Finds the gateway URL + form fields in the POST /api/bookings response.
 * Accepts a few likely shapes so small backend naming differences still work.
 */
export function extractEsewaForm(data) {
  const src = data?.esewa ?? data?.payment ?? data?.paymentForm ?? data
  const url = src?.formUrl ?? src?.gatewayUrl ?? src?.paymentUrl ?? src?.actionUrl ?? src?.url
  const fields = src?.formFields ?? src?.fields ?? src?.formData
  return url && fields && typeof fields === 'object' ? { url, fields } : null
}

/** Builds a hidden form and auto-submits it to the eSewa gateway (leaves the app). */
export function submitEsewaForm({ url, fields }) {
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = url
  form.style.display = 'none'
  Object.entries(fields).forEach(([name, value]) => {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = name
    input.value = value ?? ''
    form.appendChild(input)
  })
  document.body.appendChild(form)
  form.submit()
}

/* ------------------------------------------------------------------ */
/*  Response + image helpers                                           */
/* ------------------------------------------------------------------ */

/** Returns an array whether the API sends [..], { items }, { data } or { $values } */
export function toList(data) {
  if (Array.isArray(data)) return data
  if (!data || typeof data !== 'object') return []
  const list = data.items ?? data.data ?? data.results ?? data.$values
  return Array.isArray(list) ? list : []
}

const API_ORIGIN = (() => {
  try {
    return new URL(API_BASE_URL).origin
  } catch {
    return ''
  }
})()

/** Turns "/uploads/cover.jpg" from the backend into a full URL */
export function resolveImageUrl(path) {
  if (!path) return null
  const value = String(path)
  if (/^(https?:|data:|blob:)/i.test(value)) return value
  return `${API_ORIGIN}${value.startsWith('/') ? '' : '/'}${value}`
}

/* ------------------------------------------------------------------ */
/*  Formatting helpers (numbers always rendered with the .num class)   */
/* ------------------------------------------------------------------ */

export function formatNPR(amount) {
  const n = Number(amount)
  if (!Number.isFinite(n)) return 'Rs —'
  return `Rs ${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

export function formatNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n.toLocaleString('en-IN') : '—'
}

export function formatDate(value, options = { day: '2-digit', month: 'short', year: 'numeric' }) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('en-GB', options)
}

export function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
}

/** "18:00:00" or "18:00" → "18:00" */
export function formatTime(value) {
  if (!value) return '—'
  const match = String(value).match(/(\d{1,2}):(\d{2})/)
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : String(value)
}

/** "2026-09-20" or ISO date → "Sun, 20 Sep 2026" (date-only strings stay on the local day) */
export function formatDay(value) {
  if (!value) return '—'
  const str = String(value)
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const d = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(str)
  if (Number.isNaN(d.getTime())) return str
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/** Local YYYY-MM-DD (avoids UTC shift from toISOString) */
export function toDateInputValue(date = new Date()) {
  const d = new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** "+977 98-1234 5678" → "9812345678" */
export function normalizePhone(value) {
  return String(value ?? '').replace(/[\s-]/g, '').replace(/^\+?977/, '')
}

/** Nepal mobile: 98XXXXXXXX / 97XXXXXXXX / 96XXXXXXXX, optional +977 */
export function isValidNepalPhone(value) {
  return /^9[678]\d{8}$/.test(normalizePhone(value))
}

/** Keeps numeric ids as numbers and GUIDs as strings */
export function asId(value) {
  const n = Number(value)
  return value !== '' && value !== null && Number.isFinite(n) ? n : value
}

/* ------------------------------------------------------------------ */
/*  Player booking helpers                                             */
/* ------------------------------------------------------------------ */

/** Maps any booking response shape to one consistent object */
export function normalizeBooking(raw) {
  if (!raw || typeof raw !== 'object') return null
  const b = raw.booking ?? raw
  return {
    id: b.id,
    referenceCode: b.referenceCode ?? b.reference ?? b.bookingReference ?? '',
    futsalId: b.futsalId ?? b.futsal?.id,
    futsalName: b.futsalName ?? b.futsal?.name ?? '',
    futsalAddress: b.futsalAddress ?? b.futsal?.address ?? '',
    courtName: b.courtName ?? b.court?.name ?? '',
    date: b.date ?? b.bookingDate ?? b.slotDate,
    startTime: b.startTime ?? b.slotStart,
    endTime: b.endTime ?? b.slotEnd,
    playerName: b.playerName ?? b.customerName ?? b.name ?? '',
    contactNumber: b.contactNumber ?? b.contact ?? b.phone ?? '',
    email: b.email ?? '',
    amount: b.amount ?? b.totalAmount ?? b.price,
    paymentMethod: b.paymentMethod ?? '',
    paymentStatus: b.paymentStatus ?? '',
    status: b.status ?? b.bookingStatus ?? '',
    canCancel: b.canCancel ?? b.isCancellable,
    createdAt: b.createdAt,
  }
}

/** Uses the backend's canCancel flag, otherwise: not cancelled/completed and still in the future */
export function isBookingCancellable(booking) {
  if (!booking) return false
  if (typeof booking.canCancel === 'boolean') return booking.canCancel
  const status = String(booking.status ?? '').toLowerCase()
  if (['cancel', 'complete', 'noshow', 'no show', 'expired'].some((w) => status.includes(w))) {
    return false
  }
  const day = String(booking.date ?? '').slice(0, 10)
  const start = new Date(`${day}T${formatTime(booking.startTime)}:00`)
  return Number.isNaN(start.getTime()) ? true : start.getTime() > Date.now()
}

/** Remembers ref → phone for this browser tab (survives the eSewa redirect) */
const RECENT_BOOKINGS_KEY = 'player_recent_bookings'

export const bookingCache = {
  save(referenceCode, contact) {
    if (!referenceCode || !contact) return
    safeStorage(() => {
      const map = JSON.parse(sessionStorage.getItem(RECENT_BOOKINGS_KEY) || '{}')
      map[String(referenceCode).toUpperCase()] = contact
      sessionStorage.setItem(RECENT_BOOKINGS_KEY, JSON.stringify(map))
    })
  },
  getContact(referenceCode) {
    if (!referenceCode) return ''
    return safeStorage(() => {
      const map = JSON.parse(sessionStorage.getItem(RECENT_BOOKINGS_KEY) || '{}')
      return map[String(referenceCode).toUpperCase()] ?? ''
    }, '')
  },
}