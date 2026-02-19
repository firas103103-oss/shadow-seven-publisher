/**
 * Zustand Store Tests
 * Tests for appStore.ts state management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../stores/appStore';
import { ChatStep } from '../types';

describe('appStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useAppStore.setState({
      theme: 'dark',
      language: 'ar',
      currentStep: ChatStep.LANGUAGE_SELECT,
      metadata: {},
      conversationHistory: [],
      sidebarOpen: true,
      isProcessing: false,
    });
  });

  describe('theme management', () => {
    it('should have initial theme', () => {
      const { theme } = useAppStore.getState();
      expect(['dark', 'light', 'cyber']).toContain(theme);
    });

    it('should update theme', () => {
      useAppStore.getState().setTheme('light');
      expect(useAppStore.getState().theme).toBe('light');
    });
  });

  describe('language management', () => {
    it('should have initial language', () => {
      const { language } = useAppStore.getState();
      expect(['ar', 'en']).toContain(language);
    });

    it('should update language', () => {
      useAppStore.getState().setLanguage('en');
      expect(useAppStore.getState().language).toBe('en');
    });
  });

  describe('sidebar management', () => {
    it('should have sidebar state', () => {
      const { sidebarOpen } = useAppStore.getState();
      expect(typeof sidebarOpen).toBe('boolean');
    });

    it('should toggle sidebar state', () => {
      const initialState = useAppStore.getState().sidebarOpen;
      useAppStore.getState().setSidebarOpen(!initialState);
      expect(useAppStore.getState().sidebarOpen).toBe(!initialState);
    });
  });

  describe('conversation management', () => {
    it('should have initial step', () => {
      const { currentStep } = useAppStore.getState();
      expect(currentStep).toBe(ChatStep.LANGUAGE_SELECT);
    });

    it('should update metadata', () => {
      useAppStore.getState().updateMetadata({ title: 'Test Book' });
      expect(useAppStore.getState().metadata.title).toBe('Test Book');
    });

    it('should go to step', () => {
      useAppStore.getState().goToStep(ChatStep.TITLE);
      expect(useAppStore.getState().currentStep).toBe(ChatStep.TITLE);
    });

    it('should track history when changing steps', () => {
      useAppStore.getState().goToStep(ChatStep.TITLE);
      const { conversationHistory } = useAppStore.getState();
      expect(conversationHistory.length).toBeGreaterThan(0);
    });

    it('should go back to previous step', () => {
      useAppStore.getState().goToStep(ChatStep.TITLE);
      useAppStore.getState().goToStep(ChatStep.GENRE);
      useAppStore.getState().goBack();
      expect(useAppStore.getState().currentStep).toBe(ChatStep.TITLE);
    });

    it('should reset conversation', () => {
      useAppStore.getState().updateMetadata({ title: 'Test' });
      useAppStore.getState().goToStep(ChatStep.TITLE);
      useAppStore.getState().resetConversation();

      const state = useAppStore.getState();
      expect(state.currentStep).toBe(ChatStep.LANGUAGE_SELECT);
      expect(state.metadata).toEqual({});
      expect(state.conversationHistory).toEqual([]);
    });
  });

  describe('processing state', () => {
    it('should not be processing initially', () => {
      const { isProcessing } = useAppStore.getState();
      expect(isProcessing).toBe(false);
    });

    it('should update processing state', () => {
      useAppStore.getState().setProcessing(true);
      expect(useAppStore.getState().isProcessing).toBe(true);
    });
  });
});
