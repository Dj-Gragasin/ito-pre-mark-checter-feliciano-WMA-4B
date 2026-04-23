import { User } from '../models/User';
import { Payment } from '../models/Payment';
import { Subscription } from '../models/Subscription';

export const validateUser = (user: Partial<User>): string[] => {
  const errors: string[] = [];

  if (!user.email) {
    errors.push('Email is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) {
    errors.push('Invalid email format');
  }

  if (!user.password) {
    errors.push('Password is required');
  } else if (user.password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }

  if (!user.firstName?.trim()) {
    errors.push('First name is required');
  }

  if (!user.lastName?.trim()) {
    errors.push('Last name is required');
  }

  return errors;
};

export const validatePayment = (payment: Partial<Payment>): string[] => {
  const errors: string[] = [];

  if (!payment.amount || payment.amount <= 0) {
    errors.push('Valid payment amount is required');
  }

  if (!payment.userId) {
    errors.push('User ID is required');
  }

  if (!payment.membershipType) {
    errors.push('Membership type is required');
  }

  return errors;
};

export const validateSubscription = (subscription: Partial<Subscription>): string[] => {
  const errors: string[] = [];

  if (!subscription.userId) {
    errors.push('User ID is required');
  }

  if (!subscription.planType) {
    errors.push('Plan type is required');
  }

  if (!subscription.startDate) {
    errors.push('Start date is required');
  }

  if (!subscription.endDate) {
    errors.push('End date is required');
  }

  // Validate that end date is after start date
  if (subscription.startDate && subscription.endDate) {
    const start = new Date(subscription.startDate);
    const end = new Date(subscription.endDate);
    if (end <= start) {
      errors.push('End date must be after start date');
    }
  }

  return errors;
};

export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>&'"]/g, '');
};

export const isValidDate = (date: string): boolean => {
  const parsedDate = new Date(date);
  return parsedDate.toString() !== 'Invalid Date';
};

/**
 * Enhanced email validation
 */
export const isValidEmail = (email: string): boolean => {
  // RFC 5322 simplified regex for email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!email || !emailRegex.test(email)) {
    return false;
  }

  // Additional checks
  if (email.length > 254) {
    return false; // Email too long
  }

  const [localPart, domain] = email.split('@');
  
  if (localPart.length > 64) {
    return false; // Local part too long
  }

  // Check for consecutive dots
  if (email.includes('..')) {
    return false;
  }

  // Check domain has at least one TLD
  if (!domain.includes('.')) {
    return false;
  }

  return true;
};

/**
 * Normalize email (lowercase and trim)
 */
export const normalizeEmail = (email: string): string => {
  return email.toLowerCase().trim();
};