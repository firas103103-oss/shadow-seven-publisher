import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authApi } from '@/api/backendClient'

const AuthContext = createContext(null)

const TOKEN_KEY = 'nexus_auth_token'
const USER_KEY = 'nexus_auth_user'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY)
    const savedUser = localStorage.getItem(USER_KEY)

    if (savedToken && savedUser) {
      authApi.validate(savedToken)
        .then((data) => {
          if (data?.valid && data?.user) {
            setUser(data.user)
            localStorage.setItem(USER_KEY, JSON.stringify(data.user))
          } else {
            localStorage.removeItem(TOKEN_KEY)
            localStorage.removeItem(USER_KEY)
            setUser(null)
          }
        })
        .catch(() => {
          try { setUser(JSON.parse(savedUser)) } catch {
            localStorage.removeItem(TOKEN_KEY)
            localStorage.removeItem(USER_KEY)
          }
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = useCallback(async (email, password) => {
    try {
      const data = await authApi.login(email, password)
      if (data.error) throw new Error(data.error)
      localStorage.setItem(TOKEN_KEY, data.token)
      localStorage.setItem(USER_KEY, JSON.stringify(data.user))
      setUser(data.user)
      return { success: true, user: data.user }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }, [])

  const register = useCallback(async (email, password, fullName) => {
    try {
      const data = await authApi.register(email, password, fullName)
      if (data.error) throw new Error(data.error)
      localStorage.setItem(TOKEN_KEY, data.token)
      localStorage.setItem(USER_KEY, JSON.stringify(data.user))
      setUser(data.user)
      return { success: true, user: data.user }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }, [])

  const logout = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) { try { await authApi.logout(token) } catch {} }
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setUser(null)
  }, [])

  const updateProfile = useCallback(async (updates) => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) return { success: false, error: 'Not authenticated' }
    try {
      const data = await authApi.updateProfile(token, updates)
      if (data.error) throw new Error(data.error)
      setUser(data.user)
      localStorage.setItem(USER_KEY, JSON.stringify(data.user))
      return { success: true, user: data.user }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }, [])

  const getToken = useCallback(() => localStorage.getItem(TOKEN_KEY), [])

  const value = { user, login, register, logout, updateProfile, getToken, loading, isAuthenticated: !!user, isAdmin: user?.role === 'admin' }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
