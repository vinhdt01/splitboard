import { useState } from 'react'
import { X, DollarSign } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types/database'

interface Props {
  boardId: string
  members: Profile[]
  currentUserId: string
  onClose: () => void
  onAdded: () => void
}

const vnd = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount)
export default function AddCostModal({ boardId, members, currentUserId, onClose, onAdded }: Props) {
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [paidBy, setPaidBy] = useState(currentUserId)
  const [note, setNote] = useState('')
  // Selected people who share this cost (1–3)
  const [sharedWith, setSharedWith] = useState<string[]>(members.map(m => m.id))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const numAmount = parseFloat(amount) || 0
  const splitCount = sharedWith.length
  const perPerson = splitCount > 0 ? numAmount / splitCount : 0

  function toggleMember(id: string) {
    setSharedWith(prev => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev // keep at least 1
        return prev.filter(x => x !== id)
      }
      if (prev.length >= 3) return prev // max 3
      return [...prev, id]
    })
  }

  async function handleSubmit() {
    if (!title.trim()) { setError('Enter a title.'); return }
    if (!numAmount || numAmount <= 0) { setError('Enter a valid amount.'); return }
    if (sharedWith.length === 0) { setError('Select at least one person.'); return }

    setSaving(true)
    setError('')

    const { data: cost, error: costErr } = await supabase
      .from('costs')
      .insert({ board_id: boardId, title: title.trim(), amount: numAmount, paid_by: paidBy, created_by: currentUserId, note: note.trim() || null })
      .select()
      .single()

    if (costErr) { setError(costErr.message); setSaving(false); return }

    const share = Math.round((numAmount / sharedWith.length) * 100) / 100
    const splits = sharedWith.map(uid => ({ cost_id: cost.id, user_id: uid, share }))
    const { error: splitErr } = await supabase.from('cost_splits').insert(splits)

    if (splitErr) { setError(splitErr.message); setSaving(false); return }

    onAdded()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="card w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-semibold text-white text-lg">Add a cost</h2>
          <button onClick={onClose} className="btn-ghost p-2 -mr-2"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input className="input" placeholder="e.g. Office rent, Internet bill" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
          </div>

          <div>
            <label className="label">Amount</label>
            <div className="relative">
              <DollarSign size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="input"
                type="number"
                min="0"
                step="1000"
                placeholder="100000"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label">Paid by</label>
            <select className="input" value={paidBy} onChange={e => setPaidBy(e.target.value)}>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.full_name || m.email}{m.id === currentUserId ? ' (you)' : ''}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">
              Split between
              <span className="text-slate-500 font-normal ml-1">(max 3 people)</span>
            </label>
            <div className="flex flex-wrap gap-2 mt-1">
              {members.map(m => {
                const selected = sharedWith.includes(m.id)
                const maxed = !selected && sharedWith.length >= 3
                return (
                  <button
                    key={m.id}
                    onClick={() => toggleMember(m.id)}
                    disabled={maxed}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-all ${
                      selected
                        ? 'bg-indigo-500/20 border-indigo-500/60 text-indigo-300'
                        : maxed
                        ? 'border-slate-700 text-slate-600 cursor-not-allowed'
                        : 'border-slate-600 text-slate-300 hover:border-slate-400'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium ${selected ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                      {(m.full_name || m.email)?.[0]?.toUpperCase()}
                    </div>
                    {m.full_name || m.email.split('@')[0]}
                    {m.id === currentUserId ? ' (you)' : ''}
                  </button>
                )
              })}
            </div>
            {numAmount > 0 && splitCount > 0 && (
              <p className="text-slate-500 text-xs mt-2">
                Each person pays <span className="text-slate-300 font-medium">{vnd(perPerson)}</span>
              </p>
            )}
          </div>

          <div>
            <label className="label">Note <span className="text-slate-500 font-normal">(optional)</span></label>
            <input className="input" placeholder="Any details…" value={note} onChange={e => setNote(e.target.value)} />
          </div>

          {error && <p className="text-rose-400 text-sm">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1">
              {saving ? 'Adding…' : 'Add cost'}
            </button>
            <button onClick={onClose} className="btn-ghost">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}
