import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { useAppStore } from './stores/appStore';
import { Layout } from './components/v2/Layout';
import { Sidebar } from './components/v2/Sidebar';
import { ModernChat } from './components/v2/ModernChat';
import { ProcessingDashboard, defaultProcessingSteps } from './components/v2/ProcessingDashboard';
import { motion } from 'framer-motion';

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

function AppV2() {
  const { language, theme } = useAppStore();
  const [activeSection, setActiveSection] = useState('new');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingSteps, setProcessingSteps] = useState(defaultProcessingSteps);

  // Initial greeting
  useEffect(() => {
    const greetings = {
      ar: 'مرحباً بك في X-Book Smart Publisher! 🚀\n\nأنا مساعدك الذكي لتحويل مخطوطتك إلى كتاب احترافي جاهز للنشر.\n\nكيف يمكنني مساعدتك اليوم؟',
      en: 'Welcome to X-Book Smart Publisher! 🚀\n\nI\'m your AI assistant to transform your manuscript into a professional, publication-ready book.\n\nHow can I help you today?',
      de: 'Willkommen bei X-Book Smart Publisher! 🚀\n\nIch bin Ihr KI-Assistent, um Ihr Manuskript in ein professionelles, veröffentlichungsreifes Buch zu verwandeln.\n\nWie kann ich Ihnen heute helfen?'
    };

    setMessages([{
      id: '1',
      role: 'assistant',
      content: greetings[language] || greetings.ar,
      timestamp: new Date()
    }]);
  }, [language]);

  const handleSendMessage = async (content: string, files?: File[]) => {
    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
      attachments: files?.map(f => ({
        name: f.name,
        size: f.size,
        type: f.type
      }))
    };

    setMessages(prev => [...prev, userMessage]);

    // Simulate AI response
    setIsProcessing(true);

    // If files are uploaded, start processing
    if (files && files.length > 0) {
      setTimeout(() => {
        const responses = {
          ar: `تم استلام ${files.length} ملف! 📚\n\nسأبدأ الآن بتحليل محتواك وتحويله إلى كتاب احترافي.\n\nهذه العملية قد تستغرق بضع دقائق...`,
          en: `Received ${files.length} file(s)! 📚\n\nI'll now start analyzing your content and transforming it into a professional book.\n\nThis process may take a few minutes...`,
          de: `${files.length} Datei(en) empfangen! 📚\n\nIch werde jetzt mit der Analyse Ihres Inhalts beginnen und ihn in ein professionelles Buch verwandeln.\n\nDieser Vorgang kann einige Minuten dauern...`
        };

        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: responses[language] || responses.ar,
          timestamp: new Date()
        }]);

        // Start processing simulation
        setActiveSection('processing');
        simulateProcessing();
      }, 1000);
    } else {
      // Regular chat response
      setTimeout(() => {
        const sampleResponses = {
          ar: [
            'يمكنني مساعدتك في:\n\n✨ تحليل وتحسين المخطوطة\n📖 إنشاء المقدمة والخاتمة\n🎨 توليد غلاف احترافي\n📦 تجهيز حزمة النشر الكاملة\n\nما الذي تريد البدء به؟',
            'رائع! أخبرني المزيد عن مشروعك.',
            'سأحتاج إلى بعض المعلومات الإضافية لمساعدتك بشكل أفضل.'
          ],
          en: [
            'I can help you with:\n\n✨ Manuscript analysis and enhancement\n📖 Creating preface and conclusion\n🎨 Generating professional cover\n📦 Preparing complete publishing package\n\nWhat would you like to start with?',
            'Great! Tell me more about your project.',
            'I\'ll need some additional information to help you better.'
          ],
          de: [
            'Ich kann Ihnen helfen mit:\n\n✨ Manuskriptanalyse und -verbesserung\n📖 Erstellung von Vorwort und Fazit\n🎨 Generierung eines professionellen Covers\n📦 Vorbereitung eines vollständigen Veröffentlichungspakets\n\nWomit möchten Sie beginnen?',
            'Großartig! Erzählen Sie mir mehr über Ihr Projekt.',
            'Ich benötige einige zusätzliche Informationen, um Ihnen besser helfen zu können.'
          ]
        };

        const responses = sampleResponses[language] || sampleResponses.ar;
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];

        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: randomResponse,
          timestamp: new Date()
        }]);

        setIsProcessing(false);
      }, 1500);
    }
  };

  const simulateProcessing = () => {
    let progress = 0;
    const steps = [...defaultProcessingSteps];

    const interval = setInterval(() => {
      progress += 2;

      // Update step statuses
      if (progress >= 20 && steps[1].status !== 'completed') {
        steps[1].status = 'processing';
        steps[1].progress = Math.min(100, (progress - 20) * 2.5);
      }
      if (progress >= 40) {
        steps[1].status = 'completed';
        steps[2].status = 'processing';
        steps[2].progress = Math.min(100, (progress - 40) * 2.5);
      }
      if (progress >= 60) {
        steps[2].status = 'completed';
        steps[3].status = 'processing';
        steps[3].progress = Math.min(100, (progress - 60) * 2.5);
      }
      if (progress >= 80) {
        steps[3].status = 'completed';
        steps[4].status = 'processing';
        steps[4].progress = Math.min(100, (progress - 80) * 5);
      }
      if (progress >= 100) {
        steps[4].status = 'completed';
        setIsProcessing(false);
        setActiveSection('new');

        const completionMessages = {
          ar: '✅ اكتمل! تم معالجة مخطوطتك بنجاح.\n\nيمكنك الآن تحميل حزمة النشر الكاملة التي تتضمن:\n\n📄 النص المحسّن\n📊 تقرير التحليل\n🎨 غلاف احترافي\n📚 صفحات إضافية (مقدمة، خاتمة، فهرس)\n\nهل تريد تحميل الحزمة الآن؟',
          en: '✅ Complete! Your manuscript has been successfully processed.\n\nYou can now download the complete publishing package including:\n\n📄 Enhanced text\n📊 Analysis report\n🎨 Professional cover\n📚 Additional pages (preface, conclusion, index)\n\nWould you like to download the package now?',
          de: '✅ Fertig! Ihr Manuskript wurde erfolgreich verarbeitet.\n\nSie können jetzt das vollständige Veröffentlichungspaket herunterladen, das Folgendes umfasst:\n\n📄 Verbesserter Text\n📊 Analysebericht\n🎨 Professionelles Cover\n📚 Zusätzliche Seiten (Vorwort, Fazit, Index)\n\nMöchten Sie das Paket jetzt herunterladen?'
        };

        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: completionMessages[language] || completionMessages.ar,
          timestamp: new Date()
        }]);

        clearInterval(interval);
      }

      setProcessingSteps([...steps]);
    }, 200);
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'new':
        return (
          <motion.div
            key="chat"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="h-full"
          >
            <ModernChat
              messages={messages}
              onSendMessage={handleSendMessage}
              isProcessing={isProcessing}
            />
          </motion.div>
        );

      case 'processing':
        return (
          <motion.div
            key="processing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <ProcessingDashboard
              steps={processingSteps}
              currentStep={processingSteps.find(s => s.status === 'processing')?.id}
              overallProgress={
                (processingSteps.filter(s => s.status === 'completed').length / processingSteps.length) * 100
              }
            />
          </motion.div>
        );

      case 'manuscripts':
        return (
          <div className="text-center py-20">
            <h2 className="text-2xl font-bold mb-4">
              {language === 'ar' ? '📚 مخطوطاتي' : language === 'en' ? '📚 My Manuscripts' : '📚 Meine Manuskripte'}
            </h2>
            <p className="opacity-70">
              {language === 'ar' ? 'قريباً...' : language === 'en' ? 'Coming soon...' : 'Demnächst...'}
            </p>
          </div>
        );

      case 'analytics':
        return (
          <div className="text-center py-20">
            <h2 className="text-2xl font-bold mb-4">
              {language === 'ar' ? '📊 الإحصائيات' : language === 'en' ? '📊 Analytics' : '📊 Analytik'}
            </h2>
            <p className="opacity-70">
              {language === 'ar' ? 'قريباً...' : language === 'en' ? 'Coming soon...' : 'Demnächst...'}
            </p>
          </div>
        );

      default:
        return (
          <div className="text-center py-20">
            <h2 className="text-2xl font-bold mb-4">
              {language === 'ar' ? 'قيد التطوير' : language === 'en' ? 'Under Development' : 'In Entwicklung'}
            </h2>
            <p className="opacity-70">
              {language === 'ar' ? 'هذا القسم قيد التطوير' : language === 'en' ? 'This section is under development' : 'Dieser Abschnitt befindet sich in der Entwicklung'}
            </p>
          </div>
        );
    }
  };

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          className: theme === 'cyber'
            ? 'bg-slate-900 text-white border border-cyan-500/30'
            : theme === 'dark'
            ? 'bg-slate-800 text-white'
            : 'bg-white text-slate-900',
          duration: 3000
        }}
      />

      <Layout
        sidebar={
          <Sidebar
            activeSection={activeSection}
            onSectionChange={setActiveSection}
          />
        }
      >
        {renderContent()}
      </Layout>
    </>
  );
}

export default AppV2;
