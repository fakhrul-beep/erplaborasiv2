import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { useSettingsStore } from '../../store/settingsStore';

interface DataPoint {
  category: string;
  sales_amount: number;
  purchase_amount: number;
}

interface Props {
  data: DataPoint[];
}

export const SalesVsPurchasesChart: React.FC<Props> = ({ data }) => {
  const { formatCurrency } = useSettingsStore();

  const downloadChart = async () => {
    const element = document.getElementById('sales-vs-purchases-chart');
    if (element) {
      const canvas = await html2canvas(element);
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF();
      pdf.addImage(imgData, 'PNG', 10, 10, 190, 100);
      pdf.save('sales-vs-purchases.pdf');
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md" id="sales-vs-purchases-chart">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Transaction per Category</h3>
        <button onClick={downloadChart} className="text-gray-500 hover:text-gray-700">
          <Download size={20} />
        </button>
      </div>
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="category" />
            <YAxis tickFormatter={(value) => formatCurrency(value)} />
            <Tooltip formatter={(value: number) => formatCurrency(value)} />
            <Legend />
            <Bar dataKey="sales_amount" name="Sales" fill="#4F46E5" radius={[4, 4, 0, 0]} />
            <Bar dataKey="purchase_amount" name="Purchases" fill="#EF4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
