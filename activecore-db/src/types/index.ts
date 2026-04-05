/**
 * Type definitions and interfaces for ActiveCore API
 * Centralized location for all data model interfaces
 */

// ==================== USER MODELS ====================
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: 'member' | 'admin';
  createdAt?: string;
  updatedAt?: string;
}

export interface UserProfile extends User {
  subscription?: string;
  joinDate?: string;
}

// ==================== MEAL MODELS ====================
export interface Ingredient {
  name: string;
  amount: number;
  unit: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
}

export interface Meal {
  id?: string;
  name: string;
  category?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  ingredients?: Ingredient[];
  recipe?: string;
  prepTime?: number;
  instructions?: string;
}

export interface MealPlan {
  id?: string;
  userId: string;
  planDate?: string;
  breakfast?: Meal;
  lunch?: Meal;
  dinner?: Meal;
  snack?: Meal;
  totalCalories?: number;
  planData?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ==================== PAYMENT MODELS ====================
export interface Payment {
  id?: string;
  userId: string;
  orderId?: string;
  membershipType: 'Monthly' | 'Quarterly' | 'Yearly';
  amount: number;
  status: 'pending' | 'approved' | 'failed' | 'cancelled';
  paymentMethod: 'card' | 'paypal' | 'gcash' | 'bank' | 'cash';
  paymentGateway?: string;
  transactionId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaymentResponse {
  success: boolean;
  message: string;
  paymentId?: string;
  redirectUrl?: string;
  orderId?: string;
}

export interface Subscription {
  id?: string;
  userId: string;
  plan: 'Monthly' | 'Quarterly' | 'Yearly' | 'None';
  startDate?: string;
  endDate?: string;
  status: 'active' | 'expired' | 'cancelled' | 'pending';
  createdAt?: string;
  updatedAt?: string;
}

// ==================== ATTENDANCE MODELS ====================
export interface AttendanceRecord {
  id?: string;
  userId: string;
  checkInTime: string;
  checkOutTime?: string;
  location: string;
  status: 'checked_in' | 'checked_out';
  createdAt?: string;
}

export interface AttendanceStats {
  totalAttendance: number;
  currentStreak: number;
  thisWeek?: number;
  thisMonth?: number;
}

// ==================== REWARD MODELS ====================
export interface Reward {
  id?: string;
  name: string;
  description?: string;
  pointsRequired: number;
  type: 'discount' | 'free_session' | 'merchandise';
  value?: string;
  available: boolean;
}

export interface UserReward {
  id?: string;
  userId: string;
  rewardId: string;
  claimedAt?: string;
  expiresAt?: string;
}

// ==================== EQUIPMENT MODELS ====================
export interface Equipment {
  id?: string;
  name: string;
  category: string;
  condition: 'excellent' | 'good' | 'fair' | 'needs_repair';
  lastMaintenance?: string;
  nextMaintenance?: string;
  location?: string;
}

// ==================== API REQUEST/RESPONSE MODELS ====================
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
}

export interface CreateMealPlanRequest {
  mealType?: string;
  excludeMealNames?: string[];
  currentMeal?: Meal;
  isSnack?: boolean;
  category?: string;
}

// ==================== ERROR MODELS ====================
export interface ErrorResponse {
  success: false;
  message: string;
  error?: string;
  errorId?: string;
  stack?: string;
}

// ==================== PAGINATION ====================
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page?: number;
  pageSize?: number;
}
