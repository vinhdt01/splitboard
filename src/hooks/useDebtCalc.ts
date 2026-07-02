import { useMemo } from 'react'
import type { CostWithSplits, Profile, MemberDebt } from '../types/database'

export function useDebtCalc(
  costs: CostWithSplits[],
  members: Profile[],
  filterYear?: number,
  filterMonth?: number | 'all'
) {
  return useMemo(() => {
    const filtered = costs.filter(c => {
      if (!filterYear) return true
      const d = new Date(c.created_at)
      const yearMatch = d.getFullYear() === filterYear
      const monthMatch = filterMonth === 'all' || filterMonth === undefined || d.getMonth() === filterMonth
      return yearMatch && monthMatch
    })

    // pairDebts[debtor_id][creditor_id] = amount owed
    const pairDebts: Record<string, Record<string, number>> = {}

    for (const cost of filtered) {
      for (const split of cost.splits) {
        // skip if this split belongs to the payer (they don't owe themselves)
        if (split.user_id === cost.paid_by) continue

        if (!pairDebts[split.user_id]) pairDebts[split.user_id] = {}
        pairDebts[split.user_id][cost.paid_by] =
          (pairDebts[split.user_id][cost.paid_by] ?? 0) + split.share
      }
    }

    // Build memberDebts from pairDebts
    const memberDebts: MemberDebt[] = members.map(user => {
      const details = Object.entries(pairDebts[user.id] ?? {})
        .map(([toId, amount]) => ({
          to: members.find(m => m.id === toId)!,
          amount: Math.round(amount),
        }))
        .filter(d => d.to && d.amount > 0)

      const owes = details.reduce((sum, d) => sum + d.amount, 0)

      // how much others owe this user
      const owed = members.reduce((sum, m) => {
        return sum + (pairDebts[m.id]?.[user.id] ?? 0)
      }, 0)

      return {
        user,
        owes: Math.round(owes - owed),
        details,
      }
    })

    const totalOutstanding = memberDebts.reduce((sum, d) => sum + Math.max(d.owes, 0), 0)

    return { memberDebts, balances: {}, debts: [], totalOutstanding }
  }, [costs, members, filterYear, filterMonth])
}