import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, LayoutDashboard, Timer, Heart, Settings, ShoppingBag, TrendingUp, Trophy, Plus } from 'lucide-react';
import { UserState, DragonStage, Quest, CosmeticItem, Badge } from './types';
import { INITIAL_QUESTS, BADGES, COSMETICS } from './constants';
import { DragonAvatar } from './components/DragonAvatar';
import { StatsHeader } from './components/StatsHeader';
import { QuestItem } from './components/QuestItem';
import { FocusTimer } from './components/FocusTimer';
import { SymptomCheckIn } from './components/SymptomCheckIn';
import { MedicalDisclaimer } from './components/MedicalDisclaimer';
import { Wardrobe } from './components/Wardrobe';
import { Insights } from './components/Insights';
import { Badges } from './components/Badges';
import { CustomQuestForm } from './components/CustomQuestForm';
import { BondingActions } from './components/BondingActions';
import { cn } from './lib/utils';

const STORAGE_KEY = 'ember_user_state_v2';

export default function App() {
  const [state, setState] = useState<UserState | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'focus' | 'checkin' | 'wardrobe' | 'insights' | 'badges'>('dashboard');
  const [isFocusActive, setIsFocusActive] = useState(false);
  const [showCustomQuest, setShowCustomQuest] = useState(false);

  // Load state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as UserState;
      
      // Check for daily reset
      const today = new Date().toDateString();
      if (parsed.lastLogin !== today) {
        const resetQuests = parsed.quests.map(q => q.isDaily ? { ...q, completed: false } : q);
        const anyCompletedYesterday = parsed.quests.some(q => q.completed);
        
        const newState = {
          ...parsed,
          quests: resetQuests,
          lastLogin: today,
          isNapping: !anyCompletedYesterday,
          energy: Math.max(0, parsed.energy - 10),
        };
        setState(newState);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
      } else {
        setState(parsed);
      }
    } else {
      const initialState: UserState = {
        dragonName: 'Ember',
        stage: DragonStage.EGG,
        energy: 50,
        goldenScales: 0,
        growthProgress: 0,
        lastLogin: new Date().toDateString(),
        isNapping: false,
        quests: INITIAL_QUESTS,
        symptomLogs: [],
        inventory: [],
        equipped: {},
        badges: BADGES,
        petCount: 0,
      };
      setState(initialState);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialState));
    }
  }, []);

  useEffect(() => {
    if (state) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      checkBadges(state);
    }
  }, [state]);

  const checkBadges = (currentState: UserState) => {
    let updated = false;
    const newBadges = currentState.badges.map(badge => {
      if (badge.unlockedAt) return badge;

      let unlocked = false;
      if (badge.id === 'badge_hatch' && currentState.stage !== DragonStage.EGG) unlocked = true;
      if (badge.id === 'badge_pet_10' && currentState.petCount >= 10) unlocked = true;
      if (badge.id === 'badge_focus_5') {
        const focusQuestsDone = currentState.quests.filter(q => q.type === 'focus' && q.completed).length;
        // This is tricky because we reset daily. We might need a totalFocusCount in state.
        // For now, let's just check if they've done it today as a placeholder or add a counter.
      }

      if (unlocked) {
        updated = true;
        return { ...badge, unlockedAt: new Date().toISOString() };
      }
      return badge;
    });

    if (updated) {
      setState(prev => prev ? { ...prev, badges: newBadges } : null);
    }
  };

  const handleToggleQuest = (id: string) => {
    if (!state) return;
    const quest = state.quests.find(q => q.id === id);
    if (!quest || quest.completed) return;

    const newQuests = state.quests.map(q => q.id === id ? { ...q, completed: true } : q);
    let energyGain = quest.points;
    let scaleGain = 0;
    let growthGain = 2;

    if (quest.type === 'medication') {
      scaleGain = 10;
      growthGain = 5;
    }

    const newGrowth = state.growthProgress + growthGain;
    let newStage = state.stage;
    if (newGrowth >= 91) newStage = DragonStage.ELDER;
    else if (newGrowth >= 66) newStage = DragonStage.ADULT;
    else if (newGrowth >= 41) newStage = DragonStage.TEEN;
    else if (newGrowth >= 21) newStage = DragonStage.HATCHLING;

    setState({
      ...state,
      quests: newQuests,
      energy: state.energy + energyGain,
      goldenScales: state.goldenScales + scaleGain,
      growthProgress: Math.min(100, newGrowth),
      stage: newStage,
      isNapping: false,
    });
  };

  const handleAddCustomQuest = (quest: Quest) => {
    if (!state) return;
    setState({
      ...state,
      quests: [...state.quests, quest]
    });
  };

  const handleBuyItem = (item: CosmeticItem) => {
    if (!state || state.goldenScales < item.price) return;
    setState({
      ...state,
      goldenScales: state.goldenScales - item.price,
      inventory: [...state.inventory, item.id]
    });
  };

  const handleEquipItem = (item: CosmeticItem) => {
    if (!state) return;
    const isEquipped = state.equipped[item.category] === item.id;
    setState({
      ...state,
      equipped: {
        ...state.equipped,
        [item.category]: isEquipped ? undefined : item.id
      }
    });
  };

  const handlePet = () => {
    if (!state) return;
    const now = new Date().getTime();
    const lastPet = state.lastPetAt ? new Date(state.lastPetAt).getTime() : 0;
    
    // Cooldown of 5 seconds for petting
    if (now - lastPet < 5000) return;

    setState({
      ...state,
      petCount: state.petCount + 1,
      lastPetAt: new Date().toISOString(),
      energy: state.energy + 1,
      isNapping: false
    });
  };

  const handleFeed = () => {
    if (!state || state.energy < 5) return;
    setState({
      ...state,
      energy: state.energy + 10,
      growthProgress: Math.min(100, state.growthProgress + 0.5),
      isNapping: false
    });
  };

  const handleFocusComplete = (points: number) => {
    if (!state) return;
    const newQuests = state.quests.map(q => 
      q.type === 'focus' ? { ...q, completed: true } : q
    );

    setState({
      ...state,
      quests: newQuests,
      energy: state.energy + points,
      growthProgress: Math.min(100, state.growthProgress + 3),
      isNapping: false,
    });
  };

  const handleCheckInComplete = (energy: number, mood: number) => {
    if (!state) return;
    const newLog = {
      date: new Date().toISOString(),
      energy,
      mood,
    };
    const newQuests = state.quests.map(q => 
      q.type === 'symptom' ? { ...q, completed: true } : q
    );

    setState({
      ...state,
      quests: newQuests,
      symptomLogs: [...state.symptomLogs, newLog],
      energy: state.energy + 5,
      growthProgress: Math.min(100, state.growthProgress + 1),
      isNapping: false,
    });
  };

  if (!state) return null;

  return (
    <div className="min-h-screen bg-dragon-warm pb-24">
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-dragon-gold/10 px-6 py-4">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-dragon-ember rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="serif text-2xl font-bold text-dragon-ink">Ember</h1>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setActiveTab('insights')}
              className={cn("p-2 rounded-lg transition-colors", activeTab === 'insights' ? "bg-dragon-gold/10 text-dragon-gold" : "text-dragon-muted hover:text-dragon-ink")}
            >
              <TrendingUp className="w-6 h-6" />
            </button>
            <button 
              onClick={() => setActiveTab('badges')}
              className={cn("p-2 rounded-lg transition-colors", activeTab === 'badges' ? "bg-dragon-gold/10 text-dragon-gold" : "text-dragon-muted hover:text-dragon-ink")}
            >
              <Trophy className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 pt-8">
        <StatsHeader userState={state} />

        <div className="bg-white rounded-3xl p-8 shadow-xl border border-dragon-gold/10 mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-dragon-gold/5 rounded-full -mr-16 -mt-16 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-dragon-ember/5 rounded-full -ml-16 -mb-16 blur-3xl" />
          
          <DragonAvatar 
            stage={state.stage} 
            isNapping={state.isNapping} 
            isMeditating={isFocusActive}
            equipped={state.equipped}
          />

          <BondingActions 
            onPet={handlePet} 
            onFeed={handleFeed} 
            canPet={!state.lastPetAt || (new Date().getTime() - new Date(state.lastPetAt).getTime() > 5000)} 
          />

          {state.isNapping && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 p-4 bg-dragon-warm/50 rounded-2xl text-center border border-dragon-gold/10"
            >
              <p className="text-sm text-dragon-muted">
                Ember is resting today. Complete a quest to wake them up!
              </p>
            </motion.div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              <div className="flex justify-between items-center mb-2">
                <h2 className="serif text-2xl font-bold text-dragon-ink">Daily Quests</h2>
                <button 
                  onClick={() => setShowCustomQuest(true)}
                  className="flex items-center gap-1 text-xs font-bold text-dragon-gold uppercase tracking-widest hover:text-dragon-ember transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add Custom
                </button>
              </div>
              {state.quests.map((quest: Quest) => (
                <QuestItem 
                  key={quest.id} 
                  quest={quest} 
                  onToggle={handleToggleQuest} 
                />
              ))}
            </motion.div>
          )}

          {activeTab === 'focus' && (
            <motion.div key="focus" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }}>
              <FocusTimer onComplete={handleFocusComplete} isActive={isFocusActive} setIsActive={setIsFocusActive} />
            </motion.div>
          )}

          {activeTab === 'checkin' && (
            <motion.div key="checkin" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <SymptomCheckIn onComplete={handleCheckInComplete} />
            </motion.div>
          )}

          {activeTab === 'wardrobe' && (
            <motion.div key="wardrobe" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <Wardrobe userState={state} onBuy={handleBuyItem} onEquip={handleEquipItem} />
            </motion.div>
          )}

          {activeTab === 'insights' && (
            <motion.div key="insights" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <Insights logs={state.symptomLogs} />
            </motion.div>
          )}

          {activeTab === 'badges' && (
            <motion.div key="badges" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <Badges badges={state.badges} />
            </motion.div>
          )}
        </AnimatePresence>

        <MedicalDisclaimer />
      </main>

      {/* Custom Quest Modal */}
      <AnimatePresence>
        {showCustomQuest && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setShowCustomQuest(false)}
              className="absolute inset-0 bg-dragon-ink/40 backdrop-blur-sm" 
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative z-10 w-full max-w-md"
            >
              <CustomQuestForm onAdd={handleAddCustomQuest} onClose={() => setShowCustomQuest(false)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-dragon-gold/10 px-6 py-3 z-50">
        <div className="max-w-2xl mx-auto flex justify-around items-center">
          <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={LayoutDashboard} label="Home" />
          <NavButton active={activeTab === 'focus'} onClick={() => setActiveTab('focus')} icon={Timer} label="Focus" />
          <NavButton active={activeTab === 'checkin'} onClick={() => setActiveTab('checkin')} icon={Heart} label="Check-in" />
          <NavButton active={activeTab === 'wardrobe'} onClick={() => setActiveTab('wardrobe')} icon={ShoppingBag} label="Shop" />
        </div>
      </nav>
    </div>
  );
}

function NavButton({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) {
  return (
    <button onClick={onClick} className={cn("flex flex-col items-center gap-1 transition-all", active ? "text-dragon-ember" : "text-dragon-muted hover:text-dragon-ink")}>
      <div className={cn("p-2 rounded-xl transition-all", active ? "bg-dragon-ember/10" : "bg-transparent")}>
        <Icon className="w-6 h-6" />
      </div>
      <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
    </button>
  );
}
