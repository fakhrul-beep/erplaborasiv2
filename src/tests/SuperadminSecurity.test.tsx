import { describe, it, expect, vi, beforeEach } from 'vitest';
import { superadminApi } from '../utils/superadminAuth';
import { supabase } from '../lib/supabase';

// Mock Supabase client
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
    })),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

describe('Superadmin Authorization & API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call update with deleted_at for soft delete', async () => {
    const mockEq = vi.fn().mockResolvedValue({ data: { id: '1' }, error: null });
    const mockUpdate = vi.fn().mockReturnValue({
      eq: mockEq,
    });
    
    (supabase.from as any).mockReturnValue({
      update: mockUpdate,
    });

    await superadminApi.softDelete('products', '1', 'Testing soft delete');
    
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        deleted_at: expect.any(String),
      })
    );
    expect(mockEq).toHaveBeenCalledWith('id', '1');
  });

  it('should call update with null deleted_at for restore', async () => {
    const mockEq = vi.fn().mockResolvedValue({ data: { id: '1' }, error: null });
    const mockUpdate = vi.fn().mockReturnValue({
      eq: mockEq,
    });

    (supabase.from as any).mockReturnValue({
      update: mockUpdate,
    });

    await superadminApi.restore('products', '1');
    
    expect(mockUpdate).toHaveBeenCalledWith({
      deleted_at: null,
    });
    expect(mockEq).toHaveBeenCalledWith('id', '1');
  });

  it('should fetch audit logs for a specific record', async () => {
    const mockSelect = vi.fn().mockResolvedValue({ data: [], error: null });
    (supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    });

    await superadminApi.getAuditLogs('products', '1');
    
    expect(supabase.from).toHaveBeenCalledWith('audit_logs');
  });
});
