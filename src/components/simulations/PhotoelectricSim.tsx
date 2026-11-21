import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Sun,
  Sliders,
  Plus,
  Trash2,
  TrendingUp,
  Info,
  CheckCircle2,
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
} from 'recharts';

export interface PhotoelectricDataPoint {
  id: string;
  wavelengthNm: number;
  frequencyTHz: number; // 10^14 Hz
  stoppingPotentialV0: number; // Volts
  photocurrentNA: number;
  cathode: string;
}

interface PhotoelectricSimProps {
  onDataLogged?: (count: number) => void;
  isDark?: boolean;
}

export const PhotoelectricSim: React.FC<PhotoelectricSimProps> = ({ onDataLogged, isDark = false }) => {
  // Physical constants
  const h_planck = 6.626e-34; // J*s
  const e_charge = 1.602e-19; // C
  const c_speed = 3.0e8; // m/s

  // Cathode work functions in eV
  const cathodeMaterials = [
    { name: 'Cesium (Cs)', workFunctionEV: 2.14, thresholdLambdaNm: 580 },
    { name: 'Potassium (K)', workFunctionEV: 2.30, thresholdLambdaNm: 540 },
    { name: 'Sodium (Na)', workFunctionEV: 2.36, thresholdLambdaNm: 525 },
  ];

  // Apparatus state
  const [selectedCathodeIndex, setSelectedCathodeIndex] = useState<number>(0);
  const [wavelengthNm, setWavelengthNm] = useState<number>(436); // e.g., Mercury Violet line
  const [intensityPercent, setIntensityPercent] = useState<number>(60);
  const [retardingVoltage, setRetardingVoltage] = useState<number>(-1.5); // -4.0V to +2.0V

  const currentCathode = cathodeMaterials[selectedCathodeIndex];

  // Logged observation points
  const [loggedPoints, setLoggedPoints] = useState<PhotoelectricDataPoint[]>([
    { id: 'pe-1', wavelengthNm: 365, frequencyTHz: 8.22, stoppingPotentialV0: 1.26, photocurrentNA: 0.0, cathode: 'Cesium (Cs)' },
    { id: 'pe-2', wavelengthNm: 404, frequencyTHz: 7.43, stoppingPotentialV0: 0.93, photocurrentNA: 0.0, cathode: 'Cesium (Cs)' },
    { id: 'pe-3', wavelengthNm: 436, frequencyTHz: 6.88, stoppingPotentialV0: 0.70, photocurrentNA: 0.0, cathode: 'Cesium (Cs)' },
    { id: 'pe-4', wavelengthNm: 546, frequencyTHz: 5.49, stoppingPotentialV0: 0.13, photocurrentNA: 0.0, cathode: 'Cesium (Cs)' },
  ]);

  // Physical calculations
  const physicsState = useMemo(() => {
    const freqHz = (c_speed / (wavelengthNm * 1e-9));
    const freqTHz = parseFloat((freqHz / 1e14).toFixed(2)); // e.g. 6.88 x 10^14 Hz
    const photonEnergyJ = h_planck * freqHz;
    const photonEnergyEV = photonEnergyJ / e_charge; // eV

    const workFunctionEV = currentCathode.workFunctionEV;
    const maxKeEV = photonEnergyEV - workFunctionEV;

    // True stopping potential (retarding voltage where KE_max is arrested)
    const trueV0 = maxKeEV > 0 ? parseFloat(maxKeEV.toFixed(2)) : 0.0;

    // Beam color representation
    let beamColorHex = '#38bdf8'; // Sky blue default
    if (wavelengthNm < 400) beamColorHex = '#a855f7'; // UV / Violet
    else if (wavelengthNm < 450) beamColorHex = '#6366f1'; // Indigo
    else if (wavelengthNm < 500) beamColorHex = '#0ea5e9'; // Cyan
    else if (wavelengthNm < 570) beamColorHex = '#22c55e'; // Green
    else if (wavelengthNm < 620) beamColorHex = '#eab308'; // Yellow
    else beamColorHex = '#ef4444'; // Red

    // Current calculation based on voltage
    let photocurrent = 0;
    if (maxKeEV > 0) {
      // Saturation current scales with intensity
      const satCurrentNA = (intensityPercent / 100) * 8.5;

      if (retardingVoltage >= trueV0) {
        // Forward biased or insufficient retarding: current flows
        photocurrent = satCurrentNA;
      } else if (retardingVoltage > -0.05 && retardingVoltage < trueV0) {
        // Partial arrest
        const fraction = Math.max(0, (retardingVoltage + 0.1) / (trueV0 + 0.1));
        photocurrent = satCurrentNA * Math.pow(fraction, 1.5);
      } else {
        // Reverse voltage exceeds or equals stopping potential: Zero current!
        photocurrent = 0.0;
      }
    }

    return {
      freqTHz,
      photonEnergyEV: parseFloat(photonEnergyEV.toFixed(2)),
      trueV0,
      emittedCurrentNA: parseFloat(photocurrent.toFixed(2)),
      isEmitting: maxKeEV > 0,
      beamColorHex,
    };
  }, [wavelengthNm, intensityPercent, retardingVoltage, currentCathode]);

  // Linear regression of V0 vs Frequency
  const regressionResults = useMemo(() => {
    if (loggedPoints.length < 2) return { h: 0, workFunction: 0, rSquared: 0, isValid: false };

    const n = loggedPoints.length;
    let sumF = 0; // Frequency in 10^14 Hz
    let sumV = 0; // V0
    let sumFV = 0;
    let sumFF = 0;
    let sumVV = 0;

    loggedPoints.forEach((pt) => {
      sumF += pt.frequencyTHz;
      sumV += pt.stoppingPotentialV0;
      sumFV += pt.frequencyTHz * pt.stoppingPotentialV0;
      sumFF += pt.frequencyTHz * pt.frequencyTHz;
      sumVV += pt.stoppingPotentialV0 * pt.stoppingPotentialV0;
    });

    const denom = n * sumFF - sumF * sumF;
    if (Math.abs(denom) < 1e-9) return { h: 0, workFunction: 0, rSquared: 0, isValid: false };

    const slope = (n * sumFV - sumF * sumV) / denom; // V / (10^14 Hz)
    const intercept = (sumV - slope * sumF) / n;

    // h = e * slope = 1.602e-19 * (slope * 1e-14) in J*s
    const calcH = (1.602e-19 * slope * 1e-14) * 1e34; // in units of 10^-34 J*s
    const calcPhi = -intercept; // in eV

    const rNumerator = n * sumFV - sumF * sumV;
    const rDenom = (n * sumFF - sumF * sumF) * (n * sumVV - sumV * sumV);
    const rSquared = rDenom > 0 ? (rNumerator * rNumerator) / rDenom : 0;

    return {
      h: parseFloat(calcH.toFixed(2)),
      workFunction: parseFloat(calcPhi.toFixed(2)),
      rSquared: parseFloat(rSquared.toFixed(3)),
      isValid: true,
    };
  }, [loggedPoints]);

  const handleLogData = () => {
    const newPoint: PhotoelectricDataPoint = {
      id: `pe-${Date.now()}`,
      wavelengthNm,
      frequencyTHz: physicsState.freqTHz,
      stoppingPotentialV0: physicsState.trueV0,
      photocurrentNA: physicsState.emittedCurrentNA,
      cathode: currentCathode.name,
    };

    const updated = [...loggedPoints, newPoint];
    setLoggedPoints(updated);
    if (onDataLogged) onDataLogged(updated.length);
  };

  return (
    <div className="space-y-6">
      {/* Simulation Header */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs md:flex-row md:items-center transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-cyan-50 dark:bg-cyan-950/70 px-2 py-0.5 text-xs font-semibold text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/60">
              <Sparkles className="h-3 w-3 text-cyan-600 dark:text-cyan-400" />
              Quantum & Modern Physics
            </span>
            <span className="text-xs text-stone-600 dark:text-stone-400">Quantum Bench #03</span>
          </div>
          <h2 className="mt-1 text-lg font-bold text-stone-900 dark:text-stone-100">
            Photoelectric Effect & Planck’s Constant (h)
          </h2>
          <p className="text-xs text-stone-600 dark:text-stone-300">
            Illuminate photocathodes with monochromatic wavelengths, determine stopping potentials, and extract Planck’s quantum constant.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 px-3 py-1.5 text-center transition-colors">
            <span className="block text-[11px] text-stone-600 dark:text-stone-400">Cathode Material</span>
            <span className="text-sm font-bold text-stone-900 dark:text-stone-100">{currentCathode.name}</span>
          </div>
          <div className="rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 px-3 py-1.5 text-center transition-colors">
            <span className="block text-[11px] text-stone-600 dark:text-stone-400">Work Function (Φ)</span>
            <span className="text-sm font-bold text-stone-900 dark:text-stone-100">{currentCathode.workFunctionEV} eV</span>
          </div>
          <div className="rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 px-3 py-1.5 text-center transition-colors">
            <span className="block text-[11px] text-stone-600 dark:text-stone-400">Photon Energy (hf)</span>
            <span className="text-sm font-bold text-cyan-700 dark:text-cyan-400">{physicsState.photonEnergyEV} eV</span>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Optics Chamber & Picoammeter (7 cols) */}
        <div className="space-y-6 lg:col-span-7">
          {/* Phototube Visual Chamber */}
          <div className="relative rounded-2xl border border-stone-300 dark:border-stone-800 bg-gradient-to-b from-stone-900 to-stone-950 p-6 text-white shadow-md">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                Vacuum Phototube Chamber
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    physicsState.isEmitting ? 'bg-cyan-400 shadow-[0_0_8px_#38bdf8]' : 'bg-stone-600'
                  }`}
                />
                <span className="text-xs font-mono text-stone-400">
                  {physicsState.isEmitting ? 'PHOTO-EMISSION ACTIVE' : 'BELOW THRESHOLD (NO EMISSION)'}
                </span>
              </div>
            </div>

            {/* Chamber Graphic */}
            <div className="mt-5 flex flex-col items-center justify-center rounded-xl border border-stone-800 bg-black/50 p-6">
              {/* Photon Light Beam Projection */}
              <div className="relative flex w-full items-center justify-between">
                {/* Light Source Aperture */}
                <div className="flex flex-col items-center">
                  <div
                    className="h-10 w-10 rounded-full border-2 border-stone-400 shadow-md flex items-center justify-center"
                    style={{ backgroundColor: physicsState.beamColorHex }}
                  >
                    <Sun className="h-5 w-5 text-stone-900" />
                  </div>
                  <span className="mt-1 text-[10px] font-mono text-stone-400">
                    {wavelengthNm} nm
                  </span>
                </div>

                {/* Light Ray Stream */}
                <div className="relative flex-1 mx-4 h-6 flex items-center">
                  <div
                    className="h-2 w-full rounded-full opacity-80 shadow-md transition-all duration-300"
                    style={{
                      backgroundColor: physicsState.beamColorHex,
                      boxShadow: `0 0 16px ${physicsState.beamColorHex}`,
                    }}
                  />
                </div>

                {/* Photocell Cathode & Anode Plate */}
                <div className="flex items-center gap-6 rounded-xl border border-stone-700 bg-stone-900/90 p-4">
                  {/* Cathode Plate */}
                  <div className="flex flex-col items-center">
                    <div className="h-20 w-3 rounded-sm bg-gradient-to-b from-stone-400 to-stone-600 shadow-xs" />
                    <span className="mt-1 text-[10px] font-bold text-stone-300">Cathode (-)</span>
                  </div>

                  {/* Electron Gap */}
                  <div className="flex items-center justify-center w-16">
                    {physicsState.isEmitting && physicsState.emittedCurrentNA > 0 ? (
                      <div className="flex gap-1 animate-pulse">
                        <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
                        <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
                        <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
                      </div>
                    ) : (
                      <span className="text-[9px] text-stone-600">No flow</span>
                    )}
                  </div>

                  {/* Anode Collector Plate */}
                  <div className="flex flex-col items-center">
                    <div className="h-20 w-3 rounded-sm bg-stone-600" />
                    <span className="mt-1 text-[10px] font-bold text-stone-300">Anode (+)</span>
                  </div>
                </div>
              </div>

              {/* Digital Electrometer / Picoammeter */}
              <div className="mt-6 flex w-full items-center justify-between rounded-lg border border-stone-800 bg-stone-900 p-3">
                <div>
                  <span className="text-xs text-stone-400">Photocurrent (Electrometer)</span>
                  <div className="flex items-baseline gap-1 font-mono text-2xl font-bold text-cyan-400">
                    <span>{physicsState.emittedCurrentNA.toFixed(2)}</span>
                    <span className="text-xs text-cyan-600">nA</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-stone-400">Stopping Potential (V₀)</span>
                  <div className="font-mono text-lg font-semibold text-amber-400">
                    {physicsState.trueV0.toFixed(2)} V
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Sliders & Source Selection */}
          <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs space-y-4 transition-colors">
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">Apparatus Optical Controls</h3>

            {/* Cathode Material Selection */}
            <div>
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">Photocathode Material</label>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {cathodeMaterials.map((mat, idx) => (
                  <button
                    key={mat.name}
                    type="button"
                    onClick={() => setSelectedCathodeIndex(idx)}
                    className={`rounded-lg border p-2 text-left text-xs transition-all ${
                      selectedCathodeIndex === idx
                        ? 'border-cyan-600 dark:border-cyan-500 bg-cyan-50 dark:bg-cyan-950/70 font-bold text-cyan-900 dark:text-cyan-300'
                        : 'border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-750'
                    }`}
                  >
                    <div className="font-semibold">{mat.name}</div>
                    <div className="text-[10px] text-stone-500 dark:text-stone-400">Φ = {mat.workFunctionEV} eV</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Wavelength Slider */}
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-stone-700 dark:text-stone-300">
                  Monochromatic Wavelength (λ): <strong className="text-stone-900 dark:text-cyan-400">{wavelengthNm} nm</strong>
                </span>
                <span className="font-mono text-stone-600 dark:text-stone-400">
                  Frequency: {physicsState.freqTHz} × 10¹⁴ Hz
                </span>
              </div>
              <input
                type="range"
                min="350"
                max="650"
                step="5"
                value={wavelengthNm}
                onChange={(e) => setWavelengthNm(parseInt(e.target.value, 10))}
                className="mt-1.5 w-full accent-cyan-600"
              />
              <div className="mt-1 flex justify-between text-[10px] text-stone-500 dark:text-stone-400">
                <span>350 nm (UV)</span>
                <span>436 nm (Violet)</span>
                <span>546 nm (Green)</span>
                <span>650 nm (Red)</span>
              </div>
            </div>

            {/* Intensity Slider */}
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-stone-700 dark:text-stone-300">
                  Light Intensity (Photon Flux): <strong className="text-stone-900 dark:text-amber-400">{intensityPercent}%</strong>
                </span>
                <span className="text-[11px] text-stone-500 dark:text-stone-400">
                  (Changes photocurrent magnitude, NOT stopping potential)
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={intensityPercent}
                onChange={(e) => setIntensityPercent(parseInt(e.target.value, 10))}
                className="mt-1.5 w-full accent-amber-500"
              />
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between border-t border-stone-200 dark:border-stone-800 pt-4">
              <span className="text-xs text-stone-600 dark:text-stone-400">
                V₀ directly measured from zero photocurrent condition
              </span>
              <button
                type="button"
                id="btn-log-pe-point"
                onClick={handleLogData}
                className="flex items-center gap-1.5 rounded-lg bg-stone-900 dark:bg-cyan-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-stone-800 dark:hover:bg-cyan-500 transition-colors"
              >
                <Plus className="h-3.5 w-3.5 text-cyan-400 dark:text-white" />
                <span>Log (f, V₀) Observation</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: V0 vs Frequency Plot & Planck Constant Extraction (5 cols) */}
        <div className="space-y-6 lg:col-span-5">
          {/* Plotter */}
          <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 shadow-xs transition-colors">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-2">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                  V₀ vs Frequency (f) Quantum Plot
                </h3>
              </div>
              <span className="text-[11px] text-stone-500 dark:text-stone-400">{loggedPoints.length} points</span>
            </div>

            <div className="mt-3 h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#292524' : '#e7e5e4'} />
                  <XAxis
                    type="number"
                    dataKey="frequencyTHz"
                    domain={[4.5, 9.0]}
                    tick={{ fontSize: 10, fill: isDark ? '#a8a29e' : '#78716c' }}
                    stroke={isDark ? '#57534e' : '#a8a29e'}
                    label={{ value: 'Frequency (×10¹⁴ Hz)', position: 'bottom', offset: 0, fontSize: 10, fill: isDark ? '#d6d3d1' : '#44403c' }}
                  />
                  <YAxis
                    type="number"
                    dataKey="stoppingPotentialV0"
                    domain={[0, 2.0]}
                    tick={{ fontSize: 10, fill: isDark ? '#a8a29e' : '#78716c' }}
                    stroke={isDark ? '#57534e' : '#a8a29e'}
                    label={{ value: 'Stopping V₀ (V)', angle: -90, position: 'insideLeft', fontSize: 10, fill: isDark ? '#d6d3d1' : '#44403c' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#1c1917' : '#292524',
                      color: '#fff',
                      borderRadius: '8px',
                      fontSize: '11px',
                      border: isDark ? '1px solid #44403c' : 'none',
                    }}
                  />
                  <Scatter
                    name="Observations"
                    data={loggedPoints}
                    fill="#0ea5e9"
                    stroke="#0369a1"
                    strokeWidth={1.5}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            {/* Regression Planck Summary */}
            <div className="mt-3 rounded-lg bg-stone-50 dark:bg-stone-800/80 p-3 text-xs text-stone-700 dark:text-stone-300 border border-stone-100 dark:border-stone-800 transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-stone-900 dark:text-stone-100">Deduced Planck Constant (h):</span>
                <span className="font-mono font-bold text-cyan-700 dark:text-cyan-400">
                  {regressionResults.isValid ? `${regressionResults.h} × 10⁻³⁴ J·s` : 'N/A'}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-stone-600 dark:text-stone-400">
                <span>Standard Value:</span>
                <span className="font-mono font-medium text-stone-700 dark:text-stone-300">6.63 × 10⁻³⁴ J·s</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-stone-600 dark:text-stone-400">
                <span>Extrapolated Work Function (Φ):</span>
                <span className="font-mono font-medium text-stone-700 dark:text-stone-300">
                  {regressionResults.isValid ? `${regressionResults.workFunction} eV` : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Observations Table */}
          <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 shadow-xs transition-colors">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                Quantum Spectral Readings
              </h3>
              {loggedPoints.length > 0 && (
                <button
                  type="button"
                  onClick={() => setLoggedPoints([])}
                  className="flex items-center gap-1 text-[11px] font-medium text-stone-500 hover:text-rose-600 dark:hover:text-rose-400"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Clear</span>
                </button>
              )}
            </div>

            <div className="mt-2 max-h-52 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-stone-200 dark:border-stone-800 text-[11px] text-stone-600 dark:text-stone-400">
                    <th className="pb-1.5 font-semibold">λ (nm)</th>
                    <th className="pb-1.5 font-semibold">f (10¹⁴ Hz)</th>
                    <th className="pb-1.5 font-semibold">V₀ (V)</th>
                    <th className="pb-1.5 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800/80 font-mono text-[11px]">
                  {loggedPoints.map((pt) => (
                    <tr key={pt.id} className="hover:bg-stone-50 dark:hover:bg-stone-800/50">
                      <td className="py-1.5 text-stone-900 dark:text-stone-100 font-semibold">{pt.wavelengthNm}</td>
                      <td className="py-1.5 text-stone-600 dark:text-stone-400">{pt.frequencyTHz}</td>
                      <td className="py-1.5 text-cyan-700 dark:text-cyan-400 font-bold">{pt.stoppingPotentialV0.toFixed(2)}</td>
                      <td className="py-1.5 text-right">
                        <button
                          type="button"
                          onClick={() => setLoggedPoints(loggedPoints.filter((p) => p.id !== pt.id))}
                          className="text-stone-400 hover:text-rose-600 dark:hover:text-rose-400"
                        >
                          <Trash2 className="h-3 w-3 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
