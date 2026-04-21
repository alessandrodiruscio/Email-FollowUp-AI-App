import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { Button } from "./button";
import { Bold, Italic, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  showVariableHelper?: boolean;
  fontFamily?: string;
  onFontFamilyChange?: (value: string) => void;
  fontSize?: string;
  onFontSizeChange?: (value: string) => void;
  lineHeight?: string;
  onLineHeightChange?: (value: string) => void;
}

const AVAILABLE_VARIABLES = [
  { name: "{{original_subject}}", description: "Subject of the initial email" },
  { name: "{{name}}", description: "Recipient's name" },
  { name: "{{email}}", description: "Recipient's email address" },
  { name: "{{company}}", description: "Recipient's company name" },
];

const FONT_FAMILY_OPTIONS = [
  { value: "sans-serif", label: "Sans Serif" },
  { value: "serif", label: "Serif" },
  { value: "monospace", label: "Monospace" },
  { value: "Georgia", label: "Georgia" },
  { value: "Trebuchet MS", label: "Trebuchet" },
];

const FONT_SIZE_OPTIONS = ["12", "14", "16", "18", "20"];
const LINE_HEIGHT_OPTIONS = [
  { value: "1.2", label: "1.2" },
  { value: "1.4", label: "1.4" },
  { value: "1.6", label: "1.6" },
  { value: "1.8", label: "1.8" },
  { value: "2", label: "2.0" },
];

function plainTextToHtml(text: string): string {
  if (/<[a-z][\s\S]*>/i.test(text)) {
    return text;
  }
  return text
    .split(/\n\n+/)
    .filter(p => p.trim())
    .map(paragraph => {
      const withBr = paragraph.replace(/\n/g, "<br>");
      return `<p>${withBr}</p>`;
    })
    .join("");
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = "200px",
  showVariableHelper = false,
  fontFamily,
  onFontFamilyChange,
  fontSize,
  onFontSizeChange,
  lineHeight,
  onLineHeightChange,
}: RichTextEditorProps) {
  const [variableMenuOpen, setVariableMenuOpen] = useState(false);
  const showStylingControls = !!(onFontFamilyChange || onFontSizeChange || onLineHeightChange);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
    ],
    content: plainTextToHtml(value || ""),
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (editor && value !== undefined) {
      const htmlContent = plainTextToHtml(value);
      if (editor.getHTML() !== htmlContent) {
        try {
          editor.commands.setContent(htmlContent, false);
        } catch (e) {
          console.error("Failed to set editor content:", e);
        }
      }
    }
  }, [value, editor]);

  const insertVariable = (variable: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent(variable).run();
    setVariableMenuOpen(false);
  };

  if (!editor) {
    return (
      <div className="border rounded-lg overflow-hidden bg-white min-h-80 p-4 animate-pulse">
        <div className="h-6 bg-muted rounded w-1/3 mb-4" />
        <div className="space-y-2">
          <div className="h-4 bg-muted rounded w-full" />
          <div className="h-4 bg-muted rounded w-5/6" />
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden flex flex-col">
      {/* Sticky Toolbar */}
      <div className="sticky top-0 z-10 bg-muted/50 border-b p-2 flex flex-wrap gap-1 items-center">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive("bold") ? "bg-primary text-white" : ""}
          title="Bold (Ctrl+B)"
        >
          <Bold className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive("italic") ? "bg-primary text-white" : ""}
          title="Italic (Ctrl+I)"
        >
          <Italic className="w-4 h-4" />
        </Button>

        <div className="w-px bg-border mx-1" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive("bulletList") ? "bg-primary text-white" : ""}
          title="Bullet list"
        >
          <List className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive("orderedList") ? "bg-primary text-white" : ""}
          title="Numbered list"
        >
          <ListOrdered className="w-4 h-4" />
        </Button>

        <div className="w-px bg-border mx-1" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          className={editor.isActive({ textAlign: "left" }) ? "bg-primary text-white" : ""}
          title="Align left"
        >
          <AlignLeft className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          className={editor.isActive({ textAlign: "center" }) ? "bg-primary text-white" : ""}
          title="Align center"
        >
          <AlignCenter className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          className={editor.isActive({ textAlign: "right" }) ? "bg-primary text-white" : ""}
          title="Align right"
        >
          <AlignRight className="w-4 h-4" />
        </Button>

        {showVariableHelper && (
          <>
            <div className="w-px bg-border mx-1" />
            <DropdownMenu open={variableMenuOpen} onOpenChange={setVariableMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  title="Insert dynamic variable"
                  className="gap-1"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-xs font-semibold">Variable</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {AVAILABLE_VARIABLES.map((variable) => (
                  <DropdownMenuItem
                    key={variable.name}
                    onClick={() => insertVariable(variable.name)}
                    className="cursor-pointer"
                  >
                    <span className="font-mono text-sm text-primary font-semibold">{variable.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}

        {showStylingControls && (
          <>
            <div className="w-px bg-border mx-1" />
            {onFontFamilyChange && (
              <select
                value={fontFamily ?? "sans-serif"}
                onChange={(e) => onFontFamilyChange(e.target.value)}
                className="h-7 rounded border border-input bg-background px-1.5 text-xs text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                title="Font family"
              >
                {FONT_FAMILY_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            )}
            {onFontSizeChange && (
              <select
                value={fontSize ?? "16"}
                onChange={(e) => onFontSizeChange(e.target.value)}
                className="h-7 rounded border border-input bg-background px-1.5 text-xs text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                title="Font size"
              >
                {FONT_SIZE_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}px</option>
                ))}
              </select>
            )}
            {onLineHeightChange && (
              <select
                value={lineHeight ?? "1.6"}
                onChange={(e) => onLineHeightChange(e.target.value)}
                className="h-7 rounded border border-input bg-background px-1.5 text-xs text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                title="Line height"
              >
                {LINE_HEIGHT_OPTIONS.map((l) => (
                  <option key={l.value} value={l.value}>LH {l.label}</option>
                ))}
              </select>
            )}
          </>
        )}
      </div>

      {/* Editor */}
      <div 
        className="prose prose-sm dark:prose-invert max-w-none flex-1 overflow-auto"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <EditorContent
          editor={editor}
          className="p-4 bg-white text-foreground focus-within:outline-none"
          style={{ minHeight }}
        />
      </div>
    </div>
  );
}
