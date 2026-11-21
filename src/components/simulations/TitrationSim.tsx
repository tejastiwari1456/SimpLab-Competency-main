import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  FlaskConical,
  Droplets,
  RotateCcw,
  Play,
  Pause,
  Plus,
  TrendingUp,
  Activity,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

export interface TitrationDataPoint {
  id: string;
  volumeAdded: number; // mL NaOH
  pH: number;
  derivative: number; // dpH / dV
  color: string;
}

interface TitrationSimProps {
  onDataLogged?: (count: number) => void;
  isDark?: boolean;
}

export const TitrationSim: React.FC<TitrationSimProps> = ({ onDataLogged, isDark = false }) => {
  // Analyte parameters
  const acidVolume = 25.0; // mL of unknown HCl
  const trueAcidMolarity = 0.086; // M (equating to 21.50 mL equivalence with 0.1M NaOH)
  const baseMolarity = 0.1; // M NaOH in burette

  // Apparatus state
  const [buretteVolume, setBuretteVolume] = useState<number>(0.0); // 0 to 50 mL added
  const [stirrerOn, setStirrerOn] = useState<boolean>(true);
  const [stirrerRpm, setStirrerRpm] = useState<number>(350);
  const [continuousDispense, setContinuousDispense] = useState<boolean>(false);
  const [indicator, setIndicator] = useState<'phenolphthalein' | 'methyl_orange'>('phenolphthalein');

  // Observation records
  const [loggedPoints, setLoggedPoints] = useState<TitrationDataPoint[]>([
    { id: 't-0', volumeAdded: 0.0, pH: 1.07, derivative: 0, color: 'colorless' },
    { id: 't-1', volumeAdded: 5.0, pH: 1.25, derivative: 0.036, color: 'colorless' },
    { id: 't-2', volumeAdded: 10.0, pH: 1.48, derivative: 0.046, color: 'colorless' },
    { id: 't-3', volumeAdded: 15.0, pH: 1.82, derivative: 0.068, color: 'colorless' },
    { id: 't-4', volumeAdded: 20.0, pH: 2.48, derivative: 0.132, color: 'colorless' },
  ]);

  // Continuous dispenser timer
  const dispenseIntervalRef = useRef<any>(null);

  useEffect(() => {
    if (continuousDispense) {
      dispenseIntervalRef.current = setInterval(() => {
        setBuretteVolume((prev) => {
          if (prev >= 40) {
            setContinuousDispense(false);
            return prev;
          }
          return parseFloat((prev + 0.1).toFixed(2));
        });
      }, 150);
    } else {
      if (dispenseIntervalRef.current) clearInterval(dispenseIntervalRef.current);
    }
    return () => {
      if (dispenseIntervalRef.current) clearInterval(dispenseIntervalRef.current);
    };
  }, [continuousDispense]);

  // Chemical calculation of pH based on volume of strong base added
  const chemicalState = useMemo(() => {
    const totalSolutionVol = acidVolume + buretteVolume; // mL
    const initialAcidMoles = (acidVolume * trueAcidMolarity) / 1000;
    const baseMolesAdded = (buretteVolume * baseMolarity) / 1000;

    let pH = 7.0;
    let mv = 0;

    if (baseMolesAdded < initialAcidMoles) {
      // Acidic region
      const remainingAcidMoles = initialAcidMoles - baseMolesAdded;
      const hConc = (remainingAcidMoles / (totalSolutionVol / 1000));
      pH = -Math.log10(Math.max(1e-14, hConc));
    } else if (Math.abs(baseMolesAdded - initialAcidMoles) < 1e-7) {
      // Equivalence point
      pH = 7.0;
    } else {
      // Basic region
      const excessBaseMoles = baseMolesAdded - initialAcidMoles;
      const ohConc = (excessBaseMoles / (totalSolutionVol / 1000));
      const pOH = -Math.log10(Math.max(1e-14, ohConc));
      pH = 14.0 - pOH;
    }

    // Small electrode noise and glass response curve
    const noise = (Math.sin(buretteVolume * 13.7) * 0.02);
    const finalPH = Math.min(13.8, Math.max(0.5, parseFloat((pH + noise).toFixed(2))));

    // Nernst potential: E = E0 - 0.05916 * pH
    mv = Math.round((414 - 59.16 * finalPH));

    // Color appearance
    let solutionColor = 'bg-stone-100/50';
    let colorDescription = 'Colorless / Crystal Clear';

    if (indicator === 'phenolphthalein') {
      if (finalPH < 8.2) {
        solutionColor = 'bg-stone-50/40 border-stone-300';
        colorDescription = 'Colorless (Acidic)';
      } else if (finalPH >= 8.2 && finalPH <= 9.2) {
        solutionColor = 'bg-rose-200/60 border-rose-300 shadow-[0_0_12px_#fda4af]';
        colorDescription = 'Faint Permanent Pink (Endpoint Reached!)';
      } else {
        solutionColor = 'bg-fuchsia-400/80 border-fuchsia-500 shadow-[0_0_16px_#e879f9]';
        colorDescription = 'Deep Fuchsia / Alkaline Over-titrated';
      }
    } else {
      // Methyl orange
      if (finalPH < 3.1) {
        solutionColor = 'bg-rose-400/80';
        colorDescription = 'Red (Strongly Acidic)';
      } else if (finalPH <= 4.4) {
        solutionColor = 'bg-amber-400/80';
        colorDescription = 'Orange (Transition Window)';
      } else {
        solutionColor = 'bg-yellow-300/80';
        colorDescription = 'Yellow (Neutral / Basic)';
      }
    }

    return {
      currentPH: finalPH,
      potentialMV: mv,
      solutionColor,
      colorDescription,
      equivVol: parseFloat(((initialAcidMoles / baseMolarity) * 1000).toFixed(2)), // 21.50 mL
      isNearEquiv: Math.abs(buretteVolume - 21.5) < 0.5,
    };
  }, [buretteVolume, acidVolume, trueAcidMolarity, baseMolarity, indicator]);

  // Derivative calculation across logged data
  const processedPoints = useMemo(() => {
    return loggedPoints.map((pt, idx) => {
      let deriv = 0;
      if (idx > 0) {
        const prev = loggedPoints[idx - 1];
        const dV = pt.volumeAdded - prev.volumeAdded;
        const dpH = pt.pH - prev.pH;
        deriv = dV > 0 ? parseFloat((dpH / dV).toFixed(2)) : 0;
      }
      return {
        ...pt,
        derivative: deriv,
      };
    });
  }, [loggedPoints]);

  const handleAddVolume = (ml: number) => {
    setBuretteVolume((prev) => parseFloat(Math.min(50, prev + ml).toFixed(2)));
  };

  const handleLogPoint = () => {
    const prevPt = loggedPoints[loggedPoints.length - 1];
    let deriv = 0;
    if (prevPt) {
      const dV = buretteVolume - prevPt.volumeAdded;
      const dpH = chemicalState.currentPH - prevPt.pH;
      deriv = dV > 0 ? parseFloat((dpH / dV).toFixed(2)) : 0;
    }

    const newPoint: TitrationDataPoint = {
      id: `titr-${Date.now()}`,
      volumeAdded: buretteVolume,
      pH: chemicalState.currentPH,
      derivative: deriv,
      color: chemicalState.colorDescription,
    };

    const updated = [...loggedPoints, newPoint].sort((a, b) => a.volumeAdded - b.volumeAdded);
    setLoggedPoints(updated);
    if (onDataLogged) onDataLogged(updated.length);
  };

  const handleReset = () => {
    setBuretteVolume(0);
    setContinuousDispense(false);
  };

  return (
    <div className="space-y-6">
      {/* Simulation Header */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs md:flex-row md:items-center transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 dark:bg-rose-950/70 px-2 py-0.5 text-xs font-semibold text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
              <FlaskConical className="h-3 w-3 text-rose-600 dark:text-rose-400" />
              Analytical Volumetric Chemistry
            </span>
            <span className="text-xs text-stone-600 dark:text-stone-400">Analytical Bench #02</span>
          </div>
          <h2 className="mt-1 text-lg font-bold text-stone-900 dark:text-stone-100">
            Potentiometric Titration & Derivative pH Equivalence
          </h2>
          <p className="text-xs text-stone-600 dark:text-stone-300">
            Dispense standardized 0.100 M NaOH titrant, monitor electrode EMF and pH changes, and pinpoint the stoichiometric inflection.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 px-3 py-1.5 text-center transition-colors">
            <span className="block text-[11px] text-stone-600 dark:text-stone-400">Analyte Aliquot</span>
            <span className="text-sm font-bold text-stone-900 dark:text-stone-100">25.0 mL HCl</span>
          </div>
          <div className="rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 px-3 py-1.5 text-center transition-colors">
            <span className="block text-[11px] text-stone-600 dark:text-stone-400">Titrant in Burette</span>
            <span className="text-sm font-bold text-stone-900 dark:text-stone-100">0.100 M NaOH</span>
          </div>
          <div className="rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 px-3 py-1.5 text-center transition-colors">
            <span className="block text-[11px] text-stone-600 dark:text-stone-400">True Equivalence</span>
            <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{chemicalState.equivVol} mL</span>
          </div>
        </div>
      </div>

      {/* Main Bench Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Glassware, Titrator & pH Meter (7 cols) */}
        <div className="space-y-6 lg:col-span-7">
          {/* Visual Glassware Stage */}
          <div className="relative rounded-2xl border border-stone-300 dark:border-stone-800 bg-gradient-to-b from-stone-900 to-stone-950 p-6 text-white shadow-md">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-rose-400">
                Analytical Titration Rig
              </span>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-stone-400">
                  Burette Dispensed: <strong className="text-white">{buretteVolume.toFixed(2)} mL</strong> / 50.00 mL
                </span>
              </div>
            </div>

            {/* Glassware & Instrument Render */}
            <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-12">
              {/* Burette Column (4 cols) */}
              <div className="flex flex-col items-center justify-between rounded-xl border border-stone-800 bg-stone-900/80 p-4 md:col-span-4">
                <span className="text-xs font-semibold text-stone-300">50 mL Precision Burette</span>
                {/* Visual Glass Column */}
                <div className="relative my-3 h-48 w-7 rounded-sm border-2 border-stone-500 bg-stone-800/60">
                  {/* Liquid fill */}
                  <div
                    className="absolute bottom-0 w-full bg-cyan-200/40 backdrop-blur-xs transition-all duration-300"
                    style={{ height: `${Math.max(4, 100 - (buretteVolume / 50) * 100)}%` }}
                  />
                  {/* Graduations */}
                  <div className="absolute inset-0 flex flex-col justify-between py-1 text-[8px] font-mono text-stone-400">
                    <span className="text-right pr-0.5">0</span>
                    <span className="text-right pr-0.5">10</span>
                    <span className="text-right pr-0.5">20</span>
                    <span className="text-right pr-0.5">30</span>
                    <span className="text-right pr-0.5">40</span>
                    <span className="text-right pr-0.5">50</span>
                  </div>
                </div>

                {/* Stopcock Status */}
                <div className="text-center text-[11px] text-stone-400">
                  <span>Level: {(50 - buretteVolume).toFixed(2)} mL left</span>
                </div>
              </div>

              {/* Reaction Beaker & Stirrer (8 cols) */}
              <div className="flex flex-col justify-between rounded-xl border border-stone-800 bg-stone-900/80 p-4 md:col-span-8">
                {/* Digital pH Meter Readout */}
                <div className="rounded-lg border border-stone-700 bg-black/70 p-3">
                  <div className="flex items-center justify-between text-xs text-stone-400">
                    <span className="font-semibold text-stone-200">Glass-Calomel pH Meter</span>
                    <span className="rounded bg-stone-800 px-1.5 py-0.5 font-mono text-[10px] text-emerald-400">
                      Slope: 99.2%
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between font-mono">
                    <div>
                      <span className="text-3xl font-bold tracking-tight text-emerald-400">
                        {chemicalState.currentPH.toFixed(2)}
                      </span>
                      <span className="ml-1 text-xs text-emerald-600">pH</span>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-semibold text-cyan-400">
                        {chemicalState.potentialMV}
                      </span>
                      <span className="ml-1 text-xs text-cyan-600">mV</span>
                    </div>
                  </div>
                </div>

                {/* Glass Beaker with Animated Solution Color */}
                <div className="relative mt-4 flex flex-col items-center">
                  {/* Stirrer plate base */}
                  <div className="relative h-28 w-36 rounded-b-2xl border-2 border-t-0 border-stone-400 bg-stone-900/60 p-2 overflow-hidden flex items-end justify-center">
                    {/* Solution in beaker */}
                    <div
                      className={`h-20 w-full rounded-b-xl border transition-all duration-500 flex items-center justify-center ${chemicalState.solutionColor}`}
                    >
                      {/* Stirrer vortex / stir bar */}
                      <div
                        className={`h-1.5 w-7 rounded-full bg-white shadow-xs ${
                          stirrerOn ? 'animate-spin' : ''
                        }`}
                        style={{ animationDuration: `${Math.max(0.1, 1000 / stirrerRpm)}s` }}
                      />
                    </div>
                  </div>

                  {/* Magnetic Stirrer Base */}
                  <div className="mt-1 w-44 rounded-lg border border-stone-700 bg-stone-800 px-3 py-1.5 text-[11px] text-stone-300 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Activity className="h-3 w-3 text-amber-400" />
                      Stirrer: {stirrerOn ? `${stirrerRpm} RPM` : 'OFF'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setStirrerOn(!stirrerOn)}
                      className="rounded px-1.5 py-0.5 bg-stone-700 text-[10px] font-bold hover:bg-stone-600 text-stone-200"
                    >
                      {stirrerOn ? 'STOP' : 'START'}
                    </button>
                  </div>
                </div>

                {/* Solution State description */}
                <div className="mt-3 rounded-md bg-stone-800/80 px-3 py-2 text-center text-xs">
                  <span className="text-stone-400">Indicator Visual: </span>
                  <span className="font-semibold text-white">{chemicalState.colorDescription}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Burette Controls & Dispensing Buttons */}
          <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs space-y-4 transition-colors">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">Burette Dispensing & Controls</h3>
              {/* Indicator choice */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-stone-600 dark:text-stone-400">Indicator:</span>
                <select
                  value={indicator}
                  onChange={(e: any) => setIndicator(e.target.value)}
                  className="rounded-md border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-2 py-1 text-xs font-semibold text-stone-800 dark:text-stone-200"
                >
                  <option value="phenolphthalein">Phenolphthalein (pH 8.2–10)</option>
                  <option value="methyl_orange">Methyl Orange (pH 3.1–4.4)</option>
                </select>
              </div>
            </div>

            {/* Quick Increment Buttons */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button
                type="button"
                id="btn-titr-drop"
                onClick={() => handleAddVolume(0.05)}
                className="flex items-center justify-center gap-1 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-3 py-2 text-xs font-semibold text-stone-800 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors"
              >
                <Droplets className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                <span>+0.05 mL (1 Drop)</span>
              </button>

              <button
                type="button"
                id="btn-titr-half-ml"
                onClick={() => handleAddVolume(0.5)}
                className="flex items-center justify-center gap-1 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-3 py-2 text-xs font-semibold text-stone-800 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors"
              >
                <span>+0.50 mL</span>
              </button>

              <button
                type="button"
                id="btn-titr-one-ml"
                onClick={() => handleAddVolume(1.0)}
                className="flex items-center justify-center gap-1 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-3 py-2 text-xs font-semibold text-stone-800 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors"
              >
                <span>+1.00 mL</span>
              </button>

              <button
                type="button"
                id="btn-titr-continuous"
                onClick={() => setContinuousDispense(!continuousDispense)}
                className={`flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                  continuousDispense
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-700'
                }`}
              >
                {continuousDispense ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                <span>{continuousDispense ? 'Stop Flow' : 'Continuous Drip'}</span>
              </button>
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 dark:border-stone-800 pt-4">
              <button
                type="button"
                id="btn-reset-burette"
                onClick={handleReset}
                className="flex items-center gap-1 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800 px-3 py-2 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Refill Burette to 0.00 mL</span>
              </button>

              <button
                type="button"
                id="btn-log-titration-point"
                onClick={handleLogPoint}
                className="flex items-center gap-1.5 rounded-lg bg-stone-900 dark:bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-stone-800 dark:hover:bg-rose-500 transition-colors"
              >
                <Plus className="h-3.5 w-3.5 text-rose-400 dark:text-white" />
                <span>Log (Volume, pH) Reading</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Dynamic Titration Curve & Derivative Peak (5 cols) */}
        <div className="space-y-6 lg:col-span-5">
          {/* Real-time pH & First Derivative Plot */}
          <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 shadow-xs transition-colors">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-2">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                  Potentiometric Titration Curve
                </h3>
              </div>
              <span className="text-[11px] text-stone-500 dark:text-stone-400">{processedPoints.length} points</span>
            </div>

            <div className="mt-3 h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={processedPoints} margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#292524' : '#e7e5e4'} />
                  <XAxis
                    type="number"
                    dataKey="volumeAdded"
                    domain={[0, 35]}
                    tick={{ fontSize: 10, fill: isDark ? '#a8a29e' : '#78716c' }}
                    stroke={isDark ? '#57534e' : '#a8a29e'}
                    label={{ value: 'NaOH Added (mL)', position: 'bottom', offset: 0, fontSize: 10, fill: isDark ? '#d6d3d1' : '#44403c' }}
                  />
                  <YAxis
                    yAxisId="left"
                    domain={[0, 14]}
                    tick={{ fontSize: 10, fill: isDark ? '#a8a29e' : '#78716c' }}
                    stroke={isDark ? '#57534e' : '#a8a29e'}
                    label={{ value: 'pH', angle: -90, position: 'insideLeft', fontSize: 10, fill: isDark ? '#d6d3d1' : '#44403c' }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, 'auto']}
                    tick={{ fontSize: 9, fill: isDark ? '#a8a29e' : '#78716c' }}
                    stroke={isDark ? '#57534e' : '#a8a29e'}
                    label={{ value: 'ΔpH/ΔV', angle: 90, position: 'insideRight', fontSize: 9, fill: isDark ? '#d6d3d1' : '#44403c' }}
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
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="pH"
                    stroke="#e11d48"
                    strokeWidth={2}
                    dot={{ r: 2.5 }}
                    name="pH Curve"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="derivative"
                    stroke="#0284c7"
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                    dot={{ r: 1.5 }}
                    name="First Derivative (ΔpH/ΔV)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Equivalence Analytics Box */}
            <div className="mt-3 rounded-lg bg-stone-50 dark:bg-stone-800/80 p-3 text-xs text-stone-700 dark:text-stone-300 border border-stone-100 dark:border-stone-800 transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-stone-900 dark:text-stone-100">Stoichiometric Equivalence Point:</span>
                <span className="font-mono font-bold text-rose-700 dark:text-rose-400">~21.50 mL NaOH</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-stone-600 dark:text-stone-400">
                <span>Unknown HCl Concentration:</span>
                <span className="font-mono font-medium text-stone-700 dark:text-stone-300">
                  {`M_acid = (0.100 × 21.50) / 25.0 = 0.0860 M`}
                </span>
              </div>
            </div>
          </div>

          {/* Observation Table */}
          <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 shadow-xs transition-colors">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                Titration Logbook
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
                    <th className="pb-1.5 font-semibold">#</th>
                    <th className="pb-1.5 font-semibold">V NaOH (mL)</th>
                    <th className="pb-1.5 font-semibold">Measured pH</th>
                    <th className="pb-1.5 font-semibold">ΔpH/ΔV</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800/80 font-mono text-[11px]">
                  {processedPoints.map((pt, idx) => (
                    <tr key={pt.id} className="hover:bg-stone-50 dark:hover:bg-stone-800/50">
                      <td className="py-1.5 font-sans text-stone-500 dark:text-stone-400">{idx + 1}</td>
                      <td className="py-1.5 font-semibold text-stone-900 dark:text-stone-100">{pt.volumeAdded.toFixed(2)}</td>
                      <td className="py-1.5 text-rose-700 dark:text-rose-400 font-bold">{pt.pH.toFixed(2)}</td>
                      <td className="py-1.5 text-stone-700 dark:text-stone-300">{pt.derivative.toFixed(2)}</td>
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
