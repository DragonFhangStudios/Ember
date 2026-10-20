import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, LayoutDashboard, Timer, Heart, Settings, ShoppingBag, TrendingUp, Trophy, Plus, ChevronDown, Palette } from 'lucide-react';
import { UserState, DragonStage, Quest, CosmeticItem, CustomQuestType } from './types';
import {
  ActionResult,
  DAILY_LIMITS,
  advanceQuest,
  completeFocusSession,
  createInitialState,
  dailyFor,
  evaluateBadges,
  feedDragon,
  hasCheckedInToday,
  logCheckIn,
  migrateState,
  petDragon,
  rollOverDay,
} from './lib/progression';
import { useFocusTimer } from './hooks/useFocusTimer';
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
const DAY_CHECK_INTERVAL_MS = 30_000;

function loadState(now: Date): UserState {
  let raw: unknown = null;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    raw = saved ? JSON.parse(saved) : null;
  } catch {
    raw = null;
  }
  return evaluateBadges(rollOverDay(migrateState(raw, now), now), now);
}

export default function App() {
  const [state, setState] = useState<UserState | null>(null);
  const stateRef = useRef<UserState | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'focus' | 'checkin' | 'wardrobe' | 'insights' | 'badges'>('dashboard');
  const [showCustomQuest, setShowCustomQuest] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isPetted, setIsPetted] = useState(false);
  const [petFlavorText, setPetFlavorText] = useState<string | null>(null);
  const flavorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isLevelingUp, setIsLevelingUp] = useState(false);
  const prevStageRef = useRef<DragonStage | null>(null);

  const showFlavorText = (text: string, durationMs = 3000) => {
    setPetFlavorText(text);
    if (flavorTimeoutRef.current) clearTimeout(flavorTimeoutRef.current);
    flavorTimeoutRef.current = setTimeout(() => setPetFlavorText(null), durationMs);
  };

  // Applies a pure progression action to the latest state. The ref is updated
  // immediately so rapid clicks can't apply the same reward twice.
  const runAction = (action: (current: UserState, now: Date) => ActionResult) => {
    const current = stateRef.current;
    if (!current) return;
    const now = new Date();
    const { state: next, message } = action(current, now);
    const withBadges = evaluateBadges(next, now);
    stateRef.current = withBadges;
    setState(withBadges);
    if (message) showFlavorText(message);
  };

  const update = (fn: (current: UserState) => UserState) => runAction(current => ({ state: fn(current) }));

  const focus = useFocusTimer(() => runAction(completeFocusSession));
  const isFocusActive = focus.timer.status === 'running';

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

  // Load (and migrate) saved state
  useEffect(() => {
    const loaded = loadState(new Date());
    stateRef.current = loaded;
    setState(loaded);
  }, []);

  // Start a new day if the app is left open past midnight
  useEffect(() => {
    const checkDay = () => update(current => rollOverDay(current, new Date()));
    const interval = setInterval(checkDay, DAY_CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', checkDay);
    window.addEventListener('focus', checkDay);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', checkDay);
      window.removeEventListener('focus', checkDay);
    };
  }, []);

  useEffect(() => {
    if (state) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state]);

  const handleUpdateQuestProgress = (id: string, increment: number = 1) => {
    runAction((current, now) => advanceQuest(current, id, now, increment));
  };

  const handleAddCustomQuest = (quest: Quest) => {
    update(current => ({ ...current, quests: [...current.quests, quest] }));
  };

  const handleAddCustomType = (type: CustomQuestType) => {
    update(current => ({ ...current, customQuestTypes: [...current.customQuestTypes, type] }));
  };

  const handleBuyItem = (item: CosmeticItem) => {
    update(current => current.goldenScales < item.price ? current : {
      ...current,
      goldenScales: current.goldenScales - item.price,
      inventory: [...current.inventory, item.id]
    });
  };

  const handleEquipItem = (item: CosmeticItem) => {
    update(current => {
      const isEquipped = current.equipped[item.category] === item.id;
      return {
        ...current,
        equipped: {
          ...current.equipped,
          [item.category]: isEquipped ? undefined : item.id
        }
      };
    });
  };

  const handleUpdateTheme = (color: string) => {
    update(current => ({ ...current, themeColor: color }));
  };

  const handleToggleDarkMode = () => {
    update(current => ({ ...current, isDarkMode: !current.isDarkMode }));
  };

  const handleResetProgress = () => {
    update(current => ({
      ...createInitialState(new Date()),
      isDarkMode: current.isDarkMode,
      themeColor: current.themeColor
    }));
    focus.reset();
    setActiveTab('dashboard');
    setShowResetConfirm(false);
  };

  const handlePet = () => {
    const petCountBefore = stateRef.current?.petCount;
    runAction(petDragon);
    if (stateRef.current?.petCount !== petCountBefore) {
      setIsPetted(true);
      setTimeout(() => setIsPetted(false), 1000);
    }
  };

  const handleFeed = () => runAction(feedDragon);

  const handleCheckInComplete = (energy: number, mood: number) => {
    runAction((current, now) => logCheckIn(current, energy, mood, now));
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
            feedsLeft={DAILY_LIMITS.feeds - dailyFor(state, new Date()).feeds}
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
                {state.dragonName} curled up for a nap while you were away. Welcome back! Say hi or complete a quest to wake them up.
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
              <FocusTimer
                timer={focus.timer}
                rewardsLeft={Math.max(0, DAILY_LIMITS.focusRewards - dailyFor(state, new Date()).focusRewards)}
                onStart={focus.start}
                onPause={focus.pause}
                onReset={focus.reset}
              />
            </motion.div>
          )}

          {activeTab === 'checkin' && (
            <motion.div key="checkin" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <SymptomCheckIn onComplete={handleCheckInComplete} checkedInToday={hasCheckedInToday(state, new Date())} />
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
