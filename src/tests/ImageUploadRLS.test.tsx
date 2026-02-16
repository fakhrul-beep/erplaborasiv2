import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ImageUpload from '../components/Inventory/ImageUpload';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

// Mock Supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'http://test.com/img.jpg' } })),
      })),
    },
  },
}));

// Mock toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ImageUpload RLS Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show specific RLS error message when upload fails with RLS violation', async () => {
    const mockError = {
      message: 'new row violates row-level security policy',
      status: 403
    };

    const mockUpload = vi.fn().mockResolvedValue({ data: null, error: mockError });
    (supabase.storage.from as any).mockReturnValue({
      upload: mockUpload,
      getPublicUrl: vi.fn(),
    });

    render(<ImageUpload value="" onChange={() => {}} />);

    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const input = screen.getByText(/JPG, PNG atau WebP/i).parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
    
    // We need to trigger the file selection
    Object.defineProperty(input, 'files', {
      value: [file]
    });
    fireEvent.change(input);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Hanya admin, warehouse, purchasing, atau superadmin')
      );
    });
  });
});
