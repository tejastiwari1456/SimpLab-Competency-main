import React, { useState, useMemo } from 'react';
import {
  Eye,
  Sliders,
  Plus,
  Trash2,
  TrendingUp,
  Info,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Zap,
  Target,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Line,
  ReferenceLine,
} from 'recharts';

export interface LensTrialDataPoint {
  id: string;
  x_obj: number; // cm mark on bench
  x_lens: number; // cm mark on bench
  x_screen: number; // cm mark on bench
  u: number; // object distance (cm)
  v: number; // image distance (cm)
  inv_u: number; // 1/u (cm^-1)
  inv_v: number; // 1/v (cm^-1)
  f_calc: number; // calculated focal length (cm)
  magnification: number; // -v/u
  sharpness: number; // 0 - 100%
  isAnomalous?: boolean;
  notes?: string;
}

interface ConvexLensSimProps {
  onDataLogged?: (count: number) => void;
  isDark?: boolean;
}

export const ConvexLensSim: React.FC<ConvexLensSimProps> = ({
  onDataLogged,
  isDark = false,
}) => {
  // Nominal focal length of the biconvex lens
  const [nominalFocalLength, setNominalFocalLength] = useState<number>(15.0); // 15.0 cm default
  const [lampOn, setLampOn] = useState<boolean>(true);
  const [objectPattern, setObjectPattern] = useState<'arrow' | 'crosswire' | 'letterF'>('arrow');
  const [showRayDiagram, setShowRayDiagram] = useState<boolean>(true);
  const [addUncertainty, setAddUncertainty] = useState<boolean>(true);

  // Optical bench positions (scale 0.0 cm to 120.0 cm)
  // Initially set for u = 30.0 cm (2f) with lens at 50.0 cm, obj at 20.0 cm, screen at 80.0 cm (v = 30.0 cm)
  const [xObj, setXObj] = useState<number>(20.0); // Object upright position (cm)
  const [xLens, setXLens] = useState<number>(50.0); // Lens holder position (cm)
  const [xScreen, setXScreen] = useState<number>(80.0); // Screen position (cm)

  // Chart view tab ('uv_curve' | 'inv_uv_fit')
  const [chartTab, setChartTab] = useState<'uv_curve' | 'inv_uv_fit'>('uv_curve');

  // Observation trials history
  const [loggedTrials, setLoggedTrials] = useState<LensTrialDataPoint[]>([
    {
      id: 'trial-1',
      x_obj: 10.0,
      x_lens: 60.0,
      x_screen: 81.4,
      u: 50.0,
      v: 21.4,
      inv_u: 0.020,
      inv_v: 0.0467,
      f_calc: 14.99,
      magnification: -0.43,
      sharpness: 98,
      notes: 'u > 2f: Diminished, real, inverted',
    },
    {
      id: 'trial-2',
      x_obj: 15.0,
      x_lens: 55.0,
      x_screen: 79.1,
      u: 40.0,
      v: 24.1,
      inv_u: 0.025,
      inv_v: 0.0415,
      f_calc: 15.04,
      magnification: -0.60,
      sharpness: 97,
      notes: 'u > 2f: Real and inverted',
    },
    {
      id: 'trial-3',
      x_obj: 20.0,
      x_lens: 50.0,
      x_screen: 80.2,
      u: 30.0,
      v: 30.2,
      inv_u: 0.0333,
      inv_v: 0.0331,
      f_calc: 15.05,
      magnification: -1.01,
      sharpness: 99,
      notes: 'u ≈ 2f: Same size (m ≈ -1), real',
    },
    {
      id: 'trial-4',
      x_obj: 25.0,
      x_lens: 50.0,
      x_screen: 87.6,
      u: 25.0,
      v: 37.6,
      inv_u: 0.040,
      inv_v: 0.0266,
      f_calc: 15.02,
      magnification: -1.50,
      sharpness: 96,
      notes: 'f < u < 2f: Magnified, real, inverted',
    },
    {
      id: 'trial-5',
      x_obj: 30.0,
      x_lens: 50.0,
      x_screen: 110.1,
      u: 20.0,
      v: 60.1,
      inv_u: 0.050,
      inv_v: 0.0166,
      f_calc: 15.01,
      magnification: -3.01,
      sharpness: 95,
      notes: 'u close to f: Highly magnified',
    },
  ]);

  // Physical calculations for optical bench
  const optics = useMemo(() => {
    // Distances
    const u = parseFloat(Math.max(0.1, Math.abs(xLens - xObj)).toFixed(2)); // Object distance (cm)
    const v_screen = parseFloat(Math.max(0.1, Math.abs(xScreen - xLens)).toFixed(2)); // Screen distance (cm)

    const f = nominalFocalLength;
    const isVirtual = u < f;
    const isAtFocus = Math.abs(u - f) < 0.15;

    // True image distance from thin lens formula: 1/v = 1/f - 1/u => v_true = (u * f) / (u - f)
    let v_true = 0;
    if (!isVirtual && !isAtFocus) {
      v_true = (u * f) / (u - f);
    } else if (isVirtual) {
      v_true = -((u * f) / (f - u)); // Virtual image distance (negative)
    } else {
      v_true = 9999; // At infinity
    }

    // Add slight measurement uncertainty if enabled
    const pseudoNoise = addUncertainty ? Math.sin(xObj * 3.7 + xLens * 2.3) * 0.25 : 0;
    const v_true_meas = v_true > 0 && v_true < 500 ? v_true + pseudoNoise : v_true;

    // Ideal screen position on bench
    const idealScreenPos = xLens + v_true_meas;

    // Distance between current physical screen and the true sharp image plane
    const deltaV = Math.abs(v_screen - v_true_meas);

    // Sharpness calculation (100% when deltaV < 0.3 cm, decreasing with circle of confusion)
    let sharpness = 0;
    let blurRadius = 0; // px
    if (!lampOn) {
      sharpness = 0;
      blurRadius = 0;
    } else if (isVirtual) {
      sharpness = 0;
      blurRadius = 24;
    } else if (isAtFocus) {
      sharpness = 0;
      blurRadius = 24;
    } else {
      // Circle of confusion radius proportional to focus mismatch deltaV
      blurRadius = Math.min(22, Math.max(0.2, (deltaV / 1.4)));
      sharpness = Math.max(5, Math.round(100 / (1 + Math.pow(deltaV / 0.8, 1.8))));
    }

    const isSharp = sharpness >= 92 && !isVirtual && lampOn;

    // Magnification: m = -v_true / u
    const mag = isVirtual ? (v_true / u) : (v_true > 0 ? -(v_true / u) : 0);

    // Experimental focal length from current screen position: f_calc = (u * v_screen) / (u + v_screen)
    const f_calc = (u * v_screen) / (u + v_screen);

    // Object height (nominal 30mm)
    const h_obj = 30; // mm
    const h_img = Math.abs(mag) * h_obj; // mm

    return {
      u,
      v_screen,
      v_true: parseFloat(v_true.toFixed(2)),
      v_true_meas: parseFloat(v_true_meas.toFixed(2)),
      idealScreenPos: parseFloat(idealScreenPos.toFixed(1)),
      deltaV: parseFloat(deltaV.toFixed(2)),
      sharpness,
      blurRadius: parseFloat(blurRadius.toFixed(1)),
      isSharp,
      isVirtual,
      isAtFocus,
      mag: parseFloat(mag.toFixed(2)),
      f_calc: parseFloat(f_calc.toFixed(2)),
      h_obj,
      h_img: parseFloat(h_img.toFixed(1)),
    };
  }, [xObj, xLens, xScreen, nominalFocalLength, lampOn, addUncertainty]);

  // Summary statistics across logged trials
  const stats = useMemo(() => {
    if (loggedTrials.length === 0) {
      return { meanF: 0, stdDev: 0, errorPercent: 0, validCount: 0 };
    }
    const fValues = loggedTrials.map((t) => t.f_calc);
    const meanF = fValues.reduce((a, b) => a + b, 0) / fValues.length;
    const variance =
      fValues.reduce((sum, val) => sum + Math.pow(val - meanF, 2), 0) / fValues.length;
    const stdDev = Math.sqrt(variance);
    const errorPercent = Math.abs((meanF - nominalFocalLength) / nominalFocalLength) * 100;

    return {
      meanF: parseFloat(meanF.toFixed(2)),
      stdDev: parseFloat(stdDev.toFixed(3)),
      errorPercent: parseFloat(errorPercent.toFixed(2)),
      validCount: loggedTrials.length,
    };
  }, [loggedTrials, nominalFocalLength]);

  // Log current trial to observation table
  const handleLogTrial = () => {
    const newTrial: LensTrialDataPoint = {
      id: `trial-${Date.now()}`,
      x_obj: xObj,
      x_lens: xLens,
      x_screen: xScreen,
      u: optics.u,
      v: optics.v_screen,
      inv_u: parseFloat((1 / optics.u).toFixed(4)),
      inv_v: parseFloat((1 / optics.v_screen).toFixed(4)),
      f_calc: optics.f_calc,
      magnification: optics.mag,
      sharpness: optics.sharpness,
      isAnomalous: !optics.isSharp || Math.abs(optics.f_calc - nominalFocalLength) > 1.8,
      notes: optics.isVirtual
        ? 'Virtual image (u < f)'
        : optics.isSharp
        ? `Sharp image, m = ${optics.mag}`
        : `Blurred (Δv = ${optics.deltaV} cm)`,
    };

    setLoggedTrials((prev) => [...prev, newTrial]);
    if (onDataLogged) {
      onDataLogged(loggedTrials.length + 1);
    }
  };

  const handleRemoveTrial = (id: string) => {
    setLoggedTrials((prev) => prev.filter((t) => t.id !== id));
  };

  const handleAutoAlignScreen = () => {
    if (optics.isVirtual || optics.isAtFocus) return;
    // Auto align screen position to the sharp image plane on the bench
    const clampedPos = Math.min(120, Math.max(xLens + 5, Math.round(optics.idealScreenPos * 10) / 10));
    setXScreen(clampedPos);
  };

  const handleResetApparatus = () => {
    setXObj(20.0);
    setXLens(50.0);
    setXScreen(80.0);
  };

  // Prepare chart datasets
  const uvScatterData = useMemo(() => {
    return loggedTrials.map((t) => ({
      u: t.u,
      v: t.v,
      f: t.f_calc,
      id: t.id,
    }));
  }, [loggedTrials]);

  const invUvScatterData = useMemo(() => {
    return loggedTrials.map((t) => ({
      inv_u: t.inv_u,
      inv_v: t.inv_v,
      u: t.u,
      v: t.v,
      f: t.f_calc,
      id: t.id,
    }));
  }, [loggedTrials]);

  return (
    <div className="space-y-6">
      {/* Top Controls & Status Bar */}
      <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 shadow-xs transition-colors">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Eye className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <span>Precision Optical Bench (u-v Conjugate System)</span>
                <span className="rounded bg-amber-100 dark:bg-amber-950/70 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                  Scale: 0.0 – 120.0 cm
                </span>
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Thin Lens Formula: <code className="font-mono text-stone-800 dark:text-stone-200">1/f = 1/v - 1/u</code> &nbsp;|&nbsp; Empirical Formula: <code className="font-mono text-amber-600 dark:text-amber-400">f = (u · v) / (u + v)</code>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Lamp Toggle */}
            <button
              type="button"
              onClick={() => setLampOn(!lampOn)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-xs transition-all ${
                lampOn
                  ? 'bg-amber-500 text-stone-950 hover:bg-amber-400'
                  : 'bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-300'
              }`}
            >
              <Zap className="h-3.5 w-3.5" />
              <span>{lampOn ? 'Illuminated Object: ON' : 'Lamp: OFF'}</span>
            </button>

            {/* Lens Selector */}
            <div className="flex items-center gap-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-2.5 py-1 text-xs">
              <span className="text-stone-500 dark:text-stone-400">Nominal f:</span>
              <select
                value={nominalFocalLength}
                onChange={(e) => setNominalFocalLength(parseFloat(e.target.value))}
                className="bg-transparent font-bold text-stone-800 dark:text-stone-200 focus:outline-hidden"
              >
                <option value={15.0} className="bg-white dark:bg-stone-800">15.0 cm</option>
                <option value={20.0} className="bg-white dark:bg-stone-800">20.0 cm</option>
                <option value={12.0} className="bg-white dark:bg-stone-800">12.0 cm</option>
              </select>
            </div>

            {/* Ray Diagram Toggle */}
            <button
              type="button"
              onClick={() => setShowRayDiagram(!showRayDiagram)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                showRayDiagram
                  ? 'border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300'
                  : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-400'
              }`}
            >
              <Sparkles className="h-3 w-3" />
              <span>Ray Diagram</span>
            </button>

            {/* Auto-focus helper */}
            <button
              type="button"
              onClick={handleAutoAlignScreen}
              disabled={optics.isVirtual || optics.isAtFocus}
              className="flex items-center gap-1.5 rounded-lg bg-stone-900 dark:bg-amber-500 px-2.5 py-1.5 text-xs font-semibold text-white dark:text-stone-950 hover:bg-stone-800 dark:hover:bg-amber-400 disabled:opacity-40 transition-all shadow-xs"
              title="Automatically move screen to the conjugate image plane for sharp focus"
            >
              <Target className="h-3.5 w-3.5" />
              <span>Auto-Focus Screen</span>
            </button>

            {/* Reset */}
            <button
              type="button"
              onClick={handleResetApparatus}
              className="rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 p-1.5 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-750 transition-colors"
              title="Reset bench uprights to 2f configuration"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Real-time Optics Status Cards */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5 text-center text-xs">
          <div className="rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 p-2">
            <span className="text-[10px] text-stone-500 dark:text-stone-400 block font-medium">Object Distance (u)</span>
            <span className="text-sm font-bold text-stone-900 dark:text-stone-100 font-mono">
              {optics.u.toFixed(1)} cm
            </span>
            <span className="text-[10px] text-stone-500 dark:text-stone-400 block mt-0.5">
              |x_lens - x_obj|
            </span>
          </div>

          <div className="rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 p-2">
            <span className="text-[10px] text-stone-500 dark:text-stone-400 block font-medium">Screen Distance (v)</span>
            <span className="text-sm font-bold text-stone-900 dark:text-stone-100 font-mono">
              {optics.v_screen.toFixed(1)} cm
            </span>
            <span className="text-[10px] text-stone-500 dark:text-stone-400 block mt-0.5">
              |x_screen - x_lens|
            </span>
          </div>

          <div className="rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 p-2">
            <span className="text-[10px] text-stone-500 dark:text-stone-400 block font-medium">True Image Plane</span>
            <span className={`text-sm font-bold font-mono ${optics.isVirtual ? 'text-rose-500' : 'text-stone-900 dark:text-stone-100'}`}>
              {optics.isVirtual ? 'Virtual (v < 0)' : `${optics.v_true.toFixed(1)} cm`}
            </span>
            <span className="text-[10px] text-stone-500 dark:text-stone-400 block mt-0.5">
              Ideal mark: {optics.isVirtual ? 'Behind lens' : `${optics.idealScreenPos.toFixed(1)} cm`}
            </span>
          </div>

          <div className="rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 p-2">
            <span className="text-[10px] text-stone-500 dark:text-stone-400 block font-medium">Image Sharpness</span>
            <div className="flex items-center justify-center gap-1.5 mt-0.5">
              <div className="w-12 bg-stone-200 dark:bg-stone-700 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    optics.isSharp ? 'bg-emerald-500' : optics.sharpness > 60 ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${optics.sharpness}%` }}
                />
              </div>
              <span className={`text-xs font-bold font-mono ${optics.isSharp ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-600 dark:text-stone-400'}`}>
                {optics.sharpness}%
              </span>
            </div>
            <span className="text-[9px] text-stone-500 dark:text-stone-400 block mt-0.5">
              {optics.isSharp ? 'Sharp Focus' : `Δv = ${optics.deltaV.toFixed(1)} cm`}
            </span>
          </div>

          <div className="col-span-2 sm:col-span-1 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 p-2">
            <span className="text-[10px] text-stone-500 dark:text-stone-400 block font-medium">Calculated f</span>
            <span className="text-sm font-bold font-mono text-amber-600 dark:text-amber-400">
              {optics.isVirtual ? '—' : `${optics.f_calc.toFixed(2)} cm`}
            </span>
            <span className="text-[9px] text-stone-500 dark:text-stone-400 block mt-0.5">
              Nominal: {nominalFocalLength.toFixed(1)} cm
            </span>
          </div>
        </div>
      </div>

      {/* Main Simulation Stage: Interactive Optical Bench SVG & Screen Projection */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left/Top: Visual Optical Bench & Ray Tracer (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-900 p-4 shadow-inner text-stone-100 overflow-hidden relative">
            <div className="flex items-center justify-between border-b border-stone-800 pb-2 mb-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-semibold text-stone-200">Interactive Optical Bench Elevation & Ray Path</span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-stone-400">
                <span>Object: <strong className="text-amber-400">{xObj.toFixed(1)} cm</strong></span>
                <span>Lens: <strong className="text-cyan-400">{xLens.toFixed(1)} cm</strong></span>
                <span>Screen: <strong className="text-emerald-400">{xScreen.toFixed(1)} cm</strong></span>
              </div>
            </div>

            {/* SVG Visual Stage */}
            <div className="relative w-full h-[260px] sm:h-[300px] flex items-center justify-center select-none bg-stone-950/90 rounded-lg overflow-hidden border border-stone-800">
              <svg
                viewBox="0 0 1000 320"
                className="w-full h-full"
                preserveAspectRatio="xMidYMid meet"
              >
                <defs>
                  {/* Glowing lens gradient */}
                  <linearGradient id="lensGlass" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
                    <stop offset="50%" stopColor="#bae6fd" stopOpacity="0.75" />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.4" />
                  </linearGradient>

                  {/* Optical bench rail gradient */}
                  <linearGradient id="benchRail" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#44403c" />
                    <stop offset="50%" stopColor="#292524" />
                    <stop offset="100%" stopColor="#1c1917" />
                  </linearGradient>

                  {/* Brass upright metallic texture */}
                  <linearGradient id="brassUpright" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#b45309" />
                    <stop offset="40%" stopColor="#f59e0b" />
                    <stop offset="70%" stopColor="#d97706" />
                    <stop offset="100%" stopColor="#92400e" />
                  </linearGradient>

                  {/* Light beam gradient */}
                  <linearGradient id="beamGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.7" />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.5" />
                  </linearGradient>
                </defs>

                {/* Grid backdrop */}
                <pattern id="opticsGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#292524" strokeWidth="0.5" />
                </pattern>
                <rect width="1000" height="320" fill="url(#opticsGrid)" />

                {/* Coordinate mapping helper */}
                {/* Scale: 0 cm to 120 cm maps to SVG X: 60 to 940 (width = 880, scale = 880 / 120 = 7.33 px/cm) */}
                {(() => {
                  const toSvgX = (cm: number) => 60 + (cm / 120) * 880;
                  const yAxis = 160; // Principal axis Y coordinate

                  const svgObjX = toSvgX(xObj);
                  const svgLensX = toSvgX(xLens);
                  const svgScreenX = toSvgX(xScreen);
                  const svgF1X = toSvgX(xLens - nominalFocalLength);
                  const svgF2X = toSvgX(xLens + nominalFocalLength);
                  const svg2F1X = toSvgX(xLens - 2 * nominalFocalLength);
                  const svg2F2X = toSvgX(xLens + 2 * nominalFocalLength);
                  const svgTrueImgX = toSvgX(optics.idealScreenPos);

                  const objHeightPx = 50; // SVG object height
                  const imgHeightPx = Math.min(100, Math.max(10, Math.abs(optics.mag) * objHeightPx));

                  return (
                    <g>
                      {/* Principal Optical Axis */}
                      <line
                        x1="30"
                        y1={yAxis}
                        x2="970"
                        y2={yAxis}
                        stroke="#78716c"
                        strokeWidth="1.2"
                        strokeDasharray="8 4"
                      />
                      <text x="960" y={yAxis - 8} fill="#a8a29e" fontSize="10" fontFamily="sans-serif">
                        Axis
                      </text>

                      {/* Optical Bench Physical Rail (Bottom) */}
                      <rect x="50" y="245" width="900" height="32" rx="4" fill="url(#benchRail)" stroke="#57534e" strokeWidth="1.5" />
                      {/* Bench leveling feet */}
                      <rect x="70" y="277" width="24" height="14" rx="2" fill="#78716c" />
                      <rect x="906" y="277" width="24" height="14" rx="2" fill="#78716c" />

                      {/* Millimeter / Centimeter Scale on Bench */}
                      {Array.from({ length: 13 }).map((_, i) => {
                        const cm = i * 10;
                        const x = toSvgX(cm);
                        return (
                          <g key={cm}>
                            <line x1={x} y1="245" x2={x} y2="258" stroke="#d6d3d1" strokeWidth="1.2" />
                            <text
                              x={x}
                              y="270"
                              fill="#d6d3d1"
                              fontSize="9"
                              textAnchor="middle"
                              fontFamily="monospace"
                            >
                              {cm}
                            </text>
                            {/* Intermediate 5cm ticks */}
                            {i < 12 && (
                              <line x1={toSvgX(cm + 5)} y1="245" x2={toSvgX(cm + 5)} y2="252" stroke="#a8a29e" strokeWidth="0.8" />
                            )}
                          </g>
                        );
                      })}

                      {/* Focal point markers on principal axis */}
                      {/* F1 */}
                      <circle cx={svgF1X} cy={yAxis} r="3" fill="#38bdf8" />
                      <text x={svgF1X} y={yAxis + 14} fill="#38bdf8" fontSize="9" textAnchor="middle" fontFamily="sans-serif">
                        F₁
                      </text>
                      {/* 2F1 */}
                      {svg2F1X >= 60 && (
                        <>
                          <circle cx={svg2F1X} cy={yAxis} r="2.5" fill="#94a3b8" />
                          <text x={svg2F1X} y={yAxis + 14} fill="#94a3b8" fontSize="8" textAnchor="middle">
                            2F₁
                          </text>
                        </>
                      )}
                      {/* F2 */}
                      <circle cx={svgF2X} cy={yAxis} r="3" fill="#38bdf8" />
                      <text x={svgF2X} y={yAxis + 14} fill="#38bdf8" fontSize="9" textAnchor="middle" fontFamily="sans-serif">
                        F₂
                      </text>
                      {/* 2F2 */}
                      {svg2F2X <= 940 && (
                        <>
                          <circle cx={svg2F2X} cy={yAxis} r="2.5" fill="#94a3b8" />
                          <text x={svg2F2X} y={yAxis + 14} fill="#94a3b8" fontSize="8" textAnchor="middle">
                            2F₂
                          </text>
                        </>
                      )}

                      {/* RAY TRACING RAYS (if enabled and lamp on) */}
                      {showRayDiagram && lampOn && !optics.isVirtual && (
                        <g opacity="0.85">
                          {/* Ray 1: Top of object parallel to axis -> hits lens -> through F2 to real image */}
                          <line
                            x1={svgObjX}
                            y1={yAxis - objHeightPx}
                            x2={svgLensX}
                            y2={yAxis - objHeightPx}
                            stroke="#fbbf24"
                            strokeWidth="1.6"
                          />
                          <line
                            x1={svgLensX}
                            y1={yAxis - objHeightPx}
                            x2={svgTrueImgX}
                            y2={yAxis + imgHeightPx}
                            stroke="#fbbf24"
                            strokeWidth="1.6"
                          />

                          {/* Ray 2: Top of object straight through optical center O (undeviated) */}
                          <line
                            x1={svgObjX}
                            y1={yAxis - objHeightPx}
                            x2={svgTrueImgX}
                            y2={yAxis + imgHeightPx}
                            stroke="#38bdf8"
                            strokeWidth="1.6"
                          />

                          {/* Ray 3: Top of object through F1 -> hits lens -> emerges parallel to axis */}
                          {svgF1X > svgObjX && (
                            <>
                              <line
                                x1={svgObjX}
                                y1={yAxis - objHeightPx}
                                x2={svgLensX}
                                y2={yAxis + imgHeightPx}
                                stroke="#34d399"
                                strokeWidth="1.6"
                              />
                              <line
                                x1={svgLensX}
                                y1={yAxis + imgHeightPx}
                                x2={svgTrueImgX}
                                y2={yAxis + imgHeightPx}
                                stroke="#34d399"
                                strokeWidth="1.6"
                              />
                            </>
                          )}

                          {/* True Focus Spot Marker */}
                          <circle
                            cx={svgTrueImgX}
                            cy={yAxis + imgHeightPx}
                            r="4"
                            fill="#fbbf24"
                            className="animate-ping"
                            opacity="0.6"
                          />
                        </g>
                      )}

                      {/* RAY TRACING FOR VIRTUAL IMAGE (u < f) */}
                      {showRayDiagram && lampOn && optics.isVirtual && (
                        <g opacity="0.8">
                          {/* Diverging real rays forward */}
                          <line
                            x1={svgObjX}
                            y1={yAxis - objHeightPx}
                            x2={svgLensX}
                            y2={yAxis - objHeightPx}
                            stroke="#fbbf24"
                            strokeWidth="1.5"
                          />
                          <line
                            x1={svgLensX}
                            y1={yAxis - objHeightPx}
                            x2={svgLensX + 240}
                            y2={yAxis + 60}
                            stroke="#fbbf24"
                            strokeWidth="1.5"
                          />
                          {/* Back-projected virtual ray */}
                          <line
                            x1={svgLensX}
                            y1={yAxis - objHeightPx}
                            x2={toSvgX(Math.max(0, xLens - Math.abs(optics.v_true)))}
                            y2={yAxis - objHeightPx * Math.abs(optics.mag)}
                            stroke="#fbbf24"
                            strokeWidth="1.2"
                            strokeDasharray="4 3"
                          />
                          {/* Central ray undeviated */}
                          <line
                            x1={svgObjX}
                            y1={yAxis - objHeightPx}
                            x2={svgLensX + 240}
                            y2={yAxis + 90}
                            stroke="#38bdf8"
                            strokeWidth="1.5"
                          />
                        </g>
                      )}

                      {/* --- UPRIGHT 1: ILLUMINATED OBJECT --- */}
                      <g>
                        {/* Bench rider slider */}
                        <rect x={svgObjX - 12} y="235" width="24" height="15" rx="2" fill="url(#brassUpright)" stroke="#78350f" />
                        <line x1={svgObjX} y1="245" x2={svgObjX} y2="256" stroke="#fbbf24" strokeWidth="1.5" />
                        <polygon points={`${svgObjX},245 ${svgObjX - 4},240 ${svgObjX + 4},240`} fill="#fbbf24" />

                        {/* Upright stem */}
                        <line x1={svgObjX} y1={yAxis} x2={svgObjX} y2="235" stroke="#a8a29e" strokeWidth="4" strokeLinecap="round" />

                        {/* Lamp housing / Illuminated Object box */}
                        <rect
                          x={svgObjX - 16}
                          y={yAxis - objHeightPx - 10}
                          width="32"
                          height={objHeightPx + 20}
                          rx="3"
                          fill="#1c1917"
                          stroke={lampOn ? '#fbbf24' : '#57534e'}
                          strokeWidth="1.5"
                        />

                        {/* Illuminated Glowing Arrow (Object) */}
                        <g>
                          <line
                            x1={svgObjX}
                            y1={yAxis}
                            x2={svgObjX}
                            y2={yAxis - objHeightPx}
                            stroke={lampOn ? '#fbbf24' : '#78716c'}
                            strokeWidth="3.5"
                            strokeLinecap="round"
                          />
                          <polygon
                            points={`${svgObjX},${yAxis - objHeightPx - 6} ${svgObjX - 6},${yAxis - objHeightPx + 4} ${svgObjX + 6},${yAxis - objHeightPx + 4}`}
                            fill={lampOn ? '#fbbf24' : '#78716c'}
                          />
                          {lampOn && (
                            <circle cx={svgObjX} cy={yAxis - objHeightPx} r="9" fill="#fbbf24" opacity="0.35" className="animate-pulse" />
                          )}
                        </g>

                        <text x={svgObjX} y="228" fill="#fbbf24" fontSize="10" textAnchor="middle" fontWeight="bold">
                          Object
                        </text>
                      </g>

                      {/* --- UPRIGHT 2: CONVEX LENS HOLDER --- */}
                      <g>
                        {/* Bench rider slider */}
                        <rect x={svgLensX - 14} y="235" width="28" height="15" rx="2" fill="url(#brassUpright)" stroke="#78350f" />
                        <line x1={svgLensX} y1="245" x2={svgLensX} y2="256" stroke="#38bdf8" strokeWidth="1.5" />
                        <polygon points={`${svgLensX},245 ${svgLensX - 4},240 ${svgLensX + 4},240`} fill="#38bdf8" />

                        {/* Upright stem */}
                        <line x1={svgLensX} y1={yAxis + 70} x2={svgLensX} y2="235" stroke="#a8a29e" strokeWidth="5" strokeLinecap="round" />

                        {/* Circular Lens Frame */}
                        <circle cx={svgLensX} cy={yAxis} r="58" fill="none" stroke="#64748b" strokeWidth="3" />

                        {/* Biconvex Lens Glass Profile */}
                        <path
                          d={`M ${svgLensX} ${yAxis - 54} Q ${svgLensX + 16} ${yAxis} ${svgLensX} ${yAxis + 54} Q ${svgLensX - 16} ${yAxis} ${svgLensX} ${yAxis - 54} Z`}
                          fill="url(#lensGlass)"
                          stroke="#38bdf8"
                          strokeWidth="1.5"
                        />

                        {/* Optical Center indicator */}
                        <circle cx={svgLensX} cy={yAxis} r="2" fill="#0284c7" />

                        <text x={svgLensX} y="228" fill="#38bdf8" fontSize="10" textAnchor="middle" fontWeight="bold">
                          Convex Lens (f={nominalFocalLength}cm)
                        </text>
                      </g>

                      {/* --- UPRIGHT 3: PROJECTION SCREEN --- */}
                      <g>
                        {/* Bench rider slider */}
                        <rect x={svgScreenX - 12} y="235" width="24" height="15" rx="2" fill="url(#brassUpright)" stroke="#78350f" />
                        <line x1={svgScreenX} y1="245" x2={svgScreenX} y2="256" stroke="#34d399" strokeWidth="1.5" />
                        <polygon points={`${svgScreenX},245 ${svgScreenX - 4},240 ${svgScreenX + 4},240`} fill="#34d399" />

                        {/* Upright stem */}
                        <line x1={svgScreenX} y1={yAxis + 70} x2={svgScreenX} y2="235" stroke="#a8a29e" strokeWidth="4" strokeLinecap="round" />

                        {/* White screen plate */}
                        <rect
                          x={svgScreenX - 4}
                          y={yAxis - 70}
                          width="8"
                          height="140"
                          rx="2"
                          fill="#f8fafc"
                          stroke={optics.isSharp ? '#10b981' : '#64748b'}
                          strokeWidth={optics.isSharp ? '2.5' : '1.5'}
                        />

                        {/* Projected image indication on side profile */}
                        {lampOn && !optics.isVirtual && (
                          <line
                            x1={svgScreenX + 4}
                            y1={yAxis}
                            x2={svgScreenX + 4}
                            y2={yAxis + imgHeightPx}
                            stroke={optics.isSharp ? '#10b981' : '#94a3b8'}
                            strokeWidth="3"
                            strokeDasharray={optics.isSharp ? 'none' : '3 2'}
                          />
                        )}

                        <text x={svgScreenX} y="228" fill="#34d399" fontSize="10" textAnchor="middle" fontWeight="bold">
                          Screen
                        </text>
                      </g>
                    </g>
                  );
                })()}
              </svg>
            </div>

            {/* Slider Controls for Independent Upright Positioning */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-stone-800">
              {/* Object Position Slider */}
              <div className="space-y-1.5 bg-stone-850 p-3 rounded-xl border border-stone-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-amber-400">1. Object Mark (x_obj)</span>
                  <span className="font-mono font-bold bg-stone-800 px-2 py-0.5 rounded text-amber-300">
                    {xObj.toFixed(1)} cm
                  </span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max={Math.max(0, xLens - 5)}
                  step="0.5"
                  value={xObj}
                  onChange={(e) => setXObj(parseFloat(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="flex items-center justify-between text-[10px] text-stone-400">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setXObj((prev) => Math.max(0, parseFloat((prev - 1).toFixed(1))))}
                      className="px-1.5 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300"
                    >
                      -1 cm
                    </button>
                    <button
                      type="button"
                      onClick={() => setXObj((prev) => Math.max(0, parseFloat((prev - 0.1).toFixed(1))))}
                      className="px-1.5 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300"
                    >
                      -0.1
                    </button>
                  </div>
                  <span className="text-stone-400">u = {optics.u.toFixed(1)} cm</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setXObj((prev) => Math.min(xLens - 5, parseFloat((prev + 0.1).toFixed(1))))}
                      className="px-1.5 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300"
                    >
                      +0.1
                    </button>
                    <button
                      type="button"
                      onClick={() => setXObj((prev) => Math.min(xLens - 5, parseFloat((prev + 1).toFixed(1))))}
                      className="px-1.5 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300"
                    >
                      +1 cm
                    </button>
                  </div>
                </div>
              </div>

              {/* Lens Position Slider */}
              <div className="space-y-1.5 bg-stone-850 p-3 rounded-xl border border-stone-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-cyan-400">2. Lens Mark (x_lens)</span>
                  <span className="font-mono font-bold bg-stone-800 px-2 py-0.5 rounded text-cyan-300">
                    {xLens.toFixed(1)} cm
                  </span>
                </div>
                <input
                  type="range"
                  min={xObj + 5}
                  max={Math.min(115, xScreen - 5)}
                  step="0.5"
                  value={xLens}
                  onChange={(e) => setXLens(parseFloat(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
                <div className="flex items-center justify-between text-[10px] text-stone-400">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setXLens((prev) => Math.max(xObj + 5, parseFloat((prev - 1).toFixed(1))))}
                      className="px-1.5 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300"
                    >
                      -1 cm
                    </button>
                    <button
                      type="button"
                      onClick={() => setXLens((prev) => Math.max(xObj + 5, parseFloat((prev - 0.1).toFixed(1))))}
                      className="px-1.5 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300"
                    >
                      -0.1
                    </button>
                  </div>
                  <span className="text-stone-400">Fixed/Movable</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setXLens((prev) => Math.min(xScreen - 5, parseFloat((prev + 0.1).toFixed(1))))}
                      className="px-1.5 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300"
                    >
                      +0.1
                    </button>
                    <button
                      type="button"
                      onClick={() => setXLens((prev) => Math.min(xScreen - 5, parseFloat((prev + 1).toFixed(1))))}
                      className="px-1.5 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300"
                    >
                      +1 cm
                    </button>
                  </div>
                </div>
              </div>

              {/* Screen Position Slider */}
              <div className="space-y-1.5 bg-stone-850 p-3 rounded-xl border border-stone-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-400">3. Screen Mark (x_screen)</span>
                  <span className="font-mono font-bold bg-stone-800 px-2 py-0.5 rounded text-emerald-300">
                    {xScreen.toFixed(1)} cm
                  </span>
                </div>
                <input
                  type="range"
                  min={xLens + 5}
                  max="120.0"
                  step="0.2"
                  value={xScreen}
                  onChange={(e) => setXScreen(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <div className="flex items-center justify-between text-[10px] text-stone-400">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setXScreen((prev) => Math.max(xLens + 5, parseFloat((prev - 1).toFixed(1))))}
                      className="px-1.5 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300"
                    >
                      -1 cm
                    </button>
                    <button
                      type="button"
                      onClick={() => setXScreen((prev) => Math.max(xLens + 5, parseFloat((prev - 0.1).toFixed(1))))}
                      className="px-1.5 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300"
                    >
                      -0.1
                    </button>
                  </div>
                  <span className="text-stone-400">v = {optics.v_screen.toFixed(1)} cm</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setXScreen((prev) => Math.min(120, parseFloat((prev + 0.1).toFixed(1))))}
                      className="px-1.5 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300"
                    >
                      +0.1
                    </button>
                    <button
                      type="button"
                      onClick={() => setXScreen((prev) => Math.min(120, parseFloat((prev + 1).toFixed(1))))}
                      className="px-1.5 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300"
                    >
                      +1 cm
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Realistic Projected Screen View & Trial Logger (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 shadow-xs transition-colors">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-emerald-500" />
                <h3 className="text-xs font-bold text-stone-900 dark:text-stone-100">
                  Projection Screen View
                </h3>
              </div>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                optics.isSharp
                  ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                  : 'bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
              }`}>
                {optics.isSharp ? 'Sharp Real Image' : 'Defocussed'}
              </span>
            </div>

            {/* Simulated Frosted Glass Screen Box */}
            <div className="relative h-56 w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-950 p-3 overflow-hidden flex flex-col items-center justify-center select-none shadow-inner">
              {/* Millimeter grid overlay */}
              <div
                className="absolute inset-0 opacity-15 pointer-events-none"
                style={{
                  backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
                  backgroundSize: '16px 16px',
                }}
              />

              {/* Crosshair reference center */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                <div className="w-full h-px bg-white" />
                <div className="h-full w-px bg-white absolute" />
              </div>

              {/* Physical Optical Image Projection */}
              {!lampOn ? (
                <div className="text-center text-stone-600 text-xs">
                  <Zap className="h-6 w-6 mx-auto mb-1 opacity-30" />
                  <span>Object lamp is turned OFF</span>
                </div>
              ) : optics.isVirtual ? (
                <div className="p-3 text-center text-rose-400 bg-rose-950/40 rounded-xl border border-rose-900/60 max-w-[85%]">
                  <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-rose-400" />
                  <p className="text-[11px] font-bold">Virtual Image (u &lt; f)</p>
                  <p className="text-[10px] text-rose-300 mt-1 leading-snug">
                    Rays diverge after refraction. Virtual, erect image formed behind lens; cannot be formed on a physical screen.
                  </p>
                </div>
              ) : optics.isAtFocus ? (
                <div className="text-center text-amber-400 text-xs">
                  <Info className="h-5 w-5 mx-auto mb-1 opacity-60" />
                  <span>Object at Focus (u = f)</span>
                  <p className="text-[10px] text-stone-400">Refracted rays emerge parallel (image at infinity)</p>
                </div>
              ) : (
                <div className="relative flex items-center justify-center">
                  {/* Projected inverted arrow with dynamic blur filter and scaling */}
                  <div
                    style={{
                      transform: 'rotate(180deg)',
                      filter: `blur(${optics.blurRadius}px)`,
                      transition: 'filter 0.15s ease-out, transform 0.15s ease-out',
                      opacity: Math.max(0.35, 1 - optics.blurRadius * 0.03),
                    }}
                    className="flex flex-col items-center"
                  >
                    {/* SVG Inverted Glowing Arrow */}
                    <svg
                      width={Math.max(24, Math.min(120, 24 * Math.abs(optics.mag)))}
                      height={Math.max(40, Math.min(160, 44 * Math.abs(optics.mag)))}
                      viewBox="0 0 40 80"
                    >
                      <line
                        x1="20"
                        y1="75"
                        x2="20"
                        y2="15"
                        stroke="#fbbf24"
                        strokeWidth="6"
                        strokeLinecap="round"
                      />
                      <polygon points="20,5 5,28 35,28" fill="#fbbf24" />
                      {/* Cross wire overlay on object */}
                      <circle cx="20" cy="40" r="12" fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray="2 2" />
                    </svg>
                  </div>
                </div>
              )}

              {/* Bottom Sharpness overlay bar */}
              <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[10px] text-stone-400 bg-stone-900/80 px-2 py-1 rounded border border-stone-800 backdrop-blur-xs">
                <span>Mag: <strong>{optics.isVirtual ? 'Virtual' : `${optics.mag}x`}</strong></span>
                <span>Blur: <strong>{optics.blurRadius}px</strong></span>
                <span className={optics.isSharp ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                  {optics.sharpness}% Focus
                </span>
              </div>
            </div>

            {/* Trial Logger Action */}
            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={handleLogTrial}
                disabled={!lampOn || optics.isVirtual}
                className={`w-full flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-xs font-bold transition-all shadow-xs ${
                  optics.isSharp
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-400/40 animate-pulse'
                    : 'bg-stone-900 dark:bg-amber-500 hover:bg-stone-800 dark:hover:bg-amber-400 text-white dark:text-stone-950 disabled:opacity-50'
                }`}
              >
                <Plus className="h-4 w-4" />
                <span>
                  {optics.isSharp ? 'Log Sharp Image Reading' : 'Log Current Trial (u, v)'}
                </span>
              </button>

              {!optics.isSharp && lampOn && !optics.isVirtual && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400 text-center">
                  Notice: Image is currently blurred (Δv = {optics.deltaV.toFixed(1)} cm). Adjust screen to ~{optics.idealScreenPos.toFixed(1)} cm or click "Auto-Focus Screen".
                </p>
              )}
            </div>
          </div>

          {/* Quick Statistics Summary Card */}
          <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 shadow-xs transition-colors text-xs space-y-2.5">
            <h4 className="font-bold text-stone-900 dark:text-stone-100 flex items-center justify-between">
              <span>Focal Length Synthesis</span>
              <span className="text-[10px] font-mono text-stone-500 dark:text-stone-400">
                {stats.validCount} Trials Recorded
              </span>
            </h4>

            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-stone-50 dark:bg-stone-850 p-2 rounded-lg border border-stone-200 dark:border-stone-800">
                <span className="text-[10px] text-stone-500 dark:text-stone-400 block">Mean Focal Length (f̄)</span>
                <span className="text-sm font-bold font-mono text-stone-900 dark:text-stone-100">
                  {stats.meanF.toFixed(2)} cm
                </span>
              </div>

              <div className="bg-stone-50 dark:bg-stone-850 p-2 rounded-lg border border-stone-200 dark:border-stone-800">
                <span className="text-[10px] text-stone-500 dark:text-stone-400 block">Standard Dev (σ)</span>
                <span className="text-sm font-bold font-mono text-stone-900 dark:text-stone-100">
                  ±{stats.stdDev.toFixed(3)} cm
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 text-[11px] text-stone-600 dark:text-stone-400">
              <span>Nominal Value: <strong>{nominalFocalLength.toFixed(1)} cm</strong></span>
              <span>Error Margin: <strong className={stats.errorPercent < 2 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>{stats.errorPercent}%</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Observation Table & Graphs Section */}
      <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 shadow-xs transition-colors">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 dark:border-stone-800 pb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              Experimental Observation Table & Graphical Analysis
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {/* Chart tab switcher */}
            <div className="flex rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-100 dark:bg-stone-800 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setChartTab('uv_curve')}
                className={`rounded-md px-2.5 py-1 font-semibold transition-all ${
                  chartTab === 'uv_curve'
                    ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                }`}
              >
                u-v Hyperbola Curve
              </button>
              <button
                type="button"
                onClick={() => setChartTab('inv_uv_fit')}
                className={`rounded-md px-2.5 py-1 font-semibold transition-all ${
                  chartTab === 'inv_uv_fit'
                    ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                }`}
              >
                1/v vs 1/u Linear Fit
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-4">
          {/* Observation Table (7 cols) */}
          <div className="lg:col-span-7 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850/60 text-stone-600 dark:text-stone-400 font-semibold">
                  <th className="py-2 px-2">#</th>
                  <th className="py-2 px-2 font-mono">u (cm)</th>
                  <th className="py-2 px-2 font-mono">v (cm)</th>
                  <th className="py-2 px-2 font-mono">1/u (cm⁻¹)</th>
                  <th className="py-2 px-2 font-mono">1/v (cm⁻¹)</th>
                  <th className="py-2 px-2 font-mono">f = uv/(u+v)</th>
                  <th className="py-2 px-2">Focus</th>
                  <th className="py-2 px-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {loggedTrials.map((t, idx) => (
                  <tr
                    key={t.id}
                    className={`hover:bg-stone-50/80 dark:hover:bg-stone-800/50 transition-colors ${
                      t.isAnomalous ? 'bg-amber-50/30 dark:bg-amber-950/20' : ''
                    }`}
                  >
                    <td className="py-2.5 px-2 font-bold text-stone-500 dark:text-stone-400">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-2 font-mono font-bold text-stone-900 dark:text-stone-100">
                      {t.u.toFixed(1)}
                    </td>
                    <td className="py-2.5 px-2 font-mono font-bold text-stone-900 dark:text-stone-100">
                      {t.v.toFixed(1)}
                    </td>
                    <td className="py-2.5 px-2 font-mono text-stone-600 dark:text-stone-300">
                      {t.inv_u.toFixed(4)}
                    </td>
                    <td className="py-2.5 px-2 font-mono text-stone-600 dark:text-stone-300">
                      {t.inv_v.toFixed(4)}
                    </td>
                    <td className="py-2.5 px-2 font-mono font-bold text-amber-600 dark:text-amber-400">
                      {t.f_calc.toFixed(2)} cm
                    </td>
                    <td className="py-2.5 px-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          t.sharpness >= 90
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        {t.sharpness}%
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemoveTrial(t.id)}
                        className="p-1 rounded text-stone-400 hover:text-rose-500 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                        title="Delete trial row"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Interactive Recharts Graph (5 cols) */}
          <div className="lg:col-span-5 flex flex-col justify-between rounded-xl border border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-850/40 p-3">
            <div className="text-xs mb-2">
              <span className="font-bold text-stone-900 dark:text-stone-100">
                {chartTab === 'uv_curve' ? 'Rectangular Hyperbola (u vs v)' : 'Linear Relation: 1/v vs 1/u'}
              </span>
              <p className="text-[10px] text-stone-500 dark:text-stone-400">
                {chartTab === 'uv_curve'
                  ? `Symmetric at u = v = 2f (${(2 * nominalFocalLength).toFixed(0)} cm)`
                  : `Intercepts at 1/f = ${(1 / nominalFocalLength).toFixed(4)} cm⁻¹ with slope = -1`}
              </p>
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {chartTab === 'uv_curve' ? (
                  <ScatterChart margin={{ top: 10, right: 15, bottom: 20, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#333' : '#e5e7eb'} />
                    <XAxis
                      type="number"
                      dataKey="u"
                      name="Object Distance (u)"
                      unit=" cm"
                      domain={[15, 65]}
                      tick={{ fill: isDark ? '#a8a29e' : '#78716c', fontSize: 10 }}
                      label={{ value: 'u (cm)', position: 'insideBottom', offset: -10, fill: isDark ? '#a8a29e' : '#78716c', fontSize: 11 }}
                    />
                    <YAxis
                      type="number"
                      dataKey="v"
                      name="Image Distance (v)"
                      unit=" cm"
                      domain={[15, 75]}
                      tick={{ fill: isDark ? '#a8a29e' : '#78716c', fontSize: 10 }}
                      label={{ value: 'v (cm)', angle: -90, position: 'insideLeft', fill: isDark ? '#a8a29e' : '#78716c', fontSize: 11 }}
                    />
                    <Tooltip
                      cursor={{ strokeDasharray: '3 3' }}
                      contentStyle={{
                        backgroundColor: isDark ? '#1c1917' : '#ffffff',
                        borderColor: isDark ? '#44403c' : '#e5e7eb',
                        borderRadius: '0.5rem',
                        fontSize: '11px',
                      }}
                    />
                    {/* Reference 2f lines */}
                    <ReferenceLine x={2 * nominalFocalLength} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'u=2f', fill: '#f59e0b', fontSize: 9 }} />
                    <ReferenceLine y={2 * nominalFocalLength} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'v=2f', fill: '#f59e0b', fontSize: 9 }} />
                    <Scatter
                      name="Trials"
                      data={uvScatterData}
                      fill="#38bdf8"
                      line={{ stroke: '#0284c7', strokeWidth: 1.5 }}
                    />
                  </ScatterChart>
                ) : (
                  <ScatterChart margin={{ top: 10, right: 15, bottom: 20, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#333' : '#e5e7eb'} />
                    <XAxis
                      type="number"
                      dataKey="inv_u"
                      name="1/u"
                      unit=" cm⁻¹"
                      domain={[0, 0.08]}
                      tick={{ fill: isDark ? '#a8a29e' : '#78716c', fontSize: 10 }}
                      label={{ value: '1/u (cm⁻¹)', position: 'insideBottom', offset: -10, fill: isDark ? '#a8a29e' : '#78716c', fontSize: 11 }}
                    />
                    <YAxis
                      type="number"
                      dataKey="inv_v"
                      name="1/v"
                      unit=" cm⁻¹"
                      domain={[0, 0.08]}
                      tick={{ fill: isDark ? '#a8a29e' : '#78716c', fontSize: 10 }}
                      label={{ value: '1/v (cm⁻¹)', angle: -90, position: 'insideLeft', fill: isDark ? '#a8a29e' : '#78716c', fontSize: 11 }}
                    />
                    <Tooltip
                      cursor={{ strokeDasharray: '3 3' }}
                      contentStyle={{
                        backgroundColor: isDark ? '#1c1917' : '#ffffff',
                        borderColor: isDark ? '#44403c' : '#e5e7eb',
                        borderRadius: '0.5rem',
                        fontSize: '11px',
                      }}
                    />
                    {/* Intercept reference line */}
                    <ReferenceLine x={1 / nominalFocalLength} stroke="#10b981" strokeDasharray="3 3" label={{ value: '1/f', fill: '#10b981', fontSize: 9 }} />
                    <ReferenceLine y={1 / nominalFocalLength} stroke="#10b981" strokeDasharray="3 3" label={{ value: '1/f', fill: '#10b981', fontSize: 9 }} />
                    <Scatter
                      name="Trials (1/v vs 1/u)"
                      data={invUvScatterData}
                      fill="#10b981"
                      line={{ stroke: '#059669', strokeWidth: 1.5 }}
                    />
                  </ScatterChart>
                )}
              </ResponsiveContainer>
            </div>

            <div className="mt-2 text-[10px] text-stone-500 dark:text-stone-400 text-center">
              Points show empirical trials logged by student. Curve fits demonstrate lens formula fidelity.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
