import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { UserBadge } from '../services/gamificationService';

interface UserAchievementsProps {
  badges: UserBadge[];
  className?: string;
}

export function UserAchievements({ badges, className = '' }: UserAchievementsProps) {
  const [filter, setFilter] = useState<'all' | 'achievement' | 'consistency' | 'participation' | 'community'>('all');

  const getBadgeIcon = (badge: UserBadge) => {
    switch (badge.badge_name) {
      case 'First Goal': return 'solar:target-bold-duotone';
      case '5 Communities Conquered': return 'solar:medal-bold-duotone';
      case 'Goal Master': return 'solar:cup-star-bold-duotone';
      case '7-Day Streak': return 'solar:calendar-bold-duotone';
      case '30-Day Streak': return 'solar:bolt-bold-duotone';
      case 'Streak Master': return 'solar:bolt-bold-duotone';
      case '10 Hours Logged': return 'solar:clock-circle-bold-duotone';
      case '100 Hours Logged': return 'solar:clock-circle-bold-duotone';
      case 'Meeting Master': return 'solar:users-group-rounded-bold-duotone';
      case 'High Achiever': return 'solar:star-bold-duotone';
      case 'Big Winner': return 'solar:cup-star-bold-duotone';
      case 'Consistency King': return 'solar:crown-bold-duotone';
      default: return 'solar:medal-bold-duotone';
    }
  };

  const getBadgeColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'bg-blue-100 text-blue-600';
      case 'rare': return 'bg-purple-100 text-purple-600';
      case 'epic': return 'bg-yellow-100 text-yellow-600';
      case 'legendary': return 'bg-orange-100 text-orange-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const filteredBadges = badges.filter(badge => 
    filter === 'all' || badge.badge_category === filter
  );

  // Get all available badges (including ones not earned)
  const allBadges: (UserBadge & { earned: boolean })[] = [
    // Achievement badges
    { badge_id: '1', badge_name: 'First Goal', badge_description: 'Completed your first community goal', badge_category: 'achievement', badge_rarity: 'common', awarded_at: '', earned: badges.some(b => b.badge_name === 'First Goal') },
    { badge_id: '2', badge_name: '5 Communities Conquered', badge_description: 'Successfully completed 5 community goals', badge_category: 'achievement', badge_rarity: 'rare', awarded_at: '', earned: badges.some(b => b.badge_name === '5 Communities Conquered') },
    { badge_id: '3', badge_name: 'Goal Master', badge_description: 'Successfully completed 10 community goals', badge_category: 'achievement', badge_rarity: 'epic', awarded_at: '', earned: badges.some(b => b.badge_name === 'Goal Master') },
    
    // Consistency badges
    { badge_id: '4', badge_name: '7-Day Streak', badge_description: 'Maintained activity for 7 consecutive days', badge_category: 'consistency', badge_rarity: 'common', awarded_at: '', earned: badges.some(b => b.badge_name === '7-Day Streak') },
    { badge_id: '5', badge_name: '30-Day Streak', badge_description: 'Maintained activity for 30 consecutive days', badge_category: 'consistency', badge_rarity: 'rare', awarded_at: '', earned: badges.some(b => b.badge_name === '30-Day Streak') },
    { badge_id: '6', badge_name: 'Streak Master', badge_description: 'Maintained activity for 90 consecutive days', badge_category: 'consistency', badge_rarity: 'legendary', awarded_at: '', earned: badges.some(b => b.badge_name === 'Streak Master') },
    { badge_id: '12', badge_name: 'Consistency King', badge_description: 'Completed all daily goals for 14 consecutive days', badge_category: 'consistency', badge_rarity: 'epic', awarded_at: '', earned: badges.some(b => b.badge_name === 'Consistency King') },
    
    // Participation badges
    { badge_id: '7', badge_name: '10 Hours Logged', badge_description: 'Logged 10 hours of productive time', badge_category: 'participation', badge_rarity: 'common', awarded_at: '', earned: badges.some(b => b.badge_name === '10 Hours Logged') },
    { badge_id: '8', badge_name: '100 Hours Logged', badge_description: 'Logged 100 hours of productive time', badge_category: 'participation', badge_rarity: 'rare', awarded_at: '', earned: badges.some(b => b.badge_name === '100 Hours Logged') },
    { badge_id: '9', badge_name: 'Meeting Master', badge_description: 'Attended 50 community meetings', badge_category: 'participation', badge_rarity: 'epic', awarded_at: '', earned: badges.some(b => b.badge_name === 'Meeting Master') },
    
    // Community badges
    { badge_id: '10', badge_name: 'High Achiever', badge_description: 'Maintained a 90%+ success rate', badge_category: 'community', badge_rarity: 'epic', awarded_at: '', earned: badges.some(b => b.badge_name === 'High Achiever') },
    { badge_id: '11', badge_name: 'Big Winner', badge_description: 'Earned $1000+ in rewards', badge_category: 'community', badge_rarity: 'legendary', awarded_at: '', earned: badges.some(b => b.badge_name === 'Big Winner') }
  ];

  const filteredAllBadges = allBadges.filter(badge => 
    filter === 'all' || badge.badge_category === filter
  );

  return (
    <div className={className}>
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center space-x-2">
          <Icon icon="solar:cup-star-bold-duotone" width={20} className="text-primary-600" />
          <span>Achievement Badges</span>
        </h3>

        {/* Filter Tabs */}
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 mb-6">
          {[
            { key: 'all', label: 'All Badges' },
            { key: 'achievement', label: 'Goals' },
            { key: 'consistency', label: 'Streaks' },
            { key: 'participation', label: 'Participation' },
            { key: 'community', label: 'Community' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as any)}
              className={`flex-1 px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                filter === tab.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredAllBadges.map((badge) => {
            const iconName = getBadgeIcon(badge);
            const colorClass = getBadgeColor(badge.badge_rarity);
            
            return (
              <div 
                key={badge.badge_id} 
                className={`p-4 rounded-xl transition-all ${
                  badge.earned 
                    ? 'bg-white border-2 border-gray-200 hover:shadow-md' 
                    : 'bg-gray-50 border-2 border-gray-100 opacity-50'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${colorClass}`}>
                  <Icon icon={iconName} width={24} />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{badge.badge_name}</h3>
                <p className="text-sm text-gray-600">{badge.badge_description}</p>
                
                {badge.earned ? (
                  <div className="mt-2 flex items-center space-x-1 text-green-600">
                    <Icon icon="solar:check-circle-bold-duotone" width={14} />
                    <span className="text-xs">
                      {badge.awarded_at 
                        ? `Earned ${new Date(badge.awarded_at).toLocaleDateString()}` 
                        : 'Earned'}
                    </span>
                  </div>
                ) : (
                  <div className="mt-2">
                    <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded-full">
                      Not earned
                    </span>
                  </div>
                )}
                
                <div className="mt-2">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    badge.badge_rarity === 'common' ? 'bg-blue-50 text-blue-600' :
                    badge.badge_rarity === 'rare' ? 'bg-purple-50 text-purple-600' :
                    badge.badge_rarity === 'epic' ? 'bg-yellow-50 text-yellow-600' :
                    'bg-orange-50 text-orange-600'
                  }`}>
                    {badge.badge_rarity.charAt(0).toUpperCase() + badge.badge_rarity.slice(1)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        
        {filteredAllBadges.length === 0 && (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <Icon icon="solar:cup-star-bold-duotone" width={48} className="mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Badges Found</h3>
            <p className="text-gray-600">
              No badges match your current filter. Try selecting a different category.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}