/**
 * Text Chunking Utility Tests
 * Tests for textChunking.ts utility functions
 */

import { describe, it, expect } from 'vitest';
import { chunkTextSmart } from '../utils/textChunking';

describe('textChunking utilities', () => {
  describe('chunkTextSmart', () => {
    it('should return single chunk for short text', () => {
      const text = 'This is a short text.';
      const chunks = chunkTextSmart(text, 1000);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].text).toBe(text);
      expect(chunks[0].metadata.totalChunks).toBe(1);
    });

    it('should split long text into multiple chunks', () => {
      const text = 'A'.repeat(100000);
      const chunks = chunkTextSmart(text, 30000, 500);

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        expect(chunk.text.length).toBeLessThanOrEqual(30000 + 1000); // maxSize + overlap buffer
      });
    });

    it('should include metadata for each chunk', () => {
      const text = 'Test paragraph one.\n\nTest paragraph two.\n\n' + 'C'.repeat(80000);
      const chunks = chunkTextSmart(text, 40000);

      chunks.forEach((chunk, index) => {
        expect(chunk.metadata.index).toBe(index);
        expect(chunk.metadata.totalChunks).toBe(chunks.length);
        expect(typeof chunk.metadata.startPosition).toBe('number');
        expect(typeof chunk.metadata.endPosition).toBe('number');
      });
    });

    it('should handle empty text', () => {
      const chunks = chunkTextSmart('', 1000);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].text).toBe('');
    });

    it('should preserve text integrity', () => {
      const text = 'First paragraph.\n\nSecond paragraph.\n\n' + 'X'.repeat(80000);
      const chunks = chunkTextSmart(text, 50000, 100);

      // Reconstruct text from chunks (without overlaps)
      const reconstructed = chunks.map(c => c.text).join('');
      expect(reconstructed.length).toBeGreaterThanOrEqual(text.length);
    });

    it('should use custom chunk size and overlap', () => {
      const text = 'A'.repeat(10000);
      const chunks = chunkTextSmart(text, 3000, 200);

      expect(chunks.length).toBeGreaterThan(2);
      // Each chunk should be close to maxChunkSize
      chunks.slice(0, -1).forEach(chunk => {
        expect(chunk.text.length).toBeGreaterThan(2800);
      });
    });

    it('should handle Arabic text', () => {
      const arabicText = 'مرحبا بك في X-Book. '.repeat(10000);
      const chunks = chunkTextSmart(arabicText, 50000, 500);

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        expect(chunk.text.length).toBeGreaterThan(0);
      });
    });
  });
});
