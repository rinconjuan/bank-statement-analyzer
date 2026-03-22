import { useState, useEffect, useCallback } from 'react'
import { fetchCategories, createCategory, updateCategory, deleteCategory, Category } from '../services/api'

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchCategories()
      setCategories(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load categories')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const create = useCallback(async (data: Omit<Category, 'id'>) => {
    await createCategory(data)
    await refresh()
  }, [refresh])

  const update = useCallback(async (id: number, data: Partial<Omit<Category, 'id'>>) => {
    await updateCategory(id, data)
    await refresh()
  }, [refresh])

  const remove = useCallback(async (id: number) => {
    await deleteCategory(id)
    await refresh()
  }, [refresh])

  return { categories, loading, error, refresh, create, update, remove }
}
