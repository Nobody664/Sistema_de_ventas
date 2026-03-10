'use client';

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

const data = [
  { day: 'Lun', revenue: 2200, sales: 80 },
  { day: 'Mar', revenue: 3100, sales: 110 },
  { day: 'Mié', revenue: 2800, sales: 97 },
  { day: 'Jue', revenue: 4300, sales: 128 },
  { day: 'Vie', revenue: 5200, sales: 143 },
  { day: 'Sáb', revenue: 6100, sales: 168 },
  { day: 'Dom', revenue: 4800, sales: 134 },
];

export function RevenueChart() {
  return (
    <div className="h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#eb6c3e" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#eb6c3e" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#e7ddcf" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
          <Tooltip />
          <Area type="monotone" dataKey="revenue" stroke="#eb6c3e" strokeWidth={3} fill="url(#revenueFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

