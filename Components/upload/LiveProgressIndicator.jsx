/**
 * مكون مؤشر التقدم الحي لمعالجة النصوص
 * Live Progress Indicator for Text Processing
 */

import { Progress } from '@/Components/ui/progress';
import { Card } from '@/Components/ui/card';
import { Loader2, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const STAGE_LABELS = {
  'quick_analysis': 'تحليل سريع',
  'chunk_processing': 'معالجة النص',
  'text_cleaning': 'تنظيف النص',
  'chapter_division': 'تقسيم الفصول',
  'content_compensation': 'تعويض المحتوى',
  'llm_processing': 'المعالجة الذكية',
  'local_nlp': 'التحليل المحلي',
  'removing_duplicates': 'إزالة التكرار',
  'removing_irrelevant_llm': 'تنظيف المحتوى',
  'llm_fallback': 'تقسيم ذكي'
};

const STAGE_DESCRIPTIONS = {
  'quick_analysis': 'فحص بنية النص والإحصائيات',
  'chunk_processing': 'معالجة أجزاء النص بالتوازي',
  'text_cleaning': 'إزالة المحتوى غير المرغوب',
  'chapter_division': 'تحديد حدود الفصول',
  'content_compensation': 'استكمال المحتوى الناقص',
  'llm_processing': 'معالجة بالذكاء الاصطناعي',
  'local_nlp': 'معالجة محلية فائقة السرعة',
  'removing_duplicates': 'كشف وإزالة التكرارات',
  'removing_irrelevant_llm': 'إزالة المحتوى غير المناسب',
  'llm_fallback': 'تقسيم ذكي بالذكاء الاصطناعي'
};

export function LiveProgressIndicator({ 
  currentStage, 
  progress = { percentage: 0, completed: 0, total: 0 },
  stageData = {},
  isComplete = false,
  hasError = false,
  errorMessage = '',
  elapsedTime = 0,
  estimatedTime = 0
}) {
  const getStageIcon = () => {
    if (hasError) return <AlertCircle className="w-5 h-5 text-red-500" />;
    if (isComplete) return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    return <Loader2 className="w-5 h-5 animate-spin text-blue-500" />;
  };

  const getStageColor = () => {
    if (hasError) return 'text-red-600';
    if (isComplete) return 'text-green-600';
    return 'text-blue-600';
  };

  const formatTime = (seconds) => {
    if (seconds < 60) return `${Math.round(seconds)} ثانية`;
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${minutes} دقيقة و ${secs} ثانية`;
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="p-6 space-y-4 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 border-2">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getStageIcon()}
              <div>
                <h3 className={`font-semibold text-lg ${getStageColor()}`}>
                  {isComplete 
                    ? 'اكتملت المعالجة ✓' 
                    : hasError 
                    ? 'حدث خطأ ✗' 
                    : STAGE_LABELS[currentStage] || 'جاري المعالجة...'}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {hasError 
                    ? errorMessage
                    : STAGE_DESCRIPTIONS[currentStage] || 'معالجة النص جارية'}
                </p>
              </div>
            </div>
            
            {/* Timer */}
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <Clock className="w-4 h-4" />
              <span>{formatTime(elapsedTime)}</span>
            </div>
          </div>

          {/* Progress Bar */}
          {!hasError && (
            <div className="space-y-2">
              <Progress 
                value={progress.percentage} 
                className="h-3"
              />
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-300">
                  {progress.completed} من {progress.total || '...'}
                </span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {Math.round(progress.percentage)}%
                </span>
              </div>
            </div>
          )}

          {/* Stage Details */}
          {stageData && Object.keys(stageData).length > 0 && (
            <motion.div 
              className="grid grid-cols-2 gap-3 pt-3 border-t"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {Object.entries(stageData).map(([key, value]) => (
                <div key={key} className="flex flex-col">
                  <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                    {key.replace(/_/g, ' ')}
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {typeof value === 'number' ? value.toLocaleString('ar') : value}
                  </span>
                </div>
              ))}
            </motion.div>
          )}

          {/* Estimated Time Remaining */}
          {!isComplete && !hasError && estimatedTime > 0 && (
            <motion.div 
              className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 pt-2 border-t"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <span>الوقت المتبقي:</span>
              <span className="font-semibold">{formatTime(estimatedTime)}</span>
            </motion.div>
          )}
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}

export default LiveProgressIndicator;
