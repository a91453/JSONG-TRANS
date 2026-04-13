
"use client"

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Gamepad2, Book, LayoutDashboard, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { label: '首頁', icon: Home, href: '/' },
  { label: '練習', icon: Gamepad2, href: '/practice' },
  { label: '字典', icon: Book, href: '/dictionary' },
  { label: '進度', icon: LayoutDashboard, href: '/dashboard' },
  { label: '設定', icon: Settings, href: '/settings' },
];

export function Navigation() {
  const pathname = usePathname();

  // 隱藏在特定頁面（如學習頁面，如果需要全螢幕感的話，但目前建議保留以便導航）
  // const isLearnPage = pathname === '/learn';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-t pb-safe">
      <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all duration-200",
                isActive 
                  ? "text-primary scale-105" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className={cn(
                "p-1.5 rounded-xl mb-0.5 transition-colors",
                isActive ? "bg-primary/10" : "bg-transparent"
              )}>
                <Icon size={20} className={cn(isActive ? "opacity-100" : "opacity-70")} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
