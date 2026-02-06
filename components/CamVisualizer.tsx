import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { SimulationPoint, CamParams, FollowerType } from '../types';
import { Play, Pause, RotateCcw, Layers, RefreshCw } from 'lucide-react';

interface CamVisualizerProps {
  data: SimulationPoint[];
  params: CamParams;
  currentTheta: number; 
  isPlaying: boolean;
  onPlayChange: (playing: boolean) => void;
  onThetaChange: (theta: number) => void;
  onCalculate: () => void;
  isDirty: boolean;
}

const CamVisualizer: React.FC<CamVisualizerProps> = ({ 
  data, 
  params, 
  currentTheta, 
  isPlaying, 
  onPlayChange, 
  onThetaChange,
  onCalculate,
  isDirty
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [showInversion, setShowInversion] = useState(true);

  // Identify the point with Maximum Pressure Angle
  const maxPaPoint = useMemo(() => {
    if (!data.length) return null;
    return data.reduce((max, p) => 
      Math.abs(p.pressureAngle) > Math.abs(max.pressureAngle) ? p : max
    , data[0]);
  }, [data]);

  // Helper: Linear interpolation for smooth follower movement
  const getInterpolatedLift = (theta: number) => {
    if (data.length === 0) return 0;
    let t = theta % 360;
    if (t < 0) t += 360;
    const step = 360 / (data.length - 1);
    const indexFloat = t / step;
    const idx1 = Math.floor(indexFloat);
    const idx2 = Math.min(idx1 + 1, data.length - 1);
    const ratio = indexFloat - idx1;
    const s1 = data[idx1]?.s ?? 0;
    const s2 = data[idx2]?.s ?? 0;
    return s1 + (s2 - s1) * ratio;
  };

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;
    const margin = 50;

    // 1. CALCULATE WORLD BOUNDS
    // We need to know the maximum extent of the mechanism to scale it to fit the screen.
    const camMaxR = d3.max(data, d => Math.sqrt(d.x * d.x + d.y * d.y)) || params.baseRadius;
    
    let worldExtent = camMaxR;
    const isOscillating = params.followerType.includes('Oscillating');
    
    if (isOscillating) {
      // Pivot distance and follower length are part of the machine
      worldExtent = Math.max(worldExtent, params.pivotDistance, params.pivotDistance + params.followerRadius);
      // Roughly include the swing range
      worldExtent = Math.max(worldExtent, params.pivotDistance + params.followerLength);
    } else {
      // Stem usually goes out to at least 2x base radius
      worldExtent = Math.max(worldExtent, params.baseRadius * 2.5);
      worldExtent = Math.max(worldExtent, Math.abs(params.offset) + params.followerRadius);
    }

    // 2. SCALE FACTOR (Pixels per World Unit)
    // Map world units to screen pixels. Origin is at 0,0 (cam center).
    const availableDim = Math.min(width, height) / 2 - margin;
    const pxPerUnit = availableDim / worldExtent;

    // Utility to convert world distance to pixel distance
    const toPx = (val: number) => val * pxPerUnit;

    // 3. DRAWING
    const baseStroke = 1.5;
    const axisColor = "#1e293b";

    // Center Group (Cam Pivot)
    // We offset the center slightly to the left if it's a translating follower with a long stem
    const xOffset = isOscillating ? 0 : -toPx(params.baseRadius * 0.5);
    const g = svg.append("g")
      .attr("transform", `translate(${width/2 + xOffset},${height/2})`);

    // Grid axes
    g.append("line").attr("x1", -width).attr("y1", 0).attr("x2", width).attr("y2", 0).attr("stroke", axisColor).attr("stroke-dasharray", "4 4");
    g.append("line").attr("x1", 0).attr("y1", -height).attr("x2", 0).attr("y2", height).attr("stroke", axisColor).attr("stroke-dasharray", "4 4");

    // Cam Group (Rotates)
    const camGroup = g.append("g").attr("transform", `rotate(${currentTheta})`);

    // Profile Path
    const lineGenerator = d3.line<SimulationPoint>()
      .x(d => toPx(d.x))
      .y(d => toPx(-d.y))
      .curve(d3.curveLinearClosed);

    camGroup.append("path")
      .datum(data)
      .attr("fill", "#1e293b")
      .attr("fill-opacity", 0.7)
      .attr("stroke", "#60a5fa")
      .attr("stroke-width", baseStroke)
      .attr("d", lineGenerator);

    // Base Circle Reference
    camGroup.append("circle")
      .attr("r", toPx(params.baseRadius))
      .attr("fill", "none")
      .attr("stroke", "#334155")
      .attr("stroke-dasharray", "2 2");

    // Cam Pivot Marker
    camGroup.append("circle").attr("r", 4).attr("fill", "#94a3b8");

    // Follower Drawing Function (shared for inversion and active follower)
    const drawFollower = (container: any, theta: number, color: string, opacity: number, isHighlight: boolean = false) => {
      const s = getInterpolatedLift(theta);
      const follower = container.append("g");
      
      if (params.followerType.includes('Translating')) {
        const yCenter = toPx(-params.offset);
        let xContact = 0;
        const stemLen = toPx(params.baseRadius * 1.5);

        if (params.followerType === FollowerType.TRANSLATING_ROLLER) {
          const R_prime = Math.sqrt(Math.pow(params.baseRadius + params.followerRadius, 2) - Math.pow(params.offset, 2));
          xContact = toPx(R_prime + s);
          
          follower.append("circle")
            .attr("cx", xContact).attr("cy", yCenter)
            .attr("r", Math.max(2, toPx(params.followerRadius)))
            .attr("fill", isHighlight ? color : "none")
            .attr("stroke", color)
            .attr("stroke-width", isHighlight ? baseStroke * 2 : baseStroke);
          
          if (!opacity || opacity > 0.5) {
            follower.append("line")
              .attr("x1", xContact).attr("y1", yCenter).attr("x2", xContact + stemLen).attr("y2", yCenter)
              .attr("stroke", "#475569").attr("stroke-width", 6).attr("stroke-linecap", "round");
          }
        } else {
          xContact = toPx(params.baseRadius + s);
          const faceHalf = toPx(params.baseRadius * 0.4);
          follower.append("line")
            .attr("x1", xContact).attr("y1", yCenter - faceHalf)
            .attr("x2", xContact).attr("y2", yCenter + faceHalf)
            .attr("stroke", color).attr("stroke-width", isHighlight ? baseStroke * 3 : baseStroke * 2);
          
          if (!opacity || opacity > 0.5) {
            follower.append("line")
              .attr("x1", xContact).attr("y1", yCenter).attr("x2", xContact + stemLen).attr("y2", yCenter)
              .attr("stroke", "#475569").attr("stroke-width", 6).attr("stroke-linecap", "round");
          }
        }
      } else {
        // Oscillating
        const pivotX = toPx(params.pivotDistance);
        let phi0 = 0;
        if (params.followerType === FollowerType.OSCILLATING_ROLLER) {
           const num = Math.pow(params.pivotDistance, 2) + Math.pow(params.followerLength, 2) - Math.pow(params.baseRadius + params.followerRadius, 2);
           const den = 2 * params.pivotDistance * params.followerLength;
           phi0 = Math.acos(Math.max(-1, Math.min(1, num/den)));
        } else {
           const AE = (params.pivotDistance * params.baseRadius) / (params.baseRadius + params.offset);
           const DE = Math.sqrt(Math.max(0, AE*AE - params.baseRadius*params.baseRadius));
           phi0 = Math.atan2(params.baseRadius, DE);
        }
        
        const phi = phi0 + (s * Math.PI / 180);
        const tipX = toPx(params.pivotDistance - params.followerLength * Math.cos(phi));
        const tipY = toPx(-params.followerLength * Math.sin(phi));
        
        follower.append("line")
          .attr("x1", pivotX).attr("y1", 0).attr("x2", tipX).attr("y2", tipY)
          .attr("stroke", "#475569").attr("stroke-width", isHighlight ? 4 : 2).attr("stroke-linecap", "round");
        
        if (params.followerType === FollowerType.OSCILLATING_ROLLER) {
          follower.append("circle")
            .attr("cx", tipX).attr("cy", tipY)
            .attr("r", Math.max(2, toPx(params.followerRadius)))
            .attr("fill", isHighlight ? color : "none")
            .attr("stroke", color)
            .attr("stroke-width", isHighlight ? baseStroke * 2 : baseStroke);
        } else {
          const dx = tipX - pivotX; const dy = tipY; const len = Math.sqrt(dx*dx + dy*dy);
          const ux = -dy/len; const uy = dx/len;
          const faceHalf = toPx(params.baseRadius * 0.4);
          follower.append("line")
            .attr("x1", tipX - ux*faceHalf).attr("y1", tipY - uy*faceHalf)
            .attr("x2", tipX + ux*faceHalf).attr("y2", tipY + uy*faceHalf)
            .attr("stroke", color).attr("stroke-width", isHighlight ? baseStroke * 3 : baseStroke * 2);
        }
        
        if (!opacity || opacity > 0.5) {
          follower.append("circle").attr("cx", pivotX).attr("cy", 0).attr("r", 4).attr("fill", "#64748b");
        }
      }
      follower.attr("opacity", opacity);
    };

    // Draw Inversion (Ghost followers attached to cam)
    if (showInversion) {
      const ghostGroup = camGroup.append("g");
      for (let t = 0; t < 360; t += 30) {
        // Correctly account for rotation when placing ghost followers relative to cam
        const rot = params.rotation === 'CW' ? -t : t;
        const sub = ghostGroup.append("g").attr("transform", `rotate(${rot})`);
        drawFollower(sub, t, "#1e293b", 0.3);
      }
      if (maxPaPoint) {
        const rot = params.rotation === 'CW' ? -maxPaPoint.theta : maxPaPoint.theta;
        const sub = ghostGroup.append("g").attr("transform", `rotate(${rot})`);
        drawFollower(sub, maxPaPoint.theta, "#ef4444", 0.8, true);
      }
    }

    // Draw Active Follower (Stationary relative to screen)
    const followerGroup = g.append("g");
    drawFollower(followerGroup, Math.abs(currentTheta), "#f59e0b", 1, true);

  }, [data, params, currentTheta, showInversion]);

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-lg shadow-lg border border-slate-800 p-4">
      <div className="flex justify-between items-center mb-2">
         <h2 className="text-xl font-bold text-slate-100">Cam Simulation</h2>
         <div className="flex gap-2">
            <button
               onClick={onCalculate}
               disabled={!isDirty}
               className={`flex items-center gap-1 px-3 py-2 rounded text-xs font-bold transition-all ${
                 isDirty ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg' : 'bg-slate-800 text-slate-500'
               }`}
            >
               <RefreshCw size={14} className={isDirty ? 'animate-spin' : ''} />
               <span>{isDirty ? 'Sync Profile' : 'Synced'}</span>
            </button>
            <button 
              title="Show Kinematic Inversion"
              onClick={() => setShowInversion(!showInversion)}
              className={`p-2 rounded transition-colors ${showInversion ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            >
              <Layers size={18} />
            </button>
            <button 
              onClick={() => onPlayChange(!isPlaying)}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-200"
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button 
               onClick={() => { onPlayChange(false); onThetaChange(0); }}
               className="p-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-200"
            >
              <RotateCcw size={18} />
            </button>
         </div>
      </div>
      
      <div className="flex-1 min-h-[400px] relative border border-slate-800 rounded bg-slate-950 overflow-hidden group">
        <svg ref={svgRef} width="100%" height="100%" className="absolute inset-0" />
        
        <div className="absolute bottom-4 left-4 text-[10px] font-mono text-slate-400 bg-slate-900/90 px-2 py-1 rounded border border-slate-700 pointer-events-none">
           θ: {Math.abs(currentTheta).toFixed(1)}°
        </div>
        
        {maxPaPoint && (
           <div className="absolute top-4 right-4 text-[10px] font-mono text-red-400 bg-slate-900/90 px-2 py-1 rounded border border-red-900/30 pointer-events-none">
              Max PA: {Math.abs(maxPaPoint.pressureAngle).toFixed(1)}°
           </div>
        )}
      </div>
      
      <div className="mt-4 px-2">
         <input 
           type="range" min="0" max="360" step="0.5"
           value={Math.abs(currentTheta)}
           onChange={(e) => { onPlayChange(false); onThetaChange(Number(e.target.value)); }}
           className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400"
         />
      </div>
    </div>
  );
};

export default CamVisualizer;