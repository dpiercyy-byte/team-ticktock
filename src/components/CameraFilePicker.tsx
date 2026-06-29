import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Camera, Image, Upload } from "lucide-react";

const ALLOWED_RECEIPT_MIMES = ["image/jpeg", "image/png", "application/pdf"];
const MAX_SIZE = 10 * 1024 * 1024;

interface CameraFilePickerProps {
  onFile: (file: File) => void;
  disabled?: boolean;
  uploading?: boolean;
  label?: string;
  multiple?: boolean;
}

export function CameraFilePicker({
  onFile,
  disabled,
  uploading,
  label = "Attach receipt",
  multiple,
}: CameraFilePickerProps) {
  const [open, setOpen] = useState(false);
  const camRef = useRef<HTMLInputElement | null>(null);
  const galRef = useRef<HTMLInputElement | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const f of files) {
      if (!ALLOWED_RECEIPT_MIMES.includes(f.type)) continue;
      if (f.size > MAX_SIZE) continue;
      onFile(f);
    }
    e.currentTarget.value = "";
    setOpen(false);
  };

  return (
    <>
      <input
        ref={camRef}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        capture="environment"
        multiple={multiple}
        className="hidden"
        onChange={handleChange}
      />
      <input
        ref={galRef}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        multiple={multiple}
        className="hidden"
        onChange={handleChange}
      />

      <button
        type="button"
        disabled={disabled || uploading}
        onClick={() => setOpen(true)}
        className={`flex items-center justify-center gap-2 text-sm px-3 py-2.5 rounded-md border border-dashed border-border cursor-pointer hover:bg-secondary w-full ${
          disabled || uploading ? "opacity-60 pointer-events-none" : ""
        }`}
      >
        <Upload className="h-4 w-4" />
        {uploading ? "Uploading…" : label}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Add receipt</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Button
              variant="outline"
              className="h-16 justify-start gap-3 text-base"
              onClick={() => camRef.current?.click()}
            >
              <Camera className="h-5 w-5" />
              Take photo
            </Button>
            <Button
              variant="outline"
              className="h-16 justify-start gap-3 text-base"
              onClick={() => galRef.current?.click()}
            >
              <Image className="h-5 w-5" />
              Choose from gallery
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
