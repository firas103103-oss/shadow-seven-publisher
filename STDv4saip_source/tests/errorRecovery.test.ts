/**
 * Error Recovery Tests
 * Tests for errorRecovery.ts utility functions
 */

import { describe, it, expect, vi } from 'vitest';
import { withErrorRecovery, RecoverableError } from '../utils/errorRecovery';

describe('errorRecovery utilities', () => {
  describe('withErrorRecovery', () => {
    it('should execute function successfully', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');
      const result = await withErrorRecovery(mockFn);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const mockFn = vi.fn()
        .mockRejectedValueOnce(new Error('First attempt'))
        .mockResolvedValueOnce('success');

      const result = await withErrorRecovery(mockFn, { maxRetries: 3 });

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should call onRetry callback', async () => {
      const mockFn = vi.fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValueOnce('success');
      const onRetry = vi.fn();

      await withErrorRecovery(mockFn, { maxRetries: 3, onRetry });

      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
    });

    it('should throw after max retries', async () => {
      const error = new Error('Persistent failure');
      const mockFn = vi.fn().mockRejectedValue(error);

      await expect(
        withErrorRecovery(mockFn, { maxRetries: 2 })
      ).rejects.toThrow('Persistent failure');

      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should use fallback on failure', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Fail'));
      const fallback = () => 'fallback result';

      const result = await withErrorRecovery(mockFn, {
        maxRetries: 1,
        fallback
      });

      expect(result).toBe('fallback result');
    });

    it('should not retry RecoverableError with retryable=false', async () => {
      const error = new RecoverableError('Not retryable', true, false);
      const mockFn = vi.fn().mockRejectedValue(error);
      const fallback = () => 'fallback';

      const result = await withErrorRecovery(mockFn, {
        maxRetries: 3,
        fallback
      });

      expect(result).toBe('fallback');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('RecoverableError', () => {
    it('should create error with default values', () => {
      const error = new RecoverableError('Test error');

      expect(error.message).toBe('Test error');
      expect(error.recoverable).toBe(true);
      expect(error.retryable).toBe(true);
    });

    it('should create error with custom values', () => {
      const error = new RecoverableError('Test', false, false);

      expect(error.recoverable).toBe(false);
      expect(error.retryable).toBe(false);
    });
  });
});
