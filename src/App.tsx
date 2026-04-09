import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, LayoutDashboard, Timer, Heart, Settings, ShoppingBag, TrendingUp, Trophy, Plus, ChevronDown, Palette } from 'lucide-react';
import { UserState, DragonStage, Quest, CosmeticItem, Badge, CustomQuestType } from './types';
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
import { ResetConfirmationModal } from './components/ResetConfirmationModal';
import { cn } from './lib/utils';

const STORAGE_KEY = 'ember_user_state_v2';

export default function App() {
  const [state, setState] = useState<UserState | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'focus' | 'checkin' | 'wardrobe' | 'insights' | 'badges'>('dashboard');
  const [isFocusActive, setIsFocusActive] = useState(false);
  const [showCustomQuest, setShowCustomQuest] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isPetted, setIsPetted] = useState(false);
  const [petFlavorText, setPetFlavorText] = useState<string | null>(null);
  const [isLevelingUp, setIsLevelingUp] = useState(false);
  const prevStageRef = useRef<DragonStage | null>(null);

  // Apply dark mode class
  useEffect(() => {
    if (state?.isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [state?.isDarkMode]);

  // Detect stage changes for level up animation
  useEffect(() => {
    if (state && prevStageRef.current && state.stage !== prevStageRef.current) {
      setIsLevelingUp(true);
      setTimeout(() => setIsLevelingUp(false), 5000);
    }
    if (state) {
      prevStageRef.current = state.stage;
    }
  }, [state?.stage]);

  // Load state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as UserState;
      if (!parsed.customQuestTypes) parsed.customQuestTypes = [];
      if (parsed.currentStreak === undefined) parsed.currentStreak = 0;
      if (parsed.bestStreak === undefined) parsed.bestStreak = 0;
      
      const initializedQuests = parsed.quests.map(q => ({
        ...q,
        progress: q.progress ?? (q.completed ? (q.target ?? 1) : 0),
        target: q.target ?? 1,
      }));

      // Check for daily reset
      const today = new Date().toDateString();
      if (parsed.lastLogin !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toDateString();
        
        const allCompletedYesterday = initializedQuests.every(q => q.completed);
        let newStreak = parsed.currentStreak;

        if (parsed.lastLogin === yesterdayStr) {
          if (allCompletedYesterday) {
            newStreak += 1;
          } else {
            newStreak = 0;
          }
        } else {
          // Missed more than one day
          newStreak = 0;
        }

        // Daily Ritual Check: If missed petting or incubating yesterday, reset growth
        const lastPet = parsed.lastPetAt ? new Date(parsed.lastPetAt).toDateString() : '';
        const lastIncubate = parsed.lastIncubateAt ? new Date(parsed.lastIncubateAt).toDateString() : '';
        
        let newGrowth = parsed.growthProgress;
        if (lastPet !== yesterdayStr || lastIncubate !== yesterdayStr) {
          // Reset growth if ritual was missed
          newGrowth = 0;
        }

        const resetQuests = initializedQuests.map(q => q.isDaily ? { ...q, completed: false, progress: 0 } : q);
        
        const newState = {
          ...parsed,
          quests: resetQuests,
          lastLogin: today,
          isNapping: !allCompletedYesterday,
          energy: Math.max(0, parsed.energy - 10),
          currentStreak: newStreak,
          bestStreak: Math.max(parsed.bestStreak, newStreak),
          growthProgress: newGrowth,
          stage: DragonStage.EGG, // Softlock to Egg
        };
        setState(newState);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
      } else {
        setState({ ...parsed, quests: initializedQuests });
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
        customQuestTypes: [],
        currentStreak: 0,
        bestStreak: 0,
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
      if (badge.id === 'badge_streak_3' && currentState.currentStreak >= 3) unlocked = true;
      if (badge.id === 'badge_streak_7' && currentState.currentStreak >= 7) unlocked = true;
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

  const handleUpdateQuestProgress = (id: string, increment: number = 1) => {
    if (!state) return;
    const quest = state.quests.find(q => q.id === id);
    if (!quest || quest.completed) return;

    const newProgress = Math.min(quest.target, quest.progress + increment);
    const isNowCompleted = newProgress === quest.target;
    
    const pointsPerStep = quest.points / quest.target;
    const energyGain = pointsPerStep * increment;
    
    let scaleGain = 0;
    let growthGain = (2 / quest.target) * increment;

    if (quest.type === 'medication' && isNowCompleted) {
      scaleGain = 10;
      growthGain = 5;
    }

    const newQuests = state.quests.map(q => 
      q.id === id ? { ...q, progress: newProgress, completed: isNowCompleted } : q
    );

    const newGrowth = state.growthProgress + growthGain;
    let newStage = state.stage;
    if (newGrowth >= 91) newStage = DragonStage.ANCIENT;
    else if (newGrowth >= 66) newStage = DragonStage.DRAKE;
    else if (newGrowth >= 41) newStage = DragonStage.FLEDGLING;
    else if (newGrowth >= 21) newStage = DragonStage.HATCHLING;

    setState({
      ...state,
      quests: newQuests,
      energy: Math.round(state.energy + energyGain),
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

  const handleAddCustomType = (type: CustomQuestType) => {
    if (!state) return;
    setState({
      ...state,
      customQuestTypes: [...state.customQuestTypes, type]
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

  const handleUpdateTheme = (color: string) => {
    if (!state) return;
    setState({
      ...state,
      themeColor: color
    });
  };

  const handleToggleDarkMode = () => {
    if (!state) return;
    setState({
      ...state,
      isDarkMode: !state.isDarkMode
    });
  };

  const handleResetProgress = () => {
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
      customQuestTypes: [],
      currentStreak: 0,
      bestStreak: 0,
      isDarkMode: state?.isDarkMode,
      themeColor: state?.themeColor
    };
    
    setState(initialState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialState));
    setActiveTab('dashboard');
    setShowResetConfirm(false);
  };

  const handlePet = () => {
    if (!state) return;
    const today = new Date().toDateString();
    const lastPet = state.lastPetAt ? new Date(state.lastPetAt).toDateString() : '';
    
    if (lastPet === today) {
      setPetFlavorText("Ember is already clean and hydrated for today.");
      setTimeout(() => setPetFlavorText(null), 3000);
      return;
    }

    setIsPetted(true);
    if (state.stage === DragonStage.EGG) {
      setPetFlavorText("You carefully clean the shell and ensure it's hydrated. Ember pulses warmly.");
    } else {
      setPetFlavorText("Ember chirps happily and leans into your touch.");
    }

    setTimeout(() => {
      setIsPetted(false);
      setTimeout(() => setPetFlavorText(null), 2000);
    }, 1000);

    setState({
      ...state,
      petCount: state.petCount + 1,
      lastPetAt: new Date().toISOString(),
      energy: state.energy + 5,
      growthProgress: Math.min(100, state.growthProgress + 2),
      isNapping: false
    });
  };

  const handleFeed = () => {
    if (!state) return;
    const today = new Date().toDateString();
    const lastIncubate = state.lastIncubateAt ? new Date(state.lastIncubateAt).toDateString() : '';

    if (state.stage === DragonStage.EGG) {
      if (lastIncubate === today) {
        setPetFlavorText("The egg has already been incubated today. It's glowing steadily.");
        setTimeout(() => setPetFlavorText(null), 3000);
        return;
      }

      setPetFlavorText("You provide a spark of warmth. The egg glows with life!");
      setTimeout(() => setPetFlavorText(null), 3000);

      setState({
        ...state,
        lastIncubateAt: new Date().toISOString(),
        energy: state.energy + 10,
        growthProgress: Math.min(100, state.growthProgress + 5),
        isNapping: false
      });
      return;
    }

    if (state.energy < 5) return;
    const newGrowth = state.growthProgress + 0.5;
    let newStage = state.stage;
    
    // Softlock: Don't go past Egg for now
    if (state.stage === DragonStage.EGG) {
      newStage = DragonStage.EGG;
    } else {
      if (newGrowth >= 91) newStage = DragonStage.ANCIENT;
      else if (newGrowth >= 66) newStage = DragonStage.DRAKE;
      else if (newGrowth >= 41) newStage = DragonStage.FLEDGLING;
      else if (newGrowth >= 21) newStage = DragonStage.HATCHLING;
    }

    setState({
      ...state,
      energy: state.energy + 10,
      growthProgress: Math.min(100, newGrowth),
      stage: newStage,
      isNapping: false
    });
  };

  const handleFocusComplete = (points: number) => {
    if (!state) return;
    const newQuests = state.quests.map(q => 
      q.type === 'focus' ? { ...q, progress: q.target, completed: true } : q
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
      q.type === 'symptom' ? { ...q, progress: q.target, completed: true } : q
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

  const BACKGROUND_COLORS = [
    { name: 'Warm White', value: '#F5F5F0' },
    { name: 'Soft Blue', value: '#EBF5FF' },
    { name: 'Mint Green', value: '#F0FFF4' },
    { name: 'Lavender', value: '#F5F3FF' },
    { name: 'Peach', value: '#FFF5F5' },
    { name: 'Sunset', value: '#FFF7ED' },
  ];

  return (
    <div className="min-h-screen transition-colors duration-700 pb-24 bg-app-custom" style={{ backgroundColor: state.themeColor }}>
      <header className="bg-[var(--card-bg)]/80 backdrop-blur-md sticky top-0 z-50 border-b border-[var(--border-color)] px-6 py-4 transition-colors">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-dragon-ember rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="serif text-2xl font-bold text-[var(--text-primary)]">Ember</h1>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleToggleDarkMode}
              className="p-2 rounded-lg text-dragon-muted hover:text-dragon-ink transition-colors"
              title="Toggle Dark Mode"
            >
              {state.isDarkMode ? <Sparkles className="w-6 h-6" /> : <Palette className="w-6 h-6" />}
            </button>
            <button 
              onClick={() => setShowResetConfirm(true)}
              className="p-2 rounded-lg text-dragon-muted hover:text-red-500 transition-colors"
              title="Reset Progress"
            >
              <Settings className="w-6 h-6" />
            </button>
            <div className="h-6 w-px bg-dragon-gold/20 mx-1" />
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
            <div className="h-6 w-px bg-dragon-gold/20 mx-1" />
            <div className="flex gap-1 items-center">
              <input 
                type="color" 
                value={state.themeColor || '#F5F5F0'} 
                onChange={(e) => handleUpdateTheme(e.target.value)}
                className="w-6 h-6 rounded-full border-none cursor-pointer bg-transparent"
                title="Custom Background Color"
              />
              {BACKGROUND_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => handleUpdateTheme(color.value)}
                  className={cn(
                    "w-6 h-6 rounded-full border-2 transition-all",
                    state.themeColor === color.value ? "border-dragon-gold scale-110 shadow-sm" : "border-transparent hover:scale-105"
                  )}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 pt-8">
        <StatsHeader userState={state} />

        <div className="bg-[var(--card-bg)] rounded-3xl p-8 shadow-xl border border-[var(--border-color)] mb-8 relative overflow-hidden min-h-[75vh] flex flex-col items-center justify-center transition-colors">
          <div className="absolute top-0 right-0 w-32 h-32 bg-dragon-gold/5 rounded-full -mr-16 -mt-16 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-dragon-ember/5 rounded-full -ml-16 -mb-16 blur-3xl" />
          
          <DragonAvatar 
            stage={state.stage} 
            isNapping={state.isNapping} 
            isMeditating={isFocusActive}
            isPetted={isPetted}
            isLevelingUp={isLevelingUp}
            equipped={state.equipped}
          />

          <BondingActions 
            onPet={handlePet} 
            onFeed={handleFeed} 
            lastPetAt={state.lastPetAt} 
            lastIncubateAt={state.lastIncubateAt}
            stage={state.stage}
          />

          {petFlavorText && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 text-sm text-dragon-ember font-medium italic"
            >
              {petFlavorText}
            </motion.p>
          )}

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

          {/* Content Peek Gradient */}
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[var(--card-bg)] to-transparent pointer-events-none flex items-end justify-center pb-4 transition-colors">
            <motion.div
              animate={{ y: [0, 5, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-dragon-gold/40"
            >
              <ChevronDown className="w-6 h-6" />
            </motion.div>
          </div>
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
                <h2 className="serif text-2xl font-bold text-[var(--text-primary)]">Daily Quests</h2>
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
                  onToggle={handleUpdateQuestProgress} 
                  customQuestTypes={state.customQuestTypes}
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
              <CustomQuestForm 
                onAdd={handleAddCustomQuest} 
                onClose={() => setShowCustomQuest(false)} 
                customQuestTypes={state.customQuestTypes}
                onAddType={handleAddCustomType}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ResetConfirmationModal 
        isOpen={showResetConfirm} 
        onClose={() => setShowResetConfirm(false)} 
        onConfirm={handleResetProgress} 
      />

      <nav className="fixed bottom-0 left-0 right-0 bg-[var(--card-bg)]/80 backdrop-blur-lg border-t border-[var(--border-color)] px-6 py-3 z-50 transition-colors">
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
    <button onClick={onClick} className={cn("flex flex-col items-center gap-1 transition-all", active ? "text-dragon-ember" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]")}>
      <div className={cn("p-2 rounded-xl transition-all", active ? "bg-dragon-ember/10" : "bg-transparent")}>
        <Icon className="w-6 h-6" />
      </div>
      <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
    </button>
  );
}
