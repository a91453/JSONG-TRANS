import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '服務條款 — NihongoPath',
  description: 'NihongoPath 服務條款：說明本服務的使用規範、智慧財產權與免責事項。',
};

const LAST_UPDATED = '2025 年 4 月 22 日';
const CONTACT_EMAIL = 'qwertyuiopasdfghjkl96150@gmail.com';

export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto px-5 py-10 pb-28 text-foreground">
      {/* Header */}
      <div className="mb-10">
        <Link href="/" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors">
          ← 返回首頁
        </Link>
        <h1 className="mt-4 text-3xl font-black tracking-tighter">服務條款</h1>
        <p className="mt-1 text-xs text-muted-foreground font-medium">最後更新：{LAST_UPDATED}</p>
        <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
          歡迎使用 NihongoPath（以下簡稱「本服務」、「我們」）。使用本服務即表示你已閱讀、理解並同意本條款全部內容。
          如果你不同意，請停止使用本服務。
        </p>
      </div>

      <div className="space-y-10 text-sm leading-relaxed">

        {/* 1 */}
        <section>
          <h2 className="text-base font-black tracking-tight mb-3">1. 服務內容</h2>
          <p className="text-muted-foreground mb-2">
            本服務為沉浸式日語學習輔助工具，核心功能包含：
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2 mb-3">
            <li>YouTube 影片字幕取得與 Furigana／羅馬拼音／中文翻譯標注</li>
            <li>AI 文法解說與詞彙分析</li>
            <li>個人字典、收藏句子、學習歷史記錄</li>
            <li>練習模式（字卡、測驗、聽寫等）</li>
          </ul>
          <p className="text-muted-foreground text-xs border-l-2 border-muted pl-3">
            本服務與 YouTube、Google、Firebase 等平台的官方運營團隊<strong>無任何關聯</strong>。
            影片中的音樂、畫面及商標均為原發行商／創作者所有，本服務僅在合理使用（fair use）範圍內
            作為語言學習素材呈現，不提供影片內容的下載或再散布。
          </p>
        </section>

        {/* 2 */}
        <section>
          <h2 className="text-base font-black tracking-tight mb-3">2. 帳號與登入</h2>
          <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-2">
            <li>
              本服務透過 Google OAuth（Firebase Authentication）登入，登入僅用於取得 YouTube
              <code className="mx-1 px-1.5 py-0.5 rounded bg-muted text-xs font-mono">youtube.readonly</code>
              授權，供後端下載受限字幕。
            </li>
            <li>你對帳號內發生的一切活動負責，包含不當使用或違反條款造成的後果。</li>
            <li>我們保留在違反條款時暫停或終止使用權限的權利，不另行通知。</li>
          </ul>
        </section>

        {/* 3 */}
        <section>
          <h2 className="text-base font-black tracking-tight mb-3">3. 可接受的使用</h2>
          <p className="text-muted-foreground mb-2">使用本服務時，你同意<strong>不</strong>：</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
            <li>將本服務用於商業轉售、大量自動化爬取或繞過服務配額的行為。</li>
            <li>違反 YouTube《服務條款》或 Google API《服務條款》使用本服務的任一部分。</li>
            <li>嘗試對本服務進行逆向工程、破解、干擾伺服器運作，或上傳惡意程式。</li>
            <li>在字典條目、收藏句子等使用者內容中輸入違反法律、侵權或涉及仇恨言論的內容。</li>
            <li>將取得的字幕資料再散布於公開平台，特別是受版權保護之內容。</li>
          </ul>
        </section>

        {/* 4 */}
        <section>
          <h2 className="text-base font-black tracking-tight mb-3">4. 使用者自備 API Key 與 Cookies</h2>
          <p className="text-muted-foreground mb-2">
            本服務提供可選的「自備 API Key」與「自備 YouTube Cookies」功能：
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-2">
            <li>
              <span className="font-semibold text-foreground">Gemini／Groq API Key</span>：
              你可在設定中填入自己的 API Key，請求將直接使用該 Key 呼叫第三方 AI 服務。
              你需自行負擔該 Key 產生的任何費用，並遵守該服務商的條款。
            </li>
            <li>
              <span className="font-semibold text-foreground">YouTube Cookies（Netscape 格式）</span>：
              你可上傳自己的 cookies.txt 以存取需登入的影片。上傳的 Cookies
              僅在該次轉錄請求中使用，<strong>不會</strong>被記錄或儲存於伺服器。
            </li>
          </ul>
          <p className="mt-3 text-muted-foreground text-xs border-l-2 border-muted pl-3">
            ⚠ 自備 API Key 與 Cookies 屬於你個人之敏感資料，請勿在公用電腦設定，
            並定期於對應平台檢視授權狀態。
          </p>
        </section>

        {/* 5 */}
        <section>
          <h2 className="text-base font-black tracking-tight mb-3">5. 智慧財產權</h2>
          <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-2">
            <li>本服務的程式碼、介面設計、文案為本服務擁有者所有，受著作權法保護。</li>
            <li>YouTube 影片、音樂、歌詞之所有權屬於原發行商／創作者，本服務不主張任何權利。</li>
            <li>
              AI 生成之翻譯、furigana、文法解說內容由第三方 AI 模型產生，
              僅供學習參考，不保證準確性。
            </li>
            <li>
              使用者建立的學習記錄（字典條目、收藏、學習歷史等），所有權歸使用者所有；
              這些資料主要儲存於你瀏覽器的 localStorage，我們不對內容主張任何權利。
            </li>
          </ul>
        </section>

        {/* 6 */}
        <section>
          <h2 className="text-base font-black tracking-tight mb-3">6. 免責聲明</h2>
          <p className="text-muted-foreground mb-2">
            本服務「按現狀」（as-is）與「按可用性」（as-available）提供，<strong>不保證</strong>：
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
            <li>使用本服務必然提升你的日語能力。</li>
            <li>AI 產生之翻譯、讀音、解說內容 100% 準確，使用者應交叉驗證。</li>
            <li>所有 YouTube 影片皆可取得字幕（受影片權限、地區、年齡限制影響）。</li>
            <li>服務 100% 可用、無錯誤、無中斷或免於駭客攻擊。</li>
            <li>第三方 API（Google、Firebase、Groq、Vercel 等）永久可用。</li>
          </ul>
        </section>

        {/* 7 */}
        <section>
          <h2 className="text-base font-black tracking-tight mb-3">7. 責任限制</h2>
          <p className="text-muted-foreground mb-2">
            在法律允許的最大範圍內，本服務對因使用或無法使用本服務造成的任何直接、間接、
            偶發、懲罰性或衍生性損失不負責任，包含但不限於：資料遺失、學習進度中斷、
            時間成本、收益損失、第三方 API 費用等。
          </p>
          <p className="text-muted-foreground">
            任何情況下，本服務對使用者之總賠償責任上限為該使用者為使用本服務實際支付予我們之費用；
            本服務目前為免費提供，因此責任上限為新台幣<strong>零元</strong>。
            自備 API Key 所產生之第三方費用，由使用者自行承擔。
          </p>
        </section>

        {/* 8 */}
        <section>
          <h2 className="text-base font-black tracking-tight mb-3">8. 條款變更</h2>
          <p className="text-muted-foreground">
            我們保留隨時修改本條款的權利。重大變更會透過網站公告或電子郵件通知，
            並更新頂部的「最後更新日期」。你繼續使用本服務即視為接受變更後的條款。
            若不同意變更，請停止使用本服務。
          </p>
        </section>

        {/* 9 */}
        <section>
          <h2 className="text-base font-black tracking-tight mb-3">9. 準據法與管轄</h2>
          <p className="text-muted-foreground">
            本條款依中華民國（台灣）法律解釋。因本條款引起之爭議，
            以台灣臺北地方法院為第一審管轄法院。
          </p>
        </section>

        {/* 10 */}
        <section>
          <h2 className="text-base font-black tracking-tight mb-3">10. 聯絡方式</h2>
          <p className="text-muted-foreground">
            如有任何條款相關問題，請透過客服信箱與我們聯繫：
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary font-bold ml-1 hover:underline">
              {CONTACT_EMAIL}
            </a>
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            請同時參閱我們的{' '}
            <Link href="/privacy" className="text-primary font-bold hover:underline">
              隱私權政策
            </Link>
            。
          </p>
        </section>

      </div>

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-border text-center flex items-center justify-center gap-4">
        <Link href="/" className="text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors">
          返回首頁
        </Link>
        <span className="text-muted-foreground/50">·</span>
        <Link href="/privacy" className="text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors">
          隱私權政策
        </Link>
      </div>
    </div>
  );
}
