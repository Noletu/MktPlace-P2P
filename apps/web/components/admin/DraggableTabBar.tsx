'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface TabConfig {
  key: string;
  label: string;
  icon?: string;
  activeColor: string;
  /** Second line of label (rendered as <br/>{labelLine2}) — only for 'stacked' variant */
  labelLine2?: string;
}

interface DraggableTabBarProps {
  tabs: TabConfig[];
  activeTab: string;
  onTabChange: (key: string) => void;
  storageKey: string;
  /** 'inline' = icon + label in one line (default). 'stacked' = icon above label (admin nav style). */
  variant?: 'inline' | 'stacked';
}

function getStorageKey(sk: string) {
  return `tab-order-${sk}`;
}

function reconcileTabs(savedOrder: string[], current: TabConfig[]): TabConfig[] {
  const currentKeys = new Set(current.map(t => t.key));
  const currentMap = new Map(current.map(t => [t.key, t]));

  const ordered: TabConfig[] = [];
  for (const key of savedOrder) {
    const tab = currentMap.get(key);
    if (tab) {
      ordered.push(tab);
      currentKeys.delete(key);
    }
  }
  for (const key of currentKeys) {
    ordered.push(currentMap.get(key)!);
  }
  return ordered;
}

const CLICK_THRESHOLD = 5;

export default function DraggableTabBar({ tabs, activeTab, onTabChange, storageKey, variant = 'inline' }: DraggableTabBarProps) {
  const [orderedTabs, setOrderedTabs] = useState<TabConfig[]>([]);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);

  const draggingKeyRef = useRef<string | null>(null);
  const startXRef = useRef(0);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const prevKeySig = useRef('');
  const onTabChangeRef = useRef(onTabChange);
  onTabChangeRef.current = onTabChange;

  useEffect(() => {
    const sig = tabs.map(t => t.key).join('|');
    if (sig === prevKeySig.current) return;
    prevKeySig.current = sig;

    try {
      const saved = localStorage.getItem(getStorageKey(storageKey));
      if (saved) {
        setOrderedTabs(reconcileTabs(JSON.parse(saved), tabs));
      } else {
        setOrderedTabs(tabs);
      }
    } catch {
      setOrderedTabs(tabs);
    }
  }, [tabs, storageKey]);

  const saveOrder = useCallback((t: TabConfig[]) => {
    try {
      localStorage.setItem(getStorageKey(storageKey), JSON.stringify(t.map(x => x.key)));
    } catch {}
  }, [storageKey]);

  const handlePointerDown = useCallback((e: React.PointerEvent, key: string) => {
    if (e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    draggingKeyRef.current = key;
    startXRef.current = e.clientX;
    setDraggingKey(key);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const dk = draggingKeyRef.current;
    if (!dk) return;

    const x = e.clientX;

    setOrderedTabs(prev => {
      const fromIdx = prev.findIndex(t => t.key === dk);
      if (fromIdx === -1) return prev;

      for (let i = 0; i < prev.length; i++) {
        if (i === fromIdx) continue;
        const el = tabRefs.current.get(prev[i].key);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const mid = rect.left + rect.width / 2;

        if ((fromIdx < i && x > mid) || (fromIdx > i && x < mid)) {
          const next = [...prev];
          const [moved] = next.splice(fromIdx, 1);
          next.splice(i, 0, moved);
          return next;
        }
      }
      return prev;
    });
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const dk = draggingKeyRef.current;
    if (!dk) return;

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    draggingKeyRef.current = null;
    setDraggingKey(null);

    const distance = Math.abs(e.clientX - startXRef.current);
    if (distance < CLICK_THRESHOLD) {
      onTabChangeRef.current(dk);
    } else {
      setOrderedTabs(prev => {
        saveOrder(prev);
        return prev;
      });
    }
  }, [saveOrder]);

  if (orderedTabs.length === 0) return null;

  const isStacked = variant === 'stacked';

  const inactiveClass = isStacked
    ? 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-400 dark:hover:border-gray-600'
    : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600';

  const tabBase = isStacked
    ? 'flex flex-col items-center py-3 px-3 border-b-2 font-medium text-xs min-w-[70px] select-none'
    : 'py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap select-none';

  const renderTabContent = (t: TabConfig) => {
    if (isStacked) {
      return (
        <>
          <span className="text-lg mb-1">{t.icon}</span>
          {t.labelLine2 ? (
            <span className="text-center leading-tight">{t.label}<br />{t.labelLine2}</span>
          ) : (
            <span>{t.label}</span>
          )}
        </>
      );
    }
    return <>{t.icon ? `${t.icon} ` : ''}{t.label}</>;
  };

  const tabButtons = orderedTabs.map(t => (
    <button
      key={t.key}
      ref={el => {
        if (el) tabRefs.current.set(t.key, el);
        else tabRefs.current.delete(t.key);
      }}
      draggable={false}
      onPointerDown={(e) => handlePointerDown(e, t.key)}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className={`${tabBase} ${
        activeTab === t.key ? t.activeColor : inactiveClass
      } ${draggingKey === t.key ? 'opacity-50' : ''}`}
      style={{ cursor: draggingKey !== null ? 'grabbing' : 'grab', touchAction: 'none' }}
    >
      {renderTabContent(t)}
    </button>
  ));

  if (isStacked) {
    return (
      <div className="flex justify-center space-x-1" style={{ touchAction: 'none' }}>
        {tabButtons}
      </div>
    );
  }

  return (
    <div className="mb-6 border-b border-gray-300 dark:border-gray-700">
      <nav className="flex space-x-8 overflow-x-auto" style={{ touchAction: 'none' }}>
        {tabButtons}
      </nav>
    </div>
  );
}
