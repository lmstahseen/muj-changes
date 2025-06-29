import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useAuth } from '../contexts/AuthContext';

export function Signup() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const navigate = useNavigate();
  const { signup } = useAuth();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      setError('Full name is required');
      return false;
    }
    
    if (!formData.email.trim()) {
      setError('Email address is required');
      return false;
    }
    
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }
    
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return false;
    }
    
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Signup: Form submitted');
    setError('');

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      console.log('Signup: Calling signup function');
      const { success, error } = await signup(
        formData.email,
        formData.password,
        formData.name
      );
      
      if (success) {
        console.log('Signup: Signup successful, redirecting to login');
        // Redirect to login with success message
        navigate('/login', { 
          state: { 
            message: 'Account created successfully! Please sign in to continue.' 
          } 
        });
      } else if (error) {
        console.log('Signup: Signup failed with error', error);
        setError(error);
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error('Signup: Unexpected error', error);
      setError('An error occurred during signup. Please try again.');
      setIsSubmitting(false);
    }
  };

  const fillSampleData = () => {
    setFormData({
      name: 'John Doe',
      email: 'demo@example.com',
      password: 'password123',
      confirmPassword: 'password123'
    });
    setError('');
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
            Create your account
          </h2>
          <p className="text-gray-600">
            Join the community and start achieving your goals
          </p>
        </div>

        {/* Demo Notice */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-start space-x-3">
            <Icon icon="solar:info-circle-bold-duotone" className="text-yellow-600 flex-shrink-0 mt-0.5" width={20} />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-yellow-800 mb-1">Demo Mode</h3>
              <p className="text-sm text-yellow-700 mb-3">
                You can create a simulated account or use the demo login credentials to access the platform.
              </p>
              <button
                type="button"
                onClick={fillSampleData}
                className="text-sm bg-yellow-600 text-white px-3 py-1.5 rounded-lg hover:bg-yellow-700 transition-colors font-medium"
              >
                Fill sample data
              </button>
            </div>
          </div>
        </div>

        {/* Signup Form */}
        <form className="space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center space-x-3">
              <Icon icon="solar:danger-triangle-bold-duotone" className="text-red-600 flex-shrink-0" width={20} />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Full name
            </label>
            <div className="relative">
              <Icon icon="solar:user-bold-duotone" className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" width={20} />
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent pl-10"
                placeholder="Enter your full name"
              />
            </div>
          </div>

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
                value={formData.email}
                onChange={handleInputChange}
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
                autoComplete="new-password"
                required
                value={formData.password}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent pl-10 pr-12"
                placeholder="Create a password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <Icon icon={showPassword ? "solar:eye-closed-bold-duotone" : "solar:eye-bold-duotone"} width={20} />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Must be at least 6 characters long</p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
              Confirm password
            </label>
            <div className="relative">
              <Icon icon="solar:lock-bold-duotone" className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" width={20} />
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent pl-10 pr-12"
                placeholder="Confirm your password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <Icon icon={showConfirmPassword ? "solar:eye-closed-bold-duotone" : "solar:eye-bold-duotone"} width={20} />
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-primary-500 to-primary-600 text-white px-6 py-3 rounded-xl font-medium hover:from-primary-600 hover:to-primary-700 transition-all shadow-soft flex items-center justify-center space-x-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Creating account...</span>
              </>
            ) : (
              <span>Create account</span>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="text-center">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
              Sign in
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