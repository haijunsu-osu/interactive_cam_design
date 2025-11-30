import React from 'react';
import { MotionSegment, MotionType } from '../types';
import { Trash2, Plus, AlertCircle } from 'lucide-react';

interface MotionDesignerProps {
  segments: MotionSegment[];
  onSegmentsChange: (segments: MotionSegment[]) => void;
}

const MotionDesigner: React.FC<MotionDesignerProps> = ({ segments, onSegmentsChange }) => {
  const addSegment = () => {
    const lastSeg = segments[segments.length - 1];
    const newStartAngle = lastSeg ? lastSeg.endAngle : 0;
    
    // Suggest next segment to complete 360 or add 90
    let nextAngle = Math.min(360, newStartAngle + 90);
    
    // Simple ID gen
    const id = Math.random().toString(36).substr(2, 9);
    
    const newSegment: MotionSegment = {
      id,
      type: MotionType.DWELL,
      endAngle: nextAngle,
      endLift: lastSeg ? lastSeg.endLift : 0,
    };
    onSegmentsChange([...segments, newSegment]);
  };

  const updateSegment = (index: number, field: keyof MotionSegment, value: any) => {
    const newSegments = [...segments];
    newSegments[index] = { ...newSegments[index], [field]: value };
    
    // Auto-correct subsequent angles if needed (optional, or just validation)
    // For now let's just update
    onSegmentsChange(newSegments);
  };

  const removeSegment = (index: number) => {
    const newSegments = [...segments];
    newSegments.splice(index, 1);
    onSegmentsChange(newSegments);
  };

  const totalAngle = segments.length > 0 ? segments[segments.length - 1].endAngle : 0;
  const isComplete = totalAngle === 360;

  return (
    <div className="bg-slate-900 p-4 rounded-lg shadow-lg border border-slate-800">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-slate-100">Motion Synthesis</h2>
        <div className={`text-sm px-2 py-1 rounded ${isComplete ? 'bg-emerald-900 text-emerald-300' : 'bg-amber-900 text-amber-300'}`}>
          Total: {totalAngle}°
        </div>
      </div>

      <div className="space-y-3">
        {segments.map((seg, idx) => {
          const prevEndAngle = idx > 0 ? segments[idx-1].endAngle : 0;
          const duration = seg.endAngle - prevEndAngle;
          
          return (
            <div key={seg.id} className="bg-slate-800 p-3 rounded border border-slate-700 relative group">
              <div className="grid grid-cols-12 gap-2 items-center text-sm">
                <div className="col-span-1 text-slate-400 font-mono text-center">{idx + 1}</div>
                
                {/* Motion Type */}
                <div className="col-span-4">
                   <select 
                    value={seg.type}
                    onChange={(e) => updateSegment(idx, 'type', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    {Object.values(MotionType).map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* Duration/Angle */}
                <div className="col-span-3 flex items-center gap-1">
                   <label className="text-xs text-slate-500">End°</label>
                   <input 
                    type="number" 
                    value={seg.endAngle}
                    onChange={(e) => updateSegment(idx, 'endAngle', Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200"
                  />
                </div>

                {/* Lift */}
                <div className="col-span-3 flex items-center gap-1">
                   <label className="text-xs text-slate-500">Lift</label>
                   <input 
                    type="number" 
                    value={seg.endLift}
                    onChange={(e) => updateSegment(idx, 'endLift', Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200"
                  />
                </div>
                
                {/* Actions */}
                <div className="col-span-1 flex justify-end">
                   <button 
                    onClick={() => removeSegment(idx)}
                    className="text-slate-500 hover:text-red-400 p-1"
                  >
                    <Trash2 size={16} />
                   </button>
                </div>
              </div>
              
              {/* Info Bar */}
              <div className="text-xs text-slate-500 mt-2 flex gap-4">
                <span>Start: {prevEndAngle}°</span>
                <span>Dur: {duration > 0 ? duration : <span className="text-red-400">Invalid</span>}°</span>
              </div>
            </div>
          );
        })}
      </div>

      <button 
        onClick={addSegment}
        className="mt-4 w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300 rounded transition-colors"
      >
        <Plus size={18} /> Add Segment
      </button>
      
      {!isComplete && (
        <div className="mt-4 p-3 bg-amber-900/20 border border-amber-900/50 rounded flex gap-2 items-start text-amber-200 text-sm">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <p>Motion cycle must complete exactly 360 degrees for valid cam generation.</p>
        </div>
      )}
    </div>
  );
};

export default MotionDesigner;
