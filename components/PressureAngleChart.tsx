import React from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { SimulationPoint } from '../types';

interface PressureAngleChartProps {
  data: SimulationPoint[];
  currentTheta: number;
}

const PressureAngleChart: React.FC<PressureAngleChartProps> = ({ data, currentTheta }) => {
  // Find max pressure angle for display
  const maxPA = data.reduce((max, p) => Math.max(max, Math.abs(p.pressureAngle)), 0);

  return (
    <div className="h-48 bg-slate-900 rounded-lg border border-slate-800 p-2 flex flex-col shadow-lg mt-4">
      <div className="flex justify-between items-center mb-1 px-2">
         <div className="text-xs font-bold text-slate-400">Pressure Angle</div>
         <div className="text-[10px] flex gap-2">
            <span className="text-slate-500">Max: {maxPA.toFixed(1)}°</span>
            <span className="text-red-400">Limit: ±30°</span>
         </div>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis 
              dataKey="theta" 
              type="number" 
              domain={[0, 360]} 
              tick={{fontSize: 10, fill: '#64748b'}}
              ticks={[0, 90, 180, 270, 360]}
            />
            <YAxis tick={{fontSize: 10, fill: '#64748b'}} width={30} domain={[-40, 40]} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }}
              itemStyle={{ color: '#ec4899' }}
              formatter={(value: number) => [value.toFixed(1), '°']}
              labelFormatter={(label) => `Angle: ${label}°`}
            />
            <ReferenceLine x={currentTheta} stroke="white" strokeDasharray="3 3" />
            <ReferenceLine y={30} stroke="#ef4444" strokeDasharray="3 3" />
            <ReferenceLine y={-30} stroke="#ef4444" strokeDasharray="3 3" />
            <Line 
              type="monotone" 
              dataKey="pressureAngle" 
              stroke="#ec4899" 
              strokeWidth={2} 
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default PressureAngleChart;