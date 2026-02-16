import React from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { useSettingsStore } from '../../store/settingsStore';

interface DataPoint {
  date: string;
  income: number;
  outcome: number;
}

interface Props {
  data: DataPoint[];
}

export const CashflowChart: React.FC<Props> = ({ data }) => {
  const { formatCurrency } = useSettingsStore();

  const downloadChart = async () => {
    const element = document.getElementById('cashflow-chart');
    if (element) {
      const canvas = await html2canvas(element);
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF();
      pdf.addImage(imgData, 'PNG', 10, 10, 190, 100);
      pdf.save('cashflow-chart.pdf');
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md" id="cashflow-chart">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Cashflow (Income vs Outcome)</h3>
        <button onClick={downloadChart} className="text-gray-500 hover:text-gray-700">
          <Download size={20} />
        </button>
      </div>
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{
              top: 10,
              right: 30,
              left: 0,
              bottom: 0,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis tickFormatter={(value) => formatCurrency(value)} />
            <Tooltip formatter={(value: number) => formatCurrency(value)} />
            <Legend />
            <Area type="monotone" dataKey="income" stackId="1" stroke="#10B981" fill="#10B981" />
            <Area type="monotone" dataKey="outcome" stackId="2" stroke="#EF4444" fill="#EF4444" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
