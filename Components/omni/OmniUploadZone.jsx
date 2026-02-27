/**
 * OmniUploadZone — Stage 1: Intake
 * Drag-and-drop for 1–7 TXT/DOCX files with live word count, encoding, RTL health
 */

import { useState, useCallback, useRef } from 'react'
import { Upload, FileText, X } from 'lucide-react'
import mammoth from 'mammoth'
import { omniApi } from '@/api/backendClient'

const ALLOWED_TYPES = ['.txt', '.docx']
const ALLOWED_MIMES = [
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]
const MIN_WORDS = 500
const MAX_WORDS = 200_000

function countWords(text) {
  return text.split(/\s+/).filter(Boolean).length
}

function detectEncoding(buffer) {
  try {
    new TextDecoder('utf-8').decode(buffer)
    return 'UTF-8'
  } catch {
    try {
      new TextDecoder('windows-1256').decode(buffer)
      return 'CP1256'
    } catch {
      return 'UTF-8'
    }
  }
}

function getRtlRatio(text) {
  const total = Math.max(text.replace(/\s/g, '').length, 1)
  const arabic = (text.match(/[\u0600-\u06FF]/g) || []).length
  return (arabic / total) * 100
}

async function readFileText(file) {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'docx') {
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    return result.value || ''
  }
  const buffer = await file.arrayBuffer()
  const encoding = detectEncoding(new Uint8Array(buffer))
  const decoder = new TextDecoder(encoding === 'CP1256' ? 'windows-1256' : 'utf-8')
  return decoder.decode(buffer)
}

export default function OmniUploadZone({ onIntakeSuccess, onError }) {
  const [files, setFiles] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({ wordCount: 0, encoding: 'UTF-8', rtlRatio: 0 })
  const fileInputRef = useRef(null)

  const validateFile = useCallback((file) => {
    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase()
    const validType = ALLOWED_TYPES.includes(ext) && ALLOWED_MIMES.includes(file.type)
    return validType
  }, [])

  const updateStats = useCallback(async (fileList) => {
    if (fileList.length === 0) {
      setStats({ wordCount: 0, encoding: 'UTF-8', rtlRatio: 0 })
      return
    }
    let totalWords = 0
    let combinedText = ''
    let enc = 'UTF-8'
    for (const f of fileList) {
      try {
        const text = await readFileText(f)
        combinedText += text + '\n'
        totalWords += countWords(text)
        const buf = await f.arrayBuffer()
        enc = detectEncoding(new Uint8Array(buf))
      } catch {
        // skip failed reads
      }
    }
    const rtlRatio = combinedText ? getRtlRatio(combinedText) : 0
    setStats({ wordCount: totalWords, encoding: enc, rtlRatio })
  }, [])

  const handleFiles = useCallback(
    async (newFiles) => {
      const arr = Array.from(newFiles).filter(validateFile)
      if (arr.length === 0) return
      if (arr.length > 7) {
        onError?.('الحد الأقصى 7 ملفات')
        return
      }
      setFiles(arr)
      await updateStats(arr)
    },
    [validateFile, updateStats, onError]
  )

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault()
      setIsDragging(false)
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles]
  )

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleInputChange = useCallback(
    (e) => {
      const f = e.target.files
      if (f?.length) handleFiles(f)
      e.target.value = ''
    },
    [handleFiles]
  )

  const removeFile = useCallback(
    (idx) => {
      const next = files.filter((_, i) => i !== idx)
      setFiles(next)
      updateStats(next)
    },
    [files, updateStats]
  )

  const isValid =
    files.length >= 1 &&
    files.length <= 7 &&
    stats.wordCount >= MIN_WORDS &&
    stats.wordCount <= MAX_WORDS

  const handleSubmit = useCallback(async () => {
    if (!isValid || loading) return
    setLoading(true)
    try {
      const formData = new FormData()
      files.forEach((f, i) => formData.append(`file_${i + 1}`, f))
      const res = await omniApi.upload(formData)
      onIntakeSuccess?.({
        tracking_id: res.tracking_id,
        word_count: res.word_count ?? stats.wordCount,
        file_count: res.file_count ?? files.length,
        encoding: res.encoding ?? stats.encoding
      })
    } catch (err) {
      onError?.(err.message || 'فشل الرفع')
    } finally {
      setLoading(false)
    }
  }, [isValid, loading, files, stats, onIntakeSuccess, onError])

  return (
    <div className="cyber-card bg-shadow-surface border-2 border-dashed border-shadow-primary/20 cyber-grid rounded-xl p-6">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          flex flex-col items-center justify-center min-h-[220px] rounded-lg transition-colors
          ${isDragging ? 'border-shadow-accent/50 bg-shadow-accent/10' : 'border-shadow-primary/20'}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".txt,.docx,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={handleInputChange}
          className="hidden"
        />
        <Upload className="w-12 h-12 text-shadow-accent mb-3" />
        <p className="text-shadow-text/80 text-center mb-1">
          اسحب 1–7 ملفات TXT أو DOCX هنا أو انقر للاختيار
        </p>
        <p className="text-sm text-shadow-muted mb-4">الحد الأقصى: 200,000 كلمة</p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="cyber-button bg-shadow-accent/80 px-4 py-2 rounded-lg text-sm hover:shadow-glow transition-all"
        >
          اختيار ملفات
        </button>
      </div>

      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap gap-2 items-center">
            <span
              className={`px-2 py-1 rounded text-sm font-medium ${
                stats.wordCount >= MIN_WORDS && stats.wordCount <= MAX_WORDS
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/20 text-red-400'
              }`}
            >
              {stats.wordCount.toLocaleString()} كلمة
            </span>
            <span className="px-2 py-1 rounded text-sm bg-shadow-primary/20 text-shadow-text">
              {stats.encoding}
            </span>
            <span
              className={`px-2 py-1 rounded text-sm ${
                stats.rtlRatio > 30 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
              }`}
            >
              {stats.rtlRatio > 30 ? 'RTL OK' : `RTL ${stats.rtlRatio.toFixed(0)}%`}
            </span>
          </div>
          <ul className="space-y-1">
            {files.map((f, i) => (
              <li
                key={i}
                className="flex items-center gap-2 text-sm text-shadow-text/80"
              >
                <FileText className="w-4 h-4 text-shadow-accent" />
                <span className="flex-1 truncate">{f.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="p-1 rounded hover:bg-red-500/20 text-red-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex justify-center">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isValid || loading}
          className="cyber-button bg-shadow-accent px-6 py-3 rounded-lg hover:shadow-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'جاري الرفع...' : 'بدء الاستقبال السيادي'}
        </button>
      </div>
    </div>
  )
}
