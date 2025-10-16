'use client';

import { useState, useEffect } from 'react';

interface CountdownTimerProps {
  timeoutAt: string | Date;
  onExpire?: () => void;
}

export default function CountdownTimer({ timeoutAt, onExpire }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const targetTime = new Date(timeoutAt).getTime();
      const difference = targetTime - now;

      if (difference <= 0) {
        setIsExpired(true);
        setTimeLeft(0);
        if (onExpire) {
          onExpire();
        }
        return 0;
      }

      return difference;
    };

    // Calcular tempo inicial
    const initial = calculateTimeLeft();
    setTimeLeft(initial);

    // Atualizar a cada segundo
    const interval = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [timeoutAt, onExpire]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const getColorClass = () => {
    const minutesLeft = Math.floor(timeLeft / 1000 / 60);

    if (isExpired || minutesLeft < 0) {
      return 'bg-red-100 text-red-800 border-red-300';
    } else if (minutesLeft < 5) {
      return 'bg-red-50 text-red-700 border-red-200';
    } else if (minutesLeft < 15) {
      return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    } else {
      return 'bg-green-50 text-green-700 border-green-200';
    }
  };

  if (isExpired) {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border-2 ${getColorClass()}`}>
        <span className="text-xl">⏰</span>
        <div>
          <p className="text-xs font-semibold">TEMPO ESGOTADO</p>
          <p className="text-sm">Pedido expirado</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border-2 ${getColorClass()}`}>
      <span className="text-xl">⏱️</span>
      <div>
        <p className="text-xs font-semibold">TEMPO RESTANTE</p>
        <p className="text-2xl font-mono font-bold">{formatTime(timeLeft)}</p>
      </div>
    </div>
  );
}
