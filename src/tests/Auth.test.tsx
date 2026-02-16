
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Login from '../pages/Login';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { BrowserRouter } from 'react-router-dom';

// Mock dependencies
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      getUser: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
    })),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../store/authStore', () => ({
  useAuthStore: vi.fn(() => ({
    checkUser: vi.fn(),
  })),
}));

// Mock Logo component since it might import image assets
vi.mock('../components/Logo', () => ({
  default: () => <div data-testid="logo">Logo</div>,
}));

describe('Login Component Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display correct error message for invalid credentials during login', async () => {
    // Mock signInWithPassword to return an error typical of invalid credentials
    (supabase.auth.signInWithPassword as any).mockResolvedValue({
      data: { user: null, session: null },
      error: {
        message: 'Invalid login credentials',
        status: 400,
      },
    });

    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    // Fill in the form
    fireEvent.change(screen.getByLabelText(/Email address/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: 'wrongpassword' },
    });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /Sign in/i }));

    // Wait for the error handling
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
    
    // Check the error message
    const errorMessage = (toast.error as any).mock.calls[0][0];
    
    expect(errorMessage).not.toContain('Email is already registered');
    expect(errorMessage).toContain('Invalid login credentials');
  });

  it('should display "Email already registered" message during registration if applicable', async () => {
    // Mock signUp to return "User already registered" error
    (supabase.auth.signUp as any).mockResolvedValue({
      data: { user: null, session: null },
      error: {
        message: 'User already registered',
        status: 400,
      },
    });

    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    // Switch to Sign Up mode
    fireEvent.click(screen.getByRole('button', { name: /Create an account/i }));

    // Fill in the form
    fireEvent.change(screen.getByLabelText(/Full Name/i), {
      target: { value: 'Test User' },
    });
    fireEvent.change(screen.getByLabelText(/Email address/i), {
      target: { value: 'existing@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: 'password123' },
    });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /Sign up/i }));

    // Wait for the error handling
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });

    // Check the error message
    const errorMessage = (toast.error as any).mock.calls[0][0];
    expect(errorMessage).toContain('Email is already registered');
  });
});
