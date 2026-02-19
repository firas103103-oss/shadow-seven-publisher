import React, { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../stores/appStore';
import { Menu, Moon, Sun, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
  sidebar?: ReactNode;
  header?: ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children, sidebar, header }) => {
  const { theme, setTheme, sidebarOpen, setSidebarOpen } = useAppStore();

  const themeStyles = {
    dark: 'bg-slate-950 text-slate-100',
    light: 'bg-slate-50 text-slate-900',
    cyber: 'bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 text-cyan-50'
  };

  const cycleTheme = () => {
    const themes: Array<'dark' | 'light' | 'cyber'> = ['dark', 'light', 'cyber'];
    const currentIndex = themes.indexOf(theme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    setTheme(nextTheme);
  };

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Sparkles;

  return (
    <div className={`min-h-screen ${themeStyles[theme]} transition-colors duration-500`}>
      {/* Header */}
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className={`fixed top-0 left-0 right-0 h-16 z-50 backdrop-blur-xl border-b ${
          theme === 'cyber'
            ? 'bg-slate-950/80 border-cyan-500/30'
            : theme === 'dark'
            ? 'bg-slate-900/80 border-slate-800'
            : 'bg-white/80 border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between h-full px-6">
          {/* Left: Menu + Logo */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-slate-800/50 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>

            <motion.div
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-3"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                theme === 'cyber'
                  ? 'bg-gradient-to-br from-cyan-500 to-purple-600'
                  : 'bg-gradient-to-br from-blue-500 to-purple-600'
              }`}>
                <span className="text-2xl font-bold text-white">𝕏</span>
              </div>
              <div>
                <h1 className="text-xl font-bold">X-Book</h1>
                <p className="text-xs opacity-70">Smart Publisher</p>
              </div>
            </motion.div>
          </div>

          {/* Center: Header Content */}
          {header && (
            <div className="flex-1 flex justify-center">
              {header}
            </div>
          )}

          {/* Right: Theme Toggle */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={cycleTheme}
            className={`p-3 rounded-xl ${
              theme === 'cyber'
                ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 hover:from-cyan-500/30 hover:to-purple-500/30'
                : theme === 'dark'
                ? 'bg-slate-800 hover:bg-slate-700'
                : 'bg-slate-200 hover:bg-slate-300'
            } transition-all duration-300`}
          >
            <ThemeIcon className="w-5 h-5" />
          </motion.button>
        </div>
      </motion.header>

      {/* Main Content */}
      <div className="flex pt-16 h-screen">
        {/* Sidebar */}
        <AnimatePresence>
          {sidebarOpen && sidebar && (
            <motion.aside
              initial={{ x: -300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className={`w-80 fixed left-0 top-16 bottom-0 z-40 border-r overflow-y-auto ${
                theme === 'cyber'
                  ? 'bg-slate-950/95 backdrop-blur-xl border-cyan-500/30'
                  : theme === 'dark'
                  ? 'bg-slate-900/95 backdrop-blur-xl border-slate-800'
                  : 'bg-white/95 backdrop-blur-xl border-slate-200'
              }`}
            >
              {sidebar}
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Toggle Sidebar Button */}
        {!sidebarOpen && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setSidebarOpen(true)}
            className={`fixed left-0 top-24 z-40 p-2 rounded-r-lg ${
              theme === 'cyber'
                ? 'bg-cyan-500/20 hover:bg-cyan-500/30'
                : theme === 'dark'
                ? 'bg-slate-800 hover:bg-slate-700'
                : 'bg-slate-200 hover:bg-slate-300'
            }`}
          >
            <ChevronRight className="w-5 h-5" />
          </motion.button>
        )}

        {/* Main Content Area */}
        <motion.main
          layout
          className={`flex-1 overflow-y-auto transition-all duration-300 ${
            sidebarOpen ? 'ml-80' : 'ml-0'
          }`}
        >
          <div className="container mx-auto px-6 py-8">
            {children}
          </div>
        </motion.main>
      </div>
    </div>
  );
};
