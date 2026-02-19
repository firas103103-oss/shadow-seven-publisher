/**
 * SubmitWizardPage - صفحة إرسال المخطوطات للتوليد الذكي
 * 
 * MODULE 1: The Gatekeeper
 * - Multi-step wizard
 * - Text/File input
 * - Preferences selection
 * - Real-time validation
 * - Progress tracking
 */

import { useState, useCallback, useRef } from 'react';
import { 
  FileText, Upload, Settings, Send, CheckCircle, 
  AlertCircle, Loader2, ArrowRight, ArrowLeft,
  BookOpen, Users, Palette, Globe, Sparkles
} from 'lucide-react';
import { useToast } from '../Components/ToastProvider';

// API Base URL
const API_BASE = '/api/shadow7';

// Wizard Steps
const STEPS = [
  { id: 'input', title: 'المحتوى', icon: FileText },
  { id: 'preferences', title: 'الإعدادات', icon: Settings },
  { id: 'review', title: 'المراجعة', icon: CheckCircle },
  { id: 'submit', title: 'الإرسال', icon: Send }
];

// Options - matching backend enums
const TARGET_AUDIENCES = [
  { value: 'عام', label: 'جمهور عام', icon: '👥' },
  { value: 'أطفال', label: 'أطفال', icon: '👶' },
  { value: 'شباب', label: 'شباب', icon: '🧑' },
  { value: 'بالغين', label: 'بالغين', icon: '👨' },
  { value: 'متخصصين', label: 'متخصصين', icon: '🎓' }
];

const BOOK_GENRES = [
  { value: 'تطوير ذات', label: 'تطوير ذاتي', icon: '📈' },
  { value: 'رومانسي', label: 'رومانسي', icon: '💕' },
  { value: 'خيال علمي', label: 'خيال علمي', icon: '🚀' },
  { value: 'تشويق', label: 'تشويق', icon: '🔥' },
  { value: 'أكاديمي', label: 'أكاديمي', icon: '📚' },
  { value: 'تسويقي', label: 'تسويقي', icon: '📊' },
  { value: 'سيرة ذاتية', label: 'سيرة ذاتية', icon: '👤' },
  { value: 'تاريخي', label: 'تاريخي', icon: '🏛️' },
  { value: 'ديني', label: 'ديني', icon: '🕌' },
  { value: 'آخر', label: 'آخر', icon: '📝' }
];

const TONES = [
  { value: 'رسمي', label: 'رسمي', icon: '👔' },
  { value: 'ودي', label: 'ودي', icon: '😊' },
  { value: 'إلهامي', label: 'إلهامي', icon: '✨' },
  { value: 'أكاديمي', label: 'أكاديمي', icon: '📖' },
  { value: 'تشويقي', label: 'تشويقي', icon: '🔥' },
  { value: 'فكاهي', label: 'فكاهي', icon: '😄' }
];

const PLATFORMS = [
  { value: 'kindle', label: 'Amazon Kindle', icon: '📱' },
  { value: 'epub_generic', label: 'EPUB', icon: '📚' },
  { value: 'print_a5', label: 'Print A5', icon: '📕' },
  { value: 'print_a4', label: 'Print A4', icon: '📗' }
];

