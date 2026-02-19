import { create } from 'zustand';
import { BookMetadata, ChatStep, Language } from '../types';

interface AppState {
  // Theme
  theme: 'dark' | 'light' | 'cyber';
  setTheme: (theme: 'dark' | 'light' | 'cyber') => void;

  // Language
  language: Language;
  setLanguage: (language: Language) => void;

  // Conversation State
  currentStep: ChatStep;
  metadata: Partial<BookMetadata>;
  conversationHistory: ChatStep[];

  // Actions
  goToStep: (step: ChatStep) => void;
  updateMetadata: (updates: Partial<BookMetadata>) => void;
  goBack: () => void;
  resetConversation: () => void;

  // UI State
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;

  // Processing
  isProcessing: boolean;
  setProcessing: (processing: boolean) => void;
}

export const useAppStore = create<AppState>()((set, get) => ({
  // Initial State
  theme: (typeof window !== 'undefined' && localStorage.getItem('x-book-theme') as any) || 'cyber',
  language: (typeof window !== 'undefined' && localStorage.getItem('x-book-language') as Language) || 'ar',
  currentStep: ChatStep.LANGUAGE_SELECT,
  metadata: {},
  conversationHistory: [],
  sidebarOpen: true,
  isProcessing: false,

  // Actions
  setTheme: (theme) => {
    set({ theme });
    if (typeof window !== 'undefined') {
      localStorage.setItem('x-book-theme', theme);
    }
  },

  setLanguage: (language) => {
    set({ language });
    if (typeof window !== 'undefined') {
      localStorage.setItem('x-book-language', language);
    }
  },

  goToStep: (step) => set((state) => ({
    currentStep: step,
    conversationHistory: [...state.conversationHistory, state.currentStep]
  })),

  updateMetadata: (updates) => set((state) => ({
    metadata: { ...state.metadata, ...updates }
  })),

  goBack: () => {
    const { conversationHistory } = get();
    if (conversationHistory.length > 0) {
      const previousStep = conversationHistory[conversationHistory.length - 1];
      set({
        currentStep: previousStep,
        conversationHistory: conversationHistory.slice(0, -1)
      });
    }
  },

  resetConversation: () => set({
    currentStep: ChatStep.LANGUAGE_SELECT,
    metadata: {},
    conversationHistory: []
  }),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setProcessing: (processing) => set({ isProcessing: processing })
}));
