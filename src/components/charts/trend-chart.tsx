'use client';

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface TrendChartProps {
  data: { date: string; momentum: number }[];
}

export function TrendChart({ data }: TrendChartProps) {
  // Guard against empty data
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-500">
        No trend data available
      </div>
    );
  }

  return (
    <div className="h-64 w-full min-h-[256px]">
      <ResponsiveContainer width="100%" height="100%" minHeight={256}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="momentumGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748b', fontSize: 12 }}
            tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748b', fontSize: 12 }}
            domain={[0, 100]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
            }}
            labelStyle={{ color: '#94a3b8' }}
            itemStyle={{ color: '#8b5cf6' }}
          />
          <Area
            type="monotone"
            dataKey="momentum"
            stroke="#8b5cf6"
            strokeWidth={2}
            fill="url(#momentumGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
