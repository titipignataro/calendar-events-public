"use client"

import { useState, useEffect } from "react"

/**
 * Hook que retorna `true` apenas após a montagem do componente no cliente.
 * Útil para evitar hydration mismatch quando se usa traduções ou qualquer
 * lógica que dependa do ambiente do cliente (ex: i18next LanguageDetector).
 *
 * Exemplo de uso em um componente que usa traduções:
 *
 * function Spinner() {
 *   const mounted = useMounted()
 *   const { t } = useTranslation()
 *
 *   if (!mounted) {
 *     return <div>Loading</div> // Texto em inglês (fallback do servidor)
 *   }
 *
 *   return <div>{t("calendar.loading")}</div>
 * }
 */
export function useMounted() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return mounted
}