/**
 * Text Analyzer Enhanced - محسّن بمعالجة محلية + نظام الوكلاء
 * يستخدم NLP المحلي + الوكلاء المتخصصين لجودة دور النشر
 */

import { gemini } from "@/api/geminiClient";
import cacheManager from "@/lib/cache/CacheManager";
import { ChunkProcessor } from "@/utils/ChunkProcessor";
import { validateLanguageIntegrity } from "@/utils/LanguageValidator";

// استيراد وحدات NLP المحلية
import {
  getTextStats,
  wordCount as countWords,
  detectLanguage
} from "@/utils/nlp/arabicTokenizer";

import {
  quickAnalyze,
  extractChapters,
  extractPageNumbers,
  extractTableOfContents
} from "@/utils/nlp/patternExtractor";

import {
  classifyContent,
  classifyParagraphs,
  detectIrrelevant
} from "@/utils/nlp/contentClassifier";

import {
  generateDuplicateReport,
  removeDuplicates
} from "@/utils/nlp/duplicateDetector";

import {
  smartDivideChapters
} from "@/utils/nlp/chapterDivider";

/**
 * تحليل وتنظيف النص - نسخة محسّنة
 */
export async function analyzeAndCleanText(rawContent, language = 'ar', logger = null) {
  if (!rawContent || rawContent.trim().length === 0) {
    throw new Error('النص المدخل فارغ');
  }

  // 1. حساب عدد الكلمات
  const initialWordCount = countWords(rawContent);
  
  if (initialWordCount > 200000) {
    throw new Error('عدد الكلمات يتجاوز الحد الأقصى المسموح (200,000 كلمة)');
  }
  
  logger?.start?.('text_analysis', { wordCount: initialWordCount, language });

  // 2. تحقق من Cache
  const cacheKey = { 
    content: rawContent.substring(0, 1000), 
    language,
    wordCount: initialWordCount
  };
  
  const cached = await cacheManager.get('text_analysis', cacheKey);
  if (cached) {
    logger?.complete?.('text_analysis', { source: 'cache' });
    return cached.data;
  }

  // ===== المرحلة 1: تحليل سريع محلي (بدون LLM) =====
  logger?.progress?.('quick_analysis', { stage: 'local_nlp' });
  
  // 1.1 تحليل البنية
  const structureAnalysis = quickAnalyze(rawContent);
  
  // 1.2 كشف اللغة
  const detectedLanguage = detectLanguage(rawContent);
  
  // 1.3 إحصائيات النص
  const stats = getTextStats(rawContent);
  
  // 1.4 تقرير التكرار
  const duplicateReport = generateDuplicateReport(rawContent);
  
  // 1.5 تصنيف الفقرات
  const classifications = classifyParagraphs(rawContent);
  
  // 1.6 كشف المحتوى غير ذي الصلة
  const irrelevantContent = detectIrrelevant(rawContent, classifications);

  logger?.complete?.('quick_analysis', { 
    localProcessing: true,
    chapters: structureAnalysis.chapters.length,
    pages: structureAnalysis.pages.length,
    duplicateRate: duplicateReport.repetitionRate
  });

  // ===== المرحلة 2: معالجة الملفات الكبيرة (>50k كلمة) =====
  let processedInChunks = false;
  let chunkResults = null;
  
  if (initialWordCount > 50000) {
    logger?.start?.('chunk_processing', { words: initialWordCount });
    
    const processor = new ChunkProcessor(10000);
    const chunks = processor.chunkText(rawContent);
    
    logger?.progress?.('chunk_processing', { 
      stage: 'parallel_processing',
      chunks: chunks.length
    });
    
    const result = await processor.processParallel(
      chunks,
      async (chunk, index) => {
        // معالجة محلية لكل chunk
        return {
          chapters: extractChapters(chunk.text),
          pages: extractPageNumbers(chunk.text),
          classification: classifyContent(chunk.text),
          stats: getTextStats(chunk.text)
        };
      },
      {
        concurrency: 3,
        onProgress: (progress) => {
          logger?.progress?.('chunk_processing', {
            ...progress,
            stage: 'processing_chunks'
          });
        }
      }
    );
    
    chunkResults = processor.mergeResults(result.results, 'analysis');
    processedInChunks = true;
    
    logger?.complete?.('chunk_processing', {
      chunks: chunks.length,
      successRate: result.summary.successRate
    });
  }

  // ===== المرحلة 3: تنظيف النص =====
  logger?.start?.('text_cleaning', {});
  
  // 3.1 إزالة أرقام الصفحات
  let cleanedText = rawContent;
  structureAnalysis.pages.forEach(page => {
    const regex = new RegExp(page.match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    cleanedText = cleanedText.replace(regex, '');
  });
  
  // 3.2 إزالة جداول المحتويات
  if (structureAnalysis.toc.length > 0) {
    structureAnalysis.toc.forEach(toc => {
      const lines = cleanedText.split('\n');
      lines.splice(toc.startLine, toc.endLine - toc.startLine + 1);
      cleanedText = lines.join('\n');
    });
  }
  
  // 3.3 إزالة التكرار (إذا كان أكثر من 20%)
  if (duplicateReport.repetitionRate > 20) {
    logger?.progress?.('text_cleaning', { stage: 'removing_duplicates' });
    cleanedText = removeDuplicates(cleanedText, 0.8);
  }
  
  // 3.4 إزالة المحتوى غير ذي الصلة (استخدم LLM فقط إذا كان هناك محتوى كثير)
  if (irrelevantContent.length > 5 && irrelevantContent.length / classifications.length > 0.1) {
    logger?.progress?.('text_cleaning', { stage: 'removing_irrelevant_llm' });
    
    const cleaningPrompt = `نظّف النص التالي من المحتوى غير ذي الصلة. تم الكشف عن ${irrelevantContent.length} فقرة غير ذات صلة.

احذف فقط:
- الأكواد البرمجية
- المحادثات من مصادر أخرى
- النصوص من كتب أخرى

احتفظ بـ:
- كل المحتوى السردي
- الحوارات الأصلية
- الأوصاف

النص:
---
${cleanedText.substring(0, 80000)}
---`;

    const cleaningResult = await gemini.invokeLLM({
      messages: [{ role: 'user', content: cleaningPrompt }],
      temperature: 0.3,
      max_tokens: 80000
    });
    cleanedText = cleaningResult.output;
    
    // ✅ التحقق من سلامة اللغة بعد التنظيف
    const languageCheck = validateLanguageIntegrity(cleanedText, rawContent);
    if (!languageCheck.passed) {
      console.warn('⚠️ تحذير: مشاكل لغوية بعد التنظيف:', languageCheck.issues);
      logger?.progress?.('text_cleaning', { 
        warning: 'language_issues',
        issues: languageCheck.issues 
      });
    }
  }
  
  // ✅ التحقق من نسبة التغيير
  const cleanedWordCount = countWords(cleanedText);
  const wordPreservationRate = (cleanedWordCount / initialWordCount) * 100;
  
  // تحذير إذا تم حذف أكثر من 40%
  if (wordPreservationRate < 60) {
    logger?.warn?.('excessive_deletion', {
      original: initialWordCount,
      cleaned: cleanedWordCount,
      preservationRate: wordPreservationRate.toFixed(1)
    });
  }
  
  logger?.complete?.('text_cleaning', { 
    cleanedWordCount,
    deletedWords: initialWordCount - cleanedWordCount,
    preservationRate: wordPreservationRate.toFixed(1) + '%'
  });

  // ===== المرحلة 4: تقسيم الفصول =====
  logger?.start?.('chapter_division', {});
  
  // استخدم الخوارزمية المحلية الذكية
  const chapterDivision = smartDivideChapters(cleanedText, {
    minChapters: 2,
    maxChapters: 13,
    targetWordsPerChapter: 6000,
    preserveExisting: true
  });
  
  // إذا لم تنجح الخوارزمية المحلية، استخدم LLM
  let finalChapters = chapterDivision.chapters;
  
  if (chapterDivision.method === 'smart' && chapterDivision.actualChapters < 2) {
    logger?.progress?.('chapter_division', { stage: 'llm_fallback' });
    
    const chapterPrompt = `قسّم النص التالي إلى فصول (2-13 فصل):

النص (${cleanedWordCount} كلمة):
---
${cleanedText.substring(0, 100000)}
---

أعد JSON:
{
  "chapters": [
    {
      "number": 1,
      "title": "عنوان الفصل",
      "start_position": 0,
      "end_position": 500,
      "summary": "ملخص قصير"
    }
  ]
}`;

    const llmResult = await gemini.invokeLLM({
      messages: [{ role: 'user', content: chapterPrompt }],
      temperature: 0.5,
      max_tokens: 4000
    });
    
    // استخراج JSON من الرد
    const llmResponse = llmResult.output;
    const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
    const llmChapters = jsonMatch ? JSON.parse(jsonMatch[0]) : { chapters: [] };
    
    finalChapters = llmChapters.chapters || [];
  }
  
  logger?.complete?.('chapter_division', {
    method: chapterDivision.method,
    chaptersCount: finalChapters.length
  });

  // ===== المرحلة 5: تعويض النقص (إذا لزم الأمر) =====
  logger?.start?.('content_compensation', {});
  
  // تحقق من معايير النشر
  const wordDeficit = 50000 - cleanedWordCount; // هدف: 50k كلمة على الأقل
  
  let compensatedText = cleanedText;
  if (wordDeficit > 5000 && wordDeficit < 15000) {
    logger?.progress?.('content_compensation', { 
      stage: 'llm_generation',
      deficit: wordDeficit
    });
    
    const compensationPrompt = `أنت كاتب محترف. النص الحالي يحتوي على ${cleanedWordCount} كلمة ويحتاج إلى ${wordDeficit} كلمة إضافية.

أضف محتوى طبيعياً يتماشى مع النص دون إضافة مشاهد جديدة:
- وسّع الأوصاف الموجودة
- أضف تفاصيل للشخصيات
- طوّر الحوارات قليلاً

النص الحالي:
---
${cleanedText.substring(0, 50000)}
---

أعد النص كاملاً مع التحسينات.`;

    const compensationResult = await gemini.invokeLLM({
      messages: [{ role: 'user', content: compensationPrompt }],
      temperature: 0.8,
      max_tokens: 20000
    });
    compensatedText = compensationResult.output;
  }
  
  const finalWordCount = countWords(compensatedText);
  logger?.complete?.('content_compensation', { finalWordCount });

  // ===== النتيجة النهائية =====
  const result = {
    // النص النهائي
    cleaned_text: compensatedText,
    
    // الإحصائيات
    statistics: {
      original_word_count: initialWordCount,
      cleaned_word_count: cleanedWordCount,
      final_word_count: finalWordCount,
      words_removed: initialWordCount - cleanedWordCount,
      words_added: finalWordCount - cleanedWordCount,
      preservation_rate: ((cleanedWordCount / initialWordCount) * 100).toFixed(1) + '%',
      ...stats
    },
    
    // التحليل البنيوي
    structure: {
      detected_language: detectedLanguage,
      chapters_found: structureAnalysis.chapters.length,
      pages_removed: structureAnalysis.pages.length,
      toc_sections_removed: structureAnalysis.toc.length,
      headers: structureAnalysis.headers.length,
      processed_in_chunks: processedInChunks,
      chunk_results: chunkResults
    },
    
    // تقييم الجودة
    quality: {
      repetition_rate: duplicateReport.repetitionRate.toFixed(1) + '%',
      duplicate_paragraphs: duplicateReport.duplicateParagraphs.length,
      repeated_sentences: duplicateReport.repeatedSentences.length,
      irrelevant_content_count: irrelevantContent.length,
      main_content_type: getMostCommonType(classifications)
    },
    
    // الفصول
    chapters: finalChapters,
    
    // التصنيفات
    classifications: classifications.slice(0, 20), // أول 20 فقرة
    
    // التوصيات
    recommendations: generateRecommendations(
      initialWordCount,
      finalWordCount,
      duplicateReport.repetitionRate,
      irrelevantContent.length
    ),
    
    // البيانات الوصفية
    metadata: {
      analysis_method: processedInChunks ? 'chunked_local_nlp' : 'local_nlp',
      llm_calls: getUsedLLMCalls(irrelevantContent.length, chapterDivision.method, wordDeficit),
      processing_date: new Date().toISOString(),
      version: '2.0-enhanced'
    }
  };

  // حفظ في Cache
  await cacheManager.set('text_analysis', cacheKey, result, {
    persist: true,
    dbTTL: 24 * 60 * 60 * 1000 // 24 ساعة
  });

  logger?.complete?.('text_analysis', {
    finalWordCount,
    chaptersCount: finalChapters.length,
    method: result.metadata.analysis_method
  });

  return result;
}

/**
 * تحليل سريع للملف (بدون تنظيف)
 */
export async function quickFileAnalysis(rawContent) {
  const stats = getTextStats(rawContent);
  const structure = quickAnalyze(rawContent);
  const language = detectLanguage(rawContent);
  const duplicates = generateDuplicateReport(rawContent);
  const classification = classifyContent(rawContent.substring(0, 10000));
  
  return {
    word_count: stats.words,
    estimated_pages: Math.ceil(stats.words / 250),
    language,
    detected_chapters: structure.chapters.length,
    detected_pages: structure.pages.length,
    has_toc: structure.toc.length > 0,
    repetition_rate: duplicates.repetitionRate,
    content_type: classification.type,
    processing_estimate: stats.words > 50000 ? 'large_file' : 'normal',
    recommendations: stats.words > 200000 
      ? ['الملف كبير جداً - تجاوز 200k كلمة'] 
      : stats.words < 10000 
        ? ['الملف صغير جداً - أقل من 10k كلمة']
        : ['الملف مناسب للمعالجة']
  };
}

/**
 * دوال مساعدة
 */
function getMostCommonType(classifications) {
  const typeCounts = {};
  classifications.forEach(c => {
    typeCounts[c.type] = (typeCounts[c.type] || 0) + 1;
  });
  
  return Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';
}

function generateRecommendations(original, final, repetitionRate, irrelevantCount) {
  const recommendations = [];
  
  if (repetitionRate > 15) {
    recommendations.push('نسبة التكرار عالية - تم تنظيف التكرار');
  }
  
  if (irrelevantCount > 10) {
    recommendations.push('تم الكشف عن محتوى غير ذي صلة - تم إزالته');
  }
  
  const preservationRate = (final / original) * 100;
  if (preservationRate < 70) {
    recommendations.push('تم حذف أكثر من 30% من المحتوى - راجع النتيجة');
  }
  
  if (final < 30000) {
    recommendations.push('عدد الكلمات أقل من المثالي (30k) - قد تحتاج إلى تعويض');
  }
  
  return recommendations.length > 0 ? recommendations : ['النص جاهز للنشر'];
}

function getUsedLLMCalls(irrelevantCount, chapterMethod, wordDeficit) {
  let calls = 0;
  
  // تنظيف المحتوى غير ذي الصلة
  if (irrelevantCount > 5) calls++;
  
  // تقسيم الفصول
  if (chapterMethod !== 'existing') calls++;
  
  // تعويض النقص
  if (wordDeficit > 5000 && wordDeficit < 15000) calls++;
  
  return calls;
}

export default { analyzeAndCleanText, quickFileAnalysis };
