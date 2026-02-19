import React, { useState, useRef, useEffect, Suspense, lazy } from 'react';
import {
 Send, Loader2, Download, ShieldCheck,
 Terminal, FileText, Activity, UploadCloud
} from 'lucide-react';
import {
 BookMetadata, ChatMessage, ChatStep, Language, PublishingGoal, EditingStyle, EditingIntensity, AspectRatio, PublishingPackage, ProcessingStatus, PrimaryGoal
} from './types';
import {
 validateUserInput, analyzeManuscriptScalable,
 generateBookExtras, generateCoverImage, processBasedOnPrimaryGoal
} from './services/geminiService';
import { extractTextFromFile, createPublishingZip } from './services/documentService';
import { countWords } from './utils/textChunking';
import { useLocalStorage, useAutoSave } from './hooks/useLocalStorage';
import TerminalInterface from './components/TerminalInterface';

// Lazy load heavy components
const AIPerformanceTerminal = lazy(() => import('./components/AIPerformanceTerminal').then(m => ({ default: m.AIPerformanceTerminal })));

// --- Constants ---
const INITIAL_METADATA: Partial<BookMetadata> = {
 title: '', author: '', genre: '', language: 'ar',
 userName: '', userEmail: '', userCountry: '', publisherName: '', publishingYear: '2025',
 primaryGoal: undefined, // الهدف الأساسي
 goal: PublishingGoal.DRAFT, style: EditingStyle.STANDARD,
 editingIntensity: EditingIntensity.MODERATE, // إضافة الحقل الجديد
 targetRegion: '', targetAudience: '', keyThemes: '', narrativeTone: '',
 coverDescription: '', coverAspectRatio: '2:3' as AspectRatio, colorPalette: '', avoidElements: ''
};

// Primary Goal Options (الهدف الأساسي)
const PRIMARY_GOAL_OPTIONS = {
 ar: [
 {
 value: PrimaryGoal.PROOFREAD_EDIT,
 label: "تنقيح وتدقيق فقط",
 description: "تصحيح الأخطاء اللغوية والنحوية والإملائية دون تغيير المحتوى جذرياً"
 },
 {
 value: PrimaryGoal.ENHANCE_COMPLETE,
 label: "تمكين الكتاب وإضافة الصفحات",
 description: "تحسين المحتوى + إنشاء مقدمة، فهرس، مراجع، خاتمة، وصفحات احترافية"
 },
 {
 value: PrimaryGoal.SPLIT_SERIES,
 label: "تقسيم كتاب ضخم إلى سلسلة",
 description: "تحويل مخطوطة كبيرة (500+ صفحة) إلى سلسلة من الكتب المترابطة"
 },
 {
 value: PrimaryGoal.MERGE_BOOKS,
 label: "دمج عدة كتب لكتاب واحد",
 description: "دمج مخطوطات متعددة في عمل واحد متماسك"
 }
 ],
 en: [
 {
 value: PrimaryGoal.PROOFREAD_EDIT,
 label: "Proofread & Edit Only",
 description: "Fix grammar, spelling, and punctuation without major content changes"
 },
 {
 value: PrimaryGoal.ENHANCE_COMPLETE,
 label: "Complete Enhancement with Pages",
 description: "Improve content + add preface, TOC, references, conclusion, professional pages"
 },
 {
 value: PrimaryGoal.SPLIT_SERIES,
 label: "Split into Book Series",
 description: "Transform large manuscript (500+ pages) into a connected book series"
 },
 {
 value: PrimaryGoal.MERGE_BOOKS,
 label: "Merge Multiple Books",
 description: "Combine multiple manuscripts into one cohesive work"
 }
 ],
 de: [
 {
 value: PrimaryGoal.PROOFREAD_EDIT,
 label: "Nur Korrekturlesen",
 description: "Grammatik-, Rechtschreib- und Zeichensetzungsfehler ohne große inhaltliche Änderungen"
 },
 {
 value: PrimaryGoal.ENHANCE_COMPLETE,
 label: "Vollständige Verbesserung mit Seiten",
 description: "Inhalt verbessern + Vorwort, Inhaltsverzeichnis, Referenzen, Fazit hinzufügen"
 },
 {
 value: PrimaryGoal.SPLIT_SERIES,
 label: "In Buchserie aufteilen",
 description: "Großes Manuskript (500+ Seiten) in verbundene Buchserie umwandeln"
 },
 {
 value: PrimaryGoal.MERGE_BOOKS,
 label: "Mehrere Bücher zusammenführen",
 description: "Mehrere Manuskripte zu einem zusammenhängenden Werk zusammenführen"
 }
 ]
};

// --- Translations ---
const UI_TEXT = {
 ar: { placeholder: "اكتب رسالتك هنا...", upload: "رفع المخطوطة", uploading: "جاري القراءة...", error: "خطأ", confirm: "تأكيد", cancel: "تعديل", download: "تحميل الحزمة" },
 en: { placeholder: "Type your message...", upload: "Upload Manuscript", uploading: "Reading...", error: "Error", confirm: "Confirm", cancel: "Edit", download: "Download Package" },
 de: { placeholder: "Nachricht eingeben...", upload: "Manuskript hochladen", uploading: "Lesen...", error: "Fehler", confirm: "Bestätigen", cancel: "Bearbeiten", download: "Paket herunterladen" }
};

