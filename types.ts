export enum MotionType {
  DWELL = 'Dwell',
  UNIFORM = 'Uniform',
  PARABOLIC = 'Parabolic',
  HARMONIC = 'Harmonic',
  CYCLOIDAL = 'Cycloidal',
  POLYNOMIAL_345 = 'Polynomial 3-4-5'
}

export enum FollowerType {
  TRANSLATING_ROLLER = 'Translating Roller',
  TRANSLATING_FLAT = 'Translating Flat-Faced',
  OSCILLATING_ROLLER = 'Oscillating Roller',
  OSCILLATING_FLAT = 'Oscillating Flat-Faced'
}

export interface MotionSegment {
  id: string;
  type: MotionType;
  duration: number | string; // Duration of this segment in degrees
  deltaLift: number | string; // Change in lift during this segment (Rise = +, Return = -)
}

export interface CamParams {
  followerType: FollowerType;
  baseRadius: number; // rb
  followerRadius: number; // r0 (for rollers)
  offset: number; // d (for translating)
  pivotDistance: number; // r1 (distance between cam pivot and follower pivot)
  followerLength: number; // r3 (distance from follower pivot to roller center/contact)
  startAngleOffset: number; // To align simulation
  rotation: 'CW' | 'CCW';
}

export interface SimulationPoint {
  theta: number; // Cam angle in degrees
  s: number; // Displacement
  v: number; // Velocity
  a: number; // Acceleration
  j: number; // Jerk
  x: number; // Cam profile X
  y: number; // Cam profile Y
  pressureAngle: number;
  radiusOfCurvature: number;
}
