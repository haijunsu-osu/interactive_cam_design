import React, { useState, useEffect, useRef } from 'react';
import { MotionSegment, MotionType, CamParams, FollowerType, SimulationPoint } from './types';
import MotionDesigner from './components/MotionDesigner';
import CamConfig from './components/CamConfig';
import Charts from './components/Charts';
import CamVisualizer from './components/CamVisualizer';
import PressureAngleChart from './components/PressureAngleChart';
import { calculateMotion } from './utils/motionMath';
import { calculateCamProfile } from './utils/camMath';
import { Activity } from 'lucide-react';

const App: React.FC = () => {
  // Updated initial state based on user request:
  // Dwell 1 (20°), Rise 1 (60°), Dwell 2 (20°), Rise 2 (60°), Dwell 3 (20°), Return 1 (180°)
  // Total = 20 + 60 + 20 + 60 + 20 + 180 = 360°
  const [segments, setSegments] = useState<MotionSegment[]>([
    { id: '1', type: MotionType.DWELL, duration: 20, deltaLift: 0 },
    { id: '2', type: MotionType.CYCLOIDAL, duration: 60, deltaLift: 10 },
    { id: '3', type: MotionType.DWELL, duration: 20, deltaLift: 0 },
    { id: '4', type: MotionType.CYCLOIDAL, duration: 60, deltaLift: 20 },
    { id: '5', type: MotionType.DWELL, duration: 20, deltaLift: 0 },
    { id: '6', type: MotionType.HARMONIC, duration: 180, deltaLift: -30 },
  ]);

  const [camParams, setCamParams] = useState<CamParams>({
    followerType: FollowerType.TRANSLATING_ROLLER,
    baseRadius: 40,
    followerRadius: 10,
    offset: 0,
    pivotDistance: 80,
    followerLength: 60,
    startAngleOffset: 0,
    rotation: 'CW'
  });

  // Calculated State (For Visualization)
  const [motionData, setMotionData] = useState<SimulationPoint[]>([]);
  const [camData, setCamData] = useState<SimulationPoint[]>([]);
  const [activeParams, setActiveParams] = useState<CamParams>(camParams);
  
  // Dirty tracking for each stage
  const [motionDirty, setMotionDirty] = useState(false);
  const [camDirty, setCamDirty] = useState(false);

  // Simulation State (Synchronized)
  const [currentTheta, setCurrentTheta] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const animationRef = useRef<number>(0);

  const [activeTab, setActiveTab] = useState<'motion' | 'cam'>('motion');

  // Stage 1: Kinematic Analysis
  const handleGenerateMotion = () => {
    const stepSize = 0.5;
    const mData = calculateMotion(segments, stepSize);
    setMotionData(mData);
    setMotionDirty(false);
    // After motion changes, cam profile is automatically out of date
    setCamDirty(true);
  };

  // Stage 2: Cam Geometry Synthesis
  const handleUpdateCam = () => {
    if (motionData.length === 0) {
      // If user clicks update cam before generating motion, generate motion first
      const stepSize = 0.5;
      const mData = calculateMotion(segments, stepSize);
      setMotionData(mData);
      setMotionDirty(false);
      const cData = calculateCamProfile(mData, camParams);
      setCamData(cData);
    } else {
      const cData = calculateCamProfile(motionData, camParams);
      setCamData(cData);
    }
    setActiveParams({ ...camParams });
    setCamDirty(false);
  };

  // Animation Loop
  useEffect(() => {
    if (isPlaying) {
      let lastTime = performance.now();
      const animate = (time: number) => {
        const delta = time - lastTime;
        if (delta > 16) { 
          setCurrentTheta(prev => {
            const speed = 1.0; 
            const next = prev + (activeParams.rotation === 'CW' ? 1 : -1) * speed;
            if (next >= 360) return next - 360;
            if (next <= -360) return next + 360;
            return next;
          });
          lastTime = time;
        }
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    } else {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, activeParams.rotation]);

  // Mark as dirty when inputs change
  useEffect(() => {
    setMotionDirty(true);
  }, [segments]);

  useEffect(() => {
    setCamDirty(true);
  }, [camParams]);

  // Initial calculation on mount
  useEffect(() => {
    const stepSize = 0.5;
    const mData = calculateMotion(segments, stepSize);
    const cData = calculateCamProfile(mData, camParams);
    setMotionData(mData);
    setCamData(cData);
    setActiveParams({ ...camParams });
    setMotionDirty(false);
    setCamDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col font-sans">
      <header className="bg-slate-900 border-b border-slate-800 p-4 shadow-sm z-10">
        <div className="container mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Activity className="text-blue-500" size={28} />
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
              CamGenius
            </h1>
            <span className="text-slate-600 text-sm ml-2 hidden md:inline-block">Professional Cam Design & Analysis</span>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-6 h-[calc(100vh-120px)] lg:h-auto">
          <div className="flex rounded-lg bg-slate-900 p-1 border border-slate-800 shrink-0">
            <button 
              onClick={() => setActiveTab('motion')}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'motion' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Motion Profile
            </button>
            <button 
              onClick={() => setActiveTab('cam')}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'cam' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Cam Geometry
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
            {activeTab === 'motion' ? (
              <MotionDesigner 
                segments={segments} 
                onSegmentsChange={setSegments} 
                onGenerateMotion={handleGenerateMotion}
                isDirty={motionDirty}
              />
            ) : (
              <CamConfig params={camParams} onChange={setCamParams} />
            )}
            
            <PressureAngleChart data={camData} currentTheta={Math.abs(currentTheta)} />
          </div>
        </div>

        <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-6">
          <section className="space-y-4">
             <Charts data={motionData} currentTheta={Math.abs(currentTheta)} />
          </section>

          <section className="flex-1 min-h-[500px]">
             <CamVisualizer 
                data={camData} 
                params={activeParams} 
                currentTheta={currentTheta}
                isPlaying={isPlaying}
                onPlayChange={setIsPlaying}
                onThetaChange={setCurrentTheta}
                onCalculate={handleUpdateCam}
                isDirty={camDirty}
             />
          </section>
        </div>
      </main>

      <footer className="border-t border-slate-900 py-4 text-center text-slate-600 text-sm">
        <p>&copy; {new Date().getFullYear()} CamGenius. Precision Engineering Tools.</p>
      </footer>
    </div>
  );
};

export default App;