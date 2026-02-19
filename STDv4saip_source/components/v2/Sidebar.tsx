import React from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '../../stores/appStore';
import {
  FileText,
  Sparkles,
  Globe,
  Settings,
  History,
  BookOpen,
  TrendingUp,
  HelpCircle
} from 'lucide-react';

interface SidebarProps {
  activeSection?: string;
  onSectionChange?: (section: string) => void;
}

const menuItems = {
  ar: [
    { id: 'new', label: 'مشروع جديد', icon: Sparkles, color: 'cyan' },
    { id: 'manuscripts', label: 'مخطوطاتي', icon: FileText, color: 'purple' },
    { id: 'history', label: 'السجل', icon: History, color: 'blue' },
    { id: 'library', label: 'مكتبتي', icon: BookOpen, color: 'green' },
    { id: 'analytics', label: 'الإحصائيات', icon: TrendingUp, color: 'orange' },
    { id: 'settings', label: 'الإعدادات', icon: Settings, color: 'gray' },
    { id: 'help', label: 'المساعدة', icon: HelpCircle, color: 'pink' }
  ],
  en: [
    { id: 'new', label: 'New Project', icon: Sparkles, color: 'cyan' },
    { id: 'manuscripts', label: 'My Manuscripts', icon: FileText, color: 'purple' },
    { id: 'history', label: 'History', icon: History, color: 'blue' },
    { id: 'library', label: 'Library', icon: BookOpen, color: 'green' },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp, color: 'orange' },
    { id: 'settings', label: 'Settings', icon: Settings, color: 'gray' },
    { id: 'help', label: 'Help', icon: HelpCircle, color: 'pink' }
  ],
  de: [
    { id: 'new', label: 'Neues Projekt', icon: Sparkles, color: 'cyan' },
    { id: 'manuscripts', label: 'Meine Manuskripte', icon: FileText, color: 'purple' },
    { id: 'history', label: 'Verlauf', icon: History, color: 'blue' },
    { id: 'library', label: 'Bibliothek', icon: BookOpen, color: 'green' },
    { id: 'analytics', label: 'Analytik', icon: TrendingUp, color: 'orange' },
    { id: 'settings', label: 'Einstellungen', icon: Settings, color: 'gray' },
    { id: 'help', label: 'Hilfe', icon: HelpCircle, color: 'pink' }
  ]
};

const colorClasses = {
  cyan: 'from-cyan-500 to-cyan-600',
  purple: 'from-purple-500 to-purple-600',
  blue: 'from-blue-500 to-blue-600',
  green: 'from-green-500 to-green-600',
  orange: 'from-orange-500 to-orange-600',
  gray: 'from-gray-500 to-gray-600',
  pink: 'from-pink-500 to-pink-600'
};

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection = 'new',
  onSectionChange
}) => {
  const { theme, language } = useAppStore();
  const items = menuItems[language] || menuItems.ar;

  return (
    <div className="p-4 space-y-2">
      {items.map((item, index) => {
        const Icon = item.icon;
        const isActive = activeSection === item.id;

        return (
          <motion.button
            key={item.id}
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ scale: 1.02, x: 5 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSectionChange?.(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
              isActive
                ? theme === 'cyber'
                  ? `bg-gradient-to-r ${colorClasses[item.color as keyof typeof colorClasses]} shadow-lg shadow-${item.color}-500/50`
                  : theme === 'dark'
                  ? 'bg-slate-800 shadow-lg'
                  : 'bg-slate-200 shadow-lg'
                : theme === 'cyber'
                ? 'hover:bg-slate-800/50'
                : theme === 'dark'
                ? 'hover:bg-slate-800/50'
                : 'hover:bg-slate-100'
            }`}
          >
            <div className={`p-2 rounded-lg ${
              isActive && theme === 'cyber'
                ? 'bg-white/10'
                : !isActive && theme === 'cyber'
                ? 'bg-slate-800/50'
                : !isActive && theme === 'dark'
                ? 'bg-slate-700/50'
                : 'bg-slate-300/50'
            }`}>
              <Icon className="w-5 h-5" />
            </div>

            <span className={`flex-1 text-left font-medium ${
              isActive ? 'text-white' : ''
            }`}>
              {item.label}
            </span>

            {isActive && (
              <motion.div
                layoutId="activeIndicator"
                className="w-1 h-8 rounded-full bg-white"
                initial={false}
                transition={{ type: 'spring', damping: 25, stiffness: 400 }}
              />
            )}
          </motion.button>
        );
      })}

      {/* Stats Card */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className={`mt-8 p-4 rounded-xl ${
          theme === 'cyber'
            ? 'bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-cyan-500/30'
            : theme === 'dark'
            ? 'bg-slate-800 border border-slate-700'
            : 'bg-slate-100 border border-slate-200'
        }`}
      >
        <div className="text-sm opacity-70 mb-2">
          {language === 'ar' ? 'إحصائياتك' : language === 'en' ? 'Your Stats' : 'Ihre Statistiken'}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-2xl font-bold text-cyan-400">12</div>
            <div className="text-xs opacity-70">
              {language === 'ar' ? 'كتب' : language === 'en' ? 'Books' : 'Bücher'}
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-400">847</div>
            <div className="text-xs opacity-70">
              {language === 'ar' ? 'صفحات' : language === 'en' ? 'Pages' : 'Seiten'}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
