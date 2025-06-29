import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useAuth } from '../contexts/AuthContext';
import { NotificationCenter } from './NotificationCenter';

export function Navbar() {
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  
  const isLandingPage = location.pathname === '/';

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = async () => {
    await logout();
    setShowProfileDropdown(false);
  };

  if (isLandingPage) {
    return (
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/95 shadow-soft backdrop-blur-md' : 'bg-white/80 backdrop-blur-md'
      } border-b border-gray-200`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="text-2xl font-bold text-gray-900">
              Mujtama
            </Link>
            
            <div className="hidden md:flex space-x-8 items-center">
              <a href="#how-it-works" className="text-gray-700 hover:text-primary-600 transition-colors">
                How It Works
              </a>
              <a href="#testimonials" className="text-gray-700 hover:text-primary-600 transition-colors">
                Testimonials
              </a>
              {isAuthenticated ? (
                <Link 
                  to="/home" 
                  className="bg-gradient-to-r from-primary-500 to-primary-600 text-white px-6 py-2 rounded-xl hover:from-primary-600 hover:to-primary-700 transition-all shadow-soft"
                >
                  Dashboard
                </Link>
              ) : (
                <Link 
                  to="/login" 
                  className="bg-gradient-to-r from-primary-500 to-primary-600 text-white px-6 py-2 rounded-xl hover:from-primary-600 hover:to-primary-700 transition-all shadow-soft"
                >
                  Get Started
                </Link>
              )}
            </div>
            
            {/* Mobile menu button */}
            <div className="md:hidden">
              <button 
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="text-gray-700 hover:text-primary-600 transition-colors"
              >
                {showMobileMenu ? 
                  <Icon icon="solar:close-circle-bold" width={24} /> : 
                  <Icon icon="solar:menu-dots-bold" width={24} />
                }
              </button>
            </div>
          </div>
        </div>
        
        {/* Mobile menu */}
        {showMobileMenu && (
          <div className="md:hidden bg-white border-b border-gray-200 py-4 px-4 shadow-soft">
            <div className="flex flex-col space-y-4">
              <a 
                href="#how-it-works" 
                className="text-gray-700 hover:text-primary-600 transition-colors py-2"
                onClick={() => setShowMobileMenu(false)}
              >
                How It Works
              </a>
              <a 
                href="#testimonials" 
                className="text-gray-700 hover:text-primary-600 transition-colors py-2"
                onClick={() => setShowMobileMenu(false)}
              >
                Testimonials
              </a>
              {isAuthenticated ? (
                <Link 
                  to="/home" 
                  className="bg-gradient-to-r from-primary-500 to-primary-600 text-white px-6 py-2 rounded-xl hover:from-primary-600 hover:to-primary-700 transition-all shadow-soft text-center"
                  onClick={() => setShowMobileMenu(false)}
                >
                  Dashboard
                </Link>
              ) : (
                <Link 
                  to="/login" 
                  className="bg-gradient-to-r from-primary-500 to-primary-600 text-white px-6 py-2 rounded-xl hover:from-primary-600 hover:to-primary-700 transition-all shadow-soft text-center"
                  onClick={() => setShowMobileMenu(false)}
                >
                  Get Started
                </Link>
              )}
            </div>
          </div>
        )}
      </nav>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <nav className={`hidden md:block fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? 'bg-white/95 shadow-soft backdrop-blur-md' : 'bg-white/90 backdrop-blur-md'
    } border-b border-gray-200`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/home" className="text-2xl font-bold text-gray-900">
            Mujtama
          </Link>
          
          <div className="flex space-x-8">
            <Link 
              to="/home" 
              className={`text-sm font-medium transition-colors ${
                location.pathname === '/home' 
                  ? 'text-primary-600' 
                  : 'text-gray-700 hover:text-primary-600'
              }`}
            >
              <div className="flex items-center space-x-1">
                <Icon icon="solar:home-2-bold-duotone" className={location.pathname === '/home' ? 'text-primary-600' : 'text-gray-700'} />
                <span>Home</span>
              </div>
            </Link>
            <Link 
              to="/communities" 
              className={`text-sm font-medium transition-colors ${
                location.pathname === '/communities' 
                  ? 'text-primary-600' 
                  : 'text-gray-700 hover:text-primary-600'
              }`}
            >
              <div className="flex items-center space-x-1">
                <Icon icon="solar:users-group-rounded-bold-duotone" className={location.pathname === '/communities' ? 'text-primary-600' : 'text-gray-700'} />
                <span>Communities</span>
              </div>
            </Link>
            <Link 
              to="/create" 
              className={`text-sm font-medium transition-colors ${
                location.pathname === '/create' 
                  ? 'text-primary-600' 
                  : 'text-gray-700 hover:text-primary-600'
              }`}
            >
              <div className="flex items-center space-x-1">
                <Icon icon="solar:add-circle-bold-duotone" className={location.pathname === '/create' ? 'text-primary-600' : 'text-gray-700'} />
                <span>Create</span>
              </div>
            </Link>
            <Link 
              to="/wallet" 
              className={`text-sm font-medium transition-colors ${
                location.pathname === '/wallet' 
                  ? 'text-primary-600' 
                  : 'text-gray-700 hover:text-primary-600'
              }`}
            >
              <div className="flex items-center space-x-1">
                <Icon icon="solar:wallet-money-bold-duotone" className={location.pathname === '/wallet' ? 'text-primary-600' : 'text-gray-700'} />
                <span>Wallet</span>
              </div>
            </Link>
            <Link 
              to="/profile" 
              className={`text-sm font-medium transition-colors ${
                location.pathname === '/profile' 
                  ? 'text-primary-600' 
                  : 'text-gray-700 hover:text-primary-600'
              }`}
            >
              <div className="flex items-center space-x-1">
                <Icon icon="solar:user-rounded-bold-duotone" className={location.pathname === '/profile' ? 'text-primary-600' : 'text-gray-700'} />
                <span>Profile</span>
              </div>
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            <NotificationCenter />
            
            <div className="relative">
              <button 
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className="flex items-center space-x-2 p-2 text-gray-700 hover:text-primary-600 transition-colors rounded-lg hover:bg-gray-100"
              >
                <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-primary-600 text-sm">{user?.avatar || '👤'}</span>
                </div>
                <span className="text-sm font-medium">{user?.name || 'User'}</span>
                <Icon icon="solar:alt-arrow-down-bold" width={16} />
              </button>
              
              {showProfileDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-medium border border-gray-100 py-2 z-50">
                  <Link 
                    to="/profile" 
                    className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => setShowProfileDropdown(false)}
                  >
                    <Icon icon="solar:user-bold" width={16} />
                    <span>Profile</span>
                  </Link>
                  <button className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full text-left">
                    <Icon icon="solar:settings-bold" width={16} />
                    <span>Settings</span>
                  </button>
                  <div className="border-t border-gray-100 my-1"></div>
                  <button 
                    onClick={handleLogout}
                    className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full text-left"
                  >
                    <Icon icon="solar:logout-2-bold" width={16} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}