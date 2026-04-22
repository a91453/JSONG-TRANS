import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '隱私權政策 — NihongoPath',
  description: 'NihongoPath 隱私權政策：說明我們蒐集哪些資料、如何使用，以及你擁有的權利。',
};

const LAST_UPDATED = '2025 年 4 月 22 日';
const CONTACT_EMAIL = 'qwertyuiopasdfghjkl96150@gmail.com';

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-5 py-10 pb-28 text-foreground">
      {/* Header */}
      <div className="mb-10">
        <Link href="/" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors">
          ← 返回首頁
        </Link>
        <h1 className="mt-4 text-3xl font-black tracking-tighter">隱私權政策</h1>
        <p className="mt-1 text-xs text-muted-foreground font-medium">最後更新：{LAST_UPDATED}</p>
        <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
          NihongoPath（以下簡稱「本服務」、「我們」）重視你的隱私。本政策說明我們蒐集哪些資料、如何使用、
          與哪些第三方分享，以及你擁有的權利。使用本服務即表示你同意本政策內容。
        </p>
      </div>

      <div className="space-y-10 text-sm leading-relaxed">

        {/* 1 */}
        <section>
          <h2 className="text-base font-black tracking-tight mb-3">1. 我們蒐集的資料</h2>

          <h3 className="font-bold text-foreground/80 mb-2">1.1 透過 Google 登入時</h3>
          <p className="text-muted-foreground mb-2">
            本服務使用 Firebase Authentication 進行 Google OAuth 登入，申請範圍（scope）僅為
            <code className="mx-1 px-1.5 py-0.5 rounded bg-muted text-xs font-mono">youtube.readonly</code>。
            我們取得的資料為：
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2 mb-2">
            <li>
              <span className="font-semibold text-foreground">YouTube OAuth Access Token</span>：暫存於瀏覽器
              <code className="mx-1 px-1.5 py-0.5 rounded bg-muted text-xs font-mono">sessionStorage</code>，50 分鐘後自動清除。
              僅用於向後端轉錄服務傳遞授權，供 yt-dlp 下載字幕，不會上傳或儲存至伺服器。
            </li>
          </ul>
          <p className="text-muted-foreground text-xs border-l-2 border-muted pl-3">
            我們<strong>不</strong>取得你的電子郵件、顯示名稱、頭像，也不取得 Google 帳號中的其他資料
            （聯絡人、日曆、雲端硬碟等）。
          </p>

          <h3 className="font-bold text-foreground/80 mt-5 mb-2">1.2 使用服務時自動蒐集</h3>
          <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-2">
            <li>
              <span className="font-semibold text-foreground">IP 位址</span>（Vercel 伺服器日誌）：用於防濫用與除錯，
              不與任何帳號資料連結，由 Vercel 自動記錄。
            </li>
            <li>
              <span className="font-semibold text-foreground">字幕快取</span>：已處理的 YouTube 字幕結果儲存於 Firebase Firestore，
              以影片 ID 為 key，供相同影片的後續請求直接取用，不含個人識別資訊。
            </li>
          </ul>

          <h3 className="font-bold text-foreground/80 mt-5 mb-2">1.3 僅存在你瀏覽器的資料</h3>
          <p className="text-muted-foreground mb-2">
            以下資料透過 Zustand + localStorage 儲存於你的裝置，<strong>不會上傳至伺服器</strong>：
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
            <li>學習歷史（已觀看影片、字幕快取）</li>
            <li>個人字典與收藏句子</li>
            <li>應用程式設定（主題、字體大小、顯示偏好）</li>
            <li>連勝天數（Streak）</li>
          </ul>
        </section>

        {/* 2 */}
        <section>
          <h2 className="text-base font-black tracking-tight mb-3">2. 我們如何使用資料</h2>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
            <li>提供、維護本服務（字幕取得、AI 標注、學習功能）。</li>
            <li>字幕快取以減少重複 API 呼叫，提升回應速度。</li>
            <li>防止 API 濫用（透過 Vercel 日誌中的 IP 識別）。</li>
          </ul>
          <p className="mt-3 text-muted-foreground text-xs border-l-2 border-muted pl-3">
            我們<strong>不會</strong>將你的資料販售或租賃給第三方用於行銷。
          </p>
        </section>

        {/* 3 */}
        <section>
          <h2 className="text-base font-black tracking-tight mb-3">3. 第三方服務</h2>
          <p className="text-muted-foreground mb-3">本服務依賴以下第三方服務運作，各服務有其獨立的隱私政策：</p>
          <div className="space-y-2">
            {[
              { name: 'Google（Firebase Auth、OAuth）', url: 'https://policies.google.com/privacy' },
              { name: 'Vercel（網站託管、伺服器日誌）', url: 'https://vercel.com/legal/privacy-policy' },
              { name: 'Firebase / Google Cloud（Firestore 字幕快取）', url: 'https://firebase.google.com/support/privacy' },
              { name: 'Groq / Google Gemini（AI 分析，可選用自備 API Key）', url: 'https://groq.com/privacy-policy/' },
            ].map(({ name, url }) => (
              <div key={name} className="flex items-start gap-2 p-3 bg-muted/30 rounded-xl">
                <span className="text-muted-foreground flex-1">{name}</span>
                <a href={url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-primary font-bold shrink-0 hover:underline">
                  隱私政策 ↗
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* 4 */}
        <section>
          <h2 className="text-base font-black tracking-tight mb-3">4. Cookie 與本地儲存</h2>
          <div className="space-y-3">
            <div className="p-3 bg-muted/30 rounded-xl">
              <p className="font-semibold text-foreground text-xs uppercase tracking-widest mb-1">sessionStorage</p>
              <p className="text-muted-foreground">
                Google YouTube OAuth Token：登入後存入，50 分鐘後自動清除，或關閉分頁時移除。
                僅用於該次轉錄請求，不持久化。
              </p>
            </div>
            <div className="p-3 bg-muted/30 rounded-xl">
              <p className="font-semibold text-foreground text-xs uppercase tracking-widest mb-1">localStorage</p>
              <p className="text-muted-foreground">
                儲存學習歷史、個人字典、收藏句子、設定偏好（主題、字體大小等）。
                資料僅在你的瀏覽器中，不會上傳至伺服器。清除瀏覽器資料將同時刪除這些內容。
              </p>
            </div>
          </div>
          <p className="mt-3 text-muted-foreground text-xs border-l-2 border-muted pl-3">
            我們不使用任何第三方追蹤 Cookie（例如 Google Analytics、Facebook Pixel）。
          </p>
        </section>

        {/* 5 */}
        <section>
          <h2 className="text-base font-black tracking-tight mb-3">5. 資料保留</h2>
          <div className="space-y-2 text-muted-foreground">
            <p><span className="font-semibold text-foreground">OAuth Token（sessionStorage）</span>：50 分鐘後自動過期，關閉分頁即移除。</p>
            <p><span className="font-semibold text-foreground">字幕快取（Firestore）</span>：不設自動過期，可透過「重新分析」功能覆寫。</p>
            <p><span className="font-semibold text-foreground">瀏覽器本地資料（localStorage）</span>：由你自行管理，可隨時清除。</p>
          </div>
        </section>

        {/* 6 */}
        <section>
          <h2 className="text-base font-black tracking-tight mb-3">6. 你的權利</h2>
          <p className="text-muted-foreground mb-3">
            依據中華民國《個人資料保護法》、歐盟 GDPR（如適用），你擁有以下權利：
          </p>
          <div className="grid grid-cols-1 gap-2">
            {[
              ['查詢', '了解我們持有你的哪些資料。'],
              ['刪除', '要求刪除 Firestore 中的字幕快取或其他資料。'],
              ['停止處理', '要求停止使用你的資料（可能導致無法繼續使用服務）。'],
            ].map(([right, desc]) => (
              <div key={right} className="flex gap-3 p-3 bg-muted/30 rounded-xl">
                <span className="text-primary font-black text-sm shrink-0 w-16">{right}</span>
                <span className="text-muted-foreground text-sm">{desc}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-muted-foreground text-xs">
            如需行使以上權利，請透過客服信箱聯絡我們：
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary font-bold ml-1 hover:underline">
              {CONTACT_EMAIL}
            </a>
            ，我們將在 30 天內回覆。
            <br />
            中斷 Google 授權：前往{' '}
            <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer"
              className="text-primary font-bold hover:underline">
              Google 帳號安全設定 ↗
            </a>
            {' '}即可撤銷本服務的 OAuth 授權。
          </p>
        </section>

        {/* 7 */}
        <section>
          <h2 className="text-base font-black tracking-tight mb-3">7. 資料安全</h2>
          <p className="text-muted-foreground">
            我們採取合理的技術措施保護你的資料：全站 HTTPS 加密傳輸、敏感環境變數僅伺服器端存取、
            Firebase 規則限制 Firestore 存取。然而，網際網路傳輸無法保證絕對安全。
            如發生資料外洩事件，我們將在 72 小時內通知受影響的使用者。
          </p>
        </section>

        {/* 8 */}
        <section>
          <h2 className="text-base font-black tracking-tight mb-3">8. 未成年人</h2>
          <p className="text-muted-foreground">
            本服務不主動蒐集 13 歲以下兒童的資料。若你為 13 歲以下兒童的家長或監護人且發現子女使用了本服務，
            請聯絡我們，我們將立即處理。
          </p>
        </section>

        {/* 9 */}
        <section>
          <h2 className="text-base font-black tracking-tight mb-3">9. 政策變更</h2>
          <p className="text-muted-foreground">
            本政策如有重大變更（例如新增資料蒐集項目、改變第三方服務），我們會透過網站公告或電子郵件通知，
            並更新頂部的「最後更新日期」。
          </p>
        </section>

        {/* 10 */}
        <section>
          <h2 className="text-base font-black tracking-tight mb-3">10. 聯絡我們</h2>
          <p className="text-muted-foreground">
            如有隱私權相關問題，請透過客服信箱與我們聯繫：
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary font-bold ml-1 hover:underline">
              {CONTACT_EMAIL}
            </a>
          </p>
        </section>

      </div>

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-border text-center flex items-center justify-center gap-4">
        <Link href="/" className="text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors">
          返回首頁
        </Link>
        <span className="text-muted-foreground/50">·</span>
        <Link href="/terms" className="text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors">
          服務條款
        </Link>
      </div>
    </div>
  );
}
