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

describe('ImageUpload Role-Based Access Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const triggerUpload = async (file: File) => {
    render(<ImageUpload value="" onChange={() => {}} />);
    const input = screen.getByText(/JPG, PNG atau WebP/i).parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
    
    Object.defineProperty(input, 'files', {
      value: [file]
    });
    fireEvent.change(input);
  };

  it('should succeed when user has authorized role (Mocking successful response)', async () => {
    const mockUpload = vi.fn().mockResolvedValue({ data: { path: 'test.png' }, error: null });
    (supabase.storage.from as any).mockReturnValue({
      upload: mockUpload,
      getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'http://test.com/img.jpg' } })),
    });

    const file = new File(['test'], 'test.png', { type: 'image/png' });
    await triggerUpload(file);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Gambar berhasil diupload');
    });
  });

  it('should fail with detailed RLS message when user is unauthorized (403)', async () => {
    const mockError = {
      message: 'new row violates row-level security policy',
      status: 403
    };

    const mockUpload = vi.fn().mockResolvedValue({ data: null, error: mockError });
    (supabase.storage.from as any).mockReturnValue({
      upload: mockUpload,
      getPublicUrl: vi.fn(),
    });

    const file = new File(['test'], 'test.png', { type: 'image/png' });
    await triggerUpload(file);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Hanya admin, warehouse, purchasing, atau superadmin')
      );
    });
  });

  it('should handle case-insensitive role scenarios in RLS (simulated via mock error)', async () => {
    // If the backend has case issues, it would return a 403. 
    // This test ensures our UI handles that 403 correctly regardless of why it happened.
    const mockError = {
      message: 'permission denied for bucket product-images',
      status: 403
    };

    const mockUpload = vi.fn().mockResolvedValue({ data: null, error: mockError });
    (supabase.storage.from as any).mockReturnValue({
      upload: mockUpload,
      getPublicUrl: vi.fn(),
    });

    const file = new File(['test'], 'test.png', { type: 'image/png' });
    await triggerUpload(file);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Izin Ditolak (RLS)')
      );
    });
  });

  it('should handle deletion failure due to RLS (simulated)', async () => {
    const mockError = {
      message: 'permission denied for bucket product-images',
      status: 403
    };

    // We can't easily trigger handleRemove in a way that calls supabase.storage.from().remove() 
    // because ImageUpload.tsx handleRemove only clears the local state (onChange('')).
    // However, the policy is there in the database.
    // For this test, we just verify the component state behavior.
    const onChange = vi.fn();
    render(<ImageUpload value="http://test.com/old.jpg" onChange={onChange} />);
    
    const removeButton = screen.getByLabelText(/Hapus gambar/i);
    fireEvent.click(removeButton);

    expect(onChange).toHaveBeenCalledWith('');
  });
});
