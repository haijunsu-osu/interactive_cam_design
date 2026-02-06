import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { SimulationPoint, CamParams, FollowerType } from '../types';
import { Play, Pause, RotateCcw, Layers, RefreshCw } from 'lucide-react';

interface CamVisualizerProps {
  data: SimulationPoint[];
  params: CamParams;
  currentTheta: number; // Signed angle from App
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
    // Normalize theta to positive 0-360 range for lookup in data
    let t = theta % 360;
    if (t < 0) t += 360;
    
    // Data is generated 0-360 inclusive.
    // Calculate step based on data length (e.g. 721 points -> step 0.5)
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
    // If Cam rotates CW (Machine View), the Frame rotates CCW relative to Cam.
    // In SVG, positive rotation is CW. So CCW is negative.
    // Thus if params.rotation === 'CW', we rotate -theta.
    // If Cam rotates CCW, Frame rotates CW relative to Cam (+theta).
    // Note: 'theta' here is the magnitude of the angle from 0.
    const rot = params.rotation === 'CW' ? -theta : theta;
    const s = getInterpolatedLift(theta);
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
    
    // Determine scale based on geometry
    const maxR = d3.max(data, d => Math.sqrt(d.x*d.x + d.y*d.y)) || 50;
    const scaleDomain = maxR * 2.2; 
    
    // SVG coordinate system: y increases downwards. 
    // We'll flip y in drawing (scale(-val)) to make math +y go Up.
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
    // Rotates in machine view. currentTheta is signed.
    // SVG rotate(angle) is Clockwise.
    // If rotation is CW, currentTheta increases (0, 1, 2). rotate(1) is CW. Correct.
    // If rotation is CCW, currentTheta decreases (0, -1, -2). rotate(-1) is CCW. Correct.
    const camRotation = currentTheta;
    const camGroup = g.append("g")
       .attr("transform", `rotate(${camRotation})`);

    // Helper to draw a single ghost follower
    const drawGhostFollower = (container: any, theta: number, color: string, opacity: number, isHighlight: boolean = false) => {
        const { rotation: rot, lift: s } = getFollowerTransform(theta);
        
        const ghost = container.append("g")
          .attr("transform", `rotate(${rot})`)
          .attr("opacity", opacity);

        // Draw Follower in "Home" position (Horizontal Right)
        if (params.followerType.includes('Translating')) {
           const yOffset = scale(-params.offset) - scale(0); // SVG Y Flip (positive offset = up)
           let xPos = 0;
           
           if (params.followerType === FollowerType.TRANSLATING_ROLLER) {
              const R_prime = Math.sqrt(Math.pow(params.baseRadius + params.followerRadius, 2) - Math.pow(params.offset, 2));
              xPos = scale(R_prime + s) - scale(0);
              
              const circle = ghost.append("circle")
                .attr("cx", xPos).attr("cy", yOffset)
                .attr("r", scale(params.followerRadius) - scale(0))
                .attr("fill", isHighlight ? color : "none")
                .attr("stroke", color);
                
              if (isHighlight) circle.attr("stroke-width", 2);

           } else {
              const xVal = params.baseRadius + s;
              xPos = scale(xVal) - scale(0);
              ghost.append("line")
                .attr("x1", xPos).attr("y1", yOffset - 30)
                .attr("x2", xPos).attr("y2", yOffset + 30)
                .attr("stroke", color)
                .attr("stroke-width", isHighlight ? 3 : 1);
           }
        } else {
           // Oscillating
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
           
           const currentPhi = phi0 + (s * Math.PI / 180);
           
           const tipMathX = params.pivotDistance - params.followerLength * Math.cos(currentPhi);
           const tipMathY = params.followerLength * Math.sin(currentPhi);
           
           const gx1 = pivotX;
           const gy1 = pivotY;
           const gx2 = scale(tipMathX) - scale(0);
           const gy2 = scale(-tipMathY) - scale(0);
           
           if (!isHighlight) {
             ghost.append("line")
               .attr("x1", gx1).attr("y1", gy1)
               .attr("x2", gx2).attr("y2", gy2)
               .attr("stroke", "#cbd5e1");
           }
             
           if (params.followerType === FollowerType.OSCILLATING_ROLLER) {
              const circle = ghost.append("circle")
                .attr("cx", gx2).attr("cy", gy2)
                .attr("r", scale(params.followerRadius) - scale(0))
                .attr("fill", isHighlight ? color : "none")
                .attr("stroke", color);
                
              if (isHighlight) circle.attr("stroke-width", 2);

           } else {
              // Flat face normal at tip
              const dx = gx2 - gx1;
              const dy = gy2 - gy1;
              const len = Math.sqrt(dx*dx + dy*dy);
              const ux = -dy/len; const uy = dx/len;
              ghost.append("line")
                .attr("x1", gx2 - ux*30).attr("y1", gy2 - uy*30)
                .attr("x2", gx2 + ux*30).attr("y2", gy2 + uy*30)
                .attr("stroke", color)
                .attr("stroke-width", isHighlight ? 3 : 1);
           }
        }
    };

    // 1. Inversion Construction (Ghosts)
    if (showInversion) {
      const ghostGroup = camGroup.append("g").attr("class", "ghosts");
      const step = 20;
      
      // Standard Grid
      for (let t = 0; t < 360; t += step) {
        drawGhostFollower(ghostGroup, t, "#f59e0b", 0.15, false);
      }
      
      // Highlight Max Pressure Angle
      if (maxPaPoint) {
         drawGhostFollower(ghostGroup, maxPaPoint.theta, "#ef4444", 0.9, true);
         
         // Add label for Max PA
         const { rotation: rot } = getFollowerTransform(maxPaPoint.theta);
         const labelGroup = ghostGroup.append("g")
            .attr("transform", `rotate(${rot})`);
            
         const rLabel = scale(params.baseRadius * 1.8) - scale(0);
         labelGroup.append("text")
            .attr("x", rLabel)
            .attr("y", 0)
            .attr("fill", "#ef4444")
            .attr("font-size", "10px")
            .attr("font-weight", "bold")
            .text(`Max PA: ${Math.abs(maxPaPoint.pressureAngle).toFixed(1)}°`);
      }
    }

    // 2. Cam Profile
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

    // --- FOLLOWER GROUP (Stationary in Machine Frame) ---
    // Drawn horizontally to the Right (+X axis)
    const followerGroup = g.append("g");
    const currentLift = getInterpolatedLift(Math.abs(currentTheta)); // Look up by magnitude
    
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
           θ: {Math.abs(currentTheta).toFixed(1)}°
        </div>
        {maxPaPoint && (
           <div className="absolute top-4 right-4 text-xs font-mono text-red-400 bg-slate-900/90 px-3 py-1 rounded border border-red-900/30">
              Max PA: {Math.abs(maxPaPoint.pressureAngle).toFixed(1)}° @ {maxPaPoint.theta.toFixed(1)}°
           </div>
        )}
      </div>
      
      <div className="mt-4 px-2">
         <input 
           type="range" min="0" max="360" step="0.1"
           value={Math.abs(currentTheta)}
           onChange={(e) => { onPlayChange(false); onThetaChange(Number(e.target.value)); }}
           className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400"
         />
      </div>
    </div>
  );
};

export default CamVisualizer;