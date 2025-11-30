import React from 'react';
import { CamParams, FollowerType } from '../types';

interface CamConfigProps {
  params: CamParams;
  onChange: (params: CamParams) => void;
}

const CamConfig: React.FC<CamConfigProps> = ({ params, onChange }) => {
  const handleChange = (field: keyof CamParams, value: any) => {
    onChange({ ...params, [field]: value });
  };

  const isOscillating = params.followerType.includes('Oscillating');
  const isRoller = params.followerType.includes('Roller');

  return (
    <div className="bg-slate-900 p-4 rounded-lg shadow-lg border border-slate-800">
      <h2 className="text-xl font-bold text-slate-100 mb-4">Cam Geometry</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Type Selection */}
        <div className="col-span-2">
          <label className="block text-sm text-slate-400 mb-1">Follower Type</label>
          <select 
            value={params.followerType}
            onChange={(e) => handleChange('followerType', e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-200"
          >
            {Object.values(FollowerType).map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Base Radius */}
        <div>
          <label className="block text-sm text-slate-400 mb-1">Base Radius (rb)</label>
          <input 
            type="number"
            step="0.1"
            value={params.baseRadius}
            onChange={(e) => handleChange('baseRadius', parseFloat(e.target.value))}
            className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-200"
          />
        </div>

        {/* Direction */}
        <div>
          <label className="block text-sm text-slate-400 mb-1">Rotation</label>
          <div className="flex bg-slate-950 rounded border border-slate-700 p-1">
             {['CW', 'CCW'].map(dir => (
               <button
                 key={dir}
                 onClick={() => handleChange('rotation', dir)}
                 className={`flex-1 py-1 px-2 rounded text-sm ${params.rotation === dir ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
               >
                 {dir}
               </button>
             ))}
          </div>
        </div>

        {/* Follower Radius (Roller only) */}
        {isRoller && (
          <div>
            <label className="block text-sm text-slate-400 mb-1">Follower Radius (r0)</label>
            <input 
              type="number"
              step="0.1"
              value={params.followerRadius}
              onChange={(e) => handleChange('followerRadius', parseFloat(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-200"
            />
          </div>
        )}

        {/* Offset (Translating only) */}
        {!isOscillating && (
          <div>
            <label className="block text-sm text-slate-400 mb-1">Offset (d)</label>
            <input 
              type="number"
              step="0.1"
              value={params.offset}
              onChange={(e) => handleChange('offset', parseFloat(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-200"
            />
          </div>
        )}

        {/* Pivot Distance (Oscillating only) */}
        {isOscillating && (
          <div>
             <label className="block text-sm text-slate-400 mb-1">Pivot Distance (r1)</label>
             <input 
              type="number"
              step="0.1"
              value={params.pivotDistance}
              onChange={(e) => handleChange('pivotDistance', parseFloat(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-200"
            />
          </div>
        )}

        {/* Follower Length (Oscillating only) */}
        {isOscillating && (
          <div>
             <label className="block text-sm text-slate-400 mb-1">Follower Length (r3)</label>
             <input 
              type="number"
              step="0.1"
              value={params.followerLength}
              onChange={(e) => handleChange('followerLength', parseFloat(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-200"
            />
          </div>
        )}

      </div>
    </div>
  );
};

export default CamConfig;
