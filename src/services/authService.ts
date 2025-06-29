import { UserData } from '../contexts/AuthContext';

// Simulated auth service
class AuthService {
  private static instance: AuthService;
  private currentUser: UserData | null = null;

  private constructor() {}

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // Get current user from localStorage
  getCurrentUser(): UserData | null {
    if (!this.currentUser) {
      const savedUser = localStorage.getItem('simulated_user');
      if (savedUser) {
        this.currentUser = JSON.parse(savedUser);
      }
    }
    return this.currentUser;
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return this.getCurrentUser() !== null;
  }

  // Update user data
  updateUserData(userData: Partial<UserData>): void {
    if (this.currentUser) {
      this.currentUser = { ...this.currentUser, ...userData };
      localStorage.setItem('simulated_user', JSON.stringify(this.currentUser));
    }
  }

  // Clear user data on logout
  clearUserData(): void {
    this.currentUser = null;
    localStorage.removeItem('simulated_user');
  }
}

export default AuthService;