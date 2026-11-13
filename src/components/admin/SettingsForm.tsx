"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { changePassword, saveSettings } from "@/app/admin/actions";
import { IMAGE_ACCEPT } from "@/lib/constants";
import { toast } from "@/components/Toaster";
import { uploadFile } from "./upload";

type Values = Record<string, string>;

const DEFAULT_LOGO = "/brand/logo.jpg";

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint block">{hint}</span>}
    </label>
  );
}

export function SettingsForm({ initial, account }: { initial: Values; account: string }) {
  const router = useRouter();
  const [v, setV] = useState<Values>(initial);
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwPending, startPw] = useTransition();

  const bind = (key: string) => ({
    value: v[key] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((p) => ({ ...p, [key]: e.target.value })),
  });

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      try {
        const res = await saveSettings(v);
        if (!res.ok) {
          toast(res.error, "error");
          return;
        }
        toast("設定已儲存");
        router.refresh();
      } catch {
        toast("網路連線錯誤，儲存失敗。", "error");
      }
    });
  };

  const onLogo = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const up = await uploadFile(file, "image");
      setV((p) => ({ ...p, logoUrl: up.url }));
      toast("Logo 已上傳，記得按「儲存設定」");
    } catch (e) {
      toast(e instanceof Error ? e.message : "上傳失敗。", "error");
    } finally {
      setUploading(false);
    }
  };

  const submitPw = (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.next !== pw.confirm) {
      toast("兩次輸入的新密碼不一致。", "error");
      return;
    }
    startPw(async () => {
      try {
        const res = await changePassword(pw.current, pw.next);
        if (!res.ok) {
          toast(res.error, "error");
          return;
        }
        toast("密碼已更新");
        setPw({ current: "", next: "", confirm: "" });
      } catch {
        toast("網路連線錯誤，請稍後再試。", "error");
      }
    });
  };

  return (
    <>
      <form onSubmit={save} className="mt-6 space-y-6">
        <section className="panel">
          <h2 className="border-b-2 border-ink bg-paper-2 px-4 py-2.5 font-black">網站基本資料</h2>
          <div className="space-y-5 p-4 md:p-6">
            <div>
              <span className="field-label">社團 Logo</span>
              <div className="flex items-center gap-4">
                <img src={v.logoUrl || DEFAULT_LOGO} alt="目前的 Logo" className="h-20 w-20 flex-none border-2 border-ink object-cover" />
                <div className="space-x-2">
                  <label className="btn btn-sm cursor-pointer bg-white">
                    {uploading ? "上傳中…" : "更換 Logo"}
                    <input type="file" accept={IMAGE_ACCEPT} hidden disabled={uploading} onChange={(e) => { void onLogo(e.target.files); e.target.value = ""; }} />
                  </label>
                  {v.logoUrl !== DEFAULT_LOGO && (
                    <button type="button" className="btn btn-sm" onClick={() => setV((p) => ({ ...p, logoUrl: DEFAULT_LOGO }))}>還原預設</button>
                  )}
                  <p className="field-hint">建議使用正方形圖片。</p>
                </div>
              </div>
            </div>
            <Row label="網站名稱"><input className="input" maxLength={60} required {...bind("siteName")} /></Row>
            <Row label="網站簡稱"><input className="input" maxLength={60} {...bind("siteShortName")} /></Row>
            <Row label="英文名稱"><input className="input" maxLength={120} {...bind("siteNameEn")} /></Row>
          </div>
        </section>

        <section className="panel">
          <h2 className="border-b-2 border-ink bg-paper-2 px-4 py-2.5 font-black">首頁與關於頁</h2>
          <div className="space-y-5 p-4 md:p-6">
            <Row label="首頁標語" hint="用逗號（，）分成兩句時，第二句會以強調色顯示。">
              <input className="input" maxLength={60} required {...bind("heroTagline")} />
            </Row>
            <Row label="首頁簡介"><textarea className="input" rows={3} maxLength={300} {...bind("heroIntro")} /></Row>
            <Row label="社團簡介（關於頁）" hint="可以分段，每一行會成為一個段落。">
              <textarea className="input" rows={6} maxLength={2000} {...bind("aboutText")} />
            </Row>
          </div>
        </section>

        <section className="panel">
          <h2 className="border-b-2 border-ink bg-paper-2 px-4 py-2.5 font-black">社群與聯絡方式</h2>
          <div className="grid gap-5 p-4 sm:grid-cols-2 md:p-6">
            <Row label="Instagram 連結"><input className="input" type="url" placeholder="https://" {...bind("instagramUrl")} /></Row>
            <Row label="Facebook 連結"><input className="input" type="url" placeholder="https://" {...bind("facebookUrl")} /></Row>
            <Row label="LINE 連結"><input className="input" type="url" placeholder="https://" {...bind("lineUrl")} /></Row>
            <Row label="其他社群連結"><input className="input" type="url" placeholder="https://" {...bind("otherSocialUrl")} /></Row>
            <Row label="聯絡 Email"><input className="input" type="email" {...bind("contactEmail")} /></Row>
            <Row label="其他聯絡方式"><input className="input" maxLength={200} {...bind("contactOther")} /></Row>
          </div>
        </section>

        <section className="panel">
          <h2 className="border-b-2 border-ink bg-paper-2 px-4 py-2.5 font-black">頁尾</h2>
          <div className="space-y-5 p-4 md:p-6">
            <Row label="Footer 文字"><input className="input" maxLength={200} {...bind("footerText")} /></Row>
            <Row label="中原大學相關資訊"><input className="input" maxLength={200} {...bind("cycuInfo")} /></Row>
          </div>
        </section>

        <div className="sticky bottom-0 -mx-4 border-t-2 border-ink bg-paper px-4 py-3 md:-mx-8 md:px-8">
          <button type="submit" className="btn btn-ink" disabled={pending || uploading}>{pending ? "儲存中…" : "儲存設定"}</button>
        </div>
      </form>

      <form onSubmit={submitPw} className="panel mt-10">
        <h2 className="border-b-2 border-ink bg-paper-2 px-4 py-2.5 font-black">變更密碼（帳號：{account}）</h2>
        <div className="grid gap-5 p-4 sm:grid-cols-3 md:p-6">
          <Row label="目前的密碼">
            <input className="input" type="password" autoComplete="current-password" required value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
          </Row>
          <Row label="新密碼" hint="至少 10 個字元">
            <input className="input" type="password" autoComplete="new-password" required minLength={10} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
          </Row>
          <Row label="再次輸入新密碼">
            <input className="input" type="password" autoComplete="new-password" required minLength={10} value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
          </Row>
          <div className="sm:col-span-3">
            <button type="submit" className="btn" disabled={pwPending}>{pwPending ? "更新中…" : "更新密碼"}</button>
          </div>
        </div>
      </form>
    </>
  );
}
