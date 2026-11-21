import React from 'react';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  Tooltip,
} from 'recharts';
import { CompetencyKey, COMPETENCY_DIMENSIONS } from '../../types';

interface CompetencyRadarProps {
  scores?: Record<CompetencyKey, number>;
  activeScores?: Record<CompetencyKey, number>;
  benchmarkScores?: Record<CompetencyKey, number>;
  classAverageScores?: Record<CompetencyKey, number>;
  title?: string;
  studentName?: string;
  height?: number;
  isDark?: boolean;
}

export const CompetencyRadar: React.FC<CompetencyRadarProps> = ({
  scores,
  activeScores,
  benchmarkScores,
  classAverageScores,
  title,
  studentName = 'Current Score',
  height = 280,
  isDark = false,
}) => {
  const defaultScores: Record<CompetencyKey, number> = {
    setup_adherence: 75,
    measurement_precision: 75,
    data_interpretation: 75,
    troubleshooting_safety: 75,
    experimental_design: 75,
  };

  const resolvedScores = scores || activeScores || defaultScores;
  const resolvedBenchmark = benchmarkScores || classAverageScores;

  const chartData = (Object.keys(COMPETENCY_DIMENSIONS) as CompetencyKey[]).map((key) => ({
    subject: COMPETENCY_DIMENSIONS[key]?.shortLabel || key,
    fullLabel: COMPETENCY_DIMENSIONS[key]?.label || key,
    studentScore: resolvedScores?.[key] ?? 0,
    benchmarkScore: resolvedBenchmark ? (resolvedBenchmark[key] ?? 0) : undefined,
  }));

  return (
    <div className="w-full">
      {title && <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 mb-2">{title}</h4>}
      <div style={{ height: `${height}px` }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={chartData} margin={{ top: 10, right: 25, bottom: 10, left: 25 }}>
            <PolarGrid stroke={isDark ? '#292524' : '#e7e5e4'} />
            <PolarAngleAxis dataKey="subject" tick={{ fill: isDark ? '#d6d3d1' : '#44403c', fontSize: 10, fontWeight: 600 }} />
            <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9, fill: isDark ? '#a8a29e' : '#78716c' }} angle={30} />
            <Tooltip
              formatter={(val: any, name: string) => [`${val}%`, name]}
              contentStyle={{
                backgroundColor: isDark ? '#1c1917' : '#292524',
                color: '#fff',
                borderRadius: '8px',
                fontSize: '11px',
                border: isDark ? '1px solid #44403c' : 'none',
              }}
            />
            {benchmarkScores && (
              <Radar
                name="Cohort Average"
                dataKey="benchmarkScore"
                stroke={isDark ? '#78716c' : '#a8a29e'}
                fill={isDark ? '#78716c' : '#d6d3d1'}
                fillOpacity={isDark ? 0.35 : 0.25}
              />
            )}
            <Radar
              name={studentName}
              dataKey="studentScore"
              stroke="#f59e0b"
              fill="#f59e0b"
              fillOpacity={0.45}
            />
            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
