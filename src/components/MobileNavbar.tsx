import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useAuth } from '../contexts/AuthContext';

export function MobileNavbar() {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated || location.pathname === '/' || location.pathname === '/login' || location.pathname === '/signup') {
    return null;
  }

  const navItems = [
    { path: '/home', icon: 'solar:home-2-bold-duotone', label: 'Home' },
    { path: '/communities', icon: 'solar:users-group-rounded-bold-duotone', label: 'Communities' },
    { path: '/create', icon: 'solar:add-circle-bold-duotone', label: 'Create' },
    { path: '/wallet', icon: 'solar:wallet-money-bold-duotone', label: 'Wallet' },
    { path: '/profile', icon: 'solar:user-rounded-bold-duotone', label: 'Profile' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 shadow-soft">
      <div className="flex justify-around items-center py-2">
        {navItems.map(({ path, icon, label }) => {
          const isActive = location.pathname === path || location.pathname.startsWith(path + '/');
          
          return (
            <Link
              key={path}
              to={path}
              className={`flex flex-col items-center space-y-1 py-2 px-3 rounded-lg transition-colors ${
                isActive 
                  ? 'text-primary-600 bg-primary-50' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon icon={icon} width={20} />
              <span className="text-xs font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}