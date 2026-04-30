'use client';
/**
 * Dictionary 同步 hook：
 *   - upload(): 把本地字典推到雲端（覆寫）
 *   - download(merge): 從雲端拉字典（merge=true 用 importEntries 智慧合併，false 直接覆蓋）
 *   - fetchStatus(): 拿雲端最後更新時間 + 條目數
 *
 * 需要使用者已登入 Firebase Auth；ID token 自動帶在 Authorization 標頭。
 */

import { useCallback, useState } from 'react';
import { getFirebaseAuth } from '@/lib/firebase-client';
import { useDictionaryStore } from '@/store/use-app-store';
import type { DictEntry } from '@/types';

export interface CloudStatus {
  hasCloud:  boolean;
  updatedAt: number | null;
  entryCount: number | null;
}

async function getIdToken(): Promise<string | null> {
  const auth = getFirebaseAuth();
  const user = auth?.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch {
    return null;
  }
}

export function useDictionarySync() {
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dict = useDictionaryStore();

  const upload = useCallback(async (): Promise<{ ok: boolean; updatedAt?: number }> => {
    setBusy(true); setError(null);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('請先登入 Google 帳號');

      const payload = {
        dictionary: {
          entries:        dict.entries,
          hiddenPresets:  dict.hiddenPresets,
          version:        1,
        },
      };
      const res  = await fetch('/api/sync-dictionary', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? '上傳失敗');
      return { ok: true, updatedAt: data.updatedAt };
    } catch (e: any) {
      setError(e?.message ?? String(e));
      return { ok: false };
    } finally {
      setBusy(false);
    }
  }, [dict.entries, dict.hiddenPresets]);

  const download = useCallback(async (mode: 'merge' | 'replace'): Promise<{ ok: boolean; processed?: number }> => {
    setBusy(true); setError(null);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('請先登入 Google 帳號');

      const res  = await fetch('/api/sync-dictionary', {
        method:  'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? '下載失敗');
      if (!data.hasCloud) throw new Error('雲端尚無資料，請先用「上傳到雲端」建立');

      const cloudEntries: DictEntry[] = Array.isArray(data.dictionary?.entries) ? data.dictionary.entries : [];
      const cloudHidden:  string[]    = Array.isArray(data.dictionary?.hiddenPresets) ? data.dictionary.hiddenPresets : [];

      let processed = 0;
      if (mode === 'replace') {
        // 強硬覆寫：直接重設 store
        useDictionaryStore.setState({ entries: cloudEntries, hiddenPresets: cloudHidden });
        processed = cloudEntries.length;
      } else {
        processed = dict.importEntries(cloudEntries);
        // 合併隱藏詞清單（聯集）
        const merged = Array.from(new Set([...dict.hiddenPresets, ...cloudHidden]));
        useDictionaryStore.setState({ hiddenPresets: merged });
      }
      return { ok: true, processed };
    } catch (e: any) {
      setError(e?.message ?? String(e));
      return { ok: false };
    } finally {
      setBusy(false);
    }
  }, [dict]);

  const fetchStatus = useCallback(async (): Promise<CloudStatus | null> => {
    try {
      const token = await getIdToken();
      if (!token) return null;
      const res  = await fetch('/api/sync-dictionary', {
        method:  'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.ok) return null;
      const entryCount = Array.isArray(data.dictionary?.entries) ? data.dictionary.entries.length : null;
      return { hasCloud: !!data.hasCloud, updatedAt: data.updatedAt ?? null, entryCount };
    } catch {
      return null;
    }
  }, []);

  return { busy, error, upload, download, fetchStatus };
}
