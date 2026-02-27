/**
 * PurgeReportModal — Stage 2: Threat & Anomaly Report
 * Shows purge results and "Approve Purge & Proceed to Nuwa"
 */

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription
} from '@/Components/ui/dialog'
import { omniApi } from '@/api/backendClient'
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'

export default function PurgeReportModal({ open, onOpenChange, trackingId, onApprove }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [report, setReport] = useState(null)

  useEffect(() => {
    if (!open || !trackingId) return
    setLoading(true)
    setError(null)
    setReport(null)
    omniApi
      .purge(trackingId)
      .then((data) => {
        setReport(data)
      })
      .catch((err) => {
        const msg = (err.message || '').toLowerCase()
        if (msg.includes('404') || msg.includes('not found') || msg.includes('غير متوفر')) {
          setError('خدمة التنظيف غير متوفرة حالياً')
        } else {
          setError(err.message || 'فشل تنفيذ التنظيف')
        }
      })
      .finally(() => setLoading(false))
  }, [open, trackingId])

  const handleApprove = () => {
    onApprove?.()
    onOpenChange?.(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-shadow-surface border border-shadow-primary/20 backdrop-blur-xl max-w-lg"
        dir="rtl"
      >
        <DialogHeader>
          <DialogTitle className="text-shadow-text font-cyber">
            تقرير التهديدات والشذوذ
          </DialogTitle>
          <DialogDescription className="text-shadow-text/60">
            نتائج مرحلة التنظيف
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 className="w-6 h-6 animate-spin text-shadow-accent" />
              <span className="text-shadow-text/80">جاري التنظيف...</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <p className="text-shadow-text/90">{error}</p>
            </div>
          )}

          {!loading && !error && report && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-shadow-bg/80 border border-shadow-primary/20">
                  <p className="text-xs text-shadow-muted mb-1">عدد الكلمات الأصلي</p>
                  <p className="text-lg font-semibold text-shadow-text">
                    {(report.word_count ?? report.word_count_before ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-shadow-bg/80 border border-shadow-primary/20">
                  <p className="text-xs text-shadow-muted mb-1">بعد التنظيف</p>
                  <p className="text-lg font-semibold text-shadow-accent">
                    {(report.word_count_after ?? report.word_count ?? 0).toLocaleString()}
                  </p>
                </div>
              </div>

              {report.purge_report && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-shadow-text">تفاصيل التنظيف</p>
                  <div className="flex flex-wrap gap-2">
                    {report.purge_report.duplicates != null && (
                      <span className="px-2 py-1 rounded bg-purple-500/20 text-purple-300 text-sm">
                        تكرارات: {report.purge_report.duplicates}
                      </span>
                    )}
                    {report.purge_report.outliers != null && (
                      <span className="px-2 py-1 rounded bg-amber-500/20 text-amber-300 text-sm">
                        شذوذ: {report.purge_report.outliers}
                      </span>
                    )}
                    {report.purge_report.thematic_shifts != null && (
                      <span className="px-2 py-1 rounded bg-cyan-500/20 text-cyan-300 text-sm">
                        تحولات موضوعية: {report.purge_report.thematic_shifts}
                      </span>
                    )}
                    {report.anomalies_fixed != null && (
                      <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 text-sm">
                        تم إصلاح: {report.anomalies_fixed}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <button
            type="button"
            onClick={() => onOpenChange?.(false)}
            className="px-4 py-2 rounded-lg border border-shadow-primary/30 text-shadow-text hover:bg-shadow-hover/50 transition-colors"
          >
            إغلاق
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={loading}
            className="cyber-button bg-shadow-accent px-4 py-2 rounded-lg hover:shadow-glow transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            الموافقة على التنظيف والمتابعة إلى Nuwa (المرحلة 3)
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
