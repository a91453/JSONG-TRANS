'use client';
/**
 * Google OAuth hook — 用於取得 YouTube readonly access token。
 *
 * 用途：將 token 傳給後端 Cloud Run 服務（X-Google-Token 標頭），
 * 讓 yt-dlp 以合法的 Google 帳號憑證繞過 GCP IP 封鎖。
 *
 * Token 以 sessionStorage 暫存，50 分鐘後自動過期（Google access token ~60 min）。
 */

import { useState, useCallback } from 'react';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth } from '@/lib/firebase-client';

const YOUTUBE_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';
const TOKEN_KEY    = 'jsong_google_yt_token';
const EXPIRY_KEY   = 'jsong_google_yt_expiry';
const TOKEN_TTL_MS = 50 * 60 * 1000; // 50 min（Google token ~60 min 過期）

export function useGoogleAuth() {
  const [isSigningIn, setIsSigningIn] = useState(false);

  /** 回傳 sessionStorage 中的有效 token，過期或不存在時回傳 null */
  const getValidToken = useCallback((): string | null => {
    if (typeof window === 'undefined') return null;
    const token  = sessionStorage.getItem(TOKEN_KEY);
    const expiry = sessionStorage.getItem(EXPIRY_KEY);
    if (!token || !expiry) return null;
    if (Date.now() > parseInt(expiry, 10)) {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(EXPIRY_KEY);
      return null;
    }
    return token;
  }, []);

  /**
   * 彈出 Google 登入視窗，要求 YouTube readonly 授權。
   * 成功後將 access token 存入 sessionStorage 並回傳。
   * 使用者關閉視窗時回傳 null（不拋出例外）。
   */
  const signIn = useCallback(async (): Promise<string | null> => {
    setIsSigningIn(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope(YOUTUBE_SCOPE);
      // 每次強制顯示帳號選擇畫面，確保取得新的 access token
      provider.setCustomParameters({ prompt: 'consent' });

      const result     = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token      = credential?.accessToken;

      if (token) {
        sessionStorage.setItem(TOKEN_KEY,  token);
        sessionStorage.setItem(EXPIRY_KEY, String(Date.now() + TOKEN_TTL_MS));
        return token;
      }
      return null;
    } catch (e: any) {
      // 使用者主動關閉視窗 — 非錯誤情境，靜默回傳 null
      if (
        e.code === 'auth/popup-closed-by-user' ||
        e.code === 'auth/cancelled-popup-request'
      ) {
        return null;
      }
      throw e;
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  /** 登出 Firebase 並清除 sessionStorage 的 token */
  const signOut = useCallback(async () => {
    await firebaseSignOut(auth).catch(() => {});
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(EXPIRY_KEY);
  }, []);

  return { isSigningIn, signIn, signOut, getValidToken };
}