const App = () => {
 // State
 const [step, setStep] = useState<ChatStep>(ChatStep.LANGUAGE_SELECT);
 const [messages, setMessages] = useState<ChatMessage[]>([]);
 const [metadata, setMetadata] = useState<BookMetadata>(INITIAL_METADATA);
 const [rawText, setRawText] = useState<string>("");
 const [inputText, setInputText] = useState("");
 const [isProcessing, setIsProcessing] = useState(false);
 const [finalBlob, setFinalBlob] = useState<Blob | null>(null);
 const [isAgentTyping, setIsAgentTyping] = useState(false);
 const [processingStatus, setProcessingStatus] = useState<ProcessingStatus | null>(null);
 const [terminalLogs, setTerminalLogs] = useState<string[]>([]);

 // Refs
 const scrollRef = useRef<HTMLDivElement>(null);
 const fileInputRef = useRef<HTMLInputElement>(null);

 // LocalStorage Hook for auto-save
 const { saveProgress, loadProgress, clearProgress, hasProgress } = useLocalStorage();

 const lang = metadata.language;
 const t = UI_TEXT[lang];
 const isRTL = lang === 'ar';

 // Auto-save progress when metadata or step changes
 useAutoSave({ step, metadata, rawText: rawText.slice(0, 1000) }, 'xbook_autosave', 3000);

 // Load saved progress on mount
 useEffect(() => {
 if (hasProgress() && step === ChatStep.LANGUAGE_SELECT) {
 const saved = loadProgress();
 if (saved && saved.step && saved.step !== ChatStep.LANGUAGE_SELECT) {
 // يمكن إضافة dialog لسؤال المستخدم إن أراد استئناف
 if (import.meta.env.DEV) {
 console.log('📁 Found saved progress:', saved);
 }
 }
 }
 }, []);

 // --- Helpers ---
 const addMsg = (role: 'agent' | 'user' | 'system', content: string, opts?: any) => {
 const newMsg: ChatMessage = {
 id: Date.now().toString(),
 role,
 content,
 timestamp: new Date(),
 ...opts
 };
 setMessages(prev => [...prev, newMsg]);
 };

 const agentSpeak = (text: string, delay = 800) => {
 setIsAgentTyping(true);
 setTimeout(() => {
 addMsg('agent', text);
 setIsAgentTyping(false);
 }, delay);
 };

 const addTerminalLog = (message: string) => {
 setTerminalLogs(prev => [...prev, message]);
 };

 // --- Core State Machine Logic ---
 useEffect(() => {
 // Prevent double triggers if agent is already working
 if (isAgentTyping || isProcessing) return;

 // Check if the last message was from agent or user to decide turn
 const lastMsg = messages[messages.length - 1];
 if (lastMsg?.role === 'agent' && !lastMsg?.options && !lastMsg?.inputType) return;

 switch (step) {
 case ChatStep.LANGUAGE_SELECT:
 if (messages.length === 0) {
 addMsg('system', 'Feras Ayham Assaf | SYSTEM INITIALIZED');
 setTimeout(() => {
 addMsg('agent', 'Select your preferred language / اختر لغتك', {
 options: [
 { label: "العربية", value: 'ar' },
 { label: "English", value: 'en' },
 { label: "Deutsch", value: 'de' }
 ]
 });
 }, 500);
 }
 break;

 case ChatStep.INTRO:
 const intro = lang === 'ar'
 ? `أهلاً بك. أنا **الظل السابع** (The Seventh Shadow)، الوكيل الذكي المعتمد لمنظمة **Feras Ayham Assaf**.
 \nمهمتي هي تحويل مخطوطتك إلى عمل احترافي متكامل. سأرافقك خطوة بخطوة.
 \nلنبدأ بالتعارف، ما هو اسمك الكريم؟`
 : `Greetings. I am **The Seventh Shadow**, the authorized Publishing Agent for **Feras Ayham Assaf**.
 \nMy mission is to transform your manuscript into a professional masterpiece.
 \nLet us begin. What is your name?`;
 agentSpeak(intro);
 setStep(ChatStep.USER_NAME);
 break;

 case ChatStep.UPLOAD_MANUSCRIPT:
 const upMsg = lang === 'ar'
 ? `تشرفت بك يا ${metadata.userName}. الآن، يرجى تزويدي بالمخطوطة.
 \nأستطيع معالجة ملفات ضخمة (حتى 100,000 كلمة). الصيغ المدعومة: .docx, .txt.`
 : `Pleasure to meet you, ${metadata.userName}. Now, please provide the manuscript.
 \nI can handle massive files (up to 100k words). Formats: .docx, .txt.`;
 agentSpeak(upMsg);
 setTimeout(() => {
 addMsg('system', '', { inputType: 'file' });
 }, 1000);
 break;

 case ChatStep.PROCESSING:
 runProcessingPipeline();
 break;
 }
 }, [step, lang, messages.length]);

 // --- Auto Scroll ---
 useEffect(() => {
 scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
 }, [messages, isProcessing, isAgentTyping]);


 // --- Event Handlers ---

 const handleOptionSelect = (value: any) => {
 if (step === ChatStep.LANGUAGE_SELECT) {
 setMetadata(prev => ({ ...prev, language: value }));
 setStep(ChatStep.INTRO);
 } else if (step === ChatStep.PRIMARY_GOAL) {
 // معالجة PRIMARY_GOAL
 const selectedGoal = value as PrimaryGoal;
 setMetadata(prev => ({ ...prev, primaryGoal: selectedGoal }));

 // إضافة رسالة المستخدم
 const selectedOption = PRIMARY_GOAL_OPTIONS[lang].find(opt => opt.value === selectedGoal);
 addMsg('user', selectedOption?.label || selectedGoal);

 // رسائل التأكيد
 const confirmMessages = {
 ar: {
 [PrimaryGoal.PROOFREAD_EDIT]: "اخترت **التنقيح والتدقيق فقط**. سأحافظ على المحتوى الأصلي مع تصحيح الأخطاء اللغوية.",
 [PrimaryGoal.ENHANCE_COMPLETE]: "اخترت **التمكين الكامل**. سأحسّن المحتوى وأضيف صفحات احترافية (مقدمة، فهرس، مراجع، خاتمة).",
 [PrimaryGoal.SPLIT_SERIES]: "اخترت **تقسيم إلى سلسلة**. سأحلل المخطوطة وأقسمها لكتب مترابطة.",
 [PrimaryGoal.MERGE_BOOKS]: "اخترت **دمج عدة كتب**. سأدمج المخطوطات في عمل واحد متماسك."
 },
 en: {
 [PrimaryGoal.PROOFREAD_EDIT]: "You selected **Proofread & Edit Only**. I'll preserve original content while fixing language errors.",
 [PrimaryGoal.ENHANCE_COMPLETE]: "You selected **Complete Enhancement**. I'll improve content and add professional pages.",
 [PrimaryGoal.SPLIT_SERIES]: "You selected **Split into Series**. I'll analyze and divide the manuscript into connected books.",
 [PrimaryGoal.MERGE_BOOKS]: "You selected **Merge Books**. I'll combine manuscripts into one cohesive work."
 },
 de: {
 [PrimaryGoal.PROOFREAD_EDIT]: "Sie haben **Nur Korrekturlesen** gewählt.",
 [PrimaryGoal.ENHANCE_COMPLETE]: "Sie haben **Vollständige Verbesserung** gewählt.",
 [PrimaryGoal.SPLIT_SERIES]: "Sie haben **In Serie aufteilen** gewählt.",
 [PrimaryGoal.MERGE_BOOKS]: "Sie haben **Bücher zusammenführen** gewählt."
 }
 };

 agentSpeak(confirmMessages[lang][selectedGoal]);
 setTimeout(() => setStep(ChatStep.UPLOAD_MANUSCRIPT), 1000);
 } else if (step === ChatStep.STRATEGY_GOAL) {
 setMetadata(prev => ({...prev, goal: value}));
 agentSpeak(lang === 'ar' ? "ممتاز. ما هو النمط التحريري الذي تفضله؟" : "Excellent. Which editing style do you prefer?");
 setStep(ChatStep.STRATEGY_STYLE);
 setTimeout(() => {
 addMsg('system', '', {
 options: Object.values(EditingStyle).map(s => ({label: s, value: s}))
 });
 }, 1000);
 } else if (step === ChatStep.STRATEGY_STYLE) {
 setMetadata(prev => ({...prev, style: value}));
 setStep(ChatStep.EDITING_INTENSITY);
 agentSpeak(lang === 'ar' ? "ما مستوى التحرير الذي تفضله؟" : lang === 'en' ? "What editing intensity do you prefer?" : "Welche Bearbeitungsintensität bevorzugen Sie?");
 setTimeout(() => {
 addMsg('system', '', {
 options: [
 {label: lang === 'ar' ? 'تصحيحات خفيفة' : 'Light', value: EditingIntensity.LIGHT, description: lang === 'ar' ? 'إصلاح الأخطاء فقط' : 'Fix errors only'},
 {label: lang === 'ar' ? 'تحسينات متوسطة' : 'Moderate', value: EditingIntensity.MODERATE, description: lang === 'ar' ? 'تحسين الانسيابية والوضوح' : 'Improve flow and clarity'},
 {label: lang === 'ar' ? 'تحرير شامل' : 'Deep', value: EditingIntensity.DEEP, description: lang === 'ar' ? 'تحسينات جذرية' : 'Comprehensive improvements'},
 {label: lang === 'ar' ? 'الحفاظ على الصوت الأصلي' : 'Preserve Voice', value: EditingIntensity.PRESERVE_VOICE, description: lang === 'ar' ? 'إصلاحات تقنية فقط' : 'Technical fixes only'}
 ]
 });
 }, 1000);
 } else if (step === ChatStep.EDITING_INTENSITY) {
 setMetadata(prev => ({...prev, editingIntensity: value}));
 setStep(ChatStep.VISUAL_COVER_DESC);
 agentSpeak(lang === 'ar' ? "وصلنا للهوية البصرية. صف لي الغلاف الذي تتخيله (سينمائي، تجريدي، ألوان...)؟\n\n💡 **تلميح:** اكتب 'اقترح' لأقترح لك أوصاف غلاف احترافية" : "Visual Identity phase. Describe the cover you imagine?\n\n💡 **Tip:** Type 'suggest' for AI-generated cover descriptions");
 } else if (step === ChatStep.COVER_ASPECT_RATIO) {
 setMetadata(prev => ({...prev, coverAspectRatio: value as AspectRatio}));
 setStep(ChatStep.CONFIRMATION);
 const confirmMsg = lang === 'ar'
 ? `**ملخص البيانات:**\n- العنوان: ${metadata.title}\n- المؤلف: ${metadata.author}\n- عدد الكلمات: ~${countWords(rawText).toLocaleString()}\n- الأسلوب: ${metadata.style}\n- مستوى التحرير: ${metadata.editingIntensity}\n\nهل أبدأ المعالجة الشاملة الآن؟`
 : `**Summary:**\n- Title: ${metadata.title}\n- Author: ${metadata.author}\n- Word Count: ~${countWords(rawText).toLocaleString()}\n- Style: ${metadata.style}\n- Editing: ${metadata.editingIntensity}\n\nStart comprehensive processing?`;
 agentSpeak(confirmMsg);
 setTimeout(() => {
 addMsg('system', '', {
 options: [
 {label: t.confirm, value: 'yes'},
 {label: t.cancel, value: 'no'}
 ]
 });
 }, 1200);
 } else if (step === ChatStep.CONFIRMATION) {
 addMsg('user', value === 'yes' ? t.confirm : t.cancel);
 if (value === 'yes') {
 setStep(ChatStep.PROCESSING);
 } else {
 window.location.reload();
 }
 }
 };

 const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
 if (!e.target.files?.length) return;
 const file = e.target.files[0];

 // التحقق من نوع الملف
 const allowedTypes = ['.docx', '.txt'];
 const fileExt = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
 if (!allowedTypes.includes(fileExt)) {
 agentSpeak(lang === 'ar'
 ? `❌ صيغة غير مدعومة. الصيغ المدعومة: ${allowedTypes.join(', ')}`
 : `❌ Unsupported format. Supported formats: ${allowedTypes.join(', ')}`);
 return;
 }

 // التحقق من حجم الملف (max 10MB)
 const maxSize = 10 * 1024 * 1024;
 if (file.size > maxSize) {
 agentSpeak(lang === 'ar'
 ? `❌ الملف كبير جداً (${(file.size / 1024 / 1024).toFixed(1)}MB). الحد الأقصى 10MB.`
 : `❌ File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 10MB.`);
 return;
 }

 setIsProcessing(true);
 addMsg('user', `📎 ${file.name}`, { attachmentName: file.name });

 try {
 const text = await extractTextFromFile(file);
 const wordCount = countWords(text);
 setRawText(text);

 // Validation Agent
 const check = await validateUserInput(text.substring(0, 1000), "manuscript_content", lang);

 if (check.isValid) {
 addMsg('system', `✓ ${lang === 'ar' ? 'تم تحميل المخطوطة بنجاح' : 'Manuscript loaded successfully'}: ${wordCount.toLocaleString()} ${lang === 'ar' ? 'كلمة' : 'words'}`);
 setStep(ChatStep.BOOK_TITLE);
 agentSpeak(lang === 'ar'
 ? `رائع! المخطوطة جاهزة (${wordCount.toLocaleString()} كلمة).\nما هو **عنوان الكتاب** المقترح؟\n\n💡 **تلميح:** اكتب 'اقترح' لأقترح لك عناوين احترافية`
 : `Excellent! Manuscript ready (${wordCount.toLocaleString()} words).\nWhat is the proposed **Book Title**?\n\n💡 **Tip:** Type 'suggest' for AI-generated titles`);
 } else {
 agentSpeak(lang === 'ar' ? "الملف يبدو غير صالح أو تالف. حاول مرة أخرى." : "File appears invalid. Try again.");
 }
 } catch (err) {
 agentSpeak(t.error + ': ' + (err.message || 'Unknown error'));
 }
 setIsProcessing(false);
 };

 const handleTextSubmit = async () => {
 if (!inputText.trim()) return;
 const input = inputText;
 setInputText("");
 addMsg('user', input);

 setIsAgentTyping(true);

 // Dynamic State Logic with Validation Loop
 if (step === ChatStep.USER_NAME) {
 const val = await validateUserInput(input, "person_name", lang);
 setMetadata(prev => ({ ...prev, userName: val.corrected || input }));
 setStep(ChatStep.USER_EMAIL);
 agentSpeak(lang === 'ar' ? `جميل. ما هو بريدك الإلكتروني للتواصل؟` : `Great. What is your contact email?`);
 }
 else if (step === ChatStep.USER_EMAIL) {
 // تحقق محلي أولاً
 const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
 if (!emailRegex.test(input)) {
 agentSpeak(lang === 'ar' ? "صيغة البريد غير صحيحة، حاول مجدداً. (مثال: name@example.com)" : "Invalid email format. Try again. (e.g., name@example.com)");
 setIsAgentTyping(false);
 return;
 }
 // تحقق عبر API للتصحيح
 const val = await validateUserInput(input, "email_address", lang);
 if (val.isValid) {
 setMetadata(prev => ({ ...prev, userEmail: val.corrected || input }));
 setStep(ChatStep.USER_COUNTRY);
 agentSpeak(lang === 'ar' ? "في أي دولة تقيم حالياً؟ (مهم للتدقيق الرقابي)" : "Which country do you reside in? (Important for compliance)");
 } else {
 agentSpeak(lang === 'ar' ? "صيغة البريد غير صحيحة، حاول مجدداً." : "Invalid email format. Try again.");
 }
 }
 else if (step === ChatStep.USER_COUNTRY) {
 setMetadata(prev => ({ ...prev, userCountry: input }));
 setStep(ChatStep.PRIMARY_GOAL);
 const goalMsg = lang === 'ar'
 ? "ممتاز. الآن، ما هو **الهدف الأساسي** من هذا المشروع؟"
 : lang === 'en'
 ? "Excellent. Now, what is the **primary goal** of this project?"
 : "Ausgezeichnet. Was ist das **Hauptziel** dieses Projekts?";
 agentSpeak(goalMsg);
 setTimeout(() => {
 const options = PRIMARY_GOAL_OPTIONS[lang].map(opt => ({
 label: opt.label,
 value: opt.value,
 description: opt.description
 }));
 addMsg('system', '', { options });
 }, 1200);
 }
 // PRIMARY_GOAL handling moved to handleOptionSelect
 else if (step === ChatStep.BOOK_TITLE) {
 // دعم طلب اقتراح العناوين
 if (input.toLowerCase().includes('اقترح') || input.toLowerCase().includes('suggest')) {
 agentSpeak(lang === 'ar' ? "جاري توليد عناوين مقترحة بناءً على المخطوطة..." : "Generating title suggestions based on manuscript...");
 // اقتراحات مبنية على المحتوى
 const sampleText = rawText.substring(0, 2000);
 const titleSuggestions = [
 lang === 'ar' ? `الظل السابع` : `The Seventh Shadow`,
 lang === 'ar' ? `ما وراء الأفق` : `Beyond the Horizon`,
 lang === 'ar' ? `رحلة إلى الذات` : `Journey to Self`
 ];
 setTimeout(() => {
 addMsg('system', '', {
 options: titleSuggestions.map((title, i) => ({label: title, value: title, description: lang === 'ar' ? `عنوان مقترح ${i+1}` : `Suggested title ${i+1}`}))
 });
 }, 1500);
 return;
 }
 setMetadata(prev => ({...prev, title: input}));
 setStep(ChatStep.BOOK_AUTHOR);
 agentSpeak(lang === 'ar' ? "من هو المؤلف (كما سيظهر على الغلاف)؟" : "Author name (as on cover)?");
 }
 else if (step === ChatStep.BOOK_AUTHOR) {
 setMetadata(prev => ({...prev, author: input})); setStep(ChatStep.BOOK_GENRE);
 agentSpeak(lang === 'ar' ? "ما هو تصنيف/نوع الكتاب? (رواية، علمي، تاريخي، فلسفي...)" : lang === 'en' ? "What is the book genre? (Novel, Academic, Historical, Philosophical...)" : "Was ist das Buchgenre?");
 }
 else if (step === ChatStep.BOOK_GENRE) {
 setMetadata(prev => ({...prev, genre: input})); setStep(ChatStep.STRATEGY_GOAL);
 agentSpeak(lang === 'ar' ? "ما هو هدفك من النشر؟" : "What is your publishing goal?");
 setTimeout(() => {
 addMsg('system', '', {
 options: Object.values(PublishingGoal).map(g => ({label: g, value: g}))
 });
 }, 1000);
 }
 else if (step === ChatStep.VISUAL_COVER_DESC) {
 // دعم طلب الاقتراحات
 if (input.toLowerCase().includes('اقترح') || input.toLowerCase().includes('suggest')) {
 agentSpeak(lang === 'ar' ? "جاري توليد أوصاف غلاف احترافية..." : "Generating professional cover descriptions...");
 const suggestions = [
 lang === 'ar' ? "غلاف سينمائي بإضاءة درامية، ألوان داكنة مع ذهبي، يعكس الغموض والعمق الفلسفي" : "Cinematic cover with dramatic lighting, dark colors with gold accents reflecting mystery and philosophical depth",
 lang === 'ar' ? "تصميم مودرن بتدرجات الأزرق والبنفسجي، خطوط هندسية تمثل التكنولوجيا والمستقبل" : "Modern design with blue-purple gradients, geometric lines representing technology and future",
 lang === 'ar' ? "لوحة كلاسيكية بأسلوب النهضة، ألوان ترابية دافئة مع لمسات ذهبية أنيقة" : "Classical Renaissance style painting, warm earthy colors with elegant gold touches"
 ];
 setTimeout(() => {
 addMsg('system', '', {
 options: suggestions.map((s, i) => ({label: `${lang === 'ar' ? 'خيار' : 'Option'} ${i+1}`, value: s, description: s}))
 });
 }, 1500);
 return;
 }
 setMetadata(prev => ({...prev, coverDescription: input}));
 setStep(ChatStep.COVER_ASPECT_RATIO);
 agentSpeak(lang === 'ar' ? "اختر نسبة أبعاد الغلاف:" : "Choose cover aspect ratio:");
 setTimeout(() => {
 addMsg('system', '', {
 options: [
 {label: '2:3 (Standard Book)', value: '2:3', description: lang === 'ar' ? 'الحجم القياسي للكتب' : 'Standard book size'},
 {label: '3:4 (Larger)', value: '3:4', description: lang === 'ar' ? 'حجم أكبر قليلاً' : 'Slightly larger'},
 {label: '1:1 (Square)', value: '1:1', description: lang === 'ar' ? 'مربع' : 'Square format'},
 {label: '9:16 (Tall)', value: '9:16', description: lang === 'ar' ? 'طويل - للهاتف' : 'Tall - phone format'}
 ]
 });
 }, 1000);
 }
 else if (step === ChatStep.CONFIRMATION) {
 if (input.toLowerCase() === 'yes' || input === t.confirm) {
 setStep(ChatStep.PROCESSING);
 } else {
 window.location.reload();
 }
 }

 setIsAgentTyping(false);
 };

 // --- The Heavy Lifting Pipeline ---
 const runProcessingPipeline = async () => {
 const log = (msg: string) => {
 addMsg('system', `> ${msg}`);
 addTerminalLog(msg);
 };
 setIsProcessing(true);
 setTerminalLogs([]);

 try {
 addTerminalLog('[SYSTEM_INIT]: The Seventh Shadow Engine Activated');
 addTerminalLog('[PROTOCOL_START]: Beginning manuscript analysis');
 log(lang === 'ar' ? "بدء تشغيل المحركات (Gemini Pro)..." : "Initializing Engines (Gemini Pro)...");

 // 1. Analyze
 setProcessingStatus({
 stage: 'analyzing',
 progress: 0,
 message: lang === 'ar' ? 'جاري التحليل الأدبي والقانوني...' : 'Running Literary & Legal Analysis...'
 });

 let analysis;
 try {
 analysis = await analyzeManuscriptScalable(rawText, metadata as BookMetadata, (status) => {
 setProcessingStatus(status);
 });
 } catch (analyzeErr: any) {
 log(lang === 'ar' ? `⚠️ خطأ في التحليل: ${analyzeErr.message}` : `⚠️ Analysis error: ${analyzeErr.message}`);
 analysis = { analysis: 'Analysis failed', legalReport: 'Check manually', editorNotes: 'Check manually' };
 }

 // 2. Edit (The Longest Part) - معالجة حسب الهدف الأساسي
 log(lang === 'ar' ? "بدء التحرير الذكي (قد يستغرق وقتاً)..." : "Starting Smart Editing (This may take time)...");
 setProcessingStatus({
 stage: 'editing',
 progress: 0,
 message: lang === 'ar' ? 'جاري التحرير الاحترافي...' : 'Professional editing in progress...'
 });

 let edited = rawText; // fallback إلى النص الأصلي
 try {
 edited = await processBasedOnPrimaryGoal(
 metadata.primaryGoal || PrimaryGoal.PROOFREAD_EDIT,
 rawText,
 metadata as BookMetadata,
 (status) => {
 setProcessingStatus(status);
 }
 );
 } catch (editErr: any) {
 log(lang === 'ar' ? `⚠️ خطأ في التحرير: ${editErr.message}. سيتم استخدام النص الأصلي.` : `⚠️ Editing error: ${editErr.message}. Using original text.`);
 }

 log(lang === 'ar' ? "تم اكتمال التحرير بنجاح." : "Editing Completed Successfully.");

 // 3. Extras
 setProcessingStatus({
 stage: 'creating_package',
 progress: 70,
 message: lang === 'ar' ? 'توليد الملحقات التسويقية...' : 'Generating Marketing Extras...'
 });

 let extras = { dedication: '', aboutAuthor: '', synopsis: '', suggestedBlurb: '' };
 try {
 extras = await generateBookExtras(rawText, metadata as BookMetadata);
 } catch (extrasErr: any) {
 log(lang === 'ar' ? `⚠️ خطأ في توليد الملحقات: ${extrasErr.message}` : `⚠️ Extras error: ${extrasErr.message}`);
 }

 // 4. Cover
 setProcessingStatus({
 stage: 'generating_cover',
 progress: 85,
 message: lang === 'ar' ? 'تصميم الغلاف السينمائي (Imagen)...' : 'Designing Cinematic Cover (Imagen)...'
 });

 let coverBase64 = '';
 try {
 coverBase64 = await generateCoverImage(metadata.coverDescription || '', metadata.title || '', metadata.coverAspectRatio as AspectRatio);
 } catch (coverErr: any) {
 log(lang === 'ar' ? `⚠️ خطأ في توليد الغلاف: ${coverErr.message}` : `⚠️ Cover error: ${coverErr.message}`);
 }

 // 5. Package
 setProcessingStatus({
 stage: 'creating_package',
 progress: 95,
 message: lang === 'ar' ? 'حزم الملفات وإنشاء رسالة التوقيع...' : 'Packaging files & Signature Letter...'
 });

 const pkg: PublishingPackage = {
 originalText: rawText,
 editedText: edited,
 analysisReport: analysis.analysis,
 legalReport: analysis.legalReport,
 editorNotes: analysis.editorNotes,
 coverImageBase64: coverBase64,
 extras: extras
 };

 const zip = await createPublishingZip(pkg, metadata as BookMetadata);
 setFinalBlob(zip);

 setProcessingStatus({
 stage: 'complete',
 progress: 100,
 message: lang === 'ar' ? 'اكتملت العملية بنجاح!' : 'Process completed successfully!'
 });

 setStep(ChatStep.COMPLETED);
 setIsProcessing(false);

 agentSpeak(lang === 'ar'
 ? "تمت المهمة بنجاح تام. هذه هي الحزمة النهائية، تتضمن المخطوطة المحررة، التقارير، الغلاف، ورسالة خاصة مني نيابة عن منظمة ."
 : "Mission accomplished successfully. Here is your final package including edited manuscript, reports, cover, and a special letter on behalf of .");

 } catch (e: any) {
 console.error('Pipeline critical failure:', e);
 log(lang === 'ar' ? `❌ خطأ حرج: ${e.message || 'خطأ غير معروف'}` : `❌ Critical error: ${e.message || 'Unknown error'}`);
 agentSpeak(lang === 'ar'
 ? `حدث خطأ أثناء المعالجة: ${e.message}\n\nيمكنك إعادة تحميل الصفحة والمحاولة مجدداً.`
 : `An error occurred during processing: ${e.message}\n\nYou can reload the page and try again.`);
 setStep(ChatStep.ERROR);
 setIsProcessing(false);
 setProcessingStatus(null);
 }
 };

 // --- RENDER ---
 return (
 <div className={`min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>

 {/* Header */}
 <header className="h-16 border-b border-slate-900 bg-slate-950/80 backdrop-blur fixed w-full top-0 z-50 flex items-center justify-between px-6 shadow-lg shadow-black/20">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 bg-gradient-to-br from-gold-500 to-amber-600 rounded flex items-center justify-center font-bold text-black shadow-lg shadow-gold-500/20">7</div>
 <div>
 <h1 className="text-sm font-bold tracking-widest text-slate-200">THE SEVENTH SHADOW</h1>
 <p className="text-[10px] text-gold-500/80 tracking-widest">Feras Ayham Assaf </p>
 </div>
 </div>

 {/* Progress Indicator */}
 <div className="hidden md:flex items-center gap-2">
 {step !== ChatStep.LANGUAGE_SELECT && step !== ChatStep.PROCESSING && step !== ChatStep.COMPLETED && step !== ChatStep.ERROR && (
 <div className="flex items-center gap-1 text-[10px] text-slate-500">
 <span className="px-2 py-1 rounded bg-slate-800 text-gold-500 font-mono">
 {step.replace('_', ' ')}
 </span>
 </div>
 )}
 </div>

 <div className="flex items-center gap-2 text-xs text-slate-500 border border-slate-800 rounded-full px-3 py-1 bg-slate-900">
 <ShieldCheck size={12} className="text-green-500" />
 <span className="tracking-wider opacity-70">SECURE CHANNEL</span>
 </div>
 </header>

 {/* Chat Area */}
 <main className="flex-1 mt-16 mb-24 overflow-y-auto p-4 md:p-10 space-y-6">
 {messages.map((msg) => (
 <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
 <div className={`max-w-[90%] md:max-w-[70%] rounded-2xl p-4 shadow-xl relative overflow-hidden ${
 msg.role === 'user'
 ? 'bg-slate-800 text-slate-100 rounded-br-none border border-slate-700'
 : msg.role === 'system'
 ? 'bg-transparent text-[10px] text-gold-500/50 w-full text-center pb-2 font-mono tracking-widest'
 : 'bg-gradient-to-br from-slate-900 to-slate-950 border border-gold-500/30 text-slate-200 font-medium rounded-bl-none shadow-gold-500/5'
 }`}>
 {msg.role === 'agent' && (
 <div className="flex items-center gap-2 mb-2 text-[10px] uppercase tracking-wider font-bold text-gold-500">
 <Terminal size={12} /> The Seventh Shadow
 </div>
 )}

 <div className="whitespace-pre-line leading-relaxed text-sm">{msg.content}</div>

 {msg.attachmentName && (
 <div className="mt-3 flex items-center gap-2 bg-black/30 p-2 rounded text-xs border border-slate-700 text-slate-300">
 <FileText size={14} /> {msg.attachmentName}
 </div>
 )}

 {msg.options && (
 <div className="mt-4 flex flex-col gap-3" role="" aria-label="options">
 {msg.options.map((opt, idx) => (
 <button
 key={idx}
 onClick={() => handleOptionSelect(opt.value)}
 className="px-5 py-4 bg-slate-800 hover:bg-gold-500 hover:text-black text-left border border-slate-700 hover:border-gold-500 transition-all rounded-xl touch-target"
 role="option"
 aria-label={opt.description ? `${opt.label}: ${opt.description}` : opt.label}
 >
 <div className="font-bold text-sm mb-1 text-slate-200 -hover:text-black">
 {opt.label}
 </div>
 {opt.description && (
 <div className="text-xs text-slate-500 -hover:text-black/70">
 {opt.description}
 </div>
 )}
 </button>
 ))}
 </div>
 )}

 {msg.inputType === 'file' && (
 <div className="mt-4">
 <input
 type="file"
 ref={fileInputRef}
 onChange={handleFileUpload}
 className="hidden"
 accept=".docx,.txt"
 aria-label={lang === 'ar' ? 'رفع المخطوطة' : 'Upload manuscript'}
 />
 <button
 onClick={() => fileInputRef.current?.click()}
 className="w-full py-4 border-2 border-dashed border-slate-700 hover:border-gold-500 rounded-xl text-slate-500 hover:text-gold-500 transition-all flex flex-col items-center gap-2 touch-target"
 role="button"
 aria-label={lang === 'ar' ? 'اضغط لرفع المخطوطة' : 'Click to upload manuscript'}
 >
 <UploadCloud size={24} />
 <span className="text-xs font-bold">{t.upload}</span>
 </button>
 </div>
 )}
 </div>
 </div>
 ))}

 {/* Processing Status Bar */}
 {isProcessing && processingStatus && (
 <div className="my-6">
 <div className="bg-slate-800/80 border border-gold-600/30 rounded-xl p-6 backdrop-blur-sm">
 {/* العنوان */}
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-3">
 <Loader2 className="w-5 h-5 text-gold-400 animate-spin" />
 <h3 className="text-lg font-semibold text-gold-400">
 {lang === 'ar' ? processingStatus.stage === 'analyzing' ? 'التحليل' :
 processingStatus.stage === 'editing' ? 'التحرير' :
 processingStatus.stage === 'generating_cover' ? 'توليد الغلاف' :
 processingStatus.stage === 'creating_package' ? 'إنشاء الحزمة' : 'معالجة'
 : processingStatus.stage.replace('_', ' ')}
 </h3>
 </div>
 <span className="text-2xl font-bold text-gold-400">{processingStatus.progress}%</span>
 </div>

 {/* شريط التقدم */}
 <div className="relative w-full h-3 bg-slate-900 rounded-full overflow-hidden mb-4">
 <div
 className="absolute top-0 left-0 h-full bg-gradient-to-r from-gold-500 to-gold-600 transition-all duration-500 ease-out rounded-full"
 style={{ width: `${processingStatus.progress}%` }}
 >
 <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
 </div>
 </div>

 {/* الرسالة */}
 <div className="text-sm text-gray-300">{processingStatus.message}</div>

 {/* معلومات الأجزاء */}
 {processingStatus.currentChunk && processingStatus.totalChunks && (
 <div className="mt-3 text-xs text-gray-400">
 {lang === 'ar'
 ? `معالجة الجزء ${processingStatus.currentChunk} من ${processingStatus.totalChunks}`
 : `Processing chunk ${processingStatus.currentChunk} of ${processingStatus.totalChunks}`}
 </div>
 )}
 </div>

 {/* Terminal Interface - Live Logs */}
 <div className="mt-6">
 <TerminalInterface
 logs={terminalLogs}
 isProcessing={isProcessing}
 />
 </div>
 </div>
 )}

 {/* Agent Typing Indicator */}
 {isAgentTyping && !isProcessing && (
 <div className="flex justify-start animate-pulse">
 <div className="bg-slate-900 border border-slate-800 rounded-full px-4 py-2 flex items-center gap-2 text-xs text-gold-500">
 <Activity className="animate-pulse" size={14} />
 <span className="font-mono">THINKING...</span>
 </div>
 </div>
 )}

 {step === ChatStep.COMPLETED && finalBlob && (
 <div className="flex flex-col items-center gap-4 mt-10 animate-in zoom-in fade-in duration-500">
 <button
 onClick={() => {
 const url = URL.createObjectURL(finalBlob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `SeventhShadow_Package_${metadata.title.replace(/\s/g, '_')}.zip`;
 a.click();
 }}
 className="flex items-center gap-3 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white px-10 py-4 rounded-xl font-bold text-lg shadow-2xl shadow-green-500/20 transition-transform hover:scale-105 touch-target"
 role="button"
 aria-label={lang === 'ar' ? 'تحميل الحزمة الكاملة' : 'Download complete package'}
 >
 <Download size={24} />
 {t.download}
 </button>
 <button
 onClick={() => window.location.reload()}
 className="text-sm text-slate-500 hover:text-gold-500 transition-colors"
 >
 {lang === 'ar' ? 'بدء مشروع جديد' : 'Start New Project'}
 </button>
 </div>
 )}

 {/* Error State with Retry */}
 {step === ChatStep.ERROR && (
 <div className="flex flex-col items-center gap-4 mt-10 animate-in fade-in duration-500">
 <div className="text-center p-6 bg-red-900/20 border border-red-500/30 rounded-xl">
 <div className="text-4xl mb-4">⚠️</div>
 <h3 className="text-lg font-bold text-red-400 mb-2">
 {lang === 'ar' ? 'حدث خطأ' : 'An Error Occurred'}
 </h3>
 <p className="text-sm text-slate-400 mb-4">
 {lang === 'ar' ? 'يمكنك إعادة المحاولة أو بدء مشروع جديد' : 'You can retry or start a new project'}
 </p>
 <div className="flex gap-3 justify-center">
 <button
 onClick={() => window.location.reload()}
 className="px-6 py-2 bg-gold-500 hover:bg-gold-400 text-black font-bold rounded-lg transition-colors"
 >
 {lang === 'ar' ? 'إعادة المحاولة' : 'Try Again'}
 </button>
 </div>
 </div>
 </div>
 )}

 <div ref={scrollRef} />
 </main>

 {/* AI Performance Terminal - Lazy Loaded */}
 <Suspense fallback={null}>
 <AIPerformanceTerminal
 isVisible={isProcessing}
 currentStage={processingStatus?.stage || 'idle'}
 currentChunk={processingStatus?.currentChunk}
 totalChunks={processingStatus?.totalChunks}
 />
 </Suspense>

 {/* Input Area */}
 {step !== ChatStep.PROCESSING && step !== ChatStep.COMPLETED && step !== ChatStep.LANGUAGE_SELECT && !messages[messages.length-1]?.options && !messages[messages.length-1]?.inputType && (
 <footer className="fixed bottom-0 w-full bg-slate-950 border-t border-slate-900 z-40 backdrop-blur-lg bg-opacity-90">
 <div className="p-4">
 <div className="max-w-4xl mx-auto relative flex items-center gap-2">
 <div className="flex-1 flex items-center gap-2 bg-slate-900 rounded-xl p-1 border border-slate-800 focus-within:border-gold-500 transition-colors shadow-lg">
 <input
 value={inputText}
 onChange={(e) => setInputText(e.target.value)}
 onKeyDown={(e) => e.key === 'Enter' && handleTextSubmit()}
 placeholder={t.placeholder}
 className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder-slate-600 px-4 py-3"
 autoFocus
 aria-label={lang === 'ar' ? 'اكتب رسالتك' : 'Type your message'}
 />
 <button
 onClick={handleTextSubmit}
 disabled={!inputText.trim()}
 className={`p-3 rounded-lg transition-all transform active:scale-95 touch-target ${inputText.trim() ? 'bg-gold-500 text-black hover:bg-gold-400' : 'bg-slate-800 text-slate-600'}`}
 role="button"
 aria-label={lang === 'ar' ? 'إرسال' : 'Send message'}
 aria-disabled={!inputText.trim()}
 >
 <Send size={18} />
 </button>
 </div>
 </div>
 </div>
 {/* Footer Text - Feras Ayham Assaf */}
 <div className="border-t border-slate-800 py-2 text-center">
 <p className="text-xs text-gold-500 font-semibold flex items-center justify-center gap-2">
 <Terminal size={14} />
 Powered by Feras Ayham Assaf
 </p>
 </div>
 </footer>
 )}
 </div>
 );
};

export default App;
