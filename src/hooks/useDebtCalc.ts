import { useMemo } from 'react'
import type { CostWithSplits, Profile, MemberDebt } from '../types/database'

export function useDebtCalc(costs: CostWithSplits[], members: Profile[]) {
  return useMemo(() => {
    // Build a balance map: user_id → net balance (positive = owed money, negative = owes money)
    const balances: Record<string, number> = {}
    members.forEach(m => { balances[m.id] = 0 })

    for (const cost of costs) {
      // Payer gets credited the full amount
      balances[cost.paid_by] = (balances[cost.paid_by] ?? 0) + cost.amount

      // Each person in the split owes their share
      for (const split of cost.splits) {
        if (!split.settled) {
          balances[split.user_id] = (balances[split.user_id] ?? 0) - split.share
        }
      }
    }

    // Simplify debts: greedy algorithm
    const debts: { from: string; to: string; amount: number }[] = []
    const pos = Object.entries(balances).filter(([, v]) => v > 0.01).sort((a, b) => b[1] - a[1])
    const neg = Object.entries(balances).filter(([, v]) => v < -0.01).sort((a, b) => a[1] - b[1])

    let i = 0, j = 0
    const posArr = pos.map(([id, v]) => ({ id, v }))
    const negArr = neg.map(([id, v]) => ({ id, v }))

    while (i < posArr.length && j < negArr.length) {
      const owed = posArr[i].v
      const owes = Math.abs(negArr[j].v)
      const amount = Math.min(owed, owes)

      if (amount > 0.01) {
        debts.push({ from: negArr[j].id, to: posArr[i].id, amount: Math.round(amount * 100) / 100 })
      }

      posArr[i].v -= amount
      negArr[j].v += amount

      if (posArr[i].v < 0.01) i++
      if (Math.abs(negArr[j].v) < 0.01) j++
    }

    // Build per-member summary
    const memberDebts: MemberDebt[] = members.map(user => {
      const details = debts
        .filter(d => d.from === user.id)
        .map(d => ({ to: members.find(m => m.id === d.to)!, amount: d.amount }))
        .filter(d => d.to)

      const owes = details.reduce((sum, d) => sum + d.amount, 0)
      const owed = debts
        .filter(d => d.to === user.id)
        .reduce((sum, d) => sum + d.amount, 0)

      return { user, owes: Math.round((owes - owed) * 100) / 100, details }
    })

    return { balances, debts, memberDebts }
  }, [costs, members])
}
