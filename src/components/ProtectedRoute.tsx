import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSpinner } from './LoadingSpinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    console.log('ProtectedRoute: isAuthenticated =', isAuthenticated, 'isLoading =', isLoading);
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    console.log('ProtectedRoute: Still loading, showing spinner');
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    console.log('ProtectedRoute: Not authenticated, redirecting to login');
    // Redirect to login page with return url
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  console.log('ProtectedRoute: Authenticated, showing protected content');
  return <>{children}</>;
}