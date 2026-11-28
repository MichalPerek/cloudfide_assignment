import { useCallback, useEffect, useState } from 'react'

export function useNotice(duration = 4000) {
  const [notice, setNotice] = useState<{ message: string } | null>(null)
  const notify = useCallback((message: string) => setNotice({ message }), [])
  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(null), duration)
    return () => window.clearTimeout(timeout)
  }, [notice, duration])
  return { message: notice?.message ?? '', notify }
}
