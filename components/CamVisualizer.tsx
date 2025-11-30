import React, { useEffect, useRef, useState } from 'react';
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

  // Helper: Calculate Follower Transformation relative to Cam (Inversion)
  const getFollowerTransform = (theta: number) => {
    // Returns rotation to place ghost follower in cam frame
    const s = getInterpolatedLift(theta);
    const rot = params.rotation === 'CW' ? theta : -theta;
    return { rotation: rot, lift: s };
  };

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;
    const margin = 20;
    const maxDim = Math.min(width, height) / 2 - margin;
    
    const maxR = d3.max(data, d => Math.sqrt(d.x*d.x + d.y*d.y)) || 50;
    const scaleDomain = maxR * 2.2; 
    
    // Create scale. Note SVG y is down, so we flip y in drawing functions usually.
    const scale = d3.scaleLinear()
      .domain([-scaleDomain, scaleDomain])
      .range([-maxDim, maxDim]);

    // Center Group
    const g = svg.append("g")
      .attr("transform", `translate(${width/2},${height/2})`);

    // Axes
    const axisColor = "#334155";
    g.append("line").attr("x1", -maxDim).attr("y1", 0).attr("x2", maxDim).attr("y2", 0).attr("stroke", axisColor).attr("stroke-dasharray", "4 4");
    g.append("line").attr("x1", 0).attr("y1", -maxDim).attr("x2", 0).attr("y2", maxDim).attr("stroke", axisColor).attr("stroke-dasharray", "4 4");

    // --- CAM GROUP ---
    // Rotates in machine view.
    const camRotation = params.rotation === 'CW' ? -currentTheta : currentTheta;
    const camGroup = g.append("g")
       .attr("transform", `rotate(${camRotation})`);

    // 1. Inversion Construction (Ghosts)
    if (showInversion) {
      const ghostGroup = camGroup.append("g").attr("class", "ghosts");
      const step = 20;
      
      for (let t = 0; t < 360; t += step) {
        const { rotation: rot, lift: s } = getFollowerTransform(t);
        const ghost = ghostGroup.append("g")
          .attr("transform", `rotate(${rot})`)
          .attr("opacity", 0.15);

        // Radial Line (Horizontal along +X)
        ghost.append("line")
          .attr("x1", 0).attr("y1", 0)
          .attr("x2", scale(params.baseRadius * 1.5) - scale(0)).attr("y2", 0)
          .attr("stroke", "#94a3b8")
          .attr("stroke-dasharray", "2 2");

        // Ghost Follower (Horizontal Orientation)
        if (params.followerType.includes('Translating')) {
           const yOffset = scale(-params.offset) - scale(0); // Up if offset positive
           let xPos = 0;
           
           if (params.followerType === FollowerType.TRANSLATING_ROLLER) {
              const R_prime = Math.sqrt(Math.pow(params.baseRadius + params.followerRadius, 2) - Math.pow(params.offset, 2));
              xPos = scale(R_prime + s) - scale(0);
              
              ghost.append("circle")
                .attr("cx", xPos).attr("cy", yOffset)
                .attr("r", scale(params.followerRadius) - scale(0))
                .attr("fill", "none").attr("stroke", "#f59e0b");
           } else {
              const xVal = params.baseRadius + s;
              xPos = scale(xVal) - scale(0);
              ghost.append("line")
                .attr("x1", xPos).attr("y1", yOffset - 30)
                .attr("x2", xPos).attr("y2", yOffset + 30)
                .attr("stroke", "#f59e0b");
           }
        } else {
           // Oscillating (Ghost)
           const pivotX = scale(params.pivotDistance * Math.cos(0)) - scale(0); // Assuming pivot on X axis?
           // Wait, usually pivot is defined at some angle. 
           // In camMath we assumed pivot on X axis (radius r1).
           const pivotY = 0;
           const px = scale(params.pivotDistance) - scale(0);
           
           // Calculate Phi
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
           // IMPORTANT: In horizontal setup, Phi is angle relative to pivot line (X axis).
           // But direction depends on layout. Let's assume math aligns with X.
           // However, standard math usually places arm "above" or "below".
           // Let's assume positive phi rotates towards Y (Up).
           
           const currentPhi = phi0 + (s * Math.PI / 180); // Adjust sign if needed
           
           // Tip position relative to pivot
           // Arm starts at r1 on X axis, points back towards origin?
           // In camMath: Pivot at (r1, 0). Tip at (x,y).
           // x = r1 - r3 cos(phi)
           // y = r3 sin(phi)
           // Let's match camMath derivation approximately.
           
           const tipMathX = params.pivotDistance - params.followerLength * Math.cos(currentPhi);
           const tipMathY = params.followerLength * Math.sin(currentPhi);
           
           const gx1 = scale(params.pivotDistance) - scale(0);
           const gy1 = 0;
           const gx2 = scale(tipMathX) - scale(0);
           const gy2 = scale(-tipMathY) - scale(0); // SVG Y flip
           
           ghost.append("line")
             .attr("x1", gx1).attr("y1", gy1)
             .attr("x2", gx2).attr("y2", gy2)
             .attr("stroke", "#cbd5e1");
             
           if (params.followerType === FollowerType.OSCILLATING_ROLLER) {
              ghost.append("circle")
                .attr("cx", gx2).attr("cy", gy2)
                .attr("r", scale(params.followerRadius) - scale(0))
                .attr("fill", "none").attr("stroke", "#f59e0b");
           } else {
              // Flat face normal at tip
              const dx = gx2 - gx1;
              const dy = gy2 - gy1;
              const len = Math.sqrt(dx*dx + dy*dy);
              const ux = -dy/len; const uy = dx/len;
              ghost.append("line")
                .attr("x1", gx2 - ux*30).attr("y1", gy2 - uy*30)
                .attr("x2", gx2 + ux*30).attr("y2", gy2 + uy*30)
                .attr("stroke", "#f59e0b");
           }
        }
      }
    }

    // 2. Cam Profile
    // We use data.x and data.y which are generated for Horizontal contact (at theta=0, x=r, y=0).
    const lineGenerator = d3.line<SimulationPoint>()
      .x(d => scale(d.x))
      .y(d => scale(-d.y)) // Flip Y for SVG
      .curve(d3.curveLinearClosed);

    camGroup.append("path")
      .datum(data)
      .attr("fill", "#1e293b")
      .attr("fill-opacity", 0.8)
      .attr("stroke", "#60a5fa")
      .attr("stroke-width", 2)
      .attr("d", lineGenerator);
      
    // Base Circle
    camGroup.append("circle")
      .attr("r", scale(params.baseRadius) - scale(0))
      .attr("fill", "none")
      .attr("stroke", "#475569")
      .attr("stroke-dasharray", "3 3");
      
    camGroup.append("circle").attr("r", 4).attr("fill", "#94a3b8");

    // --- FOLLOWER GROUP (Stationary) ---
    // Drawn horizontally to the Right (+X axis)
    const followerGroup = g.append("g");
    const currentLift = getInterpolatedLift(currentTheta);
    
    if (params.followerType.includes('Translating')) {
       // Horizontal Translation
       const yOffset = scale(-params.offset) - scale(0); // Up if positive
       let xPos = 0;
       
       if (params.followerType === FollowerType.TRANSLATING_ROLLER) {
          const R_prime = Math.sqrt(Math.pow(params.baseRadius + params.followerRadius, 2) - Math.pow(params.offset, 2));
          const xVal = R_prime + currentLift;
          xPos = scale(xVal) - scale(0);
          
          followerGroup.append("circle")
            .attr("cx", xPos).attr("cy", yOffset)
            .attr("r", scale(params.followerRadius) - scale(0))
            .attr("fill", "#f59e0b").attr("stroke", "white").attr("stroke-width", 1.5);
            
          // Stem
          followerGroup.append("line")
            .attr("x1", xPos).attr("y1", yOffset)
            .attr("x2", xPos + 120).attr("y2", yOffset) 
            .attr("stroke", "#cbd5e1").attr("stroke-width", 6).attr("stroke-linecap", "round");
       } else {
          const xVal = params.baseRadius + currentLift;
          xPos = scale(xVal) - scale(0);
          
          // Face
          followerGroup.append("line")
            .attr("x1", xPos).attr("y1", yOffset - 50)
            .attr("x2", xPos).attr("y2", yOffset + 50)
            .attr("stroke", "#f59e0b").attr("stroke-width", 4);
            
          // Stem
          followerGroup.append("line")
             .attr("x1", xPos).attr("y1", yOffset)
             .attr("x2", xPos + 120).attr("y2", yOffset)
             .attr("stroke", "#cbd5e1").attr("stroke-width", 6).attr("stroke-linecap", "round");
       }
       // Guide
       g.append("rect")
         .attr("x", maxDim + 10)
         .attr("y", yOffset - 12)
         .attr("width", 60).attr("height", 24)
         .attr("fill", "#334155").attr("fill-opacity", 0.3).attr("stroke", "#475569");

    } else {
      // Oscillating (Stationary drawing)
      const pivotX = scale(params.pivotDistance) - scale(0);
      const pivotY = 0;
      
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
      
      const currentPhi = phi0 + (currentLift * Math.PI / 180);
      const mathX = params.pivotDistance - params.followerLength * Math.cos(currentPhi);
      const mathY = params.followerLength * Math.sin(currentPhi);
      
      const screenTipX = scale(mathX);
      const screenTipY = scale(-mathY); // Flip Y
      const screenPivotX = scale(params.pivotDistance);
      const screenPivotY = 0;
      
      followerGroup.append("circle")
        .attr("cx", screenPivotX).attr("cy", screenPivotY)
        .attr("r", 6).attr("fill", "#94a3b8").attr("stroke", "#1e293b").attr("stroke-width", 2);
        
      followerGroup.append("line")
        .attr("x1", screenPivotX).attr("y1", screenPivotY)
        .attr("x2", screenTipX).attr("y2", screenTipY)
        .attr("stroke", "#cbd5e1").attr("stroke-width", 8).attr("stroke-linecap", "round");
        
      if (params.followerType === FollowerType.OSCILLATING_ROLLER) {
           followerGroup.append("circle")
            .attr("cx", screenTipX).attr("cy", screenTipY)
            .attr("r", scale(params.followerRadius) - scale(0))
            .attr("fill", "#f59e0b").attr("stroke", "white").attr("stroke-width", 1.5);
      } else {
          const faceLen = 70;
          const dx = screenTipX - screenPivotX;
          const dy = screenTipY - screenPivotY;
          const len = Math.sqrt(dx*dx + dy*dy);
          const ux = -dy / len;
          const uy = dx / len;
          followerGroup.append("line")
            .attr("x1", screenTipX - ux * faceLen).attr("y1", screenTipY - uy * faceLen)
            .attr("x2", screenTipX + ux * faceLen).attr("y2", screenTipY + uy * faceLen)
            .attr("stroke", "#f59e0b").attr("stroke-width", 4);
      }
    }

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
                 isDirty 
                   ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/50' 
                   : 'bg-slate-800 text-slate-500'
               }`}
            >
               <RefreshCw size={14} className={isDirty ? 'animate-spin' : ''} />
               <span>{isDirty ? 'Update' : 'Ready'}</span>
            </button>
            <div className="w-px h-8 bg-slate-700 mx-1"></div>
            <button 
              onClick={() => setShowInversion(!showInversion)}
              className={`p-2 rounded transition-colors ${showInversion ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}
              title="Toggle Inversion Construction"
            >
              <Layers size={18} />
            </button>
            <div className="w-px h-8 bg-slate-700 mx-2"></div>
            <button 
              onClick={() => onPlayChange(!isPlaying)}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 transition-colors"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button 
               onClick={() => { onPlayChange(false); onThetaChange(0); }}
               className="p-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 transition-colors"
               title="Reset"
            >
              <RotateCcw size={18} />
            </button>
         </div>
      </div>
      
      <div className="flex-1 min-h-[400px] relative border border-slate-800 rounded bg-slate-950/50 overflow-hidden">
        <svg ref={svgRef} width="100%" height="100%" className="absolute inset-0" />
        <div className="absolute bottom-4 left-4 text-xs font-mono text-slate-400 bg-slate-900/90 px-3 py-1 rounded border border-slate-700">
           θ: {currentTheta.toFixed(1)}°
        </div>
      </div>
      
      <div className="mt-4 px-2">
         <input 
           type="range" min="0" max="360" step="0.1"
           value={currentTheta}
           onChange={(e) => { onPlayChange(false); onThetaChange(Number(e.target.value)); }}
           className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400"
         />
      </div>
    </div>
  );
};

export default CamVisualizer;