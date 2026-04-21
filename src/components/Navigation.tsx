
"use client"

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Gamepad2, Book, LayoutDashboard, Settings, LogIn, LogOut, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGoogleAuth } from '@/hooks/use-google-auth';

const navItems = [
  { label: '首頁', icon: Home, href: '/' },
  { label: '練習', icon: Gamepad2, href: '/practice' },
  { label: '字典', icon: Book, href: '/dictionary' },
  { label: '進度', icon: LayoutDashboard, href: '/dashboard' },
  { label: '設定', icon: Settings, href: '/settings' },
];

export function Navigation() {
  const pathname = usePathname();
  const { signIn, signOut, getValidToken, isSigningIn } = useGoogleAuth();
  const [isSignedIn, setIsSignedIn] = useState(false);

  // sessionStorage 只在 client 可讀；每分鐘重新確認 token 是否過期
  useEffect(() => {
    const check = () => setIsSignedIn(!!getValidToken());
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [getValidToken]);

  const handleAuthClick = async () => {
    if (isSignedIn) {
      await signOut();
      setIsSignedIn(false);
    } else {
      const token = await signIn();
      setIsSignedIn(!!token);
    }
  };

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

        {/* Google 帳號狀態按鈕 */}
        <button
          onClick={handleAuthClick}
          disabled={isSigningIn}
          title={isSignedIn ? '已連結 Google，點擊登出' : '使用 Google 登入以獲取字幕'}
          className={cn(
            "flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all duration-200",
            isSignedIn ? "text-green-600" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <div className={cn(
            "relative p-1.5 rounded-xl mb-0.5 transition-colors",
            isSignedIn ? "bg-green-500/10" : "bg-transparent"
          )}>
            {isSigningIn
              ? <Loader2 size={20} className="animate-spin opacity-70" />
              : isSignedIn
                ? <LogOut size={20} />
                : <LogIn  size={20} className="opacity-70" />
            }
            {/* 已登入的綠點指示器 */}
            {isSignedIn && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-500 ring-1 ring-background" />
            )}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-tight">
            {isSignedIn ? 'Google' : '登入'}
          </span>
        </button>
      </div>
    </nav>
  );
}
