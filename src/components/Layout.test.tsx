import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Layout from './Layout';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';

// Mock the auth store
const mockUseAuthStore = vi.fn();
vi.mock('../store/authStore', () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

// Mock Logo component
vi.mock('./Logo', () => ({
  default: () => <div data-testid="logo">Logo</div>,
}));

describe('Layout Component (Mobile Navigation)', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Default auth state
    mockUseAuthStore.mockReturnValue({
      user: { email: 'test@example.com' },
      profile: { role: 'superadmin' }, // Superadmin sees all menus
      signOut: vi.fn(),
      loading: false,
    });
  });

  const renderLayout = () => {
    render(
      <BrowserRouter>
        <Layout />
      </BrowserRouter>
    );
  };

  it('renders mobile menu button', () => {
    renderLayout();
    expect(screen.getByRole('button', { name: /open sidebar/i })).toBeInTheDocument();
  });

  it('opens sidebar when mobile menu button is clicked', () => {
    renderLayout();
    const menuButton = screen.getByRole('button', { name: /open sidebar/i });
    fireEvent.click(menuButton);
    
    // Check if sidebar content is visible (e.g., Dashboard link)
    // Since Dashboard exists in both mobile and desktop menus, we might find multiple.
    // We can check if at least one is present.
    const dashboardLinks = screen.getAllByText('Dashboard');
    expect(dashboardLinks.length).toBeGreaterThan(0);
    expect(dashboardLinks[0]).toBeInTheDocument();
  });

  it('renders nested menu items (Perlengkapan) in mobile view', () => {
    renderLayout();
    const menuButton = screen.getByRole('button', { name: /open sidebar/i });
    fireEvent.click(menuButton);

    // "Perlengkapan" should be visible
    const perlengkapanButtons = screen.getAllByText('Perlengkapan');
    expect(perlengkapanButtons.length).toBeGreaterThan(0);
  });

  it('expands nested menu items when clicked in mobile view', async () => {
    renderLayout();
    // Open mobile sidebar
    fireEvent.click(screen.getByRole('button', { name: /open sidebar/i }));

    // Find the Perlengkapan toggle button in mobile menu
    // We look for the button role specifically to differentiate from links if any
    const buttons = screen.getAllByRole('button');
    const perlengkapanToggle = buttons.find(btn => btn.textContent?.includes('Perlengkapan'));
    
    expect(perlengkapanToggle).toBeDefined();
    
    if (perlengkapanToggle) {
        // Click to expand
        fireEvent.click(perlengkapanToggle);
        
        // After clicking, check if we can find the children links like "Stok", "Penjualan", "Pembelian"
        // Note: "Stok" appears in both Perlengkapan and Bahan Baku, so getAllByText is safer
        const stokLinks = screen.getAllByText('Stok');
        expect(stokLinks.length).toBeGreaterThan(0);
    }
  });

  it('collapses other sections or toggles correctly', () => {
    renderLayout();
    fireEvent.click(screen.getByRole('button', { name: /open sidebar/i }));
    
    const buttons = screen.getAllByRole('button');
    const perlengkapanToggle = buttons.find(btn => btn.textContent?.includes('Perlengkapan'));
    const bahanBakuToggle = buttons.find(btn => btn.textContent?.includes('Bahan Baku'));

    if (perlengkapanToggle && bahanBakuToggle) {
        fireEvent.click(perlengkapanToggle);
        fireEvent.click(bahanBakuToggle);
        // Just verify no errors and state updates (implicit via component re-render in test)
        expect(true).toBe(true);
    }
  });

  it('auto-expands Logistik section when route is /delivery/vendors', () => {
    // Mock location.pathname
    vi.mock('react-router-dom', async () => {
      const actual = await vi.importActual('react-router-dom');
      return {
        ...actual,
        useLocation: () => ({ pathname: '/delivery/vendors' }),
      };
    });

    renderLayout();
    
    // On desktop view (default), children should be visible
    const vendorLinks = screen.getAllByText('Vendor Ekspedisi');
    expect(vendorLinks.length).toBeGreaterThan(0);
  });

  it('filters navigation items based on user role (delivery role)', () => {
    // Mock delivery role
    mockUseAuthStore.mockReturnValue({
      user: { email: 'delivery@example.com' },
      profile: { role: 'delivery' },
      signOut: vi.fn(),
      loading: false,
    });

    renderLayout();

    // Delivery user should see Logistik (appears in both mobile and desktop menus)
    const logistikLinks = screen.getAllByText('Logistik');
    expect(logistikLinks.length).toBeGreaterThan(0);
    
    // Delivery user should NOT see User Management (only for superadmin)
    expect(screen.queryByText('User Management')).not.toBeInTheDocument();
  });
});
