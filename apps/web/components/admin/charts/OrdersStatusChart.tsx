'use client';

import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import ChartCard from '../shared/ChartCard';

const COLORS = {
  PENDING: '#3b82f6',
  MATCHED: '#8b5cf6',
  PAYMENT_SENT: '#eab308',
  VALIDATING: '#f59e0b',
  COMPLETED: '#22c55e',
  CANCELLED: '#ef4444',
  EXPIRED: '#9ca3af',
  DISPUTED: '#ec4899',
};

export default function OrdersStatusChart() {
  const [data, setData] = useState<{ status: string; count: number }[]>([]);
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
        setData(result.data.byStatus || []);
      }
    } catch (error) {
      console.error('Erro ao carregar gráfico:', error);
    } finally {
      setLoading(false);
    }
  };

  const chartData = data.map(item => ({
    name: item.status,
    value: item.count,
  }));

  return (
    <ChartCard title="📊 Status dos Pedidos" loading={loading}>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS] || '#6b7280'} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#fff',
              }}
            />
            <Legend
              wrapperStyle={{ color: '#9ca3af' }}
              iconType="circle"
            />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[300px] flex items-center justify-center text-gray-400">
          Nenhum dado disponível
        </div>
      )}
    </ChartCard>
  );
}
