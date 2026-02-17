import { describe, it, expect } from 'vitest';
import { arabicTokenizer } from '@/utils/nlp/arabicTokenizer';

describe('Arabic Tokenizer', () => {
  it('يجب أن يقسم النص العربي إلى كلمات', () => {
    const text = 'هذا نص عربي للاختبار';
    const tokens = arabicTokenizer.tokenize(text);
    
    expect(tokens).toContain('هذا');
    expect(tokens).toContain('نص');
    expect(tokens).toContain('عربي');
    expect(tokens).toContain('للاختبار');
  });

  it('يجب أن يزيل التشكيل بشكل صحيح', () => {
    const text = 'كِتَابٌ جَمِيلٌ';
    const normalized = arabicTokenizer.normalize(text);
    
    expect(normalized).toBe('كتاب جميل');
    expect(normalized).not.toContain('َ');
    expect(normalized).not.toContain('ٌ');
  });

  it('يجب أن يتعامل مع النص الفارغ', () => {
    const tokens = arabicTokenizer.tokenize('');
    expect(tokens).toEqual([]);
  });

  it('يجب أن يتعامل مع المسافات الزائدة', () => {
    const text = 'كلمة    أولى     ثانية';
    const tokens = arabicTokenizer.tokenize(text);
    
    expect(tokens).toEqual(['كلمة', 'أولى', 'ثانية']);
  });

  it('يجب أن يتعامل مع علامات الترقيم', () => {
    const text = 'السلام عليكم! كيف حالك؟';
    const tokens = arabicTokenizer.tokenize(text);
    
    expect(tokens).toContain('السلام');
    expect(tokens).toContain('عليكم');
    expect(tokens).not.toContain('!');
    expect(tokens).not.toContain('؟');
  });

  it('يجب أن يحسب الإحصائيات بشكل صحيح', () => {
    const text = 'هذا نص قصير للاختبار. نص ثاني.';
    const stats = arabicTokenizer.getStats(text);
    
    expect(stats.words).toBeGreaterThan(0);
    expect(stats.characters).toBeGreaterThan(0);
    expect(stats.sentences).toBe(2);
  });

  it('يجب أن يكتشف الكلمات المفتاحية', () => {
    const text = 'الذكاء الاصطناعي مهم. الذكاء الاصطناعي يتطور.';
    const keywords = arabicTokenizer.extractKeywords(text, 2);
    
    expect(keywords).toContain('الذكاء');
    expect(keywords).toContain('الاصطناعي');
  });
});
