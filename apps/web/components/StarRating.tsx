'use client';

import { useState } from 'react';

interface StarRatingProps {
  value: number; // 0-5
  onChange?: (value: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export default function StarRating({
  value,
  onChange,
  readonly = false,
  size = 'md',
  label
}: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number>(0);

  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
  };

  const handleClick = (rating: number) => {
    if (!readonly && onChange) {
      onChange(rating);
    }
  };

  const handleMouseEnter = (rating: number) => {
    if (!readonly) {
      setHoverValue(rating);
    }
  };

  const handleMouseLeave = () => {
    setHoverValue(0);
  };

  const displayValue = hoverValue || value;

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}
      <div
        className="flex gap-1"
        onMouseLeave={handleMouseLeave}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => handleClick(star)}
            onMouseEnter={() => handleMouseEnter(star)}
            disabled={readonly}
            className={`
              ${sizeClasses[size]}
              ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'}
              transition-all duration-150
              ${readonly ? '' : 'focus:outline-none focus:ring-2 focus:ring-blue-500 rounded'}
            `}
            aria-label={`${star} ${star === 1 ? 'estrela' : 'estrelas'}`}
          >
            {star <= displayValue ? (
              <span className="text-yellow-400">★</span>
            ) : (
              <span className="text-gray-300 dark:text-gray-600">☆</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
