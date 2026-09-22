"use client";

import { useRef, useState } from "react";
import { Camera, FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatFileSize, isSupportedDocumentFile } from "../lib/file-kind";

export function UniversalDocumentPicker({
  onFileSelected,
  disabled = false,
  loading = false,
  cameraLabel = "Tirar foto",
  fileLabel = "Escolher foto ou PDF",
  className,
  showSelection = true
}: {
  onFileSelected: (file: File) => void | Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  cameraLabel?: string;
  fileLabel?: string;
  className?: string;
  showSelection?: boolean;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<File | null>(null);
  const [error, setError] = useState("");

  async function selectFile(file: File | undefined, input: HTMLInputElement) {
    input.value = "";
    if (!file) return;

    if (!isSupportedDocumentFile(file)) {
      setError("Use uma imagem ou um arquivo PDF.");
      return;
    }

    setError("");
    setSelected(file);
    try {
      await onFileSelected(file);
    } catch {
      setError("Nao foi possivel processar este arquivo. Tente novamente ou escolha outro documento.");
    }
  }

  const inactive = disabled || loading;

  return (
    <div className={cn("grid gap-2", className)}>
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" onClick={() => cameraRef.current?.click()} disabled={inactive}>
          {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Camera className="size-4" aria-hidden="true" />}
          {cameraLabel}
        </Button>
        <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={inactive}>
          {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <FileUp className="size-4" aria-hidden="true" />}
          {fileLabel}
        </Button>
      </div>

      <input
        ref={cameraRef}
        className="hidden"
        type="file"
        accept="image/*"
        capture="environment"
        disabled={inactive}
        onChange={(event) => void selectFile(event.target.files?.[0], event.currentTarget)}
      />
      <input
        ref={fileRef}
        className="hidden"
        type="file"
        accept="image/*,application/pdf,.pdf"
        disabled={inactive}
        onChange={(event) => void selectFile(event.target.files?.[0], event.currentTarget)}
      />

      {showSelection && selected ? (
        <p className="text-xs text-muted">
          {selected.name} · {selected.type || "tipo detectado pelo nome"} · {formatFileSize(selected.size)}
        </p>
      ) : null}
      {error ? <p className="text-xs font-bold text-red-200">{error}</p> : null}
    </div>
  );
}
