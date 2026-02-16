import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Logo from '../components/Logo';
import Login from '../pages/Login';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';

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
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({
    checkUser: vi.fn(),
    signOut: vi.fn(),
    user: null,
    profile: null,
    loading: false,
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Rebranding Validation', () => {
  it('Logo component has correct alt text', () => {
    render(<Logo />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('alt', 'Ternakmart');
  });

  it('Login page displays Ternakmart branding', () => {
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );
    expect(screen.getByText('Ternakmart')).toBeInTheDocument();
    expect(screen.queryByText('ERP Laborasi')).not.toBeInTheDocument();
  });
});
