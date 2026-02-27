import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import Layout from '@/Components/Layout'
import ErrorBoundary from '@/Components/ErrorBoundary'
import ToastProvider from '@/Components/ToastProvider'
import CollaborationProvider from '@/contexts/CollaborationContext'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import LoadingSpinner from '@/Components/LoadingSpinner'

// Pages
const LoginPage = lazy(() => import('@/Pages/LoginPage'))
const Dashboard = lazy(() => import('@/Pages/Dashboard'))
const ExportPage = lazy(() => import('@/Pages/ExportPage'))
const UploadPage = lazy(() => import('@/Pages/UploadPage'))
const ManuscriptsPage = lazy(() => import('@/Pages/ManuscriptsPage'))
const EliteEditorPage = lazy(() => import('@/Pages/EliteEditorPage'))
const BookMergerPage = lazy(() => import('@/Pages/BookMergerPage'))
const CoverDesignerPage = lazy(() => import('@/Pages/CoverDesignerPage'))
const OmniDashboard = lazy(() => import('@/Pages/OmniDashboard'))
const SettingsPage = lazy(() => import('@/Pages/SettingsPage'))
const AnalyticsDashboardPage = lazy(() => import('@/Pages/AnalyticsDashboardPage'))
const SubmitWizardPage = lazy(() => import('@/Pages/SubmitWizardPage'))
const PricingPage = lazy(() => import('@/Pages/PricingPage'))

const PageLoader = () => (
  <div className="min-h-screen bg-shadow-bg flex items-center justify-center">
    <LoadingSpinner size="md" text="جاري التحميل..." />
  </div>
)

// Redirect /manuscripts/:id → /elite-editor/:id
function ManuscriptsRedirect() {
  const { id } = useParams()
  return <Navigate to={`/elite-editor/${id}`} replace />
}

// Protected Route wrapper
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <PageLoader />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth()
  
  if (loading) return <PageLoader />

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/login" element={
        isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />
      } />
      
      {/* Protected routes */}
      <Route element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route path="/" element={<Dashboard />} />
        <Route path="/omni" element={<OmniDashboard />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/submit" element={<SubmitWizardPage />} />
        <Route path="/manuscripts" element={<ManuscriptsPage />} />
        <Route path="/manuscripts/:id" element={<ManuscriptsRedirect />} />
        <Route path="/elite-editor/:id" element={<EliteEditorPage />} />
        <Route path="/export" element={<ExportPage />} />
        <Route path="/book-merger" element={<BookMergerPage />} />
        <Route path="/cover-designer" element={<CoverDesignerPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/analytics" element={<AnalyticsDashboardPage />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to={isAuthenticated ? "/" : "/login"} replace />} />
    </Routes>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <CollaborationProvider>
            <Suspense fallback={<PageLoader />}>
              <AppRoutes />
            </Suspense>
          </CollaborationProvider>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
