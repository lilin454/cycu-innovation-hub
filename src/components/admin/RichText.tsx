"use client";

import { useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Placeholder from "@tiptap/extension-placeholder";
import { IMAGE_ACCEPT } from "@/lib/constants";
import { toast } from "@/components/Toaster";
import { uploadFile } from "./upload";

const COLORS = [
  ["#0b2a4a", "深藍（預設）"],
  ["#b93c0e", "橘紅"],
  ["#0f6f70", "青綠"],
  ["#8a5a00", "金黃"],
  ["#b42318", "紅色"],
  ["#55657a", "灰色"],
];

function Btn({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-9 min-w-9 items-center justify-center px-2 text-sm font-bold disabled:opacity-35 ${
        active ? "bg-ink text-paper" : "hover:bg-sun-soft"
      }`}
    >
      {children}
    </button>
  );
}

const Sep = () => <span className="mx-1 h-6 w-px flex-none bg-line" aria-hidden />;

function Toolbar({ editor, onPickImage, uploading }: { editor: Editor; onPickImage: () => void; uploading: boolean }) {
  const inTable = editor.isActive("table");
  const setLink = () => {
    const prev = (editor.getAttributes("link").href as string | undefined) ?? "";
    const input = window.prompt("請輸入連結網址（留空可移除連結）", prev || "https://");
    if (input === null) return;
    const url = input.trim();
    if (!url || url === "https://") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    if (!/^(https?:\/\/|mailto:|tel:)/i.test(url)) {
      toast("連結必須以 http://、https://、mailto: 或 tel: 開頭。", "error");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div className="sticky top-[7.25rem] z-10 border-b-2 border-ink bg-paper-2 lg:top-16" role="toolbar" aria-label="文字格式">
      <div className="flex flex-wrap items-center gap-y-1 p-1.5">
        <Btn title="大標題" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>標題</Btn>
        <Btn title="副標題" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>副標</Btn>
        <Btn title="一般內文" active={editor.isActive("paragraph")} onClick={() => editor.chain().focus().setParagraph().run()}>內文</Btn>
        <Sep />
        <Btn title="粗體" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></Btn>
        <Btn title="斜體" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></Btn>
        <Btn title="底線" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></Btn>
        <Btn title="刪除線" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></Btn>
        <Sep />
        <span className="flex items-center gap-1 px-1" role="group" aria-label="文字顏色">
          {COLORS.map(([c, name]) => (
            <button
              key={c}
              type="button"
              title={`文字顏色：${name}`}
              aria-label={`文字顏色：${name}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() =>
                c === COLORS[0][0] ? editor.chain().focus().unsetColor().run() : editor.chain().focus().setColor(c).run()
              }
              className={`h-5 w-5 border-2 ${editor.isActive("textStyle", { color: c }) ? "border-flame" : "border-white"} outline outline-1 outline-line`}
              style={{ background: c }}
            />
          ))}
        </span>
        <Sep />
        <Btn title="條列清單" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>• 清單</Btn>
        <Btn title="編號清單" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. 編號</Btn>
        <Btn title="引言區塊" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>❝ 引言</Btn>
        <Btn title="分隔線" onClick={() => editor.chain().focus().setHorizontalRule().run()}>― 分隔</Btn>
        <Sep />
        <Btn title="超連結" active={editor.isActive("link")} onClick={setLink}>🔗 連結</Btn>
        <Btn title="插入圖片" disabled={uploading} onClick={onPickImage}>{uploading ? "上傳中…" : "🖼 圖片"}</Btn>
        <Btn title="插入表格" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>▦ 表格</Btn>
        <Sep />
        <Btn title="復原" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>↶</Btn>
        <Btn title="重做" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>↷</Btn>
      </div>
      {inTable && (
        <div className="flex flex-wrap items-center gap-y-1 border-t border-line bg-sun-soft p-1.5 text-xs">
          <span className="px-2 font-black">表格</span>
          <Btn title="在下方新增一列" onClick={() => editor.chain().focus().addRowAfter().run()}>＋列</Btn>
          <Btn title="在右方新增一欄" onClick={() => editor.chain().focus().addColumnAfter().run()}>＋欄</Btn>
          <Btn title="刪除這一列" onClick={() => editor.chain().focus().deleteRow().run()}>−列</Btn>
          <Btn title="刪除這一欄" onClick={() => editor.chain().focus().deleteColumn().run()}>−欄</Btn>
          <Btn title="切換標題列" onClick={() => editor.chain().focus().toggleHeaderRow().run()}>標題列</Btn>
          <Btn title="刪除整個表格" onClick={() => editor.chain().focus().deleteTable().run()}>刪除表格</Btn>
        </div>
      )}
    </div>
  );
}

export function RichText({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] } }),
      Underline,
      TextStyle,
      Color,
      Link.configure({ openOnClick: false, autolink: true, protocols: ["http", "https", "mailto", "tel"] }),
      Image.configure({ inline: false }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder: "在這裡撰寫活動介紹、報名辦法、活動流程、注意事項…" }),
    ],
    content: value,
    editorProps: { attributes: { class: "tiptap rich", "aria-label": "公告內文" } },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? "" : e.getHTML()),
  });

  const insertImages = async (files: FileList | null) => {
    if (!files?.length || !editor) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const up = await uploadFile(file, "image");
        editor.chain().focus().setImage({ src: up.url, alt: file.name.replace(/\.[^.]+$/, "") }).run();
      }
      toast("圖片已插入內文");
    } catch (e) {
      toast(e instanceof Error ? e.message : "圖片上傳失敗。", "error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="border-2 border-ink bg-white">
      {editor ? (
        <Toolbar editor={editor} uploading={uploading} onPickImage={() => fileRef.current?.click()} />
      ) : (
        <div className="border-b-2 border-ink bg-paper-2 p-3 text-sm text-muted">編輯器載入中…</div>
      )}
      <EditorContent editor={editor} />
      <input ref={fileRef} type="file" accept={IMAGE_ACCEPT} multiple hidden onChange={(e) => insertImages(e.target.files)} />
    </div>
  );
}
