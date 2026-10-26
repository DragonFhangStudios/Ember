import { motion } from 'motion/react';
import { ShoppingBag, Check, Lock } from 'lucide-react';
import { COSMETICS } from '../constants';
import { CosmeticItem, UserState } from '../types';
import { cn } from '../lib/utils';

interface WardrobeProps {
  userState: UserState;
  onBuy: (item: CosmeticItem) => void;
  onEquip: (item: CosmeticItem) => void;
}

export function Wardrobe({ userState, onBuy, onEquip }: WardrobeProps) {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2 text-gold-fg mb-6">
        <ShoppingBag className="w-6 h-6" />
        <h2 className="serif text-2xl font-bold">Dragon Wardrobe</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {COSMETICS.map((item) => {
          const isOwned = userState.inventory.includes(item.id);
          const isEquipped = Object.values(userState.equipped).includes(item.id);
          const canAfford = userState.goldenScales >= item.price;

          return (
            <motion.div
              key={item.id}
              whileHover={{ scale: 1.02 }}
              className={cn(
                "bg-surface rounded-2xl p-4 border transition-all flex items-center gap-3 sm:gap-4",
                isEquipped ? "border-dragon-gold ring-1 ring-dragon-gold" : "border-line"
              )}
            >
              <div className="w-16 h-16 bg-surface-muted rounded-xl overflow-hidden flex-shrink-0">
                <img src={item.image} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-fg truncate">{item.name}</h3>
                <p className="text-xs text-fg-muted capitalize">{item.category}</p>
                {!isOwned && (
                  <div className="flex items-center gap-1 mt-1 text-gold-fg font-bold text-sm">
                    <span>{item.price}</span>
                    <div className="w-2 h-2 rounded-full bg-dragon-gold" />
                  </div>
                )}
              </div>

              {isOwned ? (
                <button
                  onClick={() => onEquip(item)}
                  aria-label={isEquipped ? `${item.name}, equipped` : `Equip ${item.name}`}
                  aria-pressed={isEquipped}
                  className={cn(
                    "min-h-11 min-w-11 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center",
                    isEquipped 
                      ? "bg-dragon-gold text-dragon-ink" 
                      : "bg-surface-muted text-fg hover:bg-dragon-gold/10"
                  )}
                >
                  {isEquipped ? <Check className="w-4 h-4" /> : 'Equip'}
                </button>
              ) : (
                <button
                  onClick={() => onBuy(item)}
                  disabled={!canAfford}
                  aria-label={`Buy ${item.name} for ${item.price} Golden Scales`}
                  className={cn(
                    "min-h-11 min-w-11 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1",
                    canAfford 
                      ? "bg-fg text-surface hover:opacity-90" 
                      : "bg-surface-muted text-fg-muted cursor-not-allowed"
                  )}
                >
                  {!canAfford && <Lock className="w-3 h-3" />}
                  Buy
                </button>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
