import { motion } from 'motion/react';
import { Zap, Star, TrendingUp } from 'lucide-react';
import { UserState } from '../types';

interface StatsHeaderProps {
  userState: UserState;
}

export function StatsHeader({ userState }: StatsHeaderProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-dragon-gold/20 flex items-center gap-4">
        <div className="bg-dragon-ember/10 p-3 rounded-full">
          <Zap className="w-6 h-6 text-dragon-ember" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider font-semibold text-dragon-muted">Energy</p>
          <p className="text-2xl font-bold text-dragon-ink">{userState.energy}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-dragon-gold/20 flex items-center gap-4">
        <div className="bg-dragon-gold/10 p-3 rounded-full">
          <Star className="w-6 h-6 text-dragon-gold" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider font-semibold text-dragon-muted">Golden Scales</p>
          <p className="text-2xl font-bold text-dragon-ink">{userState.goldenScales}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-dragon-gold/20 flex flex-col justify-center">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-dragon-muted" />
            <p className="text-xs uppercase tracking-wider font-semibold text-dragon-muted">Growth</p>
          </div>
          <p className="text-sm font-bold text-dragon-ink">{userState.growthProgress}%</p>
        </div>
        <div className="w-full bg-dragon-warm h-2 rounded-full overflow-hidden">
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
