import { MotionType, MotionSegment, SimulationPoint } from '../types';

export const normalizeAngle = (angle: number) => {
  let a = angle % 360;
  if (a < 0) a += 360;
  return a;
};

// Returns [s, v, a, j] normalized. 
// v, a, j need to be scaled by factors of (h/beta), (h/beta^2), etc. externally
const getMotionFactors = (type: MotionType, u: number): [number, number, number, number] => {
  // u is normalized time 0 to 1
  switch (type) {
    case MotionType.DWELL:
      return [0, 0, 0, 0];
      
    case MotionType.UNIFORM:
      return [u, 1, 0, 0]; // Infinite Accel/Jerk ideally
      
    case MotionType.PARABOLIC:
      if (u <= 0.5) {
        // y = 2 * u^2
        return [2 * u * u, 4 * u, 4, 0];
      } else {
        // y = 1 - 2(1-u)^2
        return [1 - 2 * Math.pow(1 - u, 2), 4 * (1 - u), -4, 0];
      }
      
    case MotionType.HARMONIC:
      // s = 0.5 * (1 - cos(pi * u))
      {
        const piU = Math.PI * u;
        return [
          0.5 * (1 - Math.cos(piU)),
          0.5 * Math.PI * Math.sin(piU),
          0.5 * Math.pow(Math.PI, 2) * Math.cos(piU),
          -0.5 * Math.pow(Math.PI, 3) * Math.sin(piU)
        ];
      }

    case MotionType.CYCLOIDAL:
      // s = u - (1/2pi)sin(2pi*u)
      {
        const twoPiU = 2 * Math.PI * u;
        return [
          u - (1 / (2 * Math.PI)) * Math.sin(twoPiU),
          1 - Math.cos(twoPiU),
          2 * Math.PI * Math.sin(twoPiU),
          4 * Math.pow(Math.PI, 2) * Math.cos(twoPiU)
        ];
      }

    case MotionType.POLYNOMIAL_345:
      // s = 10u^3 - 15u^4 + 6u^5
      {
        const u2 = u * u;
        const u3 = u2 * u;
        const u4 = u3 * u;
        const u5 = u4 * u;
        return [
          10 * u3 - 15 * u4 + 6 * u5,
          30 * u2 - 60 * u3 + 30 * u4,
          60 * u - 180 * u2 + 120 * u3,
          60 - 360 * u + 360 * u2
        ];
      }
      
    default:
      return [0, 0, 0, 0];
  }
};

export const calculateMotion = (
  segments: MotionSegment[],
  stepSize: number = 1
): SimulationPoint[] => {
  const points: SimulationPoint[] = [];
  
  // Sort segments by angle just in case
  const sortedSegments = [...segments].sort((a, b) => a.endAngle - b.endAngle);
  
  // We need a full 360 definition. 
  // We assume the list covers 0 to 360 contiguously.
  // Start lift of segment i is end lift of segment i-1.
  
  let currentSegmentIndex = 0;
  
  for (let theta = 0; theta <= 360; theta += stepSize) {
    // Find active segment
    while (
      currentSegmentIndex < sortedSegments.length && 
      theta > sortedSegments[currentSegmentIndex].endAngle
    ) {
      currentSegmentIndex++;
    }
    
    if (currentSegmentIndex >= sortedSegments.length) break;

    const segment = sortedSegments[currentSegmentIndex];
    const prevSegment = sortedSegments[currentSegmentIndex - 1];
    
    const startAngle = prevSegment ? prevSegment.endAngle : 0;
    const startLift = prevSegment ? prevSegment.endLift : sortedSegments[sortedSegments.length - 1].endLift; // Wrap around for 0
    // Actually, usually user defines 0 to 360. If 0 is not defined, we assume 0 lift? 
    // Let's assume start lift of first segment is 0 or user configured.
    // For this app, let's assume the user defines a closed loop. 
    // The previous segment for index 0 is the LAST segment (wrap around logic for lift continuity).
    
    const actualPrevLift = prevSegment ? prevSegment.endLift : 0; // Simplified: usually starts at 0 for first seg
    
    const h = segment.endLift - actualPrevLift;
    const beta = segment.endAngle - startAngle;
    
    // Normalize time u [0, 1]
    let u = 0;
    if (beta !== 0) {
      u = (theta - startAngle) / beta;
    }
    
    const [facS, facV, facA, facJ] = getMotionFactors(segment.type, u);
    
    // Convert derivatives to be w.r.t theta (radians) for calculation consistency
    // However, for typical plots we use degrees or generic time.
    // Let's store raw derivatives w.r.t u for now, but scale them for physical meaning.
    // If theta is in degrees, we need to be careful.
    // Standard cam formulas usually assume theta in radians for derivatives.
    
    const betaRad = beta * (Math.PI / 180);
    
    // s = start + h * facS
    const s = actualPrevLift + h * facS;
    
    // v = ds/dtheta = (h / betaRad) * facV
    const v = betaRad === 0 ? 0 : (h / betaRad) * facV;
    
    // a = d2s/dtheta2 = (h / betaRad^2) * facA
    const a = betaRad === 0 ? 0 : (h / (betaRad * betaRad)) * facA;
    
    // j = d3s/dtheta3 = (h / betaRad^3) * facJ
    const j = betaRad === 0 ? 0 : (h / Math.pow(betaRad, 3)) * facJ;

    points.push({
      theta,
      s,
      v,
      a,
      j,
      x: 0, // Placeholder
      y: 0, // Placeholder
      pressureAngle: 0,
      radiusOfCurvature: 0
    });
  }
  
  return points;
};
