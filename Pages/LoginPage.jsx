import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, register } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      let result
      if (isRegister) {
        if (!fullName.trim()) { setError('الاسم الكامل مطلوب'); setLoading(false); return }
        result = await register(email, password, fullName)
      } else {
        result = await login(email, password)
      }

      if (result.success) {
        if (isRegister && result.user) {
          try {
            await fetch('/api/shadow7/email/template', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to_email: email,
                template_name: 'welcome',
                user_id: result.user.id,
                variables: {
                  name: result.user.full_name || fullName || 'مستخدم',
                  email,
                  subscription: result.user.subscription || 'free'
                }
              })
            })
          } catch (_) { /* لا نعطل التوجيه إذا فشل الإيميل */ }
        }
        navigate('/')
      } else {
        setError(result.error || 'حدث خطأ غير متوقع')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{
      background: 'linear-gradient(135deg, #0a0a12 0%, #12061a 50%, #0a0a12 100%)',
    }}>
      {/* Animated background particles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-96 h-96 rounded-full opacity-10 animate-pulse" style={{
          background: 'radial-gradient(circle, #ec4899, transparent 70%)',
          top: '10%', left: '20%', filter: 'blur(80px)'
        }} />
        <div className="absolute w-96 h-96 rounded-full opacity-10 animate-pulse" style={{
          background: 'radial-gradient(circle, #6366f1, transparent 70%)',
          bottom: '10%', right: '20%', filter: 'blur(80px)', animationDelay: '1s'
        }} />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-4" style={{
            background: 'linear-gradient(135deg, #ec4899, #6366f1)',
            boxShadow: '0 0 40px rgba(236,72,153,0.3)'
          }}>
            <span className="text-4xl">🌙</span>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
            الظل السابع
          </h1>
          <p className="text-gray-500 text-sm mt-2">Shadow Seven Publisher</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8 backdrop-blur-xl" style={{
          background: 'rgba(18, 10, 24, 0.9)',
          border: '1px solid rgba(236,72,153,0.15)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
        }}>
          {/* Tab toggle */}
          <div className="flex rounded-xl mb-6 p-1" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <button
              onClick={() => { setIsRegister(false); setError('') }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${!isRegister ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              style={!isRegister ? { background: 'linear-gradient(135deg, #ec4899, #6366f1)' } : {}}
            >
              تسجيل الدخول
            </button>
            <button
              onClick={() => { setIsRegister(true); setError('') }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${isRegister ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              style={isRegister ? { background: 'linear-gradient(135deg, #ec4899, #6366f1)' } : {}}
            >
              حساب جديد
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-lg text-sm text-red-300" style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)'
            }}>
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 mr-1">الاسم الكامل</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="أدخل اسمك الكامل"
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 outline-none transition-all focus:ring-2 focus:ring-pink-500/30"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-xs text-gray-400 mb-1.5 mr-1">البريد الإلكتروني</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 outline-none transition-all focus:ring-2 focus:ring-pink-500/30"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                dir="ltr"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5 mr-1">كلمة المرور</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 outline-none transition-all focus:ring-2 focus:ring-pink-500/30"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                dir="ltr"
                minLength={6}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl text-white font-bold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, #ec4899, #6366f1)',
                boxShadow: '0 8px 25px rgba(236,72,153,0.3)'
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  جاري المعالجة...
                </span>
              ) : isRegister ? 'إنشاء الحساب' : 'دخول'}
            </button>
          </form>

          <div className="mt-6 pt-4 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <p className="text-xs text-gray-600">
              {isRegister ? 'لديك حساب؟ ' : 'ليس لديك حساب؟ '}
              <button onClick={() => { setIsRegister(!isRegister); setError('') }} className="text-pink-400 hover:text-pink-300 font-bold">
                {isRegister ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
              </button>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-700 mt-6">
          NEXUS PRIME &bull; Shadow Seven Publisher v2.0
        </p>
      </div>
    </div>
  )
}
