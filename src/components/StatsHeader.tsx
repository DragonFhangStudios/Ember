import { motion } from 'motion/react';
import { Zap, Star, TrendingUp, Flame, Heart } from 'lucide-react';
import { UserState } from '../types';
import { activeDaysOf } from '../lib/progression';
import { activeDaysThreshold, bondLevel, bondTotal, evolutionProgress } from '../lib/evolution';

interface StatsHeaderProps {
  userState: UserState;
}

export function StatsHeader({ userState }: StatsHeaderProps) {
  const bond = bondLevel(bondTotal(userState.bond));
  const evolution = evolutionProgress(userState.stage, activeDaysOf(userState));
  // Progress within the current stage, so the label and the bar agree.
  const from = activeDaysThreshold(evolution.stage);
  const stageDays = evolution.next ? evolution.next.at - from : 0;
  const daysIntoStage = evolution.next ? Math.min(stageDays, Math.max(0, evolution.activeDays - from)) : 0;
  const evolutionPercent = evolution.next ? (daysIntoStage / stageDays) * 100 : 100;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <div className="bg-[var(--card-bg)] rounded-2xl p-4 shadow-sm border border-[var(--border-color)] flex items-center gap-3 transition-colors">
        <div className="bg-dragon-ember/10 p-2 rounded-full">
          <Zap className="w-5 h-5 text-dragon-ember" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-secondary)]">Energy</p>
          <p className="text-lg font-bold text-[var(--text-primary)]">{userState.energy}</p>
        </div>
      </div>

      <div className="bg-[var(--card-bg)] rounded-2xl p-4 shadow-sm border border-[var(--border-color)] flex items-center gap-3 transition-colors">
        <div className="bg-dragon-gold/10 p-2 rounded-full">
          <Star className="w-5 h-5 text-dragon-gold" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-secondary)]">Scales</p>
          <p className="text-lg font-bold text-[var(--text-primary)]">{userState.goldenScales}</p>
        </div>
      </div>

      <div className="bg-[var(--card-bg)] rounded-2xl p-4 shadow-sm border border-[var(--border-color)] flex items-center gap-3 transition-colors">
        <div className="bg-orange-500/10 p-2 rounded-full">
          <Flame className="w-5 h-5 text-orange-500" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-secondary)]">Streak</p>
          <p className="text-lg font-bold text-[var(--text-primary)]">{userState.currentStreak}d</p>
        </div>
      </div>

      <div className="bg-[var(--card-bg)] rounded-2xl p-4 shadow-sm border border-[var(--border-color)] flex flex-col justify-center transition-colors">
        <div className="flex justify-between items-center mb-1">
          <div className="flex items-center gap-1">
            <Heart className="w-3 h-3 text-rose-500" />
            <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-secondary)]">Bond Lv {bond.level}</p>
          </div>
          <p className="text-[10px] font-bold text-[var(--text-primary)]">{Math.floor(bond.intoLevel)}/{bond.toNext}</p>
        </div>
        <div className="w-full bg-dragon-warm/20 h-1.5 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(bond.intoLevel / bond.toNext) * 100}%` }}
            className="h-full bg-rose-400"
          />
        </div>
      </div>

      <div className="bg-[var(--card-bg)] rounded-2xl p-4 shadow-sm border border-[var(--border-color)] flex flex-col justify-center col-span-2 md:col-span-4 transition-colors">
        <div className="flex justify-between items-center mb-1">
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-[var(--text-secondary)]" />
            <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-secondary)]">
              {evolution.next ? `${evolution.stage} → ${evolution.next.stage}` : `${evolution.stage} 🐉`}
            </p>
          </div>
          <p className="text-xs font-bold text-[var(--text-primary)]">
            {evolution.next ? `${daysIntoStage} / ${stageDays} days` : 'Fully evolved'}
          </p>
        </div>
        <div className="w-full bg-dragon-warm/20 h-1.5 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${evolutionPercent}%` }}
            className="h-full bg-heat-gradient"
          />
        </div>
        <p className="mt-1 text-[10px] text-[var(--text-secondary)]">
          {evolution.activeDays} lifetime active {evolution.activeDays === 1 ? 'day' : 'days'}
        </p>
      </div>
    </div>
  );
}
