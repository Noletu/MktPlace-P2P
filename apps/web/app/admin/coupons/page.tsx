'use client';

import { useEffect, useState } from 'react';
import StatusBadge from '@/components/admin/shared/StatusBadge';

interface Coupon {
  id: string;
  code: string;
  discountPercentage: number;
  maxUsesPerUser: number;
  expiresAt?: string;
  isPublic: boolean;
  isActive: boolean;
  totalUses: number;
  description?: string;
  createdAt: string;
  _count: {
    userCoupons: number;
  };
}

interface CouponStats {
  totalCoupons: number;
  activeCoupons: number;
  totalUses: number;
  totalDiscountGiven: number;
}

// Helper function para determinar status real do cupom (considera expiração)
const getCouponStatus = (coupon: Coupon): { label: string; variant: 'success' | 'warning' | 'danger' } => {
  const now = new Date();
  const isExpired = coupon.expiresAt && new Date(coupon.expiresAt) < now;

  if (isExpired) {
    return { label: 'Expirado', variant: 'warning' };
  }
  if (!coupon.isActive) {
    return { label: 'Inativo', variant: 'danger' };
  }
  return { label: 'Ativo', variant: 'success' };
};

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [stats, setStats] = useState<CouponStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterVisibility, setFilterVisibility] = useState('ALL');

  // Estados para criar cupom
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    discountPercentage: 10,
    maxUsesPerUser: 1,
    expiresAt: '',
    isPublic: false,
    isActive: true,
    description: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('accessToken');

      const [couponsRes, statsRes] = await Promise.all([
        fetch('http://localhost:3001/api/v1/coupons', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('http://localhost:3001/api/v1/coupons/stats', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const couponsData = await couponsRes.json();
      const statsData = await statsRes.json();

      if (couponsData.success) setCoupons(couponsData.data);
      if (statsData.success) setStats(statsData.data);
    } catch (error) {
      console.error('Erro ao buscar cupons:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.code.length < 3 || formData.code.length > 20) {
      setError('Código deve ter entre 3 e 20 caracteres');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const token = localStorage.getItem('accessToken');

      // Converter data para formato ISO 8601 se fornecida
      let expiresAtISO = null;
      if (formData.expiresAt) {
        try {
          const date = new Date(formData.expiresAt);
          expiresAtISO = date.toISOString();
        } catch (err) {
          setError('Data de expiração inválida');
          setIsSubmitting(false);
          return;
        }
      }

      const response = await fetch('http://localhost:3001/api/v1/coupons', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: formData.code,
          discountPercentage: formData.discountPercentage,
          maxUsesPerUser: formData.maxUsesPerUser,
          expiresAt: expiresAtISO,
          isPublic: formData.isPublic,
          isActive: formData.isActive,
          description: formData.description || null,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao criar cupom');
      }

      setShowCreateForm(false);
      setFormData({
        code: '',
        discountPercentage: 10,
        maxUsesPerUser: 1,
        expiresAt: '',
        isPublic: false,
        isActive: true,
        description: '',
      });
      setIsUnlimited(false);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Erro ao criar cupom');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCoupon = async (id: string, code: string) => {
    if (!confirm(`Deseja realmente deletar o cupom ${code}?`)) return;

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`http://localhost:3001/api/v1/coupons/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao deletar cupom');
      }

      fetchData();
    } catch (err: any) {
      alert(err.message || 'Erro ao deletar cupom');
    }
  };

  const filteredCoupons = coupons.filter((coupon) => {
    const matchSearch = coupon.code.toLowerCase().includes(searchTerm.toLowerCase());

    const now = new Date();
    const matchStatus =
      filterStatus === 'ALL' ||
      (filterStatus === 'ACTIVE' && coupon.isActive && (!coupon.expiresAt || new Date(coupon.expiresAt) > now)) ||
      (filterStatus === 'INACTIVE' && !coupon.isActive) ||
      (filterStatus === 'EXPIRED' && coupon.expiresAt && new Date(coupon.expiresAt) < now);

    const matchVisibility =
      filterVisibility === 'ALL' ||
      (filterVisibility === 'PUBLIC' && coupon.isPublic) ||
      (filterVisibility === 'SECRET' && !coupon.isPublic);

    return matchSearch && matchStatus && matchVisibility;
  });

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-700 dark:text-gray-300">Carregando cupons...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Gerenciar Cupons</h1>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition"
        >
          {showCreateForm ? 'Cancelar' : '+ Criar Cupom'}
        </button>
      </div>

      {showCreateForm && (
        <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl p-6 mb-8">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Novo Cupom</h3>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleCreateCoupon} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Código *</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  maxLength={20}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Desconto (%) *</label>
                <input
                  type="number"
                  value={formData.discountPercentage}
                  onChange={(e) => setFormData({ ...formData, discountPercentage: parseInt(e.target.value) || 0 })}
                  min="1"
                  max="100"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Limite por Usuário *</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={formData.maxUsesPerUser}
                    onChange={(e) => setFormData({ ...formData, maxUsesPerUser: parseInt(e.target.value) || 1 })}
                    min="1"
                    disabled={isUnlimited}
                    className={`flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white ${isUnlimited ? 'opacity-50 cursor-not-allowed' : ''}`}
                    required={!isUnlimited}
                  />
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={isUnlimited}
                      onChange={(e) => {
                        setIsUnlimited(e.target.checked);
                        if (e.target.checked) {
                          setFormData({ ...formData, maxUsesPerUser: 0 });
                        } else {
                          setFormData({ ...formData, maxUsesPerUser: 1 });
                        }
                      }}
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600"
                    />
                    Ilimitado
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Data de Expiração</label>
                <input
                  type="datetime-local"
                  value={formData.expiresAt}
                  onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Descrição</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                rows={2}
                maxLength={500}
              />
            </div>

            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.isPublic}
                  onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Cupom Público</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Cupom Ativo</span>
              </label>
            </div>

            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:opacity-50"
              >
                {isSubmitting ? 'Criando...' : 'Criar Cupom'}
              </button>
            </div>
          </form>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl p-6">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total de Cupons</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{stats.totalCoupons}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl p-6">
            <p className="text-sm text-gray-600 dark:text-gray-400">Cupons Ativos</p>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">{stats.activeCoupons}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl p-6">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total de Usos</p>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">{stats.totalUses}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl p-6">
            <p className="text-sm text-gray-600 dark:text-gray-400">Desconto Total</p>
            <p className="text-3xl font-bold text-purple-600 dark:text-purple-400 mt-2">N/A</p>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Buscar por código</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Digite o código..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            >
              <option value="ALL">Todos</option>
              <option value="ACTIVE">Ativos</option>
              <option value="INACTIVE">Inativos</option>
              <option value="EXPIRED">Expirados</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Visibilidade</label>
            <select
              value={filterVisibility}
              onChange={(e) => setFilterVisibility(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            >
              <option value="ALL">Todos</option>
              <option value="PUBLIC">Públicos</option>
              <option value="SECRET">Secretos</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl overflow-hidden">
        <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
          <thead className="bg-gray-100 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Código</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Desconto</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Limite/Usuário</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Validade</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Visibilidade</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Usos</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-300 dark:divide-gray-700">
            {filteredCoupons.map((coupon) => (
              <tr key={coupon.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                <td className="px-6 py-4">
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{coupon.code}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-green-600 dark:text-green-400 font-bold">{coupon.discountPercentage}%</span>
                </td>
                <td className="px-6 py-4 text-gray-900 dark:text-white">{coupon.maxUsesPerUser === 0 ? 'Ilimitado' : `${coupon.maxUsesPerUser}x`}</td>
                <td className="px-6 py-4 text-gray-900 dark:text-white">
                  {coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleString('pt-BR') : 'Sem expiração'}
                </td>
                <td className="px-6 py-4">
                  <StatusBadge variant={coupon.isPublic ? 'info' : 'warning'}>
                    {coupon.isPublic ? 'Público' : 'Secreto'}
                  </StatusBadge>
                </td>
                <td className="px-6 py-4">
                  {(() => {
                    const status = getCouponStatus(coupon);
                    return (
                      <StatusBadge variant={status.variant}>
                        {status.label}
                      </StatusBadge>
                    );
                  })()}
                </td>
                <td className="px-6 py-4 text-gray-900 dark:text-white">{coupon.totalUses}</td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => handleDeleteCoupon(coupon.id, coupon.code)}
                    className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Deletar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredCoupons.length === 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            Nenhum cupom encontrado
          </div>
        )}
      </div>
    </div>
  );
}
