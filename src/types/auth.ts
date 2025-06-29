export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string;
  joinedAt: string;
  stats: {
    currentStreak: number;
    totalHours: number;
    communitiesJoined: number;
    communitiesWon: number;
    totalEarnings: number;
    successRate: number;
  };
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  message?: string;
}