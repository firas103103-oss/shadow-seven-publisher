import { validateLanguageIntegrity } from "@/utils/LanguageValidator";

/**
 * معايير النشر الاحترافية - محدث 2026
 */
export const PUBLISHING_STANDARDS = {
  // معايير عدد الكلمات حسب النوع
  WORD_COUNT_RANGES: {
    'رواية': { min: 50000, max: 120000, optimal: 80000 },
    'قصة قصيرة': { min: 1000, max: 7500, optimal: 3500 },
    'شعر': { min: 500, max: 20000, optimal: 5000 },
    'بحث علمي': { min: 5000, max: 50000, optimal: 15000 },
    'تاريخ': { min: 40000, max: 100000, optimal: 60000 },
    'دين': { min: 20000, max: 80000, optimal: 40000 },
  },
  
  // معايير الجودة
  QUALITY_THRESHOLDS: {
    language_consistency: 85, // الحد الأدنى للتناسق اللغوي
    thematic_unity: 75,      // الحد الأدنى للوحدة الموضوعية
    repetition_rate: 15,     // الحد الأقصى للتكرار
  },
  
  // معايير التقسيم
  CHAPTER_STANDARDS: {
    min_chapters: 2,
    max_chapters: 13,
    optimal_words_per_chapter: 6000,
    min_words_per_chapter: 2000,
  },
  
  // معايير الصفحات
  PAGE_STANDARDS: {
    words_per_page: 250,
    characters_per_line: 65,
    lines_per_page: 30,
  }
};

/**
 * التحقق من مطابقة المعايير
 */
export function validatePublishingStandards(manuscriptData) {
  const issues = [];
  const warnings = [];
  const recommendations = [];
  
  const { word_count, genre, chapters, quality_metrics, content } = manuscriptData;
  
  // ✅ 0. التحقق من سلامة اللغة (جديد)
  if (content) {
    const languageCheck = validateLanguageIntegrity(content);
    if (!languageCheck.passed) {
      issues.push(...languageCheck.issues.map(i => `🔤 ${i}`));
      warnings.push(...languageCheck.warnings.map(w => `⚠️ ${w}`));
    }
    if (languageCheck.score < 70) {
      issues.push(`درجة سلامة اللغة منخفضة: ${languageCheck.score}/100`);
    }
  }
  
  // 1. التحقق من عدد الكلمات
  if (genre && PUBLISHING_STANDARDS.WORD_COUNT_RANGES[genre]) {
    const range = PUBLISHING_STANDARDS.WORD_COUNT_RANGES[genre];
    if (word_count < range.min) {
      issues.push(`عدد الكلمات (${word_count.toLocaleString()}) أقل من الحد الأدنى لنوع "${genre}" (${range.min.toLocaleString()})`);
    } else if (word_count > range.max) {
      warnings.push(`عدد الكلمات (${word_count.toLocaleString()}) يتجاوز الحد المعتاد لنوع "${genre}" (${range.max.toLocaleString()})`);
    } else if (Math.abs(word_count - range.optimal) > range.optimal * 0.3) {
      recommendations.push(`للحصول على أفضل نتيجة، يُفضل أن يكون العدد قريباً من ${range.optimal.toLocaleString()} كلمة`);
    }
  }
  
  // 2. التحقق من جودة النص
  if (quality_metrics) {
    if (quality_metrics.language_consistency < PUBLISHING_STANDARDS.QUALITY_THRESHOLDS.language_consistency) {
      issues.push(`التناسق اللغوي منخفض (${quality_metrics.language_consistency.toFixed(0)}%). يجب مراجعة النص`);
    }
    
    if (quality_metrics.thematic_unity < PUBLISHING_STANDARDS.QUALITY_THRESHOLDS.thematic_unity) {
      warnings.push(`الوحدة الموضوعية منخفضة (${quality_metrics.thematic_unity.toFixed(0)}%). قد يحتاج النص لإعادة هيكلة`);
    }
    
    if (quality_metrics.repetition_rate > PUBLISHING_STANDARDS.QUALITY_THRESHOLDS.repetition_rate) {
      warnings.push(`نسبة التكرار عالية (${quality_metrics.repetition_rate.toFixed(0)}%). يُنصح بمراجعة المحتوى`);
    }
  }
  
  // 3. التحقق من الفصول
  if (chapters && chapters.length > 0) {
    if (chapters.length < PUBLISHING_STANDARDS.CHAPTER_STANDARDS.min_chapters) {
      recommendations.push(`عدد الفصول قليل (${chapters.length}). يُفضل تقسيم أكثر للمحتوى`);
    } else if (chapters.length > PUBLISHING_STANDARDS.CHAPTER_STANDARDS.max_chapters) {
      recommendations.push(`عدد الفصول كبير (${chapters.length}). قد يُفضل دمج بعض الفصول`);
    }
    
    // التحقق من توازن الفصول
    const chapterWordCounts = chapters.map(ch => ch.word_count || 0);
    const maxWords = Math.max(...chapterWordCounts);
    const minWords = Math.min(...chapterWordCounts);
    
    if (maxWords / minWords > 3) {
      warnings.push(`عدم توازن في أطوال الفصول (${minWords.toLocaleString()} - ${maxWords.toLocaleString()} كلمة)`);
    }
    
    if (minWords < PUBLISHING_STANDARDS.CHAPTER_STANDARDS.min_words_per_chapter) {
      warnings.push(`بعض الفصول قصيرة جداً (أقل من ${PUBLISHING_STANDARDS.CHAPTER_STANDARDS.min_words_per_chapter.toLocaleString()} كلمة)`);
    }
  }
  
  return {
    passed: issues.length === 0,
    issues,
    warnings,
    recommendations,
    quality_score: calculateQualityScore(manuscriptData)
  };
}

