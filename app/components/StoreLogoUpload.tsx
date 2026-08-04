"use client";

import { useState } from "react";
import { ALLOWED_LOGO_TYPES, MAX_LOGO_SIZE_BYTES } from "@/lib/store-settings";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
};

export function StoreLogoUpload({ action }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (preview) URL.revokeObjectURL(preview);

    const file = e.target.files?.[0];
    if (!file) {
      setPreview(null);
      setFileError(null);
      return;
    }

    if (!(ALLOWED_LOGO_TYPES as readonly string[]).includes(file.type)) {
      setFileError("Tipo de arquivo não permitido. Use JPEG, PNG ou WEBP.");
      setPreview(null);
      return;
    }
    if (file.size > MAX_LOGO_SIZE_BYTES) {
      setFileError(`Arquivo muito grande (máx ${Math.round(MAX_LOGO_SIZE_BYTES / (1024 * 1024))}MB).`);
      setPreview(null);
      return;
    }

    setFileError(null);
    setPreview(URL.createObjectURL(file));
  }

  const maxSizeMb = Math.round(MAX_LOGO_SIZE_BYTES / (1024 * 1024));

  return (
    <form action={action} style={{ marginTop: "4px" }}>
      <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
        {preview ? "Trocar logo" : "Enviar logo"}
      </label>
      <input
        type="file"
        name="logo"
        accept={ALLOWED_LOGO_TYPES.join(",")}
        onChange={handleChange}
        className="input"
      />
      <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
        JPEG, PNG ou WEBP · até {maxSizeMb}MB · substitui o logo atual
      </div>

      {fileError && (
        <div className="alert-item warn" style={{ marginTop: "8px" }}>
          <span className="alert-icon">⚠</span>
          <span>{fileError}</span>
        </div>
      )}

      {preview && (
        // eslint-disable-next-line @next/next/no-img-element -- preview local (blob:), next/image não serve URL de objeto
        <img
          src={preview}
          alt="Pré-visualização do novo logo"
          style={{
            width: "96px",
            height: "96px",
            objectFit: "contain",
            borderRadius: "8px",
            border: "1px solid var(--border)",
            marginTop: "8px",
            background: "var(--panel-2)",
          }}
        />
      )}

      <button
        type="submit"
        className="btn-primary"
        style={{ marginTop: "8px" }}
        disabled={!preview || !!fileError}
      >
        Enviar logo
      </button>
    </form>
  );
}
