import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, X, AlertCircle } from "lucide-react";

interface ImageUploadFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const MAX_FILE_SIZE = 100 * 1024; // 100KB in bytes

export function ImageUploadField({ value, onChange, placeholder = "Paste HTTPS URL or upload image" }: ImageUploadFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [imageError, setImageError] = useState(false);

  const validateHttpsUrl = (url: string): boolean => {
    if (!url) return true; // empty is ok
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setError("");
    setImageError(false);
    
    if (url && !validateHttpsUrl(url)) {
      setError("Please use an HTTPS URL (e.g., https://example.com/image.jpg)");
      return;
    }
    
    onChange(url);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError(`File is too large (${(file.size / 1024).toFixed(1)}KB). Maximum size is 100KB.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError("Please select an image file (PNG, JPG, GIF, etc.)");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Convert to data URL
    setError("");
    setImageError(false);
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      onChange(result);
    };
    reader.onerror = () => {
      setError("Failed to read file. Please try again.");
    };
    reader.readAsDataURL(file);
  };

  const handleClearImage = () => {
    onChange("");
    setError("");
    setImageError(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleImageError = () => {
    setImageError(true);
  };

  const isDataUrl = value?.startsWith('data:');

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={handleUrlChange}
          className="h-10 rounded-lg bg-muted/50 text-sm flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg gap-2"
        >
          <Upload className="w-4 h-4" />
          Upload
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClearImage}
            className="rounded-lg text-destructive hover:bg-destructive/10"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {isDataUrl && (
        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Uploaded image will appear in browser preview. For best results in emails, consider using an HTTPS URL (Imgur, your website, etc.)</span>
        </div>
      )}
      {value && (
        <div className="space-y-2">
          {imageError ? (
            <div className="w-24 h-24 rounded-lg overflow-hidden border border-destructive bg-destructive/5 flex items-center justify-center text-xs text-destructive text-center p-2">
              Image failed to load
            </div>
          ) : (
            <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-input">
              <img 
                src={value} 
                alt="Profile preview" 
                className="w-full h-full object-cover" 
                onError={handleImageError}
              />
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {isDataUrl ? '✓ Uploaded image' : '✓ HTTPS image URL'}
          </p>
        </div>
      )}
    </div>
  );
}
