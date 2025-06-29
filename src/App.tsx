import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Navbar } from './components/Navbar';
import { MobileNavbar } from './components/MobileNavbar';
import { LoadingSpinner } from './components/LoadingSpinner';

// Lazy load pages for better performance
const Landing = lazy(() => import('./pages/Landing').then(module => ({ default: module.Landing })));
const Login = lazy(() => import('./pages/Login').then(module => ({ default: module.Login })));
const Signup = lazy(() => import('./pages/Signup').then(module => ({ default: module.Signup })));
const Home = lazy(() => import('./pages/Home').then(module => ({ default: module.Home })));
const Communities = lazy(() => import('./pages/Communities').then(module => ({ default: module.Communities })));
const Create = lazy(() => import('./pages/Create').then(module => ({ default: module.Create })));
const CommunityDetail = lazy(() => import('./pages/CommunityDetail').then(module => ({ default: module.CommunityDetail })));
const Wallet = lazy(() => import('./pages/Wallet').then(module => ({ default: module.Wallet })));
const Profile = lazy(() => import('./pages/Profile').then(module => ({ default: module.Profile })));

function App() {
  useEffect(() => {
    console.log('App: Component mounted');
    
    // Log environment variables availability (without exposing values)
    console.log('App: VITE_SUPABASE_URL =', import.meta.env.VITE_SUPABASE_URL ? 'exists' : 'missing');
    console.log('App: VITE_SUPABASE_ANON_KEY =', import.meta.env.VITE_SUPABASE_ANON_KEY ? 'exists' : 'missing');
    
    return () => {
      console.log('App: Component unmounted');
    };
  }, []);

  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50 font-geist">
          <Navbar />
          
          <main className="pb-20 md:pb-0">
            <Suspense fallback={<LoadingSpinner />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/home" element={
                  <ProtectedRoute>
                    <Home />
                  </ProtectedRoute>
                } />
                <Route path="/communities" element={
                  <ProtectedRoute>
                    <Communities />
                  </ProtectedRoute>
                } />
                <Route path="/create" element={
                  <ProtectedRoute>
                    <Create />
                  </ProtectedRoute>
                } />
                <Route path="/communities/:id" element={
                  <ProtectedRoute>
                    <CommunityDetail />
                  </ProtectedRoute>
                } />
                <Route path="/wallet" element={
                  <ProtectedRoute>
                    <Wallet />
                  </ProtectedRoute>
                } />
                <Route path="/profile" element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                } />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </main>

          <MobileNavbar />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;