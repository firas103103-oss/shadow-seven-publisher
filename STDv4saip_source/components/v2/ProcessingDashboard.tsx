import React from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '../../stores/appStore';
import {
  Loader2,
  CheckCircle,
  AlertCircle,
  Sparkles,
  FileText,
  Image,
  Package
} from 'lucide-react';

interface ProcessingStep {
  id: string;
  label: { ar: string; en: string; de: string };
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress?: number;
  icon: React.ComponentType<{ className?: string }>;
}

interface ProcessingDashboardProps {
  steps: ProcessingStep[];
  currentStep?: string;
  overallProgress?: number;
}

export const ProcessingDashboard: React.FC<ProcessingDashboardProps> = ({
  steps,
  currentStep,
  overallProgress = 0
}) => {
  const { theme, language } = useAppStore();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'processing':
        return <Loader2 className="w-5 h-5 animate-spin text-cyan-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-slate-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'from-green-500 to-emerald-500';
      case 'processing':
        return 'from-cyan-500 to-blue-500';
      case 'error':
        return 'from-red-500 to-orange-500';
      default:
        return 'from-slate-600 to-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Overall Progress */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={`p-6 rounded-2xl ${
          theme === 'cyber'
            ? 'bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur-xl border border-cyan-500/30'
            : theme === 'dark'
            ? 'bg-slate-800 border border-slate-700'
            : 'bg-white border border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold">
            {language === 'ar' ? 'تقدم المعالجة' : language === 'en' ? 'Processing Progress' : 'Verarbeitungsfortschritt'}
          </h3>
          <span className="text-3xl font-bold text-cyan-400">{Math.round(overallProgress)}%</span>
        </div>

        {/* Progress Bar */}
        <div className={`relative h-3 rounded-full overflow-hidden ${
          theme === 'cyber'
            ? 'bg-slate-700/50'
            : theme === 'dark'
            ? 'bg-slate-700'
            : 'bg-slate-200'
        }`}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${overallProgress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={`absolute left-0 top-0 bottom-0 ${
              theme === 'cyber'
                ? 'bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500'
                : 'bg-gradient-to-r from-blue-500 to-purple-500'
            }`}
          />

          {/* Animated Shine Effect */}
          <motion.div
            animate={{
              x: ['-100%', '200%']
            }}
            transition={{
              repeat: Infinity,
              duration: 2,
              ease: 'linear'
            }}
            className="absolute top-0 bottom-0 w-1/4 bg-gradient-to-r from-transparent via-white/30 to-transparent"
          />
        </div>
      </motion.div>

      {/* Processing Steps */}
      <div className="space-y-3">
        {steps.map((step, index) => {
          const StepIcon = step.icon;
          const isActive = step.id === currentStep;

          return (
            <motion.div
              key={step.id}
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: index * 0.1 }}
              className={`relative overflow-hidden rounded-xl transition-all duration-300 ${
                isActive
                  ? theme === 'cyber'
                    ? 'ring-2 ring-cyan-500 shadow-lg shadow-cyan-500/50'
                    : 'ring-2 ring-blue-500 shadow-lg'
                  : ''
              }`}
            >
              <div className={`p-4 ${
                theme === 'cyber'
                  ? 'bg-slate-800/50 backdrop-blur-xl border border-slate-700'
                  : theme === 'dark'
                  ? 'bg-slate-800'
                  : 'bg-slate-50'
              }`}>
                <div className="flex items-center gap-4">
                  {/* Step Icon */}
                  <div className={`p-3 rounded-xl bg-gradient-to-r ${getStatusColor(step.status)}`}>
                    <StepIcon className="w-6 h-6 text-white" />
                  </div>

                  {/* Step Info */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-semibold">
                        {step.label[language] || step.label.ar}
                      </h4>
                      {getStatusIcon(step.status)}
                    </div>

                    {/* Step Progress */}
                    {step.status === 'processing' && step.progress !== undefined && (
                      <div className={`h-1.5 rounded-full overflow-hidden ${
                        theme === 'cyber'
                          ? 'bg-slate-700/50'
                          : 'bg-slate-300'
                      }`}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${step.progress}%` }}
                          className="h-full bg-gradient-to-r from-cyan-500 to-purple-500"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Active Step Glow */}
              {isActive && theme === 'cyber' && (
                <motion.div
                  animate={{
                    opacity: [0.5, 1, 0.5]
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 2,
                    ease: 'easeInOut'
                  }}
                  className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 pointer-events-none"
                />
              )}
            </motion.div>
          );
        })}
      </div>

      {/* AI Activity Indicator */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className={`p-4 rounded-xl ${
          theme === 'cyber'
            ? 'bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30'
            : theme === 'dark'
            ? 'bg-purple-900/20 border border-purple-500/30'
            : 'bg-purple-50 border border-purple-200'
        }`}
      >
        <div className="flex items-center gap-3">
          <motion.div
            animate={{
              rotate: 360
            }}
            transition={{
              repeat: Infinity,
              duration: 3,
              ease: 'linear'
            }}
          >
            <Sparkles className="w-6 h-6 text-purple-400" />
          </motion.div>

          <div>
            <div className="font-semibold text-purple-400">
              {language === 'ar' ? '🤖 الذكاء الاصطناعي يعمل' : language === 'en' ? '🤖 AI is working' : '🤖 KI arbeitet'}
            </div>
            <div className="text-sm opacity-70">
              {language === 'ar' ? 'جيميني برو 3.5 يحلل محتواك' : language === 'en' ? 'Gemini Pro 3.5 analyzing your content' : 'Gemini Pro 3.5 analysiert Ihren Inhalt'}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// Default steps for manuscript processing
export const defaultProcessingSteps: ProcessingStep[] = [
  {
    id: 'upload',
    label: {
      ar: 'رفع المخطوطة',
      en: 'Upload Manuscript',
      de: 'Manuskript hochladen'
    },
    status: 'completed',
    progress: 100,
    icon: FileText
  },
  {
    id: 'analysis',
    label: {
      ar: 'تحليل المحتوى',
      en: 'Content Analysis',
      de: 'Inhaltsanalyse'
    },
    status: 'processing',
    progress: 65,
    icon: Sparkles
  },
  {
    id: 'enhancement',
    label: {
      ar: 'تحسين النص',
      en: 'Text Enhancement',
      de: 'Textverbesserung'
    },
    status: 'pending',
    icon: FileText
  },
  {
    id: 'cover',
    label: {
      ar: 'توليد الغلاف',
      en: 'Generate Cover',
      de: 'Cover generieren'
    },
    status: 'pending',
    icon: Image
  },
  {
    id: 'packaging',
    label: {
      ar: 'تجهيز الحزمة',
      en: 'Package Preparation',
      de: 'Paketierung'
    },
    status: 'pending',
    icon: Package
  }
];
