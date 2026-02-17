import { createContext, useContext, useState, useEffect } from 'react'
import apiClient from '@/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if user is already logged in
    const token = apiClient.getToken()
    if (token) {
      // Validate token and get user info
      // For now, we'll assume token is valid
      setUser({ token })
    }
    setLoading(false)
  }, [])

  const login = async (credentials) => {
    try {
      const response = await apiClient.login(credentials)
      apiClient.setToken(response.token)
      setUser(response.user)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  const logout = async () => {
    await apiClient.logout()
    setUser(null)
  }

  const value = {
    user,
    login,
    logout,
    loading,
    isAuthenticated: !!user,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
