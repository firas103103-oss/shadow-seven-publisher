/**
 * Backend API Client — PostgreSQL عبر FastAPI
 */

const API_BASE = import.meta.env.VITE_API_URL || ''

function baseUrl(path) {
  const base = (API_BASE || '').replace(/\/$/, '')
  return base ? `${base}${path}` : path
}

async function fetchApi(path, options = {}) {
  const url = baseUrl(path)
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || err.message || res.statusText)
  }
  return res.json()
}

// ─── Auth ─────────────────────────────────────────────────────
export const authApi = {
  login: (email, password) =>
    fetchApi('/api/shadow7/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    }),

  register: (email, password, fullName) =>
    fetchApi('/api/shadow7/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name: fullName || 'user' })
    }),

  validate: (token) =>
    fetchApi('/api/shadow7/auth/validate', {
      method: 'POST',
      body: JSON.stringify({ token })
    }),

  logout: (token) =>
    fetchApi('/api/shadow7/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ token })
    }),

  updateProfile: (token, updates) =>
    fetchApi('/api/shadow7/auth/update-profile', {
      method: 'POST',
      body: JSON.stringify({
        token,
        full_name: updates?.full_name,
        avatar_url: updates?.avatar_url
      })
    })
}

// ─── Manuscripts ─────────────────────────────────────────────
export const manuscriptsApi = {
  list: async (params = {}) => {
    const { orderBy = '-created_at', limit, filters } = params
    let path = `/api/shadow7/manuscripts?order_by=${orderBy}`
    if (limit) path += `&limit=${limit}`
    const data = await fetchApi(path)
    if (filters && Object.keys(filters).length > 0) {
      return data.filter(m => {
        for (const [k, v] of Object.entries(filters)) {
          if (m[k] !== v) return false
        }
        return true
      })
    }
    return data
  },

  get: (id) => fetchApi(`/api/shadow7/manuscripts/${id}`),

  create: (data) =>
    fetchApi('/api/shadow7/manuscripts', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  update: (id, data) =>
    fetchApi(`/api/shadow7/manuscripts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),

  delete: (id) =>
    fetchApi(`/api/shadow7/manuscripts/${id}`, { method: 'DELETE' })
}

// ─── Upload ───────────────────────────────────────────────────
export async function uploadManuscriptFile(file, metadata = {}) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('title', metadata.title || file.name.replace(/\.[^.]+$/, ''))
  formData.append('content', metadata.content || '')
  formData.append('word_count', String(metadata.word_count || 0))
  formData.append('metadata', JSON.stringify(metadata.metadata || {}))
  if (metadata.user_id) formData.append('user_id', metadata.user_id)

  const url = baseUrl('/api/shadow7/manuscripts/upload')
  const res = await fetch(url, {
    method: 'POST',
    body: formData
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || res.statusText)
  }
  return res.json()
}

// ─── Omni-Publisher (1-7 files, 200k words) ───────────────────
export const omniApi = {
  upload: async (formData) => {
    const url = baseUrl('/api/shadow7/omni/upload')
    const res = await fetch(url, { method: 'POST', body: formData })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(err.detail || err.message || res.statusText)
    }
    return res.json()
  },
  purge: async (trackingId) => {
    return fetchApi('/api/shadow7/omni/purge', {
      method: 'POST',
      body: JSON.stringify({ tracking_id: trackingId })
    })
  }
}

// ─── Dashboard Stats ───────────────────────────────────────────
export async function getDashboardStats() {
  try {
    const manuscripts = await manuscriptsApi.list()
    return {
      totalManuscripts: manuscripts.length,
      processing: manuscripts.filter(m => m.status === 'processing').length,
      completed: manuscripts.filter(m => m.status === 'completed').length,
      needsReview: manuscripts.filter(m => m.status === 'needs_review').length
    }
  } catch {
    return {
      totalManuscripts: 0,
      processing: 0,
      completed: 0,
      needsReview: 0
    }
  }
}

export default { authApi, manuscriptsApi, uploadManuscriptFile, getDashboardStats, omniApi }
