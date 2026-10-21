import { motion } from 'motion/react';
import { Zap, Star, TrendingUp, Flame, Heart } from 'lucide-react';
import { UserState } from '../types';
import { activeDaysOf } from '../lib/progression';
import { activeDaysThreshold, bondLevel, bondTotal, evolutionProgress } from '../lib/evolution';
import { Celebration } from './Celebration';

interface StatsHeaderProps {
  userState: UserState;
  /** A gentle glow on the Bond tile right after a Bond level-up. */
  celebrateBond?: boolean;
}

export function StatsHeader({ userState, celebrateBond = false }: StatsHeaderProps) {
  const bond = bondLevel(bondTotal(userState.bond));
  const evolution = evolutionProgress(userState.stage, activeDaysOf(userState));
  // Progress within the current stage, so the label and the bar agree.
  const from = activeDaysThreshold(evolution.stage);
  const stageDays = evolution.next ? evolution.next.at - from : 0;
  const daysIntoStage = evolution.next ? Math.min(stageDays, Math.max(0, evolution.activeDays - from)) : 0;
  const evolutionPercent = evolution.next ? (daysIntoStage / stageDays) * 100 : 100;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
      <div className="bg-surface rounded-2xl p-3 sm:p-4 shadow-sm border border-line flex items-center gap-3 min-w-0 transition-colors">
        <div className="bg-dragon-ember/10 p-2 rounded-full">
          <Zap className="w-5 h-5 text-dragon-ember" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider font-semibold text-fg-muted">Energy</p>
          <p className="text-lg font-bold text-fg">{userState.energy}</p>
        </div>
      </div>

      <div className="bg-surface rounded-2xl p-3 sm:p-4 shadow-sm border border-line flex items-center gap-3 min-w-0 transition-colors">
        <div className="bg-dragon-gold/10 p-2 rounded-full">
          <Star className="w-5 h-5 text-dragon-gold" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider font-semibold text-fg-muted">Scales</p>
          <p className="text-lg font-bold text-fg">{userState.goldenScales}</p>
        </div>
      </div>

      <div className="bg-surface rounded-2xl p-3 sm:p-4 shadow-sm border border-line flex items-center gap-3 min-w-0 transition-colors">
        <div className="bg-orange-500/10 p-2 rounded-full">
          <Flame className="w-5 h-5 text-orange-500" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider font-semibold text-fg-muted">Streak</p>
          <p className="text-lg font-bold text-fg">{userState.currentStreak}d</p>
        </div>
      </div>

      <div className="relative bg-surface rounded-2xl p-3 sm:p-4 shadow-sm border border-line flex flex-col justify-center transition-colors">
        <Celebration active={celebrateBond} rounded="rounded-2xl" />
        <div className="flex flex-wrap justify-between items-center gap-x-2 mb-1">
          <div className="flex items-center gap-1">
            <Heart className="w-3 h-3 text-rose-500" />
            <p className="text-xs uppercase tracking-wider font-semibold text-fg-muted">Bond Lv {bond.level}</p>
          </div>
          <p className="text-xs font-bold text-fg">{Math.floor(bond.intoLevel)}/{bond.toNext}</p>
        </div>
        <div className="w-full bg-fg/5 h-1.5 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(bond.intoLevel / bond.toNext) * 100}%` }}
            className="h-full bg-rose-400"
          />
        </div>
      </div>

      <div className="bg-surface rounded-2xl p-3 sm:p-4 shadow-sm border border-line flex flex-col justify-center col-span-2 md:col-span-4 transition-colors">
        <div className="flex flex-wrap justify-between items-center gap-x-2 mb-1">
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-fg-muted" />
            <p className="text-xs uppercase tracking-wider font-semibold text-fg-muted">
              {evolution.next ? `${evolution.stage} → ${evolution.next.stage}` : `${evolution.stage} 🐉`}
            </p>
          </div>
          <p className="text-xs font-bold text-fg">
            {evolution.next ? `${daysIntoStage} / ${stageDays} days` : 'Fully evolved'}
          </p>
        </div>
        <div className="w-full bg-fg/5 h-1.5 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${evolutionPercent}%` }}
            className="h-full bg-heat-gradient"
          />
        </div>
        <p className="mt-1 text-xs text-fg-muted">
          {evolution.activeDays} lifetime active {evolution.activeDays === 1 ? 'day' : 'days'}
        </p>
      </div>
    </div>
  );
}
