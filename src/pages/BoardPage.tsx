import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Copy, Check, UserPlus, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useDebtCalc } from '../hooks/useDebtCalc'
import AddCostModal from '../components/AddCostModal'
import DebtSummary from '../components/DebtSummary'
import type { Board, Profile, CostWithSplits } from '../types/database'
import { format } from 'date-fns'

const vnd = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount)

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [board, setBoard] = useState<Board | null>(null)
  const [members, setMembers] = useState<Profile[]>([])
  const [costs, setCosts] = useState<CostWithSplits[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddCost, setShowAddCost] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)

  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>(new Date().getMonth())

  const { memberDebts } = useDebtCalc(costs, members, selectedYear, selectedMonth)

  const fetchAll = useCallback(async () => {
    if (!boardId) return
    const [boardRes, membersRes, costsRes] = await Promise.all([
      supabase.from('boards').select().eq('id', boardId).single(),
      supabase.from('board_members').select('user_id, profiles(*)').eq('board_id', boardId),
      supabase.from('costs')
        .select('*, payer_profile:profiles!costs_paid_by_fkey(*), splits:cost_splits(*, profile:profiles(*))')
        .eq('board_id', boardId)
        .order('created_at', { ascending: false }),
    ])
    if (boardRes.data) setBoard(boardRes.data)
    if (membersRes.data) setMembers(membersRes.data.map((r: any) => r.profiles).filter(Boolean))
    if (costsRes.data) setCosts(costsRes.data as CostWithSplits[])
    setLoading(false)
  }, [boardId])

  useEffect(() => { fetchAll() }, [fetchAll])

  const availableYears = useMemo(() => {
    const years = new Set(costs.map(c => new Date(c.created_at).getFullYear()))
    years.add(currentYear)
    return Array.from(years).sort((a, b) => b - a)
  }, [costs, currentYear])

  const costsByMonth = useMemo(() => {
    const filtered = costs.filter(c => {
      const d = new Date(c.created_at)
      const yearMatch = d.getFullYear() === selectedYear
      const monthMatch = selectedMonth === 'all' || d.getMonth() === selectedMonth
      return yearMatch && monthMatch
    })
    const groups: Record<number, CostWithSplits[]> = {}
    for (const cost of filtered) {
      const month = new Date(cost.created_at).getMonth()
      if (!groups[month]) groups[month] = []
      groups[month].push(cost)
    }
    return Object.entries(groups)
      .map(([month, items]) => ({ month: Number(month), items }))
      .sort((a, b) => b.month - a.month)
  }, [costs, selectedYear, selectedMonth])

  const totalFiltered = useMemo(() =>
    costsByMonth.reduce((sum, g) => sum + g.items.reduce((s, c) => s + c.amount, 0), 0),
    [costsByMonth]
  )

  async function deleteCost(costId: string) {
    if (!confirm('Delete this cost entry?')) return
    await supabase.from('cost_splits').delete().eq('cost_id', costId)
    await supabase.from('costs').delete().eq('id', costId)
    setCosts(prev => prev.filter(c => c.id !== costId))
  }

 
  function copyInvite() {
    if (!board) return
    navigator.clipboard.writeText(board.invite_code)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const totalCosts = costs.reduce((sum, c) => sum + c.amount, 0)
  const isMember = members.some(m => m.id === user?.id)

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-slate-500 text-sm">Loading board...</div>
    </div>
  )

  if (!board || !isMember) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <p className="text-slate-400">Board not found or you're not a member.</p>
      <button onClick={() => navigate('/boards')} className="btn-secondary text-sm">Back to boards</button>
    </div>
  )

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-700/60 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/boards')} className="btn-ghost p-2 -ml-2">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="font-display font-semibold text-white leading-tight">{board.name}</h1>
              {board.description && <p className="text-slate-500 text-xs">{board.description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={copyInvite} className="btn-ghost flex items-center gap-1.5 text-xs">
              <UserPlus size={14} />
              <span className="hidden sm:block">Invite</span>
              <span className="font-mono">{board.invite_code}</span>
              {copiedCode ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            </button>
            <button onClick={() => setShowAddCost(true)} className="btn-primary flex items-center gap-2 text-sm">
              <Plus size={15} /> Add cost
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label="Total costs" value={vnd(totalCosts)} />
          <StatCard label="Entries" value={String(costs.length)} />
          <StatCard label="Members" value={String(members.length)} />
          <StatCard
            label="Your share"
            value={vnd(memberDebts.find(d => d.user.id === user?.id)?.owes ?? 0)}
            accent={memberDebts.find(d => d.user.id === user?.id)?.owes ?? 0}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            {/* Filters row */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-white text-base">Cost entries</h2>
              <div className="flex items-center gap-2">
                {totalFiltered > 0 && (
                  <span className="text-sm text-slate-400 hidden sm:block">
                    Total: <span className="text-white font-medium">{vnd(totalFiltered)}</span>
                  </span>
                )}
                <select
                  className="input py-1 px-2 text-sm w-auto"
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                >
                  <option value="all">All months</option>
                  {MONTH_NAMES.map((name, i) => (
                    <option key={i} value={i}>{name}</option>
                  ))}
                </select>
                <select
                  className="input py-1 px-2 text-sm w-auto"
                  value={selectedYear}
                  onChange={e => setSelectedYear(Number(e.target.value))}
                >
                  {availableYears.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            {costsByMonth.length === 0 ? (
              <div className="card p-10 text-center">
                <div className="text-3xl mb-2">💸</div>
                <p className="text-slate-400 text-sm">
                  No costs in {selectedMonth === 'all' ? String(selectedYear) : `${MONTH_NAMES[selectedMonth as number]} ${selectedYear}`}.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {costsByMonth.map(({ month, items }) => (
                  <MonthGroup
                    key={month}
                    month={month}
                    year={selectedYear}
                    items={items}
                    currentUserId={user!.id}
                    onDelete={deleteCost}
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="font-display font-semibold text-white text-base mb-3">Who owes what</h2>
            <DebtSummary
              memberDebts={memberDebts}
              currentUserId={user!.id}
            />
            <div className="card p-4 mt-4">
              <h3 className="font-display font-semibold text-white text-sm mb-3">Members ({members.length})</h3>
              <div className="space-y-2">
                {members.map(m => (
                  <div key={m.id} className="flex items-center gap-2">
                    {m.avatar_url
                      ? <img src={m.avatar_url} alt="" className="w-7 h-7 rounded-full" />
                      : <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs text-slate-300">{(m.full_name || m.email)?.[0]?.toUpperCase()}</div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-300 truncate">{m.full_name || m.email.split('@')[0]}</p>
                      <p className="text-xs text-slate-500 truncate">{m.email}</p>
                    </div>
                    {m.id === board.owner_id && <span className="text-xs text-indigo-400">owner</span>}
                    {m.id === user?.id && m.id !== board.owner_id && <span className="text-xs text-slate-500">you</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {showAddCost && user && (
        <AddCostModal
          boardId={boardId!}
          members={members}
          currentUserId={user.id}
          onClose={() => setShowAddCost(false)}
          onAdded={fetchAll}
        />
      )}
    </div>
  )
}

function MonthGroup({ month, year, items, currentUserId, onDelete }: {
  month: number
  year: number
  items: CostWithSplits[]
  currentUserId: string
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const total = items.reduce((s, c) => s + c.amount, 0)
  const myTotal = items.reduce((s, c) => {
    const split = c.splits.find(sp => sp.user_id === currentUserId && !sp.settled && c.paid_by !== currentUserId)
    return s + (split?.share ?? 0)
  }, 0)

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-700/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <span className="text-indigo-400 font-display font-semibold text-sm">{month + 1}</span>
          </div>
          <div className="text-left">
            <p className="font-display font-semibold text-white">{MONTH_NAMES[month]} {year}</p>
            <p className="text-xs text-slate-500">{items.length} {items.length === 1 ? 'entry' : 'entries'}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-display font-semibold text-white">{vnd(total)}</p>
            {myTotal > 0 && <p className="text-xs text-rose-400">you owe {vnd(myTotal)}</p>}
          </div>
          {expanded ? <ChevronUp size={16} className="text-slate-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-700/60 divide-y divide-slate-700/40">
          {items.map(cost => (
            <CostRow
              key={cost.id}
              cost={cost}
              currentUserId={currentUserId}
              onDelete={() => onDelete(cost.id)}
            />
          ))}
          <div className="px-4 py-3 bg-slate-800/40 flex items-center justify-between">
            <span className="text-xs text-slate-500">Total {MONTH_NAMES[month]}</span>
            <span className="font-display font-semibold text-white text-sm">{vnd(total)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function CostRow({ cost, currentUserId, onDelete }: { cost: CostWithSplits; currentUserId: string; onDelete: () => void }) {
  const isPayer = cost.paid_by === currentUserId
  const myShare = cost.splits.find(s => s.user_id === currentUserId)

  return (
    <div className="px-4 py-3 group hover:bg-slate-700/20 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-white">{cost.title}</span>
            {isPayer && (
              <span className="text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded-full">
                you paid
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs text-slate-500">{format(new Date(cost.created_at), 'dd/MM')}</span>
            <span className="text-xs text-slate-600">·</span>
            <span className="text-xs text-slate-500">
              Paid by {isPayer ? 'you' : cost.payer_profile?.full_name || cost.payer_profile?.email?.split('@')[0]}
            </span>
            {cost.note && <><span className="text-xs text-slate-600">·</span><span className="text-xs text-slate-500">{cost.note}</span></>}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {cost.splits.map(split => (
              <span
                key={split.id}
                className={`text-xs px-2 py-0.5 rounded-full border ${
                  split.settled
                    ? 'border-slate-700 text-slate-500 bg-slate-800/50'
                    : split.user_id === currentUserId
                    ? 'border-rose-500/30 text-rose-400 bg-rose-500/5'
                    : 'border-slate-600 text-slate-400'
                }`}
              >
                {split.profile?.full_name || split.profile?.email?.split('@')[0]}: {vnd(split.share)}
                {split.settled ? ' ✓' : ''}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-display font-semibold text-white text-sm">{vnd(cost.amount)}</span>
          {cost.created_by === currentUserId && (
            <button
              onClick={onDelete}
              className="opacity-0 group-hover:opacity-100 btn-ghost p-1 text-rose-400 hover:text-rose-300 transition-all"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
      {myShare && !myShare.settled && !isPayer && (
        <div className="mt-2 flex items-center justify-end">
          <span className="badge-debt text-xs">{vnd(myShare.share)}</span>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: number }) {
  const color = accent === undefined ? 'text-white' : accent > 0 ? 'text-rose-400' : accent < 0 ? 'text-emerald-400' : 'text-slate-400'
  return (
    <div className="card p-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-xl font-display font-semibold ${color}`}>{value}</p>
    </div>
  )
}