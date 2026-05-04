"use client";

import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log sem PII — apenas nome e digest
    console.error(JSON.stringify({
      level: "error",
      event: "global_error_boundary",
      name: error.name,
      digest: error.digest,
      ts: new Date().toISOString(),
    }));
  }, [error]);

  const isStoreNotFound = error.name === "StoreNotFoundError";
  const isAuthError = error.name === "AuthError";

  return (
    <html lang="pt-BR">
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white rounded-lg shadow p-8 text-center">
            {isStoreNotFound ? (
              <>
                <h1 className="text-xl font-semibold text-gray-900 mb-2">
                  Loja não configurada
                </h1>
                <p className="text-gray-600 mb-6">
                  Sua conta não está vinculada a nenhuma loja. Entre em contato
                  com o suporte para regularizar o acesso.
                </p>
              </>
            ) : isAuthError ? (
              <>
                <h1 className="text-xl font-semibold text-gray-900 mb-2">
                  Sessão expirada
                </h1>
                <p className="text-gray-600 mb-6">
                  Sua sessão expirou. Faça login novamente para continuar.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-xl font-semibold text-gray-900 mb-2">
                  Algo deu errado
                </h1>
                <p className="text-gray-600 mb-6">
                  Ocorreu um erro inesperado. Tente novamente ou entre em contato
                  com o suporte se o problema persistir.
                </p>
              </>
            )}

            <button
              onClick={reset}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
