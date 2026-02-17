import { describe, it, expect } from 'vitest';
import { patternExtractor } from '@/utils/nlp/patternExtractor';

describe('Pattern Extractor', () => {
  it('يجب أن يكتشف أرقام الصفحات', () => {
    const text = 'نص الصفحة\nصفحة 25\nمحتوى النص';
    const result = patternExtractor.extractPageNumbers(text);
    
    expect(result.found).toBe(true);
    expect(result.pages).toContain(25);
  });

  it('يجب أن يكتشف عناوين الفصول', () => {
    const text = 'الفصل الأول\nمحتوى الفصل\nالفصل الثاني\nمحتوى آخر';
    const result = patternExtractor.extractChapters(text);
    
    expect(result.found).toBe(true);
    expect(result.chapters.length).toBe(2);
    expect(result.chapters[0].title).toContain('الفصل الأول');
  });

  it('يجب أن يكتشف جدول المحتويات', () => {
    const text = 'المحتويات\n1. الفصل الأول ......... 5\n2. الفصل الثاني ....... 15';
    const result = patternExtractor.detectTableOfContents(text);
    
    expect(result.hasTOC).toBe(true);
    expect(result.entries.length).toBeGreaterThan(0);
  });

  it('يجب أن يزيل أرقام الصفحات', () => {
    const text = 'نص مهم\nصفحة 10\nنص آخر\n- 15 -\nمزيد من النص';
    const cleaned = patternExtractor.removePageNumbers(text);
    
    expect(cleaned).not.toContain('صفحة 10');
    expect(cleaned).not.toContain('- 15 -');
    expect(cleaned).toContain('نص مهم');
    expect(cleaned).toContain('نص آخر');
  });

  it('يجب أن يتعامل مع أنماط مختلفة من الصفحات', () => {
    const patterns = [
      'صفحة 5',
      '- 10 -',
      '[15]',
      'Page 20',
      '(25)'
    ];
    
    patterns.forEach(pattern => {
      const result = patternExtractor.extractPageNumbers(`نص ${pattern} نص`);
      expect(result.found).toBe(true);
    });
  });

  it('يجب أن يكتشف الرؤوس والتذييلات', () => {
    const text = 'اسم الكتاب\nالمؤلف\n\nنص المحتوى الفعلي هنا\n\nحقوق الطبع محفوظة';
    const result = patternExtractor.detectHeadersFooters(text);
    
    expect(result.hasHeaders).toBe(true);
    expect(result.hasFooters).toBe(true);
  });
});
