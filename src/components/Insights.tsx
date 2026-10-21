import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { TrendingUp, Activity, Heart } from 'lucide-react';
import { SymptomLog } from '../types';

interface InsightsProps {
  logs: SymptomLog[];
  dark: boolean;
}

// Chart colors per theme (SVG attributes can't use the CSS theme variables).
// Axis labels use the muted text color, which meets WCAG AA on the cards.
const CHART = {
  light: { grid: '#E8E8E2', tick: '#62666E' },
  dark: { grid: '#333333', tick: '#A3A7AE' },
};
const TOOLTIP = {
  contentStyle: { borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', backgroundColor: 'var(--card-bg)', color: 'var(--text-primary)' },
  itemStyle: { color: 'var(--text-primary)' },
  labelStyle: { color: 'var(--text-secondary)' },
};

export function Insights({ logs, dark }: InsightsProps) {
  const chart = dark ? CHART.dark : CHART.light;
  const data = logs.slice(-7).map(log => ({
    date: new Date(log.date).toLocaleDateString('en-US', { weekday: 'short' }),
    energy: log.energy,
    mood: log.mood,
  }));

  if (logs.length === 0) {
    return (
      <div className="bg-surface rounded-3xl p-12 shadow-xl border border-line text-center">
        <div className="bg-surface-muted p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
          <Activity className="w-8 h-8 text-fg-muted" />
        </div>
        <h3 className="serif text-xl font-bold text-fg mb-2">No Insights Yet</h3>
        <p className="text-sm text-fg-muted">
          Keep logging your symptoms daily to see patterns and trends.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2 text-fg mb-6">
        <TrendingUp className="w-6 h-6" />
        <h2 className="serif text-2xl font-bold">Health Insights</h2>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-surface rounded-3xl p-6 shadow-xl border border-line">
          <div className="flex items-center gap-2 mb-6 text-dragon-ember">
            <Activity className="w-5 h-5" />
            <h3 className="font-bold text-fg">Energy Trends</h3>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorEnergy" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF4E00" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#FF4E00" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chart.grid} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: chart.tick }} />
                <YAxis domain={[0, 5]} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: chart.tick }} />
                <Tooltip {...TOOLTIP} />
                <Area type="monotone" dataKey="energy" stroke="#FF4E00" fillOpacity={1} fill="url(#colorEnergy)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-surface rounded-3xl p-6 shadow-xl border border-line">
          <div className="flex items-center gap-2 mb-6 text-rose-500">
            <Heart className="w-5 h-5" />
            <h3 className="font-bold text-fg">Mood Trends</h3>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorMood" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#F43F5E" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chart.grid} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: chart.tick }} />
                <YAxis domain={[0, 5]} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: chart.tick }} />
                <Tooltip {...TOOLTIP} />
                <Area type="monotone" dataKey="mood" stroke="#F43F5E" fillOpacity={1} fill="url(#colorMood)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      <p className="text-xs text-fg-muted text-center italic">
        Showing trends for the last 7 check-ins.
      </p>
    </div>
  );
}
