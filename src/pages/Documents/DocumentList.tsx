import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Order, PurchaseOrder } from '../../types';
import { Download, Search, Filter, FileText, Calendar, ArrowUp, ArrowDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { generateInvoicePDF, generatePurchaseOrderPDF } from '../../utils/pdfGenerator';
import { useSettingsStore } from '../../store/settingsStore';

type DocumentType = 'invoice' | 'po';

interface DocumentItem {
  id: string;
  type: DocumentType;
  number: string;
  date: string;
  entityName: string; // Customer or Supplier
  amount: number;
  status: string;
  originalData: Order | PurchaseOrder;
}

export default function DocumentList() {
  const { formatCurrency } = useSettingsStore();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'invoice' | 'po'>('all');
  
  // Sorting
  const [sortColumn, setSortColumn] = useState<keyof DocumentItem>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      
      // Fetch Orders (Invoices)
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('*, customers(*), order_items(*, products(*))')
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      // Fetch Purchase Orders (POs)
      const { data: pos, error: posError } = await supabase
        .from('purchase_orders')
        .select('*, suppliers(*), purchase_order_items(*, products(*))')
        .order('created_at', { ascending: false });

      if (posError) throw posError;

      // Transform to common format
      const invoiceDocs: DocumentItem[] = (orders || []).map((o: any) => ({
        id: o.id,
        type: 'invoice',
        number: `INV-${o.id.slice(0, 8).toUpperCase()}`,
        date: o.order_date || o.created_at,
        entityName: o.customers?.name || 'Unknown Customer',
        amount: o.total_amount,
        status: o.payment_status,
        originalData: { ...o, customer: o.customers, items: o.order_items.map((i:any) => ({...i, product: i.products})) } as Order
      }));

      const poDocs: DocumentItem[] = (pos || []).map((p: any) => ({
        id: p.id,
        type: 'po',
        number: `PO-${p.id.slice(0, 8).toUpperCase()}`,
        date: p.order_date || p.created_at,
        entityName: p.suppliers?.name || 'Unknown Supplier',
        amount: p.total_amount,
        status: p.status,
        originalData: { ...p, supplier: p.suppliers, items: p.purchase_order_items.map((i:any) => ({...i, product: i.products})) } as PurchaseOrder
      }));

      setDocuments([...invoiceDocs, ...poDocs]);
    } catch (error: any) {
      console.error('Error fetching documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (doc: DocumentItem) => {
    try {
      if (doc.type === 'invoice') {
        await generateInvoicePDF(doc.originalData as Order);
      } else {
        await generatePurchaseOrderPDF(doc.originalData as PurchaseOrder);
      }

      // Audit Log
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
          await supabase.from('audit_logs').insert({
              user_id: user.id,
              action: `download_${doc.type}`,
              entity: doc.type === 'invoice' ? 'order' : 'purchase_order',
              entity_id: doc.id,
              details: { document_number: doc.number }
          });
      }
      toast.success(`${doc.type === 'invoice' ? 'Invoice' : 'PO'} downloaded`);
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to generate document');
    }
  };

  const handleSort = (column: keyof DocumentItem) => {
    if (sortColumn === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortOrder('asc');
    }
  };

  const filteredDocs = documents
    .filter(doc => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        doc.number.toLowerCase().includes(searchLower) ||
        doc.entityName.toLowerCase().includes(searchLower);
      
      const matchesType = typeFilter === 'all' || doc.type === typeFilter;
      
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      const valA = a[sortColumn];
      const valB = b[sortColumn];
      
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

  const SortIcon = ({ column }: { column: keyof DocumentItem }) => {
    if (sortColumn !== column) return <div className="w-4 h-4" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Document Center</h1>
      </div>

      <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6 justify-between">
          <div className="relative rounded-md shadow-sm flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="focus:ring-accent focus:border-accent block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2"
              placeholder="Search by number or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex items-center space-x-2">
             <Filter className="h-5 w-5 text-gray-400" />
             <select
               value={typeFilter}
               onChange={(e) => setTypeFilter(e.target.value as any)}
               className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-accent focus:border-accent sm:text-sm rounded-md"
             >
               <option value="all">All Documents</option>
               <option value="invoice">Invoices</option>
               <option value="po">Purchase Orders</option>
             </select>
          </div>
        </div>

        {/* Table */}
        <div className="flex flex-col">
          <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
              <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th 
                        scope="col" 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('date')}
                      >
                        <div className="flex items-center">Date <SortIcon column="date" /></div>
                      </th>
                      <th 
                        scope="col" 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('number')}
                      >
                        <div className="flex items-center">Number <SortIcon column="number" /></div>
                      </th>
                      <th 
                        scope="col" 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('type')}
                      >
                        <div className="flex items-center">Type <SortIcon column="type" /></div>
                      </th>
                      <th 
                        scope="col" 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('entityName')}
                      >
                        <div className="flex items-center">Entity <SortIcon column="entityName" /></div>
                      </th>
                      <th 
                        scope="col" 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('amount')}
                      >
                        <div className="flex items-center">Amount <SortIcon column="amount" /></div>
                      </th>
                      <th scope="col" className="relative px-6 py-3">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loading ? (
                      <tr><td colSpan={6} className="px-6 py-4 text-center text-gray-500">Loading documents...</td></tr>
                    ) : filteredDocs.length === 0 ? (
                      <tr><td colSpan={6} className="px-6 py-4 text-center text-gray-500">No documents found.</td></tr>
                    ) : (
                      filteredDocs.map((doc) => (
                        <tr key={`${doc.type}-${doc.id}`} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {format(new Date(doc.date), 'MMM d, yyyy')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary">
                            {doc.number}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              doc.type === 'invoice' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                            }`}>
                              {doc.type.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {doc.entityName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(doc.amount)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => handleDownload(doc)}
                              className="text-gray-600 hover:text-gray-900 flex items-center justify-end w-full"
                            >
                              <Download className="h-4 w-4 mr-1" /> Download
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
