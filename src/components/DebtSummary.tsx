import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, ArrowRightLeft, HelpCircle, X, TrendingUp } from 'lucide-react'
import type { MemberDebt, Profile } from '../types/database'

interface Props {
  memberDebts: MemberDebt[]
  currentUserId: string
}

interface Settlement {
  from: Profile
  to: Profile
  amount: number
}

const vnd = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount)

function simplifyDebts(memberDebts: MemberDebt[]): Settlement[] {
  const debtors = memberDebts
    .filter(debt => debt.owes > 0)
    .map(debt => ({ user: debt.user, amount: Math.round(debt.owes) }))
    .sort((a, b) => b.amount - a.amount)
  const creditors = memberDebts
    .filter(debt => debt.owes < 0)
    .map(debt => ({ user: debt.user, amount: Math.round(-debt.owes) }))
    .sort((a, b) => b.amount - a.amount)

  const settlements: Settlement[] = []
  let debtorIndex = 0
  let creditorIndex = 0

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex]
    const creditor = creditors[creditorIndex]
    const amount = Math.min(debtor.amount, creditor.amount)

    if (amount > 0) settlements.push({ from: debtor.user, to: creditor.user, amount })
    debtor.amount -= amount
    creditor.amount -= amount
    if (debtor.amount === 0) debtorIndex++
    if (creditor.amount === 0) creditorIndex++
  }

  return settlements
}

const memberName = (user: Profile) => user.full_name || user.email.split('@')[0]

const tourSteps = [
  {
    target: 'debt-details-tour-step',
    title: 'Debt details',
    description: 'See the original breakdown of who owes whom and the amount for each person. This view helps you trace the individual debts.',
  },
  {
    target: 'debt-offset-tour-step',
    title: 'Offset suggestions',
    description: 'These suggested payments combine everyone’s balances, so debts in opposite directions cancel out and fewer payments may be needed.',
  },
]

export default function DebtSummary({ memberDebts, currentUserId }: Props) {
  const [tourStep, setTourStep] = useState<number | null>(null)
  const settlements = simplifyDebts(memberDebts)
  const totalDebt = memberDebts.reduce((sum, debt) => sum + Math.max(debt.owes, 0), 0)

  useEffect(() => {
    if (tourStep !== null) {
      document.getElementById(tourSteps[tourStep].target)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [tourStep])

  const closeTour = () => setTourStep(null)

  return (
    <div className="card p-5 h-fit">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-indigo-400" />
          <h3 className="font-display font-semibold text-white">Debt summary</h3>
        </div>
        <button
          type="button"
          onClick={() => setTourStep(0)}
          className="btn-ghost flex items-center gap-1.5 text-xs"
          aria-label="Start debt summary guide"
        >
          <HelpCircle size={14} />
          <span>Guide</span>
        </button>
      </div>

      <div
        id="debt-details-tour-step"
        className={`rounded-lg transition-shadow ${tourStep === 0 ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-900' : ''}`}
      >
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
                      {memberName(debt.user)}
                      {debt.user.id === currentUserId ? <span className="text-slate-500 font-normal"> (you)</span> : ''}
                    </span>
                  </div>
                  {debt.details.length > 0 ? (
                    <span className="badge-debt">{vnd(debt.details.reduce((sum, detail) => sum + detail.amount, 0))}</span>
                  ) : (
                    <span className="badge-settled">settled</span>
                  )}
                </div>

                {debt.details.map((detail, index) => (
                  <div key={`${detail.to.id}-${index}`} className="ml-9 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <ArrowRight size={11} />
                      <span>{memberName(detail.to)}</span>
                    </div>
                    <span className="text-xs text-slate-500">{vnd(detail.amount)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        id="debt-offset-tour-step"
        className={`mt-5 pt-4 border-t border-slate-700 rounded-lg transition-shadow ${tourStep === 1 ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-900' : ''}`}
      >
        <div className="flex items-center gap-2 mb-1">
          <ArrowRightLeft size={15} className="text-indigo-400" />
          <h4 className="text-sm font-medium text-white">Offset suggestions</h4>
        </div>
        <p className="text-xs text-slate-500 mb-3">Suggested payments after offsetting everyone’s balances.</p>

        {settlements.length === 0 ? (
          <p className="text-xs text-emerald-400">Everyone is settled up.</p>
        ) : (
          <div className="space-y-2">
            {settlements.map(settlement => (
              <div key={`${settlement.from.id}-${settlement.to.id}`} className="flex items-center gap-2 rounded-lg bg-slate-800/60 p-3">
                <span title={memberName(settlement.from)} className="min-w-0 flex-1 truncate text-sm text-slate-200">
                  {memberName(settlement.from)}{settlement.from.id === currentUserId ? ' (you)' : ''}
                </span>
                <ArrowRight size={14} className="shrink-0 text-indigo-400" />
                <span title={memberName(settlement.to)} className="min-w-0 flex-1 truncate text-sm text-slate-200">
                  {memberName(settlement.to)}{settlement.to.id === currentUserId ? ' (you)' : ''}
                </span>
                <span className="badge-debt shrink-0">{vnd(settlement.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-slate-700">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Total outstanding</span>
          <span className="text-rose-400 font-medium">{vnd(totalDebt)}</span>
        </div>
        <p className="text-xs text-slate-600 mt-2 leading-relaxed">
          📧 Members with open debts receive a reminder email on the 1st of each month.
        </p>
      </div>

      {tourStep !== null && (
        <div
          className="fixed z-50 bottom-3 left-3 right-3 sm:left-auto sm:right-6 sm:bottom-6 sm:w-96"
          role="dialog"
          aria-labelledby="debt-tour-title"
          aria-describedby="debt-tour-description"
          aria-live="polite"
        >
          <div className="card max-h-[70vh] overflow-y-auto border border-indigo-400/40 p-4 shadow-2xl shadow-slate-950/50 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-indigo-300">Debt summary guide · {tourStep + 1} of {tourSteps.length}</p>
                <h4 id="debt-tour-title" className="mt-1 font-display font-semibold text-white">
                  {tourSteps[tourStep].title}
                </h4>
              </div>
              <button type="button" onClick={closeTour} className="btn-ghost -mr-2 -mt-2 p-2" aria-label="Close guide">
                <X size={16} />
              </button>
            </div>
            <p id="debt-tour-description" className="mt-2 text-sm leading-relaxed text-slate-300">
              {tourSteps[tourStep].description}
            </p>
            <div className="mt-4 flex items-center justify-between gap-2">
              <button type="button" onClick={closeTour} className="btn-ghost text-xs">Skip guide</button>
              <div className="flex items-center gap-2">
                {tourStep > 0 && (
                  <button type="button" onClick={() => setTourStep(tourStep - 1)} className="btn-secondary flex items-center gap-1 text-xs">
                    <ArrowLeft size={13} /> Back
                  </button>
                )}
                {tourStep < tourSteps.length - 1 ? (
                  <button type="button" onClick={() => setTourStep(tourStep + 1)} className="btn-primary flex items-center gap-1 text-xs">
                    Next <ArrowRight size={13} />
                  </button>
                ) : (
                  <button type="button" onClick={closeTour} className="btn-primary text-xs">Done</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
