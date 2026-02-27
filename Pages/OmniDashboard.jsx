/**
 * OmniDashboard — Shadow-7 Omni-Publisher Command Center
 * 7-stage pipeline: Intake, Purge, Nuwa, Expansion, Compliance, Creative, Encapsulation
 */

import { useState, useCallback } from 'react'
import { Zap, Play } from 'lucide-react'
import OmniUploadZone from '@/Components/omni/OmniUploadZone'
import PurgeReportModal from '@/Components/omni/PurgeReportModal'
import { useToast } from '@/Components/ToastProvider'

const STAGES = [
  'الاستقبال',
  'التنظيف',
  'Nuwa',
  'التوسع',
  'الامتثال',
  'الإبداع',
  'التغليف'
]

export default function OmniDashboard() {
  const [stage, setStage] = useState(1)
  const [intakeData, setIntakeData] = useState(null)
  const [purgeModalOpen, setPurgeModalOpen] = useState(false)
  const { success, error } = useToast()

  const handleIntakeSuccess = useCallback((data) => {
    setIntakeData(data)
    setStage(2)
    setPurgeModalOpen(true)
    success('تم الاستقبال بنجاح. جاري فتح تقرير التنظيف...')
  }, [success])

  const handlePurgeApprove = useCallback(() => {
    setStage(3)
    success('تمت الموافقة على التنظيف. المرحلة 3 (Nuwa) قيد التطوير.')
  }, [success])

  return (
    <div className="min-h-screen cyber-grid bg-shadow-bg" dir="rtl">
      <div className="relative z-10 p-6 lg:p-8 max-w-5xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-cyber font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-purple-400 bg-clip-text text-transparent">
            Shadow-7 Omni-Publisher: Sovereign Core
          </h1>
          <p className="text-shadow-text/60 mt-1">
            خط أنابيب النشر السيادي — 7 مراحل
          </p>
        </header>

        {/* Pipeline Stepper */}
        <div className="sticky top-0 z-20 mb-6 py-3 bg-shadow-bg/95 backdrop-blur-md border-b border-shadow-primary/20 -mx-6 px-6 lg:-mx-8 lg:px-8">
          <div className="flex flex-wrap gap-2 lg:gap-4 items-center justify-center">
            {STAGES.map((name, i) => {
              const idx = i + 1
              const isActive = stage === idx
              const isPast = stage > idx
              return (
                <div
                  key={idx}
                  className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                    ${isActive ? 'bg-shadow-accent/30 text-shadow-accent border border-shadow-accent/50' : ''}
                    ${isPast ? 'text-shadow-muted' : ''}
                    ${!isActive && !isPast ? 'text-shadow-text/60' : ''}
                  `}
                >
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs bg-shadow-surface border border-shadow-primary/20">
                    {idx}
                  </span>
                  <span>{name}</span>
                  {i < STAGES.length - 1 && (
                    <span className="hidden lg:inline text-shadow-muted/50">→</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <div className="cyber-card bg-shadow-surface border border-shadow-primary/20 rounded-xl overflow-hidden">
          {stage === 1 && (
            <OmniUploadZone
              onIntakeSuccess={handleIntakeSuccess}
              onError={error}
            />
          )}

          {stage === 2 && (
            <div className="p-8 text-center">
              <p className="text-shadow-text/80 mb-4">
                تم الاستقبال. جاري عرض تقرير التنظيف...
              </p>
              {intakeData && (
                <div className="inline-flex flex-col gap-2 text-sm text-shadow-muted mb-6">
                  <span>معرف التتبع: {intakeData.tracking_id}</span>
                  <span>عدد الكلمات: {intakeData.word_count?.toLocaleString()}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => setPurgeModalOpen(true)}
                className="cyber-button bg-shadow-accent px-6 py-3 rounded-lg hover:shadow-glow transition-all flex items-center gap-2 mx-auto"
              >
                <Play className="w-4 h-4" />
                تشغيل التنظيف
              </button>
            </div>
          )}

          {stage >= 3 && (
            <div className="p-12 text-center">
              <Zap className="w-16 h-16 text-shadow-accent/60 mx-auto mb-4" />
              <h2 className="text-xl font-cyber text-shadow-text mb-2">
                المرحلة {stage}: {STAGES[stage - 1]}
              </h2>
              <p className="text-shadow-text/60 max-w-md mx-auto">
                قيد التطوير. ستتوفر هذه المرحلة قريباً.
              </p>
            </div>
          )}
        </div>
      </div>

      <PurgeReportModal
        open={purgeModalOpen}
        onOpenChange={setPurgeModalOpen}
        trackingId={intakeData?.tracking_id}
        onApprove={handlePurgeApprove}
      />
    </div>
  )
}
