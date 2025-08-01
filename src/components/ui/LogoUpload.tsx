"use client";

import React, { useState, useRef } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { Button } from "./button";
import { Label } from "./label";
import { cn } from "@/lib/utils";

interface LogoUploadProps {
  value?: string;
  onChange: (file: File | null, previewUrl: string | null) => void;
  onRemove?: () => void;
  label?: string;
  description?: string;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
}

export function LogoUpload({
  value,
  onChange,
  onRemove,
  label = "Logo",
  description = "Sube tu logo (PNG, JPG, WebP o SVG, máx 1MB)",
  className,
  disabled = false,
  loading = false,
  error
}: LogoUploadProps) {
  const [preview, setPreview] = useState<string | null>(value || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      alert('Solo se permiten archivos de imagen (JPEG, PNG, WebP, SVG)');
      return;
    }

    if (file.size > 1 * 1024 * 1024) {
      alert('El archivo debe ser menor a 1MB');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const previewUrl = e.target?.result as string;
      setPreview(previewUrl);
      onChange(file, previewUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = () => {
    setPreview(null);
    onChange(null, null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onRemove?.();
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label htmlFor="logo-upload">
          {label}
        </Label>
      )}
      
      <div className="relative">
        {preview ? (
          <div className="relative inline-block">
            <div className="w-32 h-32 rounded-lg border-2 border-gray-200 overflow-hidden bg-white">
              <img
                src={preview}
                alt="Logo preview"
                className="w-full h-full object-contain"
              />
            </div>
            
            {!disabled && !loading && (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 h-6 w-6"
                onClick={handleRemove}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            
            {loading && (
              <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-lg">
                <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
              </div>
            )}
          </div>
        ) : (
          <label
            htmlFor="logo-upload"
            className={cn(
              "flex flex-col items-center justify-center w-32 h-32",
              "border-2 border-dashed border-gray-300 rounded-lg",
              "cursor-pointer hover:border-purple-400 transition-colors",
              "bg-gray-50 hover:bg-gray-100",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <Upload className="w-8 h-8 text-gray-400 mb-2" />
            <span className="text-xs text-gray-500">Subir logo</span>
            <input
              ref={fileInputRef}
              id="logo-upload"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/svg+xml"
              onChange={handleFileSelect}
              disabled={disabled || loading}
              className="hidden"
            />
          </label>
        )}
      </div>

      {description && !error && (
        <p className="text-xs text-gray-500">{description}</p>
      )}

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}