import { motion } from 'motion/react';
import { Zap, Star, TrendingUp, Flame } from 'lucide-react';
import { UserState } from '../types';

interface StatsHeaderProps {
  userState: UserState;
}

export function StatsHeader({ userState }: StatsHeaderProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-dragon-gold/20 flex items-center gap-3">
        <div className="bg-dragon-ember/10 p-2 rounded-full">
          <Zap className="w-5 h-5 text-dragon-ember" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider font-semibold text-dragon-muted">Energy</p>
          <p className="text-lg font-bold text-dragon-ink">{userState.energy}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-dragon-gold/20 flex items-center gap-3">
        <div className="bg-dragon-gold/10 p-2 rounded-full">
          <Star className="w-5 h-5 text-dragon-gold" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider font-semibold text-dragon-muted">Scales</p>
          <p className="text-lg font-bold text-dragon-ink">{userState.goldenScales}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-dragon-gold/20 flex items-center gap-3">
        <div className="bg-orange-500/10 p-2 rounded-full">
          <Flame className="w-5 h-5 text-orange-500" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider font-semibold text-dragon-muted">Streak</p>
          <p className="text-lg font-bold text-dragon-ink">{userState.currentStreak}d</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-dragon-gold/20 flex flex-col justify-center col-span-2 md:col-span-1">
        <div className="flex justify-between items-center mb-1">
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-dragon-muted" />
            <p className="text-[10px] uppercase tracking-wider font-semibold text-dragon-muted">Growth</p>
          </div>
          <p className="text-xs font-bold text-dragon-ink">{userState.growthProgress}%</p>
        </div>
        <div className="w-full bg-dragon-warm h-1.5 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${userState.growthProgress}%` }}
            className="h-full bg-dragon-gold"
          />
        </div>
      </div>
    </div>
  );
}
