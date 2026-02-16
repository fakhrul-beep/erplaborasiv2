import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ImageUpload from './ImageUpload';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

// Mock Supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        getPublicUrl: vi.fn(),
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

describe('ImageUpload Component', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render correctly with initial value', () => {
    render(<ImageUpload value="http://example.com/image.jpg" onChange={mockOnChange} />);
    const img = screen.getByAltText('Preview');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'http://example.com/image.jpg');
  });

  it('should show placeholder when no value is provided', () => {
    render(<ImageUpload value="" onChange={mockOnChange} />);
    expect(screen.getByText('No Image')).toBeInTheDocument();
  });

  it('should validate file type', async () => {
    const { container } = render(<ImageUpload value="" onChange={mockOnChange} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    
    const invalidFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [invalidFile] } });

    expect(toast.error).toHaveBeenCalledWith('Format gambar tidak didukung. Gunakan JPG, PNG, atau WebP.');
  });

  it('should validate file size', async () => {
    const { container } = render(<ImageUpload value="" onChange={mockOnChange} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    
    // 6MB file
    const largeFile = new File(['a'.repeat(6 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [largeFile] } });

    expect(toast.error).toHaveBeenCalledWith('Ukuran gambar maksimal 5MB.');
  });

  it('should handle "Bucket not found" error', async () => {
    const mockUpload = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'bucket not found', status: 404 }
    });

    vi.mocked(supabase.storage.from).mockReturnValue({
      upload: mockUpload,
      getPublicUrl: vi.fn(),
    } as any);

    const { container } = render(<ImageUpload value="" onChange={mockOnChange} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('tidak ditemukan. Pastikan bucket telah dibuat'));
    });
  });

  it('should handle successful upload', async () => {
    const mockUpload = vi.fn().mockResolvedValue({
      data: { path: 'products/test.jpg' },
      error: null
    });
    const mockGetPublicUrl = vi.fn().mockReturnValue({
      data: { publicUrl: 'http://supabase.com/test.jpg' }
    });

    vi.mocked(supabase.storage.from).mockReturnValue({
      upload: mockUpload,
      getPublicUrl: mockGetPublicUrl,
    } as any);

    const { container } = render(<ImageUpload value="" onChange={mockOnChange} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith('http://supabase.com/test.jpg');
      expect(toast.success).toHaveBeenCalledWith('Gambar berhasil diupload');
    });
  });

  it('should call onChange with empty string when removed', () => {
    render(<ImageUpload value="http://example.com/image.jpg" onChange={mockOnChange} />);
    const removeBtn = screen.getByLabelText('Hapus gambar');
    fireEvent.click(removeBtn);
    expect(mockOnChange).toHaveBeenCalledWith('');
  });
});
