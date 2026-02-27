import { Outlet, Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Upload,
  FileText,
  BookOpen,
  FileDown,
  Settings,
  Menu,
  X,
  BarChart3,
  Palette,
  Send,
  LogOut,
  Zap
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/Components/ui/button'
import { useAuth } from '@/contexts/AuthContext'

const navigation = [
  { name: 'لوحة التحكم', href: '/', icon: LayoutDashboard },
  { name: 'Omni-Publisher', href: '/omni', icon: Zap },
  { name: 'رفع مخطوط', href: '/upload', icon: Upload },
  { name: 'تقديم مخطوط', href: '/submit', icon: Send },
  { name: 'المخطوطات', href: '/manuscripts', icon: FileText },
  { name: 'تصدير ⚡ Agency', href: '/export', icon: FileDown },
  { name: 'دمج الكتب', href: '/book-merger', icon: BookOpen },
  { name: 'مصمم الغلاف', href: '/cover-designer', icon: Palette },
  { name: 'التحليلات', href: '/analytics', icon: BarChart3 },
  { name: 'الإعدادات', href: '/settings', icon: Settings },
]

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const { user, logout } = useAuth()

  const SidebarContent = ({ onLinkClick }) => (
    <>
      {/* Brand */}
      <div className="flex items-center justify-center h-20 border-b border-shadow-border/50 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 to-transparent" />
        <div className="relative text-center">
          <h1 className="text-xl font-cyber font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-purple-400 bg-clip-text text-transparent">
            SHADOW-7
          </h1>
          <p className="text-[10px] tracking-[0.3em] text-purple-400/60 uppercase">Publisher</p>
        </div>
      </div>

      {/* User info */}
      {user && (
        <div className="px-4 py-3 border-b border-shadow-border/30">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold">
              {(user.full_name || user.email || '?')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-shadow-text truncate">{user.full_name || 'مستخدم'}</p>
              <p className="text-xs text-shadow-muted truncate">{user.email}</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = item.href === '/manuscripts'
            ? (location.pathname === '/manuscripts' || location.pathname.startsWith('/elite-editor/'))
            : (location.pathname === item.href || (item.href !== '/' && location.pathname.startsWith(item.href + '/')))
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm",
                isActive
                  ? "bg-gradient-to-r from-purple-600/30 to-pink-600/20 text-purple-300 border border-purple-500/30 shadow-neon"
                  : "text-shadow-muted hover:text-shadow-text hover:bg-shadow-hover/50"
              )}
              onClick={onLinkClick}
            >
              <item.icon className={cn("h-4 w-4", isActive ? "text-purple-400" : "")} />
              <span>{item.name}</span>
              {isActive && <div className="mr-auto w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-shadow-border/30 space-y-2">
        <button
          onClick={() => { logout(); onLinkClick?.(); }}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span>تسجيل الخروج</span>
        </button>
        <p className="text-[10px] text-shadow-muted/50 text-center">
          © 2026 SHADOW-7 · MrF103
        </p>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-shadow-bg" dir="rtl">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 right-0 w-64 bg-sidebar-gradient border-l border-shadow-border/50 flex flex-col">
            <div className="absolute top-3 left-3">
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} className="text-shadow-muted hover:text-white">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <SidebarContent onLinkClick={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:right-0 lg:w-64 lg:flex lg:flex-col bg-sidebar-gradient border-l border-shadow-border/50">
        <SidebarContent />
      </aside>

      {/* Main content */}
      <div className="lg:pr-64">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between h-14 px-4 border-b border-shadow-border/50 bg-shadow-surface/80 backdrop-blur-md sticky top-0 z-30">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="text-shadow-muted hover:text-purple-400">
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-cyber font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
            SHADOW-7
          </h1>
          <div className="w-10" />
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8 min-h-[calc(100vh-3.5rem)] lg:min-h-screen">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
