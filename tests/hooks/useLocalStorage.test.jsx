import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from '@/hooks/useLocalStorage';

describe('useLocalStorage Hook', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('يجب أن يحفظ ويسترجع القيمة من localStorage', () => {
    const { result } = renderHook(() => useLocalStorage('testKey', 'قيمة افتراضية'));
    
    expect(result.current[0]).toBe('قيمة افتراضية');
    
    act(() => {
      result.current[1]('قيمة جديدة');
    });
    
    expect(result.current[0]).toBe('قيمة جديدة');
    expect(localStorage.getItem('testKey')).toBe(JSON.stringify('قيمة جديدة'));
  });

  it('يجب أن يسترجع قيمة موجودة من localStorage', () => {
    localStorage.setItem('existingKey', JSON.stringify('قيمة محفوظة'));
    
    const { result } = renderHook(() => useLocalStorage('existingKey', 'افتراضي'));
    
    expect(result.current[0]).toBe('قيمة محفوظة');
  });

  it('يجب أن يتعامل مع objects', () => {
    const { result } = renderHook(() => useLocalStorage('objectKey', { name: 'سيادي' }));
    
    expect(result.current[0]).toEqual({ name: 'سيادي' });
    
    act(() => {
      result.current[1]({ name: 'منصة سيادي', version: '4.0' });
    });
    
    expect(result.current[0]).toEqual({ name: 'منصة سيادي', version: '4.0' });
  });

  it('يجب أن يحذف القيمة عند تمرير undefined', () => {
    const { result } = renderHook(() => useLocalStorage('removeKey', 'قيمة'));
    
    act(() => {
      result.current[1](undefined);
    });
    
    expect(localStorage.getItem('removeKey')).toBeNull();
  });

  it('يجب أن يتعامل مع function updater', () => {
    const { result } = renderHook(() => useLocalStorage('counterKey', 0));
    
    act(() => {
      result.current[1]((prev) => prev + 1);
    });
    
    expect(result.current[0]).toBe(1);
    
    act(() => {
      result.current[1]((prev) => prev + 5);
    });
    
    expect(result.current[0]).toBe(6);
  });
});