/**
 * حساب درجة الجودة الإجمالية
 */
function calculateQualityScore(manuscriptData) {
  const { quality_metrics, word_count, genre, chapters } = manuscriptData;
  let score = 100;
  
  // خصم النقاط بناءً على المشاكل
  if (quality_metrics) {
    if (quality_metrics.language_consistency < 85) score -= 15;
    else if (quality_metrics.language_consistency < 90) score -= 5;
    
    if (quality_metrics.thematic_unity < 75) score -= 10;
    else if (quality_metrics.thematic_unity < 85) score -= 5;
    
    if (quality_metrics.repetition_rate > 20) score -= 15;
    else if (quality_metrics.repetition_rate > 15) score -= 5;
  }
  
  // مكافأة التوافق مع المعايير
  if (genre && PUBLISHING_STANDARDS.WORD_COUNT_RANGES[genre]) {
    const range = PUBLISHING_STANDARDS.WORD_COUNT_RANGES[genre];
    if (word_count >= range.min && word_count <= range.max) {
      score += 5;
    }
  }
  
  if (chapters && chapters.length >= 2 && chapters.length <= 13) {
    score += 5;
  }
  
  // ✅ مكافأة سلامة اللغة (جديد)
  if (manuscriptData.language_validation?.score >= 90) {
    score += 10;
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * توليد تقرير مفصل للنشر
 */
export async function generatePublishingReport(manuscriptData) {
  const validation = validatePublishingStandards(manuscriptData);
  
  // Report generation would call an API or AI service
  
  return {
    ...validation,
    professional_assessment: null,
    generated_at: new Date().toISOString()
  };
}

/**
 * اقتراح تحسينات تلقائية
 */
export async function suggestImprovements(manuscriptData, analysisResults) {
  const issues = [];
  
  // تحليل الفجوات في المحتوى
  if (analysisResults.difference_percentage > 40) {
    if (analysisResults.final_word_count < analysisResults.original_word_count) {
      issues.push({
        type: 'word_count_deficit',
        severity: 'high',
        description: `نقص في عدد الكلمات بنسبة ${analysisResults.difference_percentage.toFixed(1)}%`,
        suggestion: 'توليد محتوى تكميلي'
      });
    }
  }
  
  // تحليل توزيع الفصول
  if (manuscriptData.chapters) {
    const wordCounts = manuscriptData.chapters.map(ch => ch.word_count || 0);
    const avg = wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length;
    const std = Math.sqrt(wordCounts.reduce((sq, n) => sq + Math.pow(n - avg, 2), 0) / wordCounts.length);
    
    if (std / avg > 0.5) {
      issues.push({
        type: 'chapter_imbalance',
        severity: 'medium',
        description: 'عدم توازن كبير في أطوال الفصول',
        suggestion: 'إعادة توزيع المحتوى بين الفصول'
      });
    }
  }
  
  return issues;
}