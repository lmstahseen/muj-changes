import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';

interface ActiveTimerProps {
  targetDate: string;
  isCountdown: boolean;
  className?: string;
  showIcon?: boolean;
  iconSize?: number;
  textSize?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
  textColor?: string;
}

export function ActiveTimer({
  targetDate,
  isCountdown,
  className = '',
  showIcon = true,
  iconSize = 16,
  textSize = 'base',
  textColor = 'text-primary-600'
}: ActiveTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  
  useEffect(() => {
    const calculateTimeRemaining = () => {
      const target = new Date(targetDate);
      const now = new Date();
      
      // For countdown, target is in the future; for countup, target is in the past
      const diffTime = isCountdown 
        ? target.getTime() - now.getTime() 
        : now.getTime() - target.getTime();
      
      if (isCountdown && diffTime <= 0) {
        setTimeRemaining('Time\'s up!');
        return;
      }
      
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));
      const diffSeconds = Math.floor((diffTime % (1000 * 60)) / 1000);
      
      // Format based on remaining time
      if (diffDays > 0) {
        setTimeRemaining(`${diffDays}d ${diffHours}h`);
      } else if (diffHours > 0) {
        setTimeRemaining(`${diffHours}h ${diffMinutes}m`);
      } else {
        setTimeRemaining(`${diffMinutes}m ${diffSeconds}s`);
      }
    };
    
    // Calculate immediately and then set interval
    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 1000);
    
    return () => clearInterval(interval);
  }, [targetDate, isCountdown]);
  
  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      {showIcon && <Icon icon="solar:clock-circle-bold-duotone" width={iconSize} className={textColor} />}
      <span className={`font-medium ${textSize} ${textColor}`}>
        {timeRemaining}
      </span>
    </div>
  );
}