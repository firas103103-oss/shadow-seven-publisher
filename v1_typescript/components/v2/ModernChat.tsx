import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../stores/appStore';
import { Send, Upload, Loader2, Paperclip, Mic, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  attachments?: Array<{
    name: string;
    size: number;
    type: string;
  }>;
}

interface ModernChatProps {
  messages: ChatMessage[];
  onSendMessage: (content: string, files?: File[]) => void;
  isProcessing?: boolean;
  placeholder?: string;
}

export const ModernChat: React.FC<ModernChatProps> = ({
  messages,
  onSendMessage,
  isProcessing = false,
  placeholder
}) => {
  const { theme, language } = useAppStore();
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const translations = {
    ar: {
      placeholder: placeholder || 'اكتب رسالتك هنا...',
      send: 'إرسال',
      upload: 'إرفاق ملف',
      processing: 'جاري المعالجة...'
    },
    en: {
      placeholder: placeholder || 'Type your message...',
      send: 'Send',
      upload: 'Attach file',
      processing: 'Processing...'
    },
    de: {
      placeholder: placeholder || 'Nachricht eingeben...',
      send: 'Senden',
      upload: 'Datei anhängen',
      processing: 'Verarbeitung läuft...'
    }
  };

  const t = translations[language] || translations.ar;

  const handleSend = () => {
    if (!input.trim() && files.length === 0) return;

    onSendMessage(input, files);
    setInput('');
    setFiles([]);

    // Scroll to bottom
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles([...files, ...newFiles]);
      toast.success(`${newFiles.length} ${language === 'ar' ? 'ملف مضاف' : 'files added'}`);
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'user':
        return theme === 'cyber'
          ? 'bg-gradient-to-r from-cyan-500 to-blue-500'
          : 'bg-blue-500';
      case 'assistant':
        return theme === 'cyber'
          ? 'bg-gradient-to-r from-purple-500 to-pink-500'
          : 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <AnimatePresence>
          {messages.map((message, index) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: index * 0.05 }}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] ${
                  message.role === 'user'
                    ? `${getRoleColor(message.role)} text-white`
                    : theme === 'cyber'
                    ? 'bg-slate-800/50 backdrop-blur-xl border border-cyan-500/30'
                    : theme === 'dark'
                    ? 'bg-slate-800'
                    : 'bg-slate-100'
                } rounded-2xl px-4 py-3 shadow-lg`}
              >
                <div className="text-sm mb-1 opacity-70">
                  {message.role === 'user'
                    ? language === 'ar' ? 'أنت' : 'You'
                    : language === 'ar' ? 'المساعد' : 'Assistant'}
                </div>
                <div className="whitespace-pre-wrap">{message.content}</div>

                {message.attachments && message.attachments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {message.attachments.map((att, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-xs opacity-70"
                      >
                        <Paperclip className="w-3 h-3" />
                        <span>{att.name}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="text-xs opacity-50 mt-2">
                  {new Date(message.timestamp).toLocaleTimeString(language, {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className={`rounded-2xl px-4 py-3 ${
              theme === 'cyber'
                ? 'bg-slate-800/50 backdrop-blur-xl border border-purple-500/30'
                : 'bg-slate-800'
            }`}>
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                <span>{t.processing}</span>
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* File Attachments Preview */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className={`px-6 py-3 border-t ${
              theme === 'cyber'
                ? 'bg-slate-900/50 border-cyan-500/30'
                : theme === 'dark'
                ? 'bg-slate-900 border-slate-800'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex flex-wrap gap-2">
              {files.map((file, index) => (
                <motion.div
                  key={index}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                    theme === 'cyber'
                      ? 'bg-cyan-500/20 border border-cyan-500/30'
                      : 'bg-slate-200'
                  }`}
                >
                  <Paperclip className="w-4 h-4" />
                  <span className="text-sm">{file.name}</span>
                  <button
                    onClick={() => removeFile(index)}
                    className="p-1 hover:bg-red-500/20 rounded"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Area */}
      <div className={`p-4 border-t ${
        theme === 'cyber'
          ? 'bg-slate-950/80 backdrop-blur-xl border-cyan-500/30'
          : theme === 'dark'
          ? 'bg-slate-900 border-slate-800'
          : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-end gap-3">
          {/* File Upload */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            accept=".txt,.doc,.docx,.pdf"
          />

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => fileInputRef.current?.click()}
            className={`p-3 rounded-xl ${
              theme === 'cyber'
                ? 'bg-cyan-500/20 hover:bg-cyan-500/30'
                : theme === 'dark'
                ? 'bg-slate-800 hover:bg-slate-700'
                : 'bg-slate-200 hover:bg-slate-300'
            } transition-colors`}
          >
            <Upload className="w-5 h-5" />
          </motion.button>

          {/* Text Input */}
          <div className="flex-1">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={t.placeholder}
              rows={1}
              className={`w-full px-4 py-3 rounded-xl resize-none ${
                theme === 'cyber'
                  ? 'bg-slate-800/50 border border-cyan-500/30 focus:border-cyan-500 placeholder-slate-500'
                  : theme === 'dark'
                  ? 'bg-slate-800 border border-slate-700 focus:border-slate-600'
                  : 'bg-slate-100 border border-slate-300 focus:border-slate-400'
              } focus:outline-none transition-colors`}
              style={{ minHeight: '48px', maxHeight: '200px' }}
            />
          </div>

          {/* Send Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSend}
            disabled={isProcessing || (!input.trim() && files.length === 0)}
            className={`p-3 rounded-xl ${
              theme === 'cyber'
                ? 'bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600'
                : 'bg-blue-500 hover:bg-blue-600'
            } text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg`}
          >
            {isProcessing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );
};
