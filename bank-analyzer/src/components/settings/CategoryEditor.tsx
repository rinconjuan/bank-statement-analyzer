import React, { useState } from 'react'
import { Category } from '../../services/api'

interface CategoryEditorProps {
  categories: Category[]
  onCreate: (data: Omit<Category, 'id'>) => Promise<void>
  onUpdate: (id: number, data: Partial<Omit<Category, 'id'>>) => Promise<void>
  onDelete: (id: number) => Promise<void>
}

const PRESET_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#f97316', '#06b6d4', '#ec4899', '#94a3b8']
const PRESET_ICONS = ['💼', '↔️', '🛍️', '⚡', '🏦', '🍽️', '🚗', '📦', '🏠', '💊', '🎓', '✈️', '🎭', '💻', '🛒']

function KeywordChip({ value, onRemove }: { value: string; onRemove: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
      style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
    >
      {value}
      <button onClick={onRemove} style={{ color: 'var(--accent-red)' }}>×</button>
    </span>
  )
}

function CategoryRow({ cat, onUpdate, onDelete }: { cat: Category; onUpdate: (id: number, data: Partial<Omit<Category, 'id'>>) => Promise<void>; onDelete: (id: number) => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(cat.name)
  const [color, setColor] = useState(cat.color)
  const [icon, setIcon] = useState(cat.icon)
  const [keywords, setKeywords] = useState<string[]>([...cat.keywords])
  const [newKeyword, setNewKeyword] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onUpdate(cat.id, { name, color, icon, keywords })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const addKeyword = () => {
    const kw = newKeyword.trim().toLowerCase()
    if (kw && !keywords.includes(kw)) {
      setKeywords([...keywords, kw])
    }
    setNewKeyword('')
  }

  return (
    <div
      className="rounded-xl p-4 mb-3"
      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
    >
      {!editing ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg" style={{ background: `${cat.color}20` }}>
              {cat.icon}
            </div>
            <div>
              <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{cat.name}</div>
              <div className="flex flex-wrap gap-1 mt-1">
                {cat.keywords.slice(0, 4).map((k) => (
                  <span key={k} className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>{k}</span>
                ))}
                {cat.keywords.length > 4 && (
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>+{cat.keywords.length - 4}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditing(true)} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
              Editar
            </button>
            <button onClick={() => onDelete(cat.id)} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--accent-red)', border: '1px solid rgba(239,68,68,0.2)' }}>
              Eliminar
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Ícono</label>
              <div className="flex flex-wrap gap-1 w-40">
                {PRESET_ICONS.map((ic) => (
                  <button key={ic} onClick={() => setIcon(ic)} className="w-7 h-7 rounded text-sm" style={{ background: icon === ic ? `${color}30` : 'var(--bg-secondary)', border: icon === ic ? `1px solid ${color}` : '1px solid var(--border)' }}>{ic}</button>
                ))}
              </div>
            </div>
            <div className="flex-1 flex flex-col gap-3">
              <div>
                <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Nombre</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="w-full text-sm rounded-lg px-3 py-1.5" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', outline: 'none' }} />
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Color</label>
                <div className="flex gap-1.5 flex-wrap">
                  {PRESET_COLORS.map((c) => (
                    <button key={c} onClick={() => setColor(c)} className="w-6 h-6 rounded-full transition-all" style={{ background: c, border: color === c ? '2px solid #fff' : '2px solid transparent' }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Palabras clave</label>
            <div className="flex flex-wrap gap-1 mb-2">
              {keywords.map((k) => (
                <KeywordChip key={k} value={k} onRemove={() => setKeywords(keywords.filter((kw) => kw !== k))} />
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword() } }}
                placeholder="Nueva palabra..."
                className="flex-1 text-xs rounded-lg px-3 py-1.5"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', outline: 'none' }}
              />
              <button onClick={addKeyword} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'var(--accent-primary)', color: '#fff' }}>+</button>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setEditing(false)} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'var(--accent-primary)', color: '#fff' }}>{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

export function CategoryEditor({ categories, onCreate, onUpdate, onDelete }: CategoryEditorProps) {
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#6366f1')
  const [newIcon, setNewIcon] = useState('📦')
  const [newKeywords, setNewKeywords] = useState<string[]>([])
  const [newKeyword, setNewKeyword] = useState('')
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      await onCreate({ name: newName.trim(), keywords: newKeywords, color: newColor, icon: newIcon })
      setShowNew(false)
      setNewName('')
      setNewKeywords([])
      setNewKeyword('')
    } finally {
      setCreating(false)
    }
  }

  const addNewKeyword = () => {
    const kw = newKeyword.trim().toLowerCase()
    if (kw && !newKeywords.includes(kw)) setNewKeywords([...newKeywords, kw])
    setNewKeyword('')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Categorías</h2>
        <button
          onClick={() => setShowNew(!showNew)}
          className="text-sm px-4 py-2 rounded-lg font-medium"
          style={{ background: 'var(--accent-primary)', color: '#fff' }}
        >
          + Nueva categoría
        </button>
      </div>

      {showNew && (
        <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--accent-primary)', borderStyle: 'dashed' }}>
          <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Nueva categoría</h3>
          <div className="flex gap-3 mb-3">
            <div>
              <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Ícono</label>
              <div className="flex flex-wrap gap-1 w-36">
                {PRESET_ICONS.map((ic) => (
                  <button key={ic} onClick={() => setNewIcon(ic)} className="w-7 h-7 rounded text-sm" style={{ background: newIcon === ic ? `${newColor}30` : 'var(--bg-tertiary)', border: newIcon === ic ? `1px solid ${newColor}` : '1px solid var(--border)' }}>{ic}</button>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <div className="mb-2">
                <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Nombre</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full text-sm rounded-lg px-3 py-1.5" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)', outline: 'none' }} placeholder="Ej: Entretenimiento" />
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Color</label>
                <div className="flex gap-1.5 flex-wrap">
                  {PRESET_COLORS.map((c) => (
                    <button key={c} onClick={() => setNewColor(c)} className="w-6 h-6 rounded-full" style={{ background: c, border: newColor === c ? '2px solid #fff' : '2px solid transparent' }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="mb-3">
            <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Palabras clave</label>
            <div className="flex flex-wrap gap-1 mb-2">
              {newKeywords.map((k) => (
                <KeywordChip key={k} value={k} onRemove={() => setNewKeywords(newKeywords.filter((kw) => kw !== k))} />
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNewKeyword() } }} placeholder="Palabra clave..." className="flex-1 text-xs rounded-lg px-3 py-1.5" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)', outline: 'none' }} />
              <button onClick={addNewKeyword} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'var(--accent-primary)', color: '#fff' }}>+</button>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowNew(false)} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>Cancelar</button>
            <button onClick={handleCreate} disabled={creating || !newName.trim()} className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-50" style={{ background: 'var(--accent-primary)', color: '#fff' }}>{creating ? 'Creando...' : 'Crear'}</button>
          </div>
        </div>
      )}

      <div>
        {categories.map((cat) => (
          <CategoryRow key={cat.id} cat={cat} onUpdate={onUpdate} onDelete={onDelete} />
        ))}
      </div>
    </div>
  )
}
