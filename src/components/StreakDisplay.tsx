import React from 'react';
import { Icon } from '@iconify/react';
import { UserStreak } from '../services/gamificationService';

interface StreakDisplayProps {
  streak: UserStreak;
  className?: string;
  showDetails?: boolean;
}

export function StreakDisplay({ streak, className = '', showDetails = true }: StreakDisplayProps) {
  const today = new Date().toISOString().split('T')[0];
  const isActiveToday = streak.last_active_date?.split('T')[0] === today;
  
  // Calculate days since streak start
  const daysSinceStart = streak.streak_start_date 
    ? Math.floor((new Date().getTime() - new Date(streak.streak_start_date).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  
  // Calculate days until next milestone
  const nextMilestone = streak.current_streak < 7 ? 7 : 
                        streak.current_streak < 30 ? 30 :
                        streak.current_streak < 90 ? 90 : 
                        streak.current_streak + 10;
  
  const daysToNextMilestone = nextMilestone - streak.current_streak;
  
  return (
    <div className={`${className}`}>
      <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Icon icon="solar:bolt-bold-duotone" width={20} className="text-primary-600" />
            <h3 className="text-lg font-semibold text-primary-900">Your Streak</h3>
          </div>
          
          {isActiveToday ? (
            <div className="flex items-center space-x-1 text-green-600 bg-green-50 px-2 py-1 rounded-full text-xs">
              <Icon icon="solar:check-circle-bold-duotone" width={14} />
              <span>Active Today</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1 text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full text-xs">
              <Icon icon="solar:danger-triangle-bold-duotone" width={14} />
              <span>Not Active Today</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-center mb-6">
          <div className="text-center">
            <div className="text-5xl font-bold text-primary-600 mb-1">{streak.current_streak}</div>
            <div className="text-sm text-primary-700">Day Streak</div>
          </div>
        </div>
        
        {/* Streak Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-primary-700 mb-1">
            <span>Current</span>
            <span>Next: {nextMilestone} days</span>
          </div>
          <div className="w-full bg-white rounded-full h-2.5">
            <div 
              className="bg-primary-600 h-2.5 rounded-full transition-all"
              style={{ width: `${Math.min(100, (streak.current_streak / nextMilestone) * 100)}%` }}
            ></div>
          </div>
          {daysToNextMilestone > 0 && (
            <p className="text-xs text-primary-600 mt-1">
              {daysToNextMilestone} days until your next milestone!
            </p>
          )}
        </div>
        
        {showDetails && (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-primary-700">Longest Streak:</span>
              <span className="font-medium text-primary-900">{streak.longest_streak} days</span>
            </div>
            {streak.streak_start_date && (
              <div className="flex justify-between">
                <span className="text-primary-700">Started On:</span>
                <span className="font-medium text-primary-900">{new Date(streak.streak_start_date).toLocaleDateString()}</span>
              </div>
            )}
            {daysSinceStart > 0 && (
              <div className="flex justify-between">
                <span className="text-primary-700">Days Since Start:</span>
                <span className="font-medium text-primary-900">{daysSinceStart} days</span>
              </div>
            )}
            {streak.last_active_date && (
              <div className="flex justify-between">
                <span className="text-primary-700">Last Active:</span>
                <span className="font-medium text-primary-900">{new Date(streak.last_active_date).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        )}
        
        {!isActiveToday && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center space-x-2 text-yellow-800">
              <Icon icon="solar:calendar-bold-duotone" width={16} className="text-yellow-600" />
              <span className="text-sm font-medium">Don't break your streak!</span>
            </div>
            <p className="text-xs text-yellow-700 mt-1">
              Log progress or attend a meeting today to maintain your streak.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}