import { MotionType, MotionSegment, SimulationPoint } from '../types';

export const normalizeAngle = (angle: number) => {
  let a = angle % 360;
  if (a < 0) a += 360;
  return a;
};

// Returns [s, v, a, j] normalized factors. 
const getMotionFactors = (type: MotionType, u: number): [number, number, number, number] => {
  switch (type) {
    case MotionType.DWELL:
      return [0, 0, 0, 0];
      
    case MotionType.UNIFORM:
      return [u, 1, 0, 0]; 
      
    case MotionType.PARABOLIC:
      if (u <= 0.5) {
        return [2 * u * u, 4 * u, 4, 0];
      } else {
        return [1 - 2 * Math.pow(1 - u, 2), 4 * (1 - u), -4, 0];
      }
      
    case MotionType.HARMONIC:
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
  
  // Pre-calculate cumulative lift and absolute angle boundaries
  let cumulativeAngle = 0;
  let cumulativeLift = 0;
  
  const processedSegments = segments.map(seg => {
    const startAngle = cumulativeAngle;
    const startLift = cumulativeLift;
    
    const duration = Number(seg.duration) || 0;
    const deltaLift = Number(seg.deltaLift) || 0;
    
    cumulativeAngle += duration;
    cumulativeLift += deltaLift;
    
    return {
      ...seg,
      durationVal: duration,
      deltaLiftVal: deltaLift,
      startAngle,
      endAngle: cumulativeAngle,
      startLift,
      endLift: cumulativeLift
    };
  });

  const finalLift = processedSegments.length > 0 
    ? processedSegments[processedSegments.length - 1].endLift 
    : 0;

  let currentSegmentIndex = 0;
  const epsilon = 1e-10;

  for (let theta = 0; theta <= 360 + epsilon; theta += stepSize) {
    const clampedTheta = Math.min(theta, 360);

    // Find active segment for current theta
    while (
      currentSegmentIndex < processedSegments.length && 
      clampedTheta > processedSegments[currentSegmentIndex].endAngle + epsilon
    ) {
      currentSegmentIndex++;
    }
    
    // If cycle not fully defined to 360
    if (currentSegmentIndex >= processedSegments.length) {
      points.push({
        theta: clampedTheta,
        s: finalLift,
        v: 0, a: 0, j: 0,
        x: 0, y: 0, pressureAngle: 0, radiusOfCurvature: 0
      });
      continue;
    }

    const segment = processedSegments[currentSegmentIndex];
    const beta = segment.durationVal;
    const h = segment.deltaLiftVal; 
    const startLift = segment.startLift;
    
    let u = 0;
    if (beta > epsilon) {
      u = (clampedTheta - segment.startAngle) / beta;
    }
    u = Math.max(0, Math.min(1, u));
    
    const [facS, facV, facA, facJ] = getMotionFactors(segment.type, u);
    const betaRad = beta * (Math.PI / 180);
    
    const s = startLift + h * facS;
    const v = betaRad < epsilon ? 0 : (h / betaRad) * facV;
    const a = betaRad < epsilon ? 0 : (h / (betaRad * betaRad)) * facA;
    const j = betaRad < epsilon ? 0 : (h / Math.pow(betaRad, 3)) * facJ;

    points.push({
      theta: clampedTheta,
      s, v, a, j,
      x: 0, y: 0, pressureAngle: 0, radiusOfCurvature: 0
    });
  }
  
  return points;
};
