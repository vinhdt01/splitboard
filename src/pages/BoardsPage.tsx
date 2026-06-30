import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, LogIn, LogOut, Users, Copy, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { Board } from '../types/database'

function generateInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export default function BoardsPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [boards, setBoards] = useState<Board[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user) fetchBoards()
  }, [user])

  async function fetchBoards() {
    const { data } = await supabase
      .from('board_members')
      .select('board_id, boards(*)')
      .eq('user_id', user!.id)
    if (data) {
      setBoards(data.map((r: any) => r.boards).filter(Boolean))
    }
    setLoading(false)
  }

  async function createBoard() {
    if (!newName.trim()) return
    setSaving(true)
    setError('')
    const code = generateInviteCode()
    const { data: board, error: err } = await supabase
      .from('boards')
      .insert({ name: newName.trim(), description: newDesc.trim() || null, invite_code: code, owner_id: user!.id })
      .select()
      .single()
    if (err) { setError(err.message); setSaving(false); return }
    await supabase.from('board_members').insert({ board_id: board.id, user_id: user!.id })
    setBoards(prev => [board, ...prev])
    setShowCreate(false)
    setNewName(''); setNewDesc('')
    setSaving(false)
  }

  async function joinBoard() {
  if (!inviteCode.trim()) return
  setSaving(true)
  setError('')

 const { data } = await supabase
  .rpc('get_board_by_invite', { p_code: inviteCode.trim().toUpperCase() })

  const board = data?.[0]
  if (!board) { setError('Board not found. Check the invite code.'); setSaving(false); return }

  const already = boards.find(b => b.id === board.id)
  if (already) { setError('You are already in this board.'); setSaving(false); return }

  await supabase.from('board_members').insert({ board_id: board.id, user_id: user!.id })
  setBoards(prev => [board, ...prev])
  setShowJoin(false)
  setInviteCode('')
  setSaving(false)
}

  function copyCode(code: string) {
    navigator.clipboard.writeText(code)
    setCopied(code)
    setTimeout(() => setCopied(null), 2000)
  }

  const avatarUrl = user?.user_metadata?.avatar_url
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0]

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-slate-700/60 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-500 flex items-center justify-center text-base">÷</div>
            <span className="font-display font-semibold text-white">Nhà Chung Thanh Đa</span>
          </div>
          <div className="flex items-center gap-3">
            {avatarUrl
              ? <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full" />
              : <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-sm font-medium">{displayName?.[0]?.toUpperCase()}</div>
            }
            <span className="text-sm text-slate-300 hidden sm:block">{displayName}</span>
            <button onClick={signOut} className="btn-ghost flex items-center gap-1.5 text-sm">
              <LogOut size={15} /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-display font-semibold text-white">Your boards</h1>
            <p className="text-slate-400 text-sm mt-0.5">Create a board or join one with an invite code.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setShowJoin(true); setShowCreate(false); setError('') }} className="btn-secondary flex items-center gap-2 text-sm">
              <LogIn size={15} /> Join
            </button>
            <button onClick={() => { setShowCreate(true); setShowJoin(false); setError('') }} className="btn-primary flex items-center gap-2 text-sm">
              <Plus size={15} /> New board
            </button>
          </div>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="card p-5 mb-5">
            <h3 className="font-display font-semibold text-white mb-4">Create a new board</h3>
            <div className="space-y-3">
              <div>
                <label className="label">Board name</label>
                <input className="input" placeholder="e.g. Office overhead, Apartment bills" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createBoard()} autoFocus />
              </div>
              <div>
                <label className="label">Description <span className="text-slate-500 font-normal">(optional)</span></label>
                <input className="input" placeholder="What's this board for?" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
              </div>
              {error && <p className="text-rose-400 text-sm">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button onClick={createBoard} disabled={saving || !newName.trim()} className="btn-primary text-sm">{saving ? 'Creating…' : 'Create board'}</button>
                <button onClick={() => { setShowCreate(false); setError('') }} className="btn-ghost text-sm">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Join form */}
        {showJoin && (
          <div className="card p-5 mb-5">
            <h3 className="font-display font-semibold text-white mb-4">Join a board</h3>
            <div className="space-y-3">
              <div>
                <label className="label">Invite code</label>
                <input className="input font-mono uppercase tracking-widest" placeholder="ABC123" value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && joinBoard()} autoFocus maxLength={6} />
              </div>
              {error && <p className="text-rose-400 text-sm">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button onClick={joinBoard} disabled={saving || !inviteCode.trim()} className="btn-primary text-sm">{saving ? 'Joining…' : 'Join board'}</button>
                <button onClick={() => { setShowJoin(false); setError('') }} className="btn-ghost text-sm">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Board list */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="card p-5 h-24 animate-pulse bg-slate-800" />)}
          </div>
        ) : boards.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="text-4xl mb-3">📋</div>
            <h3 className="font-display font-semibold text-white mb-1">No boards yet</h3>
            <p className="text-slate-400 text-sm">Create a board or join one with an invite code to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {boards.map(board => (
              <button
                key={board.id}
                onClick={() => navigate(`/boards/${board.id}`)}
                className="card w-full p-5 text-left hover:border-indigo-500/50 transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Users size={15} className="text-indigo-400" />
                      <h3 className="font-display font-semibold text-white group-hover:text-indigo-300 transition-colors">{board.name}</h3>
                      {board.owner_id === user?.id && (
                        <span className="text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded-full">owner</span>
                      )}
                    </div>
                    {board.description && <p className="text-slate-400 text-sm">{board.description}</p>}
                  </div>
                  <div
                    className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors"
                    onClick={e => { e.stopPropagation(); copyCode(board.invite_code) }}
                    title="Copy invite code"
                  >
                    <span className="font-mono text-xs">{board.invite_code}</span>
                    {copied === board.invite_code ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
