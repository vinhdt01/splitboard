import { ArrowRight, TrendingUp } from 'lucide-react'
import type { MemberDebt } from '../types/database'

interface Props {
  memberDebts: MemberDebt[]
  currentUserId: string
}

const vnd = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount)
export default function DebtSummary({ memberDebts, currentUserId }: Props) {
  const totalDebt = memberDebts.reduce((sum, d) => sum + Math.max(d.owes, 0), 0)

  return (
    <div className="card p-5 h-fit">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={16} className="text-indigo-400" />
        <h3 className="font-display font-semibold text-white">Debt summary</h3>
      </div>

      {totalDebt === 0 ? (
        <div className="text-center py-6">
          <div className="text-3xl mb-2">🎉</div>
          <p className="text-emerald-400 font-medium text-sm">All settled up!</p>
          <p className="text-slate-500 text-xs mt-1">No outstanding debts</p>
        </div>
      ) : (
        <div className="space-y-3">
          {memberDebts.map(debt => (
            <div key={debt.user.id} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-medium text-slate-300">
                    {(debt.user.full_name || debt.user.email)?.[0]?.toUpperCase()}
                  </div>
                  <span className="text-sm text-slate-300 font-medium">
                    {debt.user.full_name || debt.user.email.split('@')[0]}
                    {debt.user.id === currentUserId ? <span className="text-slate-500 font-normal"> (you)</span> : ''}
                  </span>
                </div>
                {debt.details.length > 0 ? (
                  <span className="badge-debt">{vnd(debt.details.reduce((s, d) => s + d.amount, 0))}</span>
                ) : (
                  <span className="badge-settled">settled</span>
                )}
              </div>

              {/* Debt details */}
              {debt.details.map((d, i) => (
                <div key={i} className="ml-9 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <ArrowRight size={11} />
                    <span>{d.to.full_name || d.to.email.split('@')[0]}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{vnd(d.amount)}</span>
                     
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-slate-700">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Total outstanding</span>
          <span className="text-rose-400 font-medium">{vnd(totalDebt)}</span>
        </div>
        <p className="text-xs text-slate-600 mt-2 leading-relaxed">
          📧 Members with open debts receive a reminder email on the 1st of each month.
        </p>
      </div>
    </div>
  )
}
