
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { StockOpnameSession, StockOpnameItem } from '../../types';
import { ArrowLeft, Save, CheckCircle, AlertTriangle, Download, Upload, Search, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { useAuthStore } from '../../store/authStore';

interface Props {
  type: 'equipment' | 'raw_material';
}

export default function StockOpnameDetail({ type }: Props) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const [session, setSession] = useState<StockOpnameSession | null>(null);
  const [items, setItems] = useState<StockOpnameItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDifference, setFilterDifference] = useState<'all' | 'diff' | 'match'>('all');
  
  // Stats
  const [stats, setStats] = useState({
    totalItems: 0,
    countedItems: 0,
    matchedItems: 0,
    discrepancyItems: 0,
    totalValueDiff: 0
  });

  useEffect(() => {
    if (id) fetchSessionData();
  }, [id]);

  useEffect(() => {
    calculateStats();
  }, [items]);

  const fetchSessionData = async () => {
    try {
      setLoading(true);
      // Fetch Session
      const { data: sessionData, error: sessionError } = await supabase
        .from('stock_opname_sessions')
        .select('*')
        .eq('id', id)
        .single();
      
      if (sessionError) throw sessionError;
      setSession(sessionData);

      // Fetch Items
      const { data: itemsData, error: itemsError } = await supabase
        .from('stock_opname_items')
        .select('*')
        .eq('session_id', id);
      
      if (itemsError) throw itemsError;

      let finalItems = itemsData || [];

      if (finalItems.length > 0) {
        const productIds = finalItems.map((i: any) => i.product_id);
        const { data: productsData } = await supabase
          .from('products')
          .select('*')
          .in('id', productIds);
        
        const productsMap = new Map((productsData || []).map((p: any) => [p.id, p]));

        finalItems = finalItems.map((item: any) => ({
          ...item,
          product: productsMap.get(item.product_id)
        }));

        // Sort by product name
        finalItems.sort((a: any, b: any) => {
          const nameA = a.product?.name || '';
          const nameB = b.product?.name || '';
          return nameA.localeCompare(nameB);
        });
      }

      setItems(finalItems);

    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load session data');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = () => {
    const total = items.length;
    const counted = items.filter(i => i.physical_stock !== null).length;
    const diff = items.filter(i => i.physical_stock !== null && i.physical_stock !== i.system_stock).length;
    const match = counted - diff;
    
    setStats({
      totalItems: total,
      countedItems: counted,
      matchedItems: match,
      discrepancyItems: diff,
      totalValueDiff: 0 // Ideally calc value based on product cost
    });
  };

  const handleStockChange = (itemId: string, val: string) => {
    const numVal = val === '' ? null : parseFloat(val);
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          physical_stock: numVal === null ? undefined : numVal, // Handle types
        } as StockOpnameItem; // Cast to avoid undefined/null issues
      }
      return item;
    }));
  };

  const handleNotesChange = (itemId: string, val: string) => {
    setItems(prev => prev.map(item => item.id === itemId ? { ...item, notes: val } : item));
  };

  const saveProgress = async () => {
    setSaving(true);
    try {
      // Bulk upsert is efficient
      const updates = items.map(item => ({
        id: item.id,
        session_id: session?.id,
        product_id: item.product_id,
        physical_stock: item.physical_stock,
        notes: item.notes,
        condition: item.condition
      }));

      const { error } = await supabase
        .from('stock_opname_items')
        .upsert(updates);

      if (error) throw error;
      toast.success('Progress saved');
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Failed to save progress');
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async () => {
    if (!window.confirm('Are you sure you want to finalize this session? This will update the inventory stocks.')) return;
    
    setSaving(true);
    try {
      // 1. Save current items state first
      await saveProgress();

      // 2. Update Inventory Movements & Products
      // This logic ideally resides in a backend function for transaction safety.
      // But for this implementation, we will iterate and update.
      
      // Filter items with difference
      const diffItems = items.filter(i => i.physical_stock !== null && i.physical_stock !== i.system_stock);
      
      for (const item of diffItems) {
        const diff = (item.physical_stock || 0) - item.system_stock;
        
        // Add movement log
        const { error: moveError } = await supabase.from('inventory_movements').insert({
          product_id: item.product_id,
          warehouse_id: session?.warehouse_id, // Added warehouse_id
          movement_type: 'adjustment',
          quantity: diff,
          balance_after: item.physical_stock,
          reference_type: 'stock_opname',
          reference_id: session?.id,
          user_id: user?.id,
          notes: `Stock Opname Adjustment: ${item.notes || ''}`
        });

        if (moveError) throw moveError;

        // Update product stock
        const { error: prodError } = await supabase.from('products')
            .update({ stock_quantity: item.physical_stock })
            .eq('id', item.product_id);
        
        if (prodError) throw prodError;
      }

      // 3. Update Session Status
      await supabase
        .from('stock_opname_sessions')
        .update({ status: 'finalized' })
        .eq('id', id);

      toast.success('Session finalized and inventory updated');
      setSession(prev => prev ? { ...prev, status: 'finalized' } : null);

    } catch (error: any) {
      console.error('Finalize error:', error);
      toast.error('Failed to finalize: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleExportTemplate = () => {
    const data = items.map(item => ({
      'Item Code': item.product?.sku || item.id,
      'Item Name': item.product?.name,
      'System Stock': item.system_stock,
      'Physical Stock': '', // Empty for user to fill
      'Notes': ''
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "StockOpname");
    XLSX.writeFile(wb, `StockOpname_Template_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);

      // Map imported data back to items
      // Assuming matching by Item Code (SKU) or Name
      const newItems = [...items];
      let matchCount = 0;

      data.forEach((row: any) => {
        const sku = row['Item Code'];
        const physical = row['Physical Stock'];
        const notes = row['Notes'];
        
        if (sku && physical !== undefined) {
          const idx = newItems.findIndex(i => i.product?.sku === sku || i.id === sku);
          if (idx >= 0) {
             newItems[idx] = {
               ...newItems[idx],
               physical_stock: parseFloat(physical),
               notes: notes || newItems[idx].notes
             };
             matchCount++;
          }
        }
      });

      setItems(newItems);
      toast.success(`Imported ${matchCount} items successfully`);
    };
    reader.readAsBinaryString(file);
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = (item.product?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (item.product?.sku || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterDifference === 'all') return matchesSearch;
    if (filterDifference === 'diff') return matchesSearch && (item.physical_stock !== null && item.physical_stock !== item.system_stock);
    if (filterDifference === 'match') return matchesSearch && (item.physical_stock === item.system_stock);
    return matchesSearch;
  });

  if (!session) return <div>Loading...</div>;

  const isFinalized = session.status === 'finalized';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700" aria-label="Back">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {type === 'equipment' ? 'Equipment' : 'Raw Material'} Stock Opname
            </h1>
            <p className="text-sm text-gray-500">
              {format(new Date(session.scheduled_date), 'PPP')} • <span className="capitalize">{session.status.replace('_', ' ')}</span>
            </p>
          </div>
        </div>
        
        <div className="flex space-x-2">
           {!isFinalized && (
             <>
               <button onClick={handleExportTemplate} className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                 <Download className="h-4 w-4 mr-2" /> Template
               </button>
               <label className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
                 <Upload className="h-4 w-4 mr-2" /> Import
                 <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
               </label>
               <button 
                 onClick={saveProgress}
                 disabled={saving}
                 className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-hover disabled:opacity-50"
               >
                 <Save className="h-4 w-4 mr-2" /> Save Draft
               </button>
               <button 
                 onClick={handleFinalize}
                 disabled={saving}
                 className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
               >
                 <CheckCircle className="h-4 w-4 mr-2" /> Finalize
               </button>
             </>
           )}
           {isFinalized && (
             <div className="px-4 py-2 bg-green-100 text-green-800 rounded-md font-medium flex items-center">
               <CheckCircle className="h-5 w-5 mr-2" /> Completed
             </div>
           )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-4">
        <div className="bg-white overflow-hidden shadow rounded-lg p-5">
          <dl>
            <dt className="text-sm font-medium text-gray-500 truncate">Total Items</dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">{stats.totalItems}</dd>
          </dl>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg p-5">
          <dl>
            <dt className="text-sm font-medium text-gray-500 truncate">Counted</dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">{stats.countedItems} <span className="text-sm text-gray-500 font-normal">({Math.round(stats.countedItems/stats.totalItems*100 || 0)}%)</span></dd>
          </dl>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg p-5">
          <dl>
            <dt className="text-sm font-medium text-gray-500 truncate">Matched</dt>
            <dd className="mt-1 text-3xl font-semibold text-green-600">{stats.matchedItems}</dd>
          </dl>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg p-5 border-l-4 border-red-500">
          <dl>
            <dt className="text-sm font-medium text-gray-500 truncate">Discrepancies</dt>
            <dd className="mt-1 text-3xl font-semibold text-red-600">{stats.discrepancyItems}</dd>
          </dl>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between gap-4">
           <div className="relative rounded-md shadow-sm max-w-xs w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              aria-label="Search items"
              className="focus:ring-accent focus:border-accent block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2"
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex space-x-2">
             <button 
               onClick={() => setFilterDifference('all')}
               className={`px-3 py-2 rounded-md text-sm font-medium ${filterDifference === 'all' ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
             >
               All
             </button>
             <button 
               onClick={() => setFilterDifference('diff')}
               className={`px-3 py-2 rounded-md text-sm font-medium ${filterDifference === 'diff' ? 'bg-red-100 text-red-800' : 'text-gray-600 hover:bg-gray-50'}`}
             >
               Discrepancies Only
             </button>
             <button 
               onClick={() => setFilterDifference('match')}
               className={`px-3 py-2 rounded-md text-sm font-medium ${filterDifference === 'match' ? 'bg-green-100 text-green-800' : 'text-gray-600 hover:bg-gray-50'}`}
             >
               Matched Only
             </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">System Stock</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Physical Stock</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Difference</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredItems.map((item) => {
                const diff = (item.physical_stock || 0) - item.system_stock;
                const hasDiff = item.physical_stock !== null && diff !== 0;
                
                return (
                  <tr key={item.id} className={hasDiff ? 'bg-red-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{item.product?.name}</div>
                      <div className="text-xs text-gray-500">{item.product?.sku}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                      {item.system_stock}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <input
                        type="number"
                        aria-label="Physical Stock"
                        disabled={isFinalized}
                        value={item.physical_stock === undefined || item.physical_stock === null ? '' : item.physical_stock}
                        onChange={(e) => handleStockChange(item.id, e.target.value)}
                        className={`w-24 text-right border-gray-300 rounded-md shadow-sm focus:ring-accent focus:border-accent sm:text-sm ${
                          hasDiff ? 'border-red-300 text-red-900 focus:ring-red-500 focus:border-red-500' : ''
                        }`}
                        placeholder="0"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {item.physical_stock !== null && (
                         <span className={diff < 0 ? 'text-red-600' : diff > 0 ? 'text-green-600' : 'text-gray-400'}>
                           {diff > 0 ? '+' : ''}{diff}
                         </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <input
                        type="text"
                        aria-label="Notes"
                        disabled={isFinalized}
                        value={item.notes || ''}
                        onChange={(e) => handleNotesChange(item.id, e.target.value)}
                        className="w-full border-gray-300 rounded-md shadow-sm focus:ring-accent focus:border-accent sm:text-sm"
                        placeholder="Condition, reason..."
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
