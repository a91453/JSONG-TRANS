'use client';
/**
 * Google OAuth hook — 用於取得 YouTube readonly access token。
 *
 * 用途：將 token 傳給後端 Cloud Run 服務（X-Google-Token 標頭），
 * 讓 yt-dlp 以合法的 Google 帳號憑證繞過 GCP IP 封鎖。
 *
 * Token 以 sessionStorage 暫存 50 分鐘，`getValidToken()` 自動檢查過期。
 */

import { useState, useCallback } from 'react';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase-client';

const YOUTUBE_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';
const TOKEN_KEY    = 'jsong_google_yt_token';
const EXPIRY_KEY   = 'jsong_google_yt_expiry';
const TOKEN_TTL_MS = 50 * 60 * 1000;

export function useGoogleAuth() {
  const [isSigningIn, setIsSigningIn] = useState(false);

  const getValidToken = useCallback((): string | null => {
    if (typeof window === 'undefined') return null;
    const token  = sessionStorage.getItem(TOKEN_KEY);
    const expiry = sessionStorage.getItem(EXPIRY_KEY);
    if (!token || !expiry) return null;
    const expiryMs = parseInt(expiry, 10);
    if (isNaN(expiryMs) || Date.now() > expiryMs) {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(EXPIRY_KEY);
      return null;
    }
    return token;
  }, []);

  const signIn = useCallback(async (): Promise<string | null> => {
    const auth = getFirebaseAuth();
    if (!auth) {
      console.warn('[GoogleAuth] Firebase 未初始化，無法登入。請確認 NEXT_PUBLIC_FIREBASE_* 環境變數已設定。');
      return null;
    }

    setIsSigningIn(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope(YOUTUBE_SCOPE);
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

  const signOut = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (auth) await firebaseSignOut(auth).catch(() => {});
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(EXPIRY_KEY);
  }, []);

  return { isSigningIn, signIn, signOut, getValidToken };
}