const SubmitWizardPage = () => {
  // State
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [trackingId, setTrackingId] = useState(null);
  const [trackingStatus, setTrackingStatus] = useState(null);
  const fileInputRef = useRef(null);
  const { success, error } = useToast();
  
  // Form state
  const [formData, setFormData] = useState({
    rawText: '',
    fileName: null,
    userEmail: '',
    userName: '',
    targetAudience: 'عام',
    bookGenre: 'آخر',
    toneOfVoice: 'رسمي',
    platform: 'kindle',
    language: 'ar'
  });
  
  // Validation state
  const [validation, setValidation] = useState({
    wordCount: 0,
    arabicRatio: 0,
    isValid: false,
    errors: []
  });

  // ─────────────────────────────────────────────────────────────
  // Validation
  // ─────────────────────────────────────────────────────────────
  
  const validateText = useCallback((text) => {
    const errors = [];
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;
    
    // Count Arabic characters
    const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
    const totalChars = text.replace(/\s/g, '').length;
    const arabicRatio = totalChars > 0 ? (arabicChars / totalChars) * 100 : 0;
    
    // Validation rules
    if (wordCount < 500) {
      errors.push(`النص قصير جداً (${wordCount} كلمة). الحد الأدنى: 500 كلمة`);
    }
    if (wordCount > 5000) {
      errors.push(`النص طويل جداً (${wordCount} كلمة). الحد الأقصى: 5000 كلمة`);
    }
    if (arabicRatio < 30) {
      errors.push(`نسبة العربية منخفضة (${arabicRatio.toFixed(0)}%). يجب ألا تقل عن 30%`);
    }
    
    const isValid = errors.length === 0 && wordCount >= 500 && wordCount <= 5000;
    
    setValidation({ wordCount, arabicRatio, isValid, errors });
    return isValid;
  }, []);

  // ─────────────────────────────────────────────────────────────
  // File handling
  // ─────────────────────────────────────────────────────────────
  
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const validTypes = ['.txt', '.docx'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!validTypes.includes(ext)) {
      error('نوع الملف غير مدعوم. الأنواع المسموحة: TXT, DOCX');
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      error('حجم الملف كبير جداً. الحد الأقصى: 10MB');
      return;
    }
    
    try {
      let text = '';
      
      if (ext === '.txt') {
        text = await file.text();
      } else if (ext === '.docx') {
        // For DOCX, we'll send directly to backend
        setFormData(prev => ({ ...prev, fileName: file.name, rawText: '' }));
        success(`تم اختيار: ${file.name}`);
        return;
      }
      
      setFormData(prev => ({ ...prev, rawText: text, fileName: file.name }));
      validateText(text);
      success(`تم تحميل: ${file.name}`);
      
    } catch (err) {
      error('خطأ في قراءة الملف');
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Navigation
  // ─────────────────────────────────────────────────────────────
  
  const canProceed = () => {
    if (currentStep === 0) {
      return validation.isValid && formData.userEmail;
    }
    if (currentStep === 1) {
      return formData.targetAudience && formData.bookGenre;
    }
    return true;
  };
  
  const nextStep = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };
  
  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Submit
  // ─────────────────────────────────────────────────────────────
  
  const handleSubmit = async () => {
    setIsLoading(true);
    
    try {
      const response = await fetch(`${API_BASE}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_email: formData.userEmail,
          user_name: formData.userName,
          raw_text: formData.rawText,
          target_audience: formData.targetAudience,
          book_genre: formData.bookGenre,
          tone_of_voice: formData.toneOfVoice,
          platform: formData.platform,
          language: formData.language,
          file_name: formData.fileName
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'خطأ في الإرسال');
      }
      
      setTrackingId(data.tracking_id);
      setCurrentStep(3); // Move to tracking step
      success(`تم الإرسال! رقم التتبع: ${data.tracking_id}`);
      
      // Start polling for status
      pollStatus(data.tracking_id);
      
    } catch (err) {
      error(err.message || 'فشل الإرسال');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Poll for status updates
  const pollStatus = async (tid) => {
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/track/${tid}`);
        const data = await res.json();
        
        setTrackingStatus(data);
        
        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(pollInterval);
        }
      } catch (err) {
        console.error('Poll error:', err);
      }
    }, 5000);
  };

  // ─────────────────────────────────────────────────────────────
  // Render Steps
  // ─────────────────────────────────────────────────────────────
  
  // Step 1: Input
  const renderInputStep = () => (
    <div className="space-y-6">
      {/* Email & Name */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            البريد الإلكتروني *
          </label>
          <input
            type="email"
            value={formData.userEmail}
            onChange={(e) => setFormData(prev => ({ ...prev, userEmail: e.target.value }))}
            placeholder="email@example.com"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            الاسم (اختياري)
          </label>
          <input
            type="text"
            value={formData.userName}
            onChange={(e) => setFormData(prev => ({ ...prev, userName: e.target.value }))}
            placeholder="اسمك الكريم"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
          />
        </div>
      </div>
      
      {/* File Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          أو ارفع ملف
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.docx"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full border-2 border-dashed border-gray-600 rounded-lg p-6 text-center hover:border-purple-500 transition-colors"
        >
          <Upload className="w-10 h-10 mx-auto text-gray-500 mb-2" />
          <p className="text-gray-400">
            {formData.fileName || 'اضغط لاختيار ملف TXT أو DOCX'}
          </p>
        </button>
      </div>
      
      {/* Text Area */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          أو الصق النص هنا
        </label>
        <textarea
          value={formData.rawText}
          onChange={(e) => {
            setFormData(prev => ({ ...prev, rawText: e.target.value }));
            validateText(e.target.value);
          }}
          placeholder="الصق مخطوطتك هنا... (500-5000 كلمة)"
          className="w-full h-64 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none resize-none"
          dir="rtl"
        />
      </div>
      
      {/* Validation Stats */}
      <div className="flex items-center gap-4 text-sm">
        <div className={`flex items-center gap-2 ${validation.wordCount >= 500 && validation.wordCount <= 5000 ? 'text-green-400' : 'text-yellow-400'}`}>
          <span>📝</span>
          <span>{validation.wordCount.toLocaleString()} كلمة</span>
        </div>
        <div className={`flex items-center gap-2 ${validation.arabicRatio >= 30 ? 'text-green-400' : 'text-yellow-400'}`}>
          <span>🔤</span>
          <span>{validation.arabicRatio.toFixed(0)}% عربي</span>
        </div>
      </div>
      
      {/* Validation Errors */}
      {validation.errors.length > 0 && (
        <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4">
          {validation.errors.map((err, i) => (
            <p key={i} className="text-red-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {err}
            </p>
          ))}
        </div>
      )}
    </div>
  );
  
  // Step 2: Preferences
  const renderPreferencesStep = () => (
    <div className="space-y-8">
      {/* Target Audience */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
          <Users className="w-4 h-4" />
          الجمهور المستهدف
        </label>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {TARGET_AUDIENCES.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFormData(prev => ({ ...prev, targetAudience: opt.value }))}
              className={`p-4 rounded-lg border-2 transition-all ${
                formData.targetAudience === opt.value
                  ? 'border-purple-500 bg-purple-500/20'
                  : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              <span className="text-2xl block mb-1">{opt.icon}</span>
              <span className="text-sm text-gray-300">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* Book Genre */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
          <BookOpen className="w-4 h-4" />
          نوع الكتاب
        </label>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {BOOK_GENRES.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFormData(prev => ({ ...prev, bookGenre: opt.value }))}
              className={`p-4 rounded-lg border-2 transition-all ${
                formData.bookGenre === opt.value
                  ? 'border-purple-500 bg-purple-500/20'
                  : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              <span className="text-2xl block mb-1">{opt.icon}</span>
              <span className="text-sm text-gray-300">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* Tone */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
          <Palette className="w-4 h-4" />
          نبرة الكتابة
        </label>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {TONES.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFormData(prev => ({ ...prev, toneOfVoice: opt.value }))}
              className={`p-4 rounded-lg border-2 transition-all ${
                formData.toneOfVoice === opt.value
                  ? 'border-purple-500 bg-purple-500/20'
                  : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              <span className="text-2xl block mb-1">{opt.icon}</span>
              <span className="text-sm text-gray-300">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* Platform */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
          <Globe className="w-4 h-4" />
          منصة النشر
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {PLATFORMS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFormData(prev => ({ ...prev, platform: opt.value }))}
              className={`p-4 rounded-lg border-2 transition-all ${
                formData.platform === opt.value
                  ? 'border-purple-500 bg-purple-500/20'
                  : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              <span className="text-2xl block mb-1">{opt.icon}</span>
              <span className="text-sm text-gray-300">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
  
  // Step 3: Review
  const renderReviewStep = () => (
    <div className="space-y-6">
      <div className="bg-gray-800/50 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold text-white mb-4">ملخص الطلب</h3>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">البريد:</span>
            <p className="text-white">{formData.userEmail}</p>
          </div>
          <div>
            <span className="text-gray-500">عدد الكلمات:</span>
            <p className="text-white">{validation.wordCount.toLocaleString()}</p>
          </div>
          <div>
            <span className="text-gray-500">الجمهور:</span>
            <p className="text-white">{formData.targetAudience}</p>
          </div>
          <div>
            <span className="text-gray-500">النوع:</span>
            <p className="text-white">{formData.bookGenre}</p>
          </div>
          <div>
            <span className="text-gray-500">النبرة:</span>
            <p className="text-white">{formData.toneOfVoice}</p>
          </div>
          <div>
            <span className="text-gray-500">المنصة:</span>
            <p className="text-white">{formData.platform}</p>
          </div>
        </div>
        
        {/* Preview text snippet */}
        <div className="mt-4 pt-4 border-t border-gray-700">
          <span className="text-gray-500 text-sm">معاينة النص:</span>
          <p className="text-gray-300 text-sm mt-2 line-clamp-4" dir="rtl">
            {formData.rawText.substring(0, 300)}...
          </p>
        </div>
      </div>
      
      <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-4">
        <p className="text-yellow-400 text-sm">
          ⚠️ بعد الإرسال، سيتم توليد كتاب كامل (8-12 فصل) + 4 تقارير استشارية. 
          العملية تستغرق 15-30 دقيقة. ستصلك إشعار على بريدك عند الاكتمال.
        </p>
      </div>
    </div>
  );
  
  // Step 4: Tracking
  const renderTrackingStep = () => (
    <div className="space-y-6 text-center">
      {trackingId && (
        <div className="bg-gray-800/50 rounded-lg p-8">
          <Sparkles className="w-16 h-16 mx-auto text-purple-500 mb-4" />
          
          <h3 className="text-xl font-bold text-white mb-2">تم استلام طلبك!</h3>
          
          <div className="bg-gray-900 rounded-lg p-4 my-4">
            <span className="text-gray-500 text-sm">رقم التتبع:</span>
            <p className="text-2xl font-mono text-purple-400">{trackingId}</p>
          </div>
          
          {trackingStatus && (
            <div className="space-y-4">
              {/* Progress Bar */}
              <div className="w-full bg-gray-700 rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${trackingStatus.progress || 0}%` }}
                />
              </div>
              
              <p className="text-gray-300">
                {trackingStatus.current_step || 'جاري المعالجة...'}
              </p>
              
              <p className="text-sm text-gray-500">
                الحالة: {trackingStatus.status}
              </p>
              
              {trackingStatus.status === 'completed' && trackingStatus.download_url && (
                <a
                  href={trackingStatus.download_url}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
                >
                  <CheckCircle className="w-5 h-5" />
                  تحميل الحزمة
                </a>
              )}
              
              {trackingStatus.status === 'failed' && (
                <p className="text-red-400">
                  {trackingStatus.error_message || 'حدث خطأ أثناء المعالجة'}
                </p>
              )}
            </div>
          )}
          
          {!trackingStatus && (
            <div className="flex items-center justify-center gap-2 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>جاري بدء المعالجة...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ─────────────────────────────────────────────────────────────
  // Main Render
  // ─────────────────────────────────────────────────────────────
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            🚀 SHADOW-7 Publisher
          </h1>
          <p className="text-gray-400">
            حوّل أفكارك إلى كتاب كامل جاهز للنشر
          </p>
        </div>
        
        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;
            
            return (
              <div key={step.id} className="flex items-center">
                <div className={`
                  flex items-center gap-2 px-4 py-2 rounded-full transition-all
                  ${isActive ? 'bg-purple-500 text-white' : ''}
                  ${isCompleted ? 'bg-green-500/20 text-green-400' : ''}
                  ${!isActive && !isCompleted ? 'bg-gray-800 text-gray-500' : ''}
                `}>
                  <StepIcon className="w-4 h-4" />
                  <span className="hidden md:inline text-sm">{step.title}</span>
                </div>
                
                {index < STEPS.length - 1 && (
                  <div className={`w-8 h-0.5 mx-1 ${isCompleted ? 'bg-green-500' : 'bg-gray-700'}`} />
                )}
              </div>
            );
          })}
        </div>
        
        {/* Step Content */}
        <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/50">
          {currentStep === 0 && renderInputStep()}
          {currentStep === 1 && renderPreferencesStep()}
          {currentStep === 2 && renderReviewStep()}
          {currentStep === 3 && renderTrackingStep()}
        </div>
        
        {/* Navigation */}
        {currentStep < 3 && (
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={prevStep}
              disabled={currentStep === 0}
              className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gray-700 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              السابق
            </button>
            
            {currentStep < 2 ? (
              <button
                onClick={nextStep}
                disabled={!canProceed()}
                className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
              >
                التالي
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="flex items-center gap-2 px-8 py-3 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    جاري الإرسال...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    إرسال للتوليد
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SubmitWizardPage;
