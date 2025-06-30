import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase, isDemoMode } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

// Define user type
export interface UserData {
  id: string;
  email: string;
  name: string;
  avatar: string;
}

// Define auth context type
interface AuthContextType {
  user: UserData | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Simulated user database with valid UUIDs (only used in demo mode)
const USERS: Record<string, { password: string; userData: UserData }> = {
  'demo@example.com': {
    password: 'password123',
    userData: {
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      email: 'demo@example.com',
      name: 'Demo User',
      avatar: '👤'
    }
  },
  'test@example.com': {
    password: 'test123',
    userData: {
      id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      email: 'test@example.com',
      name: 'Test User',
      avatar: '👤'
    }
  }
};

// UUID validation function
const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

// Convert Supabase user to UserData
const convertSupabaseUser = (user: User, profile?: any): UserData => {
  return {
    id: user.id,
    email: user.email || '',
    name: profile?.name || user.user_metadata?.name || user.email?.split('@')[0] || 'User',
    avatar: profile?.avatar_url || '👤'
  };
};

// Auth provider component
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Initialize auth state
  useEffect(() => {
    console.log('AuthProvider: Initializing auth state, isDemoMode:', isDemoMode);
    setIsLoading(true);
    
    if (isDemoMode) {
      // Demo mode - use simulated authentication
      try {
        const savedUser = localStorage.getItem('simulated_user');
        
        if (savedUser) {
          console.log('AuthProvider: Found saved user in demo mode');
          const userData = JSON.parse(savedUser);
          
          if (userData.id && isValidUUID(userData.id)) {
            console.log('AuthProvider: Valid UUID found, restoring session');
            setUser(userData);
            setIsAuthenticated(true);
          } else {
            console.log('AuthProvider: Invalid UUID found, clearing corrupted data');
            localStorage.removeItem('simulated_user');
          }
        }
      } catch (error) {
        console.error('AuthProvider: Error initializing demo auth', error);
        localStorage.removeItem('simulated_user');
      } finally {
        setIsLoading(false);
      }
    } else {
      // Real Supabase mode - use Supabase authentication
      const initializeSupabaseAuth = async () => {
        try {
          // Get initial session
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error('AuthProvider: Error getting session', error);
          } else if (session?.user) {
            console.log('AuthProvider: Found existing Supabase session');
            
            // Get user profile
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();
            
            const userData = convertSupabaseUser(session.user, profile);
            setUser(userData);
            setIsAuthenticated(true);
          }
          
          // Listen for auth changes
          const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
              console.log('AuthProvider: Auth state changed', event);
              
              if (session?.user) {
                // Get user profile
                const { data: profile } = await supabase
                  .from('profiles')
                  .select('*')
                  .eq('id', session.user.id)
                  .single();
                
                const userData = convertSupabaseUser(session.user, profile);
                setUser(userData);
                setIsAuthenticated(true);
              } else {
                setUser(null);
                setIsAuthenticated(false);
              }
            }
          );
          
          return () => {
            subscription.unsubscribe();
          };
        } catch (error) {
          console.error('AuthProvider: Error initializing Supabase auth', error);
        } finally {
          setIsLoading(false);
        }
      };
      
      initializeSupabaseAuth();
    }
  }, []);

  // Login function
  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    console.log('AuthProvider: Login attempt started');
    setIsLoading(true);
    
    try {
      if (isDemoMode) {
        // Demo mode login
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const userRecord = USERS[email];
        
        if (!userRecord || userRecord.password !== password) {
          console.log('AuthProvider: Demo login failed - invalid credentials');
          setIsLoading(false);
          return { success: false, error: 'Invalid email or password' };
        }
        
        console.log('AuthProvider: Demo login successful');
        setUser(userRecord.userData);
        setIsAuthenticated(true);
        localStorage.setItem('simulated_user', JSON.stringify(userRecord.userData));
        
        setIsLoading(false);
        return { success: true };
      } else {
        // Supabase login
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) {
          console.log('AuthProvider: Supabase login failed', error.message);
          setIsLoading(false);
          return { success: false, error: error.message };
        }
        
        if (data.user) {
          console.log('AuthProvider: Supabase login successful');
          // User state will be updated by the auth state change listener
          setIsLoading(false);
          return { success: true };
        }
        
        setIsLoading(false);
        return { success: false, error: 'Login failed' };
      }
    } catch (error) {
      console.error('AuthProvider: Unexpected login error', error);
      setIsLoading(false);
      return { success: false, error: 'An unexpected error occurred' };
    }
  };

  // Signup function
  const signup = async (email: string, password: string, name: string): Promise<{ success: boolean; error?: string }> => {
    console.log('AuthProvider: Signup attempt started');
    setIsLoading(true);
    
    try {
      if (isDemoMode) {
        // Demo mode signup
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (USERS[email]) {
          console.log('AuthProvider: Demo signup failed - email already in use');
          setIsLoading(false);
          return { success: false, error: 'Email already in use' };
        }
        
        const generateUUID = () => {
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
        };
        
        const newUser: UserData = {
          id: generateUUID(),
          email,
          name,
          avatar: '👤'
        };
        
        console.log('AuthProvider: Demo signup successful');
        setUser(newUser);
        setIsAuthenticated(true);
        localStorage.setItem('simulated_user', JSON.stringify(newUser));
        
        setIsLoading(false);
        return { success: true };
      } else {
        // Supabase signup
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: name,
            }
          }
        });
        
        if (error) {
          console.log('AuthProvider: Supabase signup failed', error.message);
          setIsLoading(false);
          return { success: false, error: error.message };
        }
        
        if (data.user) {
          console.log('AuthProvider: Supabase signup successful');
          
          // Create profile record
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: data.user.id,
              name: name,
              email: email,
            });
          
          if (profileError) {
            console.error('AuthProvider: Error creating profile', profileError);
            // Don't fail the signup if profile creation fails
          }
          
          // User state will be updated by the auth state change listener
          setIsLoading(false);
          return { success: true };
        }
        
        setIsLoading(false);
        return { success: false, error: 'Signup failed' };
      }
    } catch (error) {
      console.error('AuthProvider: Unexpected signup error', error);
      setIsLoading(false);
      return { success: false, error: 'An unexpected error occurred' };
    }
  };

  // Logout function
  const logout = async (): Promise<void> => {
    console.log('AuthProvider: Logout attempt started');
    setIsLoading(true);
    
    try {
      if (isDemoMode) {
        // Demo mode logout
        await new Promise(resolve => setTimeout(resolve, 500));
        setUser(null);
        setIsAuthenticated(false);
        localStorage.removeItem('simulated_user');
      } else {
        // Supabase logout
        const { error } = await supabase.auth.signOut();
        if (error) {
          console.error('AuthProvider: Logout error', error);
        }
        // User state will be updated by the auth state change listener
      }
    } catch (error) {
      console.error('AuthProvider: Logout error', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Context value
  const value = {
    user,
    isAuthenticated,
    isLoading,
    login,
    signup,
    logout
  };

  console.log('AuthProvider: Current state', { isAuthenticated, isLoading, hasUser: !!user, isDemoMode });

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};