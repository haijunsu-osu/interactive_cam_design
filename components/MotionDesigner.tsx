import React from 'react';
import { MotionSegment, MotionType } from '../types';
import { Trash2, Plus, AlertCircle, PlayCircle } from 'lucide-react';

interface MotionDesignerProps {
  segments: MotionSegment[];
  onSegmentsChange: (segments: MotionSegment[]) => void;
  onGenerateMotion: () => void;
  isDirty: boolean;
}

const MotionDesigner: React.FC<MotionDesignerProps> = ({ segments, onSegmentsChange, onGenerateMotion, isDirty }) => {
  const addSegment = () => {
    const currentTotalAngle = segments.reduce((sum, s) => sum + s.duration, 0);
    const remainingAngle = Math.max(0, 360 - currentTotalAngle);
    const suggestDuration = remainingAngle > 0 ? Math.min(90, remainingAngle) : 90;
    
    const id = Math.random().toString(36).substr(2, 9);
    
    const newSegment: MotionSegment = {
      id,
      type: MotionType.DWELL,
      duration: suggestDuration,
      deltaLift: 0,
    };
    onSegmentsChange([...segments, newSegment]);
  };

  const updateSegment = (index: number, field: keyof MotionSegment, value: any) => {
    const newSegments = [...segments];
    newSegments[index] = { ...newSegments[index], [field]: value };
    onSegmentsChange(newSegments);
  };

  const removeSegment = (index: number) => {
    const newSegments = [...segments];
    newSegments.splice(index, 1);
    onSegmentsChange(newSegments);
  };

  const totalAngle = segments.reduce((sum, s) => sum + s.duration, 0);
  const isComplete = totalAngle === 360;

  // Calculate cumulative lifts for display
  let runningLift = 0;
  const cumulativeLifts = segments.map(s => {
    runningLift += s.deltaLift;
    return runningLift;
  });

  return (
    <div className="bg-slate-900 p-4 rounded-lg shadow-lg border border-slate-800">
      <style>{`
        input::-webkit-outer-spin-button,
        input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>

      <div className="flex justify-between items-center mb-4 gap-2">
        <h2 className="text-xl font-bold text-slate-100 whitespace-nowrap">Motion Synthesis</h2>
        <button
          onClick={onGenerateMotion}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all shadow-md ${
            isDirty 
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40' 
              : 'bg-slate-800 text-slate-500 cursor-default'
          }`}
        >
          <PlayCircle size={14} />
          Compute SVAJ
        </button>
      </div>
      
      <div className="mb-4 flex justify-end">
        <div className={`text-[10px] px-2 py-0.5 rounded font-mono ${isComplete ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-800/50' : 'bg-amber-900/40 text-amber-400 border border-amber-800/50'}`}>
          Total Cycle: {totalAngle}°
        </div>
      </div>

      <div className="flex items-center gap-2 mb-2 px-1">
        <div className="w-6"></div>
        <div className="flex-[1.5] text-[10px] font-bold text-slate-500 uppercase tracking-wider">Function</div>
        <div className="flex-[1] text-[10px] font-bold text-slate-500 uppercase tracking-wider">Duration</div>
        <div className="flex-[1.2] text-[10px] font-bold text-slate-500 uppercase tracking-wider">Lift (Δ)</div>
        <div className="w-8"></div>
      </div>

      <div className="space-y-2">
        {segments.map((seg, idx) => {
          return (
            <div key={seg.id} className="flex flex-col gap-1">
              <div className="flex items-center gap-2 bg-slate-800/50 p-2 rounded border border-slate-700/50 hover:border-slate-600 transition-colors group">
                <div className="w-6 text-[10px] font-mono text-slate-600 flex justify-center">
                  {idx + 1}
                </div>
                
                <div className="flex-[1.5] min-w-0">
                  <select 
                    value={seg.type}
                    onChange={(e) => updateSegment(idx, 'type', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition-colors appearance-none cursor-pointer"
                  >
                    {Object.values(MotionType).map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div className="flex-[1]">
                  <input 
                    type="number" 
                    value={seg.duration}
                    onChange={(e) => updateSegment(idx, 'duration', Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all text-center font-mono"
                  />
                </div>

                <div className="flex-[1.2]">
                  <input 
                    type="number" 
                    value={seg.deltaLift}
                    onChange={(e) => updateSegment(idx, 'deltaLift', Number(e.target.value))}
                    placeholder="+ / -"
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all text-center font-mono"
                  />
                </div>

                <button 
                  onClick={() => removeSegment(idx)}
                  className="w-8 h-8 flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-400/10 rounded transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="px-10 flex justify-between">
                 <span className="text-[9px] text-slate-600 uppercase font-bold tracking-tight">Pos: {cumulativeLifts[idx].toFixed(1)} mm</span>
              </div>
            </div>
          );
        })}
      </div>

      <button 
        onClick={addSegment}
        className="mt-4 w-full flex items-center justify-center gap-2 py-2 border border-dashed border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300 hover:bg-slate-800/30 rounded transition-all text-xs font-bold uppercase tracking-widest"
      >
        <Plus size={14} /> Add Segment
      </button>
      
      {!isComplete && (
        <div className="mt-4 p-2.5 bg-amber-900/10 border border-amber-900/30 rounded flex gap-2.5 items-start text-amber-200/70 text-[10px] leading-tight">
          <AlertCircle size={14} className="shrink-0 text-amber-600" />
          <p>Motion incomplete ({totalAngle}°/360°).</p>
        </div>
      )}
    </div>
  );
};

export default MotionDesigner;