import { useState, useEffect, useCallback } from 'react'
import { fetchMonths, deleteMonth, MonthWithStats } from '../services/api'

export function useMonths() {
  const [months, setMonths] = useState<MonthWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchMonths()
      setMonths(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load months')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const remove = useCallback(async (id: number) => {
    await deleteMonth(id)
    await refresh()
  }, [refresh])

  return { months, loading, error, refresh, remove }
}
