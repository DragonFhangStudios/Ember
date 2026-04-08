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
      <div className="flex items-center gap-2 text-dragon-gold mb-6">
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
                "bg-white rounded-2xl p-4 border transition-all flex items-center gap-4",
                isEquipped ? "border-dragon-gold ring-1 ring-dragon-gold" : "border-dragon-gold/10"
              )}
            >
              <div className="w-16 h-16 bg-dragon-warm rounded-xl overflow-hidden flex-shrink-0">
                <img src={item.image} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-dragon-ink truncate">{item.name}</h3>
                <p className="text-xs text-dragon-muted capitalize">{item.category}</p>
                {!isOwned && (
                  <div className="flex items-center gap-1 mt-1 text-dragon-gold font-bold text-sm">
                    <span>{item.price}</span>
                    <div className="w-2 h-2 rounded-full bg-dragon-gold" />
                  </div>
                )}
              </div>

              {isOwned ? (
                <button
                  onClick={() => onEquip(item)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                    isEquipped 
                      ? "bg-dragon-gold text-white" 
                      : "bg-dragon-warm text-dragon-ink hover:bg-dragon-gold/10"
                  )}
                >
                  {isEquipped ? <Check className="w-4 h-4" /> : 'Equip'}
                </button>
              ) : (
                <button
                  onClick={() => onBuy(item)}
                  disabled={!canAfford}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1",
                    canAfford 
                      ? "bg-dragon-ink text-white hover:bg-black" 
                      : "bg-dragon-warm text-dragon-muted cursor-not-allowed"
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
