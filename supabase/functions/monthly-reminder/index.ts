// supabase/functions/monthly-reminder/index.ts
// Deploy: supabase functions deploy monthly-reminder
// Trigger: set a pg_cron job or call from Supabase Dashboard → Cron

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const vnd = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount)
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'noreply@yourdomain.com'

interface DebtRow {
  debtor_id: string
  debtor_email: string
  debtor_name: string | null
  creditor_email: string
  creditor_name: string | null
  board_name: string
  total_owed: number
}

Deno.serve(async () => {
  // Find all unsettled debts grouped by user + board
  const { data: debts, error } = await supabase.rpc('get_outstanding_debts')
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

  const byUser: Record<string, DebtRow[]> = {}
  for (const row of (debts ?? []) as DebtRow[]) {
    if (!byUser[row.debtor_id]) byUser[row.debtor_id] = []
    byUser[row.debtor_id].push(row)
  }

  const results: string[] = []

  for (const [, userDebts] of Object.entries(byUser)) {
    const user = userDebts[0]
    const totalAcrossBoards = userDebts.reduce((s, d) => s + d.total_owed, 0)

    const boardLines = userDebts
      .map(d => `• ${d.board_name}: ${vnd(d.total_owed)}`)
      .join('\n')

   const html = `
  <div style="font-family: Inter, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px; background: #0F172A; color: #f8fafc; border-radius: 12px;">
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; background: #6366F1; width: 48px; height: 48px; border-radius: 16px; line-height: 48px; font-size: 24px; margin-bottom: 8px;">÷</div>
      <h1 style="font-size: 20px; font-weight: 600; margin: 0; color: white;">Xứ Sở Thanh Đa</h1>
    </div>

    <h2 style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">Xin chào ${user.debtor_name ?? user.debtor_email} 👋</h2>
    <p style="color: #94a3b8; margin-bottom: 24px;">
      Đây là nhắc nhở hàng tháng của bạn. Bạn đang có các khoản nợ chưa thanh toán:
    </p>

    ${userDebts.map(d => `
      <div style="background: #1E293B; border: 1px solid #334155; border-radius: 10px; padding: 20px; margin-bottom: 16px;">
        <div style="font-weight: 600; color: #818cf8; font-size: 14px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #334155;">
          📋 ${d.board_name}
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="color: #cbd5e1; font-size: 14px; line-height:24px;">
            <span style="color: #f8fafc; font-weight: 500;">${user.debtor_name ?? user.debtor_email}</span>
            <span style="color: #475569; margin: 0 8px;">nợ</span>
            <span style="color: #f8fafc; font-weight: 500;">${d.creditor_name ?? d.creditor_email}: &nbsp;</span>
          </div>
          <span style="color: #fb7185; font-weight: 700; font-size: 16px;">${vnd(d.total_owed)}</span>
        </div>
      </div>
    `).join('')}

    <div style="background: #1E293B; border: 1px solid #6366F1; border-radius: 10px; padding: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;line-height:24px;">
      <span style="font-weight: 600; color: #f8fafc;">Tổng nợ của bạn:&nbsp;</span>
      <span style="color: #fb7185; font-weight: 700; font-size: 20px;">${vnd(totalAcrossBoards)}</span>
    </div>

    <div style="text-align: center;">
      <a href="${Deno.env.get('APP_URL') ?? 'https://yourapp.com'}/boards"
         style="background: #6366F1; color: white; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 500; display: inline-block;">
        Xem các board của tôi →
      </a>
    </div>

    <p style="color: #475569; font-size: 12px; text-align: center; margin-top: 24px;">
      Bạn nhận được email này hàng tháng vì bạn là thành viên Xứ Sở Thanh Đa có khoản nợ chưa thanh toán.<br/>
      Đăng nhập để đánh dấu đã thanh toán.
    </p>
  </div>
`
   const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${RESEND_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    from: FROM_EMAIL,
    to: user.debtor_email,
    subject: `💸 Monthly reminder: You owe ${vnd(totalAcrossBoards)} on Nhà Chung Thanh Đa`,
    html,
  }),
})

const body = await res.text()

console.log('RESEND STATUS', res.status)
console.log('RESEND BODY', body)

results.push(
  `${user.debtor_email}: ${
    res.ok ? 'sent' : `failed (${res.status}) ${body}`
  }`
)
  }

  return new Response(JSON.stringify({ sent: results.length, results }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
