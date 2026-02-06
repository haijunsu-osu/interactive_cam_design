import React from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { SimulationPoint } from '../types';

interface ChartsProps {
  data: SimulationPoint[];
  currentTheta: number;
}

const ChartContainer = ({ title, dataKey, data, color, unit, currentTheta }: any) => (
  <div className="h-48 bg-slate-900 rounded-lg border border-slate-800 p-2 flex flex-col">
    <div className="text-xs font-bold text-slate-400 mb-1 px-2">{title}</div>
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
          <YAxis tick={{fontSize: 10, fill: '#64748b'}} width={30} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }}
            itemStyle={{ color: color }}
            formatter={(value: number) => [value.toFixed(2), unit]}
            labelFormatter={(label) => `Angle: ${label}°`}
          />
          <ReferenceLine x={currentTheta} stroke="white" strokeDasharray="3 3" />
          <ReferenceLine y={0} stroke="#334155" />
          <Line 
            type="monotone" 
            dataKey={dataKey} 
            stroke={color} 
            strokeWidth={2} 
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </div>
);

const Charts: React.FC<ChartsProps> = ({ data, currentTheta }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <ChartContainer title="Displacement (S)" dataKey="s" data={data} color="#3b82f6" unit="" currentTheta={currentTheta} />
      <ChartContainer title="Velocity (V)" dataKey="v" data={data} color="#10b981" unit="" currentTheta={currentTheta} />
      <ChartContainer title="Acceleration (A)" dataKey="a" data={data} color="#f59e0b" unit="" currentTheta={currentTheta} />
      <ChartContainer title="Jerk (J)" dataKey="j" data={data} color="#ef4444" unit="" currentTheta={currentTheta} />
    </div>
  );
};

export default Charts;