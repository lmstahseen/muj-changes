import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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

// Simulated user database with valid UUIDs
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

// Auth provider component
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Initialize auth state
  useEffect(() => {
    console.log('AuthProvider: Initializing auth state');
    setIsLoading(true);
    
    try {
      // Check for existing session in localStorage
      const savedUser = localStorage.getItem('simulated_user');
      
      if (savedUser) {
        console.log('AuthProvider: Found saved user');
        const userData = JSON.parse(savedUser);
        setUser(userData);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('AuthProvider: Error initializing auth', error);
      // Clear potentially corrupted data
      localStorage.removeItem('simulated_user');
    } finally {
      console.log('AuthProvider: Setting isLoading to false');
      setIsLoading(false);
    }
  }, []);

  // Login function
  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    console.log('AuthProvider: Login attempt started');
    setIsLoading(true);
    
    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const userRecord = USERS[email];
      
      if (!userRecord || userRecord.password !== password) {
        console.log('AuthProvider: Login failed - invalid credentials');
        setIsLoading(false);
        return { success: false, error: 'Invalid email or password' };
      }
      
      // Login successful
      console.log('AuthProvider: Login successful');
      setUser(userRecord.userData);
      setIsAuthenticated(true);
      
      // Save to localStorage
      localStorage.setItem('simulated_user', JSON.stringify(userRecord.userData));
      
      setIsLoading(false);
      return { success: true };
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
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if user already exists
      if (USERS[email]) {
        console.log('AuthProvider: Signup failed - email already in use');
        setIsLoading(false);
        return { success: false, error: 'Email already in use' };
      }
      
      // Generate a valid UUID for new user
      const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c == 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };
      
      // Create new user (in a real app, this would be saved to a database)
      const newUser: UserData = {
        id: generateUUID(),
        email,
        name,
        avatar: '👤'
      };
      
      // In a real implementation, we would save this user to the database
      // For simulation, we'll just pretend it worked
      console.log('AuthProvider: Signup successful');
      
      // Automatically log in the new user
      setUser(newUser);
      setIsAuthenticated(true);
      
      // Save to localStorage
      localStorage.setItem('simulated_user', JSON.stringify(newUser));
      
      setIsLoading(false);
      return { success: true };
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
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Clear user data
      setUser(null);
      setIsAuthenticated(false);
      
      // Remove from localStorage
      localStorage.removeItem('simulated_user');
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

  console.log('AuthProvider: Current state', { isAuthenticated, isLoading, hasUser: !!user });

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