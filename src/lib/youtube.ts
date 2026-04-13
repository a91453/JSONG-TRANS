import { YouTubeVideoInfo } from '@/types';

export async function fetchYouTubeInfo(videoId: string): Promise<YouTubeVideoInfo | null> {
  const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const json = await response.json();
    return {
      title: json.title || videoId,
      author: json.author_name || '',
    };
  } catch (error) {
    console.error('Failed to fetch YouTube info:', error);
    return null;
  }
}

/**
 * 從 YouTube 網址中提取影片 ID
 * 支援：watch?v=, shorts/, youtu.be/, embed/, v/
 */
export function extractVideoID(urlString: string): string | null {
  const s = urlString.trim();
  if (!s) return null;

  try {
    const url = new URL(s);
    
    // 處理 youtube.com
    if (url.hostname.includes('youtube.com')) {
      // 處理 shorts, embed, v
      const pathParts = url.pathname.split('/');
      if (pathParts.includes('shorts') || pathParts.includes('embed') || pathParts.includes('v')) {
        return pathParts[pathParts.length - 1];
      }
      // 處理標準 watch?v=
      return url.searchParams.get('v');
    }

    // 處理 youtu.be
    if (url.hostname === 'youtu.be') {
      return url.pathname.slice(1);
    }

    return null;
  } catch (e) {
    console.error('URL parsing failed in extractVideoID, falling back to raw ID check:', e);
    // 處理非完整網址（可能直接是 ID）
    if (s.length === 11 && !s.includes('/') && !s.includes('.')) {
      return s;
    }
    return null;
  }
}
