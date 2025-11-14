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
    const totalMinutes = Math.floor(totalSeconds / 60);
    const totalHours = Math.floor(totalMinutes / 60);
    const totalDays = Math.floor(totalHours / 24);

    const days = totalDays;
    const hours = totalHours % 24;
    const minutes = totalMinutes % 60;
    const seconds = totalSeconds % 60;

    // Se mais de 1 dia, mostrar dias e horas
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}min`;
    }

    // Se mais de 1 hora, mostrar horas e minutos
    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }

    // Se mais de 1 minuto, mostrar minutos e segundos
    if (minutes > 0) {
      return `${minutes}min ${seconds}s`;
    }

    // Menos de 1 minuto, apenas segundos
    return `${seconds}s`;
  };

  const getColorClass = () => {
    const minutesLeft = Math.floor(timeLeft / 1000 / 60);
    const hoursLeft = Math.floor(minutesLeft / 60);

    if (isExpired || minutesLeft < 0) {
      return 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700';
    } else if (minutesLeft < 5) {
      return 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800';
    } else if (minutesLeft < 30) {
      return 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800';
    } else if (hoursLeft < 2) {
      return 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800';
    } else {
      return 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800';
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
        <p className="text-xs font-semibold uppercase">Tempo Restante</p>
        <p className="text-lg font-semibold">{formatTime(timeLeft)}</p>
      </div>
    </div>
  );
}
