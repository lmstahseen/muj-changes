import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useAuth } from '../contexts/AuthContext';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const { login, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Get the page user was trying to access
  const from = location.state?.from?.pathname || '/home';
  const successMessage = location.state?.message;

  // Show success message if redirected from signup
  useEffect(() => {
    if (successMessage) {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
    }
  }, [successMessage]);

  // Redirect if already authenticated
  useEffect(() => {
    console.log('Login: Checking auth state', { isAuthenticated, isLoading });
    if (isAuthenticated && !isLoading) {
      console.log('Login: User is authenticated, navigating to', from);
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Login: Form submitted');
    setError('');
    setIsSubmitting(true);

    try {
      console.log('Login: Calling login function');
      const { success, error } = await login(email, password);
      
      if (!success && error) {
        console.log('Login: Login failed with error', error);
        setError(error);
        setIsSubmitting(false);
      } else {
        console.log('Login: Login successful');
        // Don't set isSubmitting to false here, let the redirect handle it
      }
    } catch (err) {
      console.error('Login: Unexpected error', err);
      setError('An error occurred during login. Please try again.');
      setIsSubmitting(false);
    }
  };

  // For demo purposes, pre-fill with test credentials
  const fillTestCredentials = () => {
    setEmail('demo@example.com');
    setPassword('password123');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <Link to="/" className="text-3xl font-bold text-gray-900 mb-2 block">
            Mujtama
          </Link>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            Welcome back
          </h2>
          <p className="text-gray-600">
            Sign in to your account to continue your journey
          </p>
        </div>

        {/* Success Message */}
        {showSuccess && successMessage && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <Icon icon="solar:check-circle-bold-duotone" className="text-green-600 flex-shrink-0" width={20} />
              <p className="text-green-700 text-sm">{successMessage}</p>
            </div>
          </div>
        )}

        {/* Demo Mode Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center space-x-3">
            <Icon icon="solar:info-circle-bold-duotone" className="text-blue-600 flex-shrink-0" width={20} />
            <div>
              <p className="text-blue-700 text-sm">
                <strong>Demo Account:</strong> A demo account with real data has been made to make testing easier.
              </p>
              <button 
                onClick={fillTestCredentials}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium mt-1"
              >
                Use test credentials
              </button>
            </div>
          </div>
        </div>

        {/* Login Form */}
        <form className="space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center space-x-3">
              <Icon icon="solar:danger-triangle-bold-duotone" className="text-red-600 flex-shrink-0" width={20} />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email address
            </label>
            <div className="relative">
              <Icon icon="solar:letter-bold-duotone" className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" width={20} />
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent pl-10"
                placeholder="Enter your email"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <Icon icon="solar:lock-bold-duotone" className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" width={20} />
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent pl-10 pr-12"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <Icon icon={showPassword ? "solar:eye-closed-bold-duotone" : "solar:eye-bold-duotone"} width={20} />
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || isLoading}
            className="w-full bg-gradient-to-r from-primary-500 to-primary-600 text-white px-6 py-3 rounded-xl font-medium hover:from-primary-600 hover:to-primary-700 transition-all shadow-soft flex items-center justify-center space-x-2"
          >
            {isSubmitting || isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Signing in...</span>
              </>
            ) : (
              <span>Sign in</span>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="text-center">
          <p className="text-sm text-gray-600">
            Don't have an account?{' '}
            <Link to="/signup" className="text-primary-600 hover:text-primary-700 font-medium">
              Sign up
            </Link>
          </p>
        </div>

        {/* Back to Landing */}
        <div className="text-center pt-4 border-t border-gray-200">
          <Link 
            to="/" 
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            ← Back to homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
