import { useState, useEffect, useCallback } from 'react'
import { fetchMovements, fetchSummary, Movement, MovementsSummary } from '../services/api'

interface Filters {
  month_id?: number
  category_id?: number
  type?: string
  search?: string
}

export function useMovements(filters: Filters) {
  const [movements, setMovements] = useState<Movement[]>([])
  const [summary, setSummary] = useState<MovementsSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (filters.month_id == null) {
      setMovements([])
      setSummary(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [movs, sum] = await Promise.all([
        fetchMovements(filters),
        fetchSummary(filters.month_id),
      ])
      setMovements(movs)
      setSummary(sum)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load movements')
    } finally {
      setLoading(false)
    }
  }, [filters.month_id, filters.category_id, filters.type, filters.search])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { refresh() }, [refresh])

  return { movements, summary, loading, error, refresh }
}
