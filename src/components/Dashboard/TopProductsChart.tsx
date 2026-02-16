import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { useSettingsStore } from '../../store/settingsStore';

interface DataPoint {
  product_name: string;
  quantity_sold: number;
  revenue: number;
}

interface Props {
  data: DataPoint[];
}

export const TopProductsChart: React.FC<Props> = ({ data }) => {
  const { formatCurrency } = useSettingsStore();

  const downloadChart = async () => {
    const element = document.getElementById('top-products-chart');
    if (element) {
      const canvas = await html2canvas(element);
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF();
      pdf.addImage(imgData, 'PNG', 10, 10, 190, 100);
      pdf.save('top-products.pdf');
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md" id="top-products-chart">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Top 10 Best Selling Products</h3>
        <button onClick={downloadChart} className="text-gray-500 hover:text-gray-700">
          <Download size={20} />
        </button>
      </div>
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={data}
            margin={{
              top: 5,
              right: 30,
              left: 40,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tickFormatter={(value) => formatCurrency(value)} />
            <YAxis dataKey="product_name" type="category" width={100} />
            <Tooltip formatter={(value: number) => formatCurrency(value)} />
            <Bar dataKey="revenue" fill="#F59E0B" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
