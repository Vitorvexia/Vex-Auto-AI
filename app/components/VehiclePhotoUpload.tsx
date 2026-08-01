"use client";

import { useState } from "react";
import { ALLOWED_PHOTO_TYPES, MAX_PHOTO_SIZE_BYTES } from "@/lib/vehicle-photos";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  remainingSlots: number;
};

export function VehiclePhotoUpload({ action, remainingSlots }: Props) {
  const [previews, setPreviews] = useState<string[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    previews.forEach((url) => URL.revokeObjectURL(url));

    if (files.length > remainingSlots) {
      setFileError(
        `Máximo de ${remainingSlots} foto${remainingSlots === 1 ? "" : "s"} restante${remainingSlots === 1 ? "" : "s"} pra este veículo.`
      );
      setPreviews([]);
      return;
    }

    setFileError(null);
    setPreviews(files.map((f) => URL.createObjectURL(f)));
  }

  const maxSizeMb = Math.round(MAX_PHOTO_SIZE_BYTES / (1024 * 1024));

  return (
    <form action={action} style={{ marginTop: "12px" }}>
      <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
        Adicionar fotos ({remainingSlots} restante{remainingSlots === 1 ? "" : "s"})
      </label>
      <input
        type="file"
        name="photos"
        multiple
        accept={ALLOWED_PHOTO_TYPES.join(",")}
        onChange={handleChange}
        disabled={remainingSlots <= 0}
        className="input"
      />
      <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
        JPEG, PNG ou WEBP · até {maxSizeMb}MB cada
      </div>

      {fileError && (
        <div className="alert-item warn" style={{ marginTop: "8px" }}>
          <span className="alert-icon">⚠</span>
          <span>{fileError}</span>
        </div>
      )}

      {previews.length > 0 && (
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" }}>
          {previews.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- preview local (blob:), next/image não serve URL de objeto
            <img
              key={src}
              src={src}
              alt={`Pré-visualização ${i + 1}`}
              style={{
                width: "72px",
                height: "72px",
                objectFit: "cover",
                borderRadius: "6px",
                border: "1px solid var(--border)",
              }}
            />
          ))}
        </div>
      )}

      <button
        type="submit"
        className="btn-primary"
        style={{ marginTop: "8px" }}
        disabled={remainingSlots <= 0 || previews.length === 0}
      >
        Enviar fotos
      </button>
    </form>
  );
}
