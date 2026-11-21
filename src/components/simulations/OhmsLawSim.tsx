import React, { useState, useMemo } from 'react';
import {
  Zap,
  Power,
  Sliders,
  RotateCcw,
  Flame,
  AlertTriangle,
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

export interface OhmsDataPoint {
  id: string;
  voltage: number; // Volts
  current: number; // Amperes
  currentMA: number; // mA
  isAnomaly?: boolean;
  notes?: string;
}

interface OhmsLawSimProps {
  onDataLogged?: (pointsCount: number) => void;
  onSafetyWarningTriggered?: () => void;
  isDark?: boolean;
}

export const OhmsLawSim: React.FC<OhmsLawSimProps> = ({
  onDataLogged,
  onSafetyWarningTriggered,
  isDark = false,
}) => {
  // Apparatus state
  const [powerOn, setPowerOn] = useState<boolean>(true);
  const [supplyVoltage, setSupplyVoltage] = useState<number>(3.0); // 0 to 12V
  const [rheostatR, setRheostatR] = useState<number>(20); // 0 to 100 ohms
  const [ammeterRange, setAmmeterRange] = useState<'500mA' | '2A'>('500mA');
  const [contactFault, setContactFault] = useState<boolean>(false);
  const [continuousStressTime, setContinuousStressTime] = useState<number>(0);

  // Nominal Nichrome Resistor Coil Specs
  const nominalR = 15.0; // 15 ohms nominal
  const thermalCoeff = 0.0004; // Nichrome approx 0.0004 / deg C

  // Logged observation points
  const [loggedPoints, setLoggedPoints] = useState<OhmsDataPoint[]>([
    { id: 'p-1', voltage: 0.98, current: 0.065, currentMA: 65, notes: 'Rheostat high load' },
    { id: 'p-2', voltage: 1.95, current: 0.13, currentMA: 130, notes: 'Good linear fit' },
    { id: 'p-3', voltage: 2.92, current: 0.195, currentMA: 195, notes: 'Mid range' },
  ]);

  // Physical simulation calculation
  const circuitState = useMemo(() => {
    if (!powerOn) {
      return {
        measuredV: 0,
        measuredI: 0,
        measuredI_mA: 0,
        coilR: nominalR,
        powerW: 0,
        isOverload: false,
        meterOverflow: false,
        tempRise: 0,
      };
    }

    // Burden resistance of ammeter
    const ammeterBurden = ammeterRange === '500mA' ? 1.5 : 0.2;
    // Extra resistance from loose terminal contact fault
    const faultResistance = contactFault ? 18.0 : 0.0;

    // Thermal rise estimate based on applied voltage & duration
    const approxCurrent = supplyVoltage / (nominalR + rheostatR + ammeterBurden + faultResistance + 0.1);
    const approxPower = approxCurrent * approxCurrent * nominalR;
    const tempRise = Math.min(80, approxPower * 12 + continuousStressTime * 0.5);
    const coilR = nominalR * (1 + thermalCoeff * tempRise);

    // Total series loop resistance
    const totalLoopR = coilR + rheostatR + ammeterBurden + faultResistance;
    const loopCurrent = totalLoopR > 0 ? supplyVoltage / totalLoopR : 0;

    // Small random noise (instrument jitter +/- 0.5%)
    const noiseFactor = 1 + (Math.sin(supplyVoltage * 7.1) * 0.006);
    const currentNoisy = loopCurrent * noiseFactor;
    const voltageNoisy = currentNoisy * coilR;

    const powerW = voltageNoisy * currentNoisy;
    const isOverload = powerW > 3.0; // > 3W produces excessive heat

    // Check ammeter saturation
    const currentMA = currentNoisy * 1000;
    const meterOverflow = ammeterRange === '500mA' && currentMA > 510;

    return {
      measuredV: parseFloat(voltageNoisy.toFixed(2)),
      measuredI: parseFloat(currentNoisy.toFixed(4)),
      measuredI_mA: parseFloat(currentMA.toFixed(1)),
      coilR: parseFloat(coilR.toFixed(2)),
      powerW: parseFloat(powerW.toFixed(2)),
      isOverload,
      meterOverflow,
      tempRise: Math.round(tempRise),
    };
  }, [powerOn, supplyVoltage, rheostatR, ammeterRange, contactFault, continuousStressTime]);

  // Regression analysis of logged points
  const regressionStats = useMemo(() => {
    if (loggedPoints.length < 2) {
      return { slopeR: 0, rSquared: 0, isValid: false };
    }

    const n = loggedPoints.length;
    let sumX = 0; // Current (A)
    let sumY = 0; // Voltage (V)
    let sumXY = 0;
    let sumXX = 0;
    let sumYY = 0;

    loggedPoints.forEach((pt) => {
      sumX += pt.current;
      sumY += pt.voltage;
      sumXY += pt.current * pt.voltage;
      sumXX += pt.current * pt.current;
      sumYY += pt.voltage * pt.voltage;
    });

    const denom = n * sumXX - sumX * sumX;
    if (Math.abs(denom) < 1e-9) {
      return { slopeR: 0, rSquared: 0, isValid: false };
    }

    const slope = (n * sumXY - sumX * sumY) / denom;
    const numerator = n * sumXY - sumX * sumY;
    const rSqDenom = (n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY);
    const rSquared = rSqDenom > 0 ? (numerator * numerator) / rSqDenom : 0;

    return {
      slopeR: parseFloat(slope.toFixed(2)),
      rSquared: parseFloat(rSquared.toFixed(3)),
      isValid: true,
    };
  }, [loggedPoints]);

  const handleLogDataPoint = () => {
    if (!powerOn) return;
    const newPt: OhmsDataPoint = {
      id: `pt-${Date.now()}`,
      voltage: circuitState.measuredV,
      current: circuitState.measuredI,
      currentMA: circuitState.measuredI_mA,
      isAnomaly: contactFault,
      notes: contactFault
        ? 'Abnormal reading (Contact resistance)'
        : circuitState.isOverload
        ? 'Thermal stress region'
        : 'Normal observation',
    };

    const updated = [...loggedPoints, newPt];
    setLoggedPoints(updated);
    if (onDataLogged) onDataLogged(updated.length);
  };

  const handleRemovePoint = (id: string) => {
    setLoggedPoints(loggedPoints.filter((p) => p.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Simulation Header & Bench Overview */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs md:flex-row md:items-center transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/70 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
              <Zap className="h-3 w-3 text-amber-600 dark:text-amber-400" />
              Direct Current Circuitry
            </span>
            <span className="text-xs text-stone-600 dark:text-stone-400">Apparatus Bench #01</span>
          </div>
          <h2 className="mt-1 text-lg font-bold text-stone-900 dark:text-stone-100">
            Regulated DC Circuit Bench & Resistance Verification
          </h2>
          <p className="text-xs text-stone-600 dark:text-stone-300">
            Calibrate voltmeter and ammeter, sweep applied potential, log (V, I) data points, and derive experimental resistance.
          </p>
        </div>

        {/* Bench Quick Stats */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 p-2.5 px-3 py-1.5 text-center transition-colors">
            <span className="block text-[11px] text-stone-600 dark:text-stone-400">Resistor Coil</span>
            <span className="text-sm font-bold text-stone-900 dark:text-stone-100">{nominalR} Ω (Nominal)</span>
          </div>
          <div className="rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 px-3 py-1.5 text-center transition-colors">
            <span className="block text-[11px] text-stone-600 dark:text-stone-400">Coil Temp</span>
            <span
              className={`text-sm font-bold ${
                circuitState.tempRise > 30 ? 'text-rose-600 dark:text-rose-400' : 'text-stone-900 dark:text-stone-100'
              }`}
            >
              25°C + {circuitState.tempRise}°C
            </span>
          </div>
          <div className="rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 px-3 py-1.5 text-center transition-colors">
            <span className="block text-[11px] text-stone-600 dark:text-stone-400">Power Dissipation</span>
            <span
              className={`text-sm font-bold ${
                circuitState.isOverload ? 'text-rose-600 dark:text-rose-400' : 'text-stone-900 dark:text-stone-100'
              }`}
            >
              {circuitState.powerW} W
            </span>
          </div>
        </div>
      </div>

      {/* Overload Alert if Power > 3W */}
      {circuitState.isOverload && powerOn && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 p-4 text-rose-900 dark:text-rose-200 transition-colors">
          <Flame className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400 animate-pulse" />
          <div className="text-xs">
            <p className="font-semibold">Thermal Overload Warning (Joule Heating P &gt; 3.0 W)</p>
            <p className="text-rose-700 dark:text-rose-300">
              The coil temperature is elevating rapidly. Notice how the measured resistance begins to diverge from ideal linearity as wire atoms scatter electrons more vigorously!
            </p>
          </div>
        </div>
      )}

      {/* Main Grid: Interactive Workbench & Real-Time Instruments */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Virtual Equipment & Controls (7 cols) */}
        <div className="space-y-6 lg:col-span-7">
          {/* Apparatus Visual Board */}
          <div className="relative rounded-2xl border border-stone-300 bg-gradient-to-b from-stone-900 to-stone-950 p-6 text-white shadow-md">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                Virtual Laboratory Workstation
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    powerOn ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-stone-600'
                  }`}
                />
                <span className="text-xs font-mono text-stone-400">
                  {powerOn ? 'CIRCUIT CLOSED' : 'CIRCUIT OPEN'}
                </span>
              </div>
            </div>

            {/* Instrument Panels Layout */}
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Voltmeter Instrument */}
              <div className="rounded-xl border border-stone-800 bg-stone-900/90 p-4">
                <div className="flex items-center justify-between text-xs text-stone-400">
                  <span className="font-semibold text-stone-300">DC Voltmeter</span>
                  <span className="rounded bg-stone-800 px-1.5 py-0.5 text-[10px] font-mono text-cyan-400">
                    Across Resistor
                  </span>
                </div>
                <div className="mt-3 flex items-baseline justify-center rounded-lg bg-black/60 py-3 font-mono">
                  <span className="text-3xl font-bold tracking-tight text-cyan-400">
                    {circuitState.measuredV.toFixed(2)}
                  </span>
                  <span className="ml-1 text-sm text-cyan-600">V</span>
                </div>
                <div className="mt-2 flex justify-between text-[10px] text-stone-500">
                  <span>Range: 0.00 – 12.00 V</span>
                  <span>Accuracy: ±0.01V</span>
                </div>
              </div>

              {/* Ammeter Instrument */}
              <div className="rounded-xl border border-stone-800 bg-stone-900/90 p-4">
                <div className="flex items-center justify-between text-xs text-stone-400">
                  <span className="font-semibold text-stone-300">DC Milliammeter</span>
                  <div className="flex items-center gap-1 rounded bg-stone-800 p-0.5 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setAmmeterRange('500mA')}
                      className={`rounded px-1.5 py-0.5 transition-colors ${
                        ammeterRange === '500mA'
                          ? 'bg-amber-500 font-bold text-stone-950'
                          : 'text-stone-400 hover:text-white'
                      }`}
                    >
                      500mA
                    </button>
                    <button
                      type="button"
                      onClick={() => setAmmeterRange('2A')}
                      className={`rounded px-1.5 py-0.5 transition-colors ${
                        ammeterRange === '2A'
                          ? 'bg-amber-500 font-bold text-stone-950'
                          : 'text-stone-400 hover:text-white'
                      }`}
                    >
                      2.0A
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex items-baseline justify-center rounded-lg bg-black/60 py-3 font-mono">
                  {circuitState.meterOverflow ? (
                    <span className="text-xl font-bold tracking-tight text-rose-500 animate-pulse">
                      OVERFLOW (OL)
                    </span>
                  ) : (
                    <>
                      <span className="text-3xl font-bold tracking-tight text-emerald-400">
                        {ammeterRange === '500mA'
                          ? circuitState.measuredI_mA.toFixed(1)
                          : circuitState.measuredI.toFixed(3)}
                      </span>
                      <span className="ml-1 text-sm text-emerald-600">
                        {ammeterRange === '500mA' ? 'mA' : 'A'}
                      </span>
                    </>
                  )}
                </div>
                <div className="mt-2 flex justify-between text-[10px] text-stone-500">
                  <span>Burden: {ammeterRange === '500mA' ? '1.5Ω' : '0.2Ω'}</span>
                  <span>{circuitState.meterOverflow ? 'Switch to 2A Range!' : 'Protected'}</span>
                </div>
              </div>
            </div>

            {/* Circuit Component Representation */}
            <div className="mt-5 rounded-xl border border-dashed border-stone-700 bg-stone-900/40 p-4">
              <div className="flex items-center justify-between text-xs text-stone-400">
                <span className="font-semibold text-stone-300">Coil under Test (Nichrome Wire)</span>
                <span
                  className={`text-[11px] font-mono ${
                    circuitState.isOverload ? 'text-rose-400 font-bold' : 'text-stone-400'
                  }`}
                >
                  Dynamic R = {circuitState.coilR} Ω
                </span>
              </div>
              <div className="mt-2 flex items-center justify-center gap-2">
                <div
                  className={`h-4 flex-1 rounded transition-all duration-300 ${
                    circuitState.isOverload
                      ? 'bg-gradient-to-r from-amber-600 via-rose-500 to-amber-600 animate-pulse shadow-[0_0_12px_#f43f5e]'
                      : 'bg-stone-700'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Interactive Adjustment Controls */}
          <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs space-y-4 transition-colors">
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">Apparatus Controls & Variable Adjustments</h3>

            {/* Regulated Power Supply Voltage Slider */}
            <div>
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="input-voltage-slider" className="font-semibold text-stone-700 dark:text-stone-300">
                  Regulated DC Power Supply (V_supply)
                </label>
                <span className="font-mono font-bold text-stone-900 dark:text-amber-400">{supplyVoltage.toFixed(1)} V</span>
              </div>
              <input
                id="input-voltage-slider"
                type="range"
                min="0"
                max="10"
                step="0.2"
                value={supplyVoltage}
                onChange={(e) => setSupplyVoltage(parseFloat(e.target.value))}
                className="mt-1.5 w-full accent-amber-500"
              />
              <div className="mt-1 flex justify-between text-[10px] text-stone-500 dark:text-stone-400">
                <span>0.0 V (Min)</span>
                <span>5.0 V</span>
                <span>10.0 V (Max)</span>
              </div>
            </div>

            {/* Rheostat Slider */}
            <div>
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="input-rheostat-slider" className="font-semibold text-stone-700 dark:text-stone-300">
                  Variable Rheostat Series Load (R_h)
                </label>
                <span className="font-mono font-bold text-stone-900 dark:text-amber-400">{rheostatR} Ω</span>
              </div>
              <input
                id="input-rheostat-slider"
                type="range"
                min="0"
                max="80"
                step="1"
                value={rheostatR}
                onChange={(e) => setRheostatR(parseInt(e.target.value, 10))}
                className="mt-1.5 w-full accent-stone-700 dark:accent-stone-400"
              />
              <div className="mt-1 flex justify-between text-[10px] text-stone-500 dark:text-stone-400">
                <span>0 Ω (Max Current)</span>
                <span>40 Ω</span>
                <span>80 Ω (High series drop)</span>
              </div>
            </div>

            {/* Action Bar & Fault Injection */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 dark:border-stone-800 pt-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="btn-toggle-key-switch"
                  onClick={() => setPowerOn(!powerOn)}
                  className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
                    powerOn
                      ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/60'
                      : 'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700'
                  }`}
                >
                  <Power className="h-3.5 w-3.5" />
                  <span>{powerOn ? 'Open Key Switch' : 'Plug In Key Switch'}</span>
                </button>

                <button
                  type="button"
                  id="btn-toggle-loose-contact"
                  onClick={() => setContactFault(!contactFault)}
                  className={`flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                    contactFault
                      ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 font-semibold'
                      : 'border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700'
                  }`}
                  title="Simulates a loose alligator clip introducing 18Ω contact resistance"
                >
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  <span>{contactFault ? 'Fault Active: Loose Clip (+18Ω)' : 'Simulate Loose Contact'}</span>
                </button>
              </div>

              <button
                type="button"
                id="btn-log-observation"
                disabled={!powerOn || circuitState.meterOverflow}
                onClick={handleLogDataPoint}
                className="flex items-center gap-1.5 rounded-lg bg-stone-900 dark:bg-amber-500 px-4 py-2 text-xs font-semibold text-white dark:text-stone-950 shadow-sm transition-all hover:bg-stone-800 dark:hover:bg-amber-400 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5 text-amber-400 dark:text-stone-950" />
                <span>Log (V, I) Observation</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Real-Time Plotter & Logged Data Table (5 cols) */}
        <div className="space-y-6 lg:col-span-5">
          {/* Real-time V vs I Scatter Plot */}
          <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 shadow-xs transition-colors">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-2">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                  V vs I Empirical Plot & Regression
                </h3>
              </div>
              <span className="text-[11px] text-stone-500 dark:text-stone-400">{loggedPoints.length} points</span>
            </div>

            <div className="mt-3 h-52 w-full">
              {loggedPoints.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-stone-200 dark:border-stone-800 text-xs text-stone-500 dark:text-stone-400">
                  <p>No observations recorded yet.</p>
                  <p className="mt-1 text-[11px] text-stone-400">
                    Adjust voltage or rheostat and click "Log (V, I) Observation".
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#292524' : '#e7e5e4'} />
                    <XAxis
                      type="number"
                      dataKey="current"
                      name="Current"
                      unit=" A"
                      domain={[0, 'auto']}
                      tick={{ fontSize: 10, fill: isDark ? '#a8a29e' : '#78716c' }}
                      stroke={isDark ? '#57534e' : '#a8a29e'}
                      label={{ value: 'Current (A)', position: 'bottom', offset: 0, fontSize: 10, fill: isDark ? '#d6d3d1' : '#44403c' }}
                    />
                    <YAxis
                      type="number"
                      dataKey="voltage"
                      name="Voltage"
                      unit=" V"
                      domain={[0, 'auto']}
                      tick={{ fontSize: 10, fill: isDark ? '#a8a29e' : '#78716c' }}
                      stroke={isDark ? '#57534e' : '#a8a29e'}
                      label={{ value: 'Voltage (V)', angle: -90, position: 'insideLeft', fontSize: 10, fill: isDark ? '#d6d3d1' : '#44403c' }}
                    />
                    <Tooltip
                      formatter={(val: any, name: string) => [
                        `${Number(val).toFixed(3)} ${name === 'Voltage' ? 'V' : 'A'}`,
                        name,
                      ]}
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
                      fill="#f59e0b"
                      stroke="#b45309"
                      strokeWidth={1.5}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Regression Summary Box */}
            <div className="mt-3 rounded-lg bg-stone-50 dark:bg-stone-800/80 p-3 text-xs text-stone-700 dark:text-stone-300 border border-stone-100 dark:border-stone-800 transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-stone-900 dark:text-stone-100">Experimental Slope (R = ΔV/ΔI):</span>
                <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                  {regressionStats.isValid ? `${regressionStats.slopeR} Ω` : 'N/A (>1 pt needed)'}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-stone-600 dark:text-stone-400">
                <span>Goodness of Fit (R²):</span>
                <span className="font-mono font-medium text-stone-700 dark:text-stone-300">
                  {regressionStats.isValid ? regressionStats.rSquared : 'N/A'}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-stone-600 dark:text-stone-400">
                <span>Nominal Error:</span>
                <span className="font-mono font-medium text-stone-700 dark:text-stone-300">
                  {regressionStats.isValid
                    ? `${Math.abs(((regressionStats.slopeR - nominalR) / nominalR) * 100).toFixed(1)}%`
                    : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Observation Notebook Table */}
          <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 shadow-xs transition-colors">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                Observation Notebook
              </h3>
              {loggedPoints.length > 0 && (
                <button
                  type="button"
                  onClick={() => setLoggedPoints([])}
                  className="flex items-center gap-1 text-[11px] font-medium text-stone-500 hover:text-rose-600 dark:hover:text-rose-400"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Clear Table</span>
                </button>
              )}
            </div>

            <div className="mt-2 max-h-56 overflow-y-auto">
              {loggedPoints.length === 0 ? (
                <p className="py-6 text-center text-xs text-stone-500 dark:text-stone-400">Table is empty.</p>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 dark:border-stone-800 text-[11px] text-stone-600 dark:text-stone-400">
                      <th className="pb-1.5 font-semibold">#</th>
                      <th className="pb-1.5 font-semibold">V (Volts)</th>
                      <th className="pb-1.5 font-semibold">I (mA)</th>
                      <th className="pb-1.5 font-semibold">R = V/I (Ω)</th>
                      <th className="pb-1.5 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800/80 font-mono text-[11px]">
                    {loggedPoints.map((pt, index) => {
                      const calculatedR = pt.current > 0 ? (pt.voltage / pt.current).toFixed(1) : '0';
                      return (
                        <tr
                          key={pt.id}
                          className={pt.isAnomaly ? 'bg-amber-50/60 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300' : 'hover:bg-stone-50 dark:hover:bg-stone-800/50'}
                        >
                          <td className="py-1.5 font-sans text-stone-500 dark:text-stone-400">{index + 1}</td>
                          <td className="py-1.5 font-semibold text-stone-900 dark:text-stone-100">{pt.voltage.toFixed(2)}</td>
                          <td className="py-1.5 text-stone-700 dark:text-stone-300">{pt.currentMA.toFixed(1)}</td>
                          <td className="py-1.5 font-semibold text-stone-900 dark:text-stone-100">{calculatedR}</td>
                          <td className="py-1.5 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemovePoint(pt.id)}
                              className="text-stone-400 hover:text-rose-600 dark:hover:text-rose-400"
                              title="Delete anomalous point"
                            >
                              <Trash2 className="h-3 w-3 inline" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
