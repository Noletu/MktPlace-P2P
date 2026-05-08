'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { fetchWithAuth } from '@/utils/api';
import RolesView from '@/components/admin/security/RolesView';
import TwoFactorView from '@/components/admin/security/TwoFactorView';
import MasterSeedView from '@/components/admin/security/MasterSeedView';
import ApprovalsView from '@/components/admin/security/ApprovalsView';
import DelegationsView from '@/components/admin/security/DelegationsView';

type SecurityTab = 'roles' | '2fa' | 'master-seed' | 'approvals' | 'delegations';

const TAB_CONFIG: { key: SecurityTab; label: string; icon: string; activeColor: string }[] = [
  { key: 'roles',       label: 'Roles',       icon: '👑', activeColor: 'border-purple-500 text-purple-600 dark:text-purple-400' },
  { key: '2fa',         label: '2FA',         icon: '🔒', activeColor: 'border-blue-500 text-blue-600 dark:text-blue-400' },
  { key: 'master-seed', label: 'Master Seed', icon: '🔐', activeColor: 'border-purple-500 text-purple-600 dark:text-purple-400' },
  { key: 'approvals',   label: 'Aprovações',  icon: '✅', activeColor: 'border-green-500 text-green-600 dark:text-green-400' },
  { key: 'delegations', label: 'Delegações',  icon: '🤝', activeColor: 'border-yellow-500 text-yellow-600 dark:text-yellow-400' },
];

const VALID_TABS: SecurityTab[] = ['roles', '2fa', 'master-seed', 'approvals', 'delegations'];

function SecurityPageContent() {
  const searchParams = useSearchParams();
  const [userLevel, setUserLevel] = useState(0);
  const [hasActiveDelegation, setHasActiveDelegation] = useState(false);
  const [loading, setLoading] = useState(true);

  const paramTab = searchParams.get('tab') as SecurityTab | null;
  const [activeTab, setActiveTab] = useState<SecurityTab>(
    paramTab && VALID_TABS.includes(paramTab) ? paramTab : 'roles'
  );

  useEffect(() => {
    const init = async () => {
      try {
        const meRes = await fetchWithAuth('/auth/me');
        const meData = await meRes.json();
        const level = meData.data?.level ?? 0;
        setUserLevel(level);

        if (level < 100) {
          try {
            const delegRes = await fetchWithAuth('/admin/delegations/my-delegation');
            if (delegRes.ok) {
              const delegData = await delegRes.json();
              setHasActiveDelegation(!!delegData.data);
            }
          } catch {
            // silencioso
          }
        }
      } catch {
        // silencioso — layout já protege
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const canSeeApprovals = userLevel >= 100 || hasActiveDelegation;
  const canSeeDelegations = userLevel >= 100;

  const visibleTabs = TAB_CONFIG.filter(t => {
    if (t.key === 'approvals') return canSeeApprovals;
    if (t.key === 'delegations') return canSeeDelegations;
    return true;
  });

  const effectiveTab = visibleTabs.some(t => t.key === activeTab) ? activeTab : 'roles';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Segurança</h1>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-300 dark:border-gray-700">
        <nav className="flex space-x-8 overflow-x-auto">
          {visibleTabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition whitespace-nowrap ${
                effectiveTab === t.key
                  ? t.activeColor
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      {effectiveTab === 'roles' && <RolesView />}
      {effectiveTab === '2fa' && <TwoFactorView />}
      {effectiveTab === 'master-seed' && <MasterSeedView />}
      {effectiveTab === 'approvals' && canSeeApprovals && <ApprovalsView />}
      {effectiveTab === 'delegations' && canSeeDelegations && <DelegationsView />}
    </div>
  );
}

export default function AdminSecurityPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-300">Carregando...</p>
          </div>
        </div>
      }
    >
      <SecurityPageContent />
    </Suspense>
  );
}
