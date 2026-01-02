'use client';

import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ChartCard from '../shared/ChartCard';

export default function VolumeChart() {
  const [data, setData] = useState<{ date: string; volume: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('http://localhost:3001/api/v1/admin/orders/stats', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const result = await res.json();
      if (result.success) {
        setData(result.data.volumeByDay || []);
      }
    } catch (error) {
      console.error('Erro ao carregar gráfico:', error);
    } finally {
      setLoading(false);
    }
  };

  const chartData = data.map(item => ({
    date: format(new Date(item.date), 'dd/MM', { locale: ptBR }),
    volume: item.volume,
  }));

  return (
    <ChartCard title="💰 Volume de Negociações" loading={loading}>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" />
            <XAxis
              dataKey="date"
              stroke="var(--axis-stroke)"
              style={{ fontSize: '12px' }}
            />
            <YAxis
              stroke="var(--axis-stroke)"
              style={{ fontSize: '12px' }}
              tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--tooltip-bg)',
                border: '1px solid var(--tooltip-border)',
                borderRadius: '8px',
                color: 'var(--tooltip-text)',
              }}
              formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Volume']}
            />
            <Area
              type="monotone"
              dataKey="volume"
              stroke="#3b82f6"
              fillOpacity={1}
              fill="url(#colorVolume)"
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[300px] flex items-center justify-center text-gray-600 dark:text-gray-400">
          Nenhum dado disponível
        </div>
      )}
    </ChartCard>
  );
}
