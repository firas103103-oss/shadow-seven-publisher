/**
 * Export Page - صفحة التصدير الرئيسية
 *
 * واجهة كاملة لتصدير الكتب وإنشاء حزمة Agency in a Box
 * يجلب المخطوطات من API ويسمح باختيار مخطوطة للتصدير
 */

import { useState } from 'react';
import { ArrowRight, Sparkles, FileText, AlertCircle } from 'lucide-react';
import { ExportOptions, ExportProgress, PackagePreview, ExportResults } from '../Components/export';
import useExportManager from '../hooks/useExportManager';
import { useManuscripts, useManuscript } from '../hooks/useManuscripts';

const ExportPage = () => {
  const { data: manuscripts = [], isLoading: manuscriptsLoading } = useManuscripts();
  const [selectedManuscriptId, setSelectedManuscriptId] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  const { data: manuscriptDetail } = useManuscript(selectedManuscriptId);
  const selectedManuscript = manuscriptDetail ?? manuscripts.find((m) => m.id === selectedManuscriptId) ?? null;

  const {
    isProcessing,
    progress,
    currentStage,
    stages,
    results,
    error,
    exportWithAgency,
    downloadFile,
    downloadAll,
    reset
  } = useExportManager();

  // تحويل المخطوطة إلى صيغة متوافقة مع ExportModule (content, chapters, title, author)
  const manuscriptForExport = selectedManuscript
    ? {
        id: selectedManuscript.id,
        title: selectedManuscript.title || 'بدون عنوان',
        author: selectedManuscript.author || '',
        content: selectedManuscript.content || '',
        chapters: Array.isArray(selectedManuscript.chapters)
          ? selectedManuscript.chapters.map((ch) =>
              typeof ch === 'object' && ch !== null
                ? { title: ch.title || '', content: ch.content || '' }
                : { title: String(ch), content: '' }
            )
          : [],
        genre: selectedManuscript.metadata?.genre,
        targetAudience: selectedManuscript.metadata?.targetAudience,
        mood: selectedManuscript.metadata?.mood
      }
    : null;

  const handleExport = async (exportConfig) => {
    if (!manuscriptForExport) {
      return;
    }
    try {
      await exportWithAgency(manuscriptForExport, exportConfig);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const handleNewExport = () => {
    reset();
    setShowPreview(false);
  };

  return (
    <div className="min-h-screen bg-shadow-bg p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* العنوان الرئيسي */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-3">
            <Sparkles className="w-10 h-10 text-shadow-accent animate-pulse-neon" />
            <h1 className="text-4xl md:text-5xl font-bold text-shadow-text cyber-text">
              الظل السابع - Agency in a Box
            </h1>
            <Sparkles className="w-10 h-10 text-shadow-accent animate-pulse-neon" />
          </div>
          <p className="text-xl text-shadow-text/60">
            صدّر كتابك واحصل على حزمة تسويقية شاملة بالذكاء الاصطناعي
          </p>
        </div>

        {/* المحتوى الرئيسي */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            {/* اختيار المخطوطة */}
            <div className="cyber-card bg-shadow-surface rounded-lg border border-shadow-primary/20 p-6">
              <h3 className="text-lg font-semibold text-shadow-text mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-shadow-accent" />
                اختر المخطوطة للتصدير
              </h3>

              {manuscriptsLoading ? (
                <div className="py-8 text-center text-shadow-text/60">
                  <div className="w-8 h-8 border-2 border-shadow-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  جاري تحميل المخطوطات...
                </div>
              ) : manuscripts.length === 0 ? (
                <div className="py-8 text-center">
                  <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-2" />
                  <p className="text-shadow-text/80">لا توجد مخطوطات بعد</p>
                  <p className="text-sm text-shadow-text/60 mt-1">
                    ارفع مخطوطة من صفحة الرفع أولاً
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <select
                    value={selectedManuscriptId || ''}
                    onChange={(e) => setSelectedManuscriptId(e.target.value || null)}
                    className="w-full px-4 py-3 bg-shadow-bg border border-shadow-primary/30 rounded-lg text-shadow-text focus:outline-none focus:border-shadow-accent transition-colors"
                  >
                    <option value="">-- اختر مخطوطة --</option>
                    {manuscripts.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title || 'بدون عنوان'} ({m.word_count || 0} كلمة)
                      </option>
                    ))}
                  </select>

                  {selectedManuscript && (
                    <div className="space-y-2 pt-2 border-t border-shadow-primary/20">
                      <div className="flex justify-between">
                        <span className="text-shadow-text/60">العنوان:</span>
                        <span className="text-shadow-text font-semibold">
                          {selectedManuscript.title || 'بدون عنوان'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-shadow-text/60">المؤلف:</span>
                        <span className="text-shadow-text font-semibold">
                          {selectedManuscript.author || '—'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-shadow-text/60">الفصول:</span>
                        <span className="text-shadow-text font-semibold">
                          {Array.isArray(selectedManuscript.chapters)
                            ? selectedManuscript.chapters.length
                            : 0}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-shadow-text/60">الكلمات:</span>
                        <span className="text-shadow-text font-semibold">
                          {(selectedManuscript.word_count || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* خيارات التصدير */}
            {!isProcessing && !results && manuscriptForExport && (
              <ExportOptions
                manuscript={manuscriptForExport}
                onExport={handleExport}
              />
            )}

            {/* شريط التقدم */}
            {isProcessing && (
              <ExportProgress
                progress={progress}
                currentStage={currentStage}
                stages={stages}
                error={error}
              />
            )}

            {/* النتائج */}
            {results && !isProcessing && (
              <ExportResults
                results={results}
                onDownload={downloadFile}
                onDownloadAll={downloadAll}
              />
            )}

            {/* زر بدء جديد */}
            {results && (
              <button
                onClick={handleNewExport}
                className="w-full cyber-button bg-shadow-secondary py-4 px-6 rounded-lg font-bold text-lg flex items-center justify-center gap-2 hover:shadow-glow transition-all"
              >
                <ArrowRight className="w-6 h-6" />
                تصدير جديد
              </button>
            )}
          </div>

          {/* العمود الأيمن: المعاينة */}
          <div className="space-y-6">
            {!showPreview && !results && manuscriptForExport && (
              <button
                onClick={() => setShowPreview(true)}
                className="w-full cyber-card bg-shadow-surface rounded-lg border-2 border-shadow-accent/30 p-8 hover:border-shadow-accent/60 transition-all group"
              >
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 mx-auto bg-shadow-accent/20 rounded-full flex items-center justify-center group-hover:bg-shadow-accent/30 transition-all">
                    <Sparkles className="w-8 h-8 text-shadow-accent" />
                  </div>
                  <h3 className="text-xl font-bold text-shadow-text">
                    معاينة محتويات الحزمة
                  </h3>
                  <p className="text-shadow-text/60">
                    شاهد ما ستحصل عليه في حزمة Agency in a Box
                  </p>
                </div>
              </button>
            )}

            {(showPreview || results) && manuscriptForExport && (
              <PackagePreview
                agencyData={{
                  manuscript: manuscriptForExport,
                  exports: results?.agencyData?.exports || {},
                  marketing: results?.agencyData?.marketing || {
                    catchyTitles: ['عنوان جذاب 1', 'عنوان جذاب 2'],
                    elevatorPitch: 'وصف قصير مثير...',
                    seoKeywords: ['كلمة 1', 'كلمة 2']
                  },
                  socialMedia: results?.agencyData?.socialMedia || {
                    twitter: ['تغريدة 1', 'تغريدة 2'],
                    facebook: ['منشور 1'],
                    instagram: ['كابشن 1'],
                    linkedin: ['منشور احترافي'],
                    tiktok: ['سكريبت'],
                    contentCalendar: []
                  },
                  mediaScripts: results?.agencyData?.mediaScripts || {
                    youtubeScript: 'سكريبت يوتيوب...',
                    podcastScript: 'سكريبت بودكاست...',
                    interviewQuestions: {
                      basic: ['سؤال 1', 'سؤال 2'],
                      intermediate: ['سؤال 3'],
                      advanced: ['سؤال 4']
                    }
                  },
                  design: results?.agencyData?.design || {
                    colorPalettes: [
                      { name: 'لوحة 1', colors: ['#000', '#fff'] }
                    ],
                    designConcepts: ['فكرة 1', 'فكرة 2'],
                    aiPrompts: ['Prompt 1', 'Prompt 2']
                  }
                }}
              />
            )}

            {!results && (
              <div className="cyber-card bg-shadow-surface rounded-lg border border-shadow-primary/20 p-6 space-y-4">
                <h3 className="text-lg font-bold text-shadow-text">
                  💡 ما الذي ستحصل عليه؟
                </h3>
                <ul className="space-y-3 text-shadow-text/80">
                  <li className="flex items-start gap-2">
                    <span className="text-shadow-accent mt-1">✓</span>
                    <span>كتابك بـ 3 صيغ احترافية (PDF, EPUB, DOCX)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-shadow-accent mt-1">✓</span>
                    <span>استراتيجية تسويقية كاملة مع عناوين جذابة</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-shadow-accent mt-1">✓</span>
                    <span>محتوى جاهز لـ 5 منصات سوشيال ميديا</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-shadow-accent mt-1">✓</span>
                    <span>سكريبتات يوتيوب وبودكاست وإعلانات راديو</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-shadow-accent mt-1">✓</span>
                    <span>4 أفكار تصميم غلاف احترافية</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-shadow-accent mt-1">✓</span>
                    <span>دليل استخدام شامل مع نصائح التسويق</span>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="text-center text-shadow-text/40 text-sm mt-12">
          <p>🌟 صُنع بحب بواسطة الظل السابع - Shadow Seven Agency v4.0</p>
        </div>
      </div>

      <div className="fixed inset-0 pointer-events-none opacity-10 cyber-grid -z-10" />
    </div>
  );
};

export default ExportPage;
