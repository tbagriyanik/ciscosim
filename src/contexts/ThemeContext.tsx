'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
 theme: Theme;
 setTheme: (theme: Theme) => void;
 toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
 const [theme, setTheme] = useState<Theme>('dark');
 const [initialized, setInitialized] = useState(false);

 // İlk mount'ta localStorage'dan tema yükle (sadece bir kez)
 useEffect(() => {
 if (initialized) return;
 
 try {
 const saved = localStorage.getItem('network-sim-theme');
 if (saved === 'dark' || saved === 'light') {
 setTheme(saved);
 }
 } catch {
 // localStorage erişim hatası - varsayılan dark kullan
 }
 setInitialized(true);
 }, [initialized]);

 // Tema değiştiğinde kaydet ve uygula
 useEffect(() => {
 if (!initialized) return;
 
 try {
 localStorage.setItem('network-sim-theme', theme);
 } catch {
 // localStorage erişim hatası
 }
 
 // DOM'u güncelle
 const root = document.documentElement;
 if (theme === 'dark') {
 root.classList.add('dark');
 root.classList.remove('light');
 } else {
 root.classList.add('light');
 root.classList.remove('dark');
 }
 }, [theme, initialized]);

 const toggleTheme = useCallback(() => {
 setTheme(prev => prev === 'dark' ? 'light' : 'dark');
 }, []);

 return (
 <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
 {children}
 </ThemeContext.Provider>
 );
}

export const useTheme = () => {
 const context = useContext(ThemeContext);
 if (context === undefined) {
 throw new Error('useTheme must be used within a ThemeProvider');
 }
 return context;
};
