import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, LayoutDashboard, Timer, Heart, Settings, ShoppingBag, TrendingUp, Trophy, Plus, ChevronDown } from 'lucide-react';
import { UserState, DragonStage, Quest, CosmeticItem, CustomQuestType } from './types';
import {
  ActionResult,
  DAILY_LIMITS,
  advanceQuest,
  createInitialState,
  dailyFor,
  evaluateBadges,
  feedDragon,
  hasCheckedInToday,
  logCheckIn,
  migrateState,
  petDragon,
} from './lib/progression';
import { focusView, pauseFocus, resetFocus, settle, startFocus } from './lib/focusSession';
import { EmberStore, LegacySaveUnreadableError, StoreResult, openStore } from './lib/store';
import { createRevisionGate } from './lib/revisionGate';
import { parseLegacySave } from './lib/legacySave';
import { DragonAvatar } from './components/DragonAvatar';
import { CELEBRATION_MS } from './components/Celebration';
import { bondLevel, bondTotal } from './lib/evolution';
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
import { RecoveryNotice, SaveStatusBanner } from './components/SaveStatusBanner';
import { SettingsSheet } from './components/SettingsSheet';
import { FeedbackToast } from './components/FeedbackToast';
import { cn } from './lib/utils';
import { THEME_HINT_KEY, ThemePreference, readableBackground, resolveDark } from './lib/theme';
import { useSystemDark } from './lib/useMediaQuery';

// Pre-IndexedDB save. Migrated once into the store and then left untouched as a backup.
const STORAGE_KEY = 'ember_user_state_v2';
// Kept outside the save so a save copied to another device gets its own Bond ledger entry.
const DEVICE_ID_KEY = 'ember_device_id';

function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `device_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return 'local';
  }
}

/**
 * The pre-IndexedDB save: null only when there genuinely is none. Throws when
 * storage can't be read, the data is corrupt, or it isn't a recognizable Ember
 * save, so a failed read is never mistaken for "no save" (see openStore).
 */
function readLegacySave(): unknown {
  return parseLegacySave(localStorage.getItem(STORAGE_KEY));
}

function newFocusSessionId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `focus_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

const DAY_CHECK_INTERVAL_MS = 30_000;
const FOCUS_TICK_MS = 250;
const FEEDBACK_MS = 4000;
/** The evolution banner stays a little longer than the glow so it can be read. */
const EVOLUTION_CELEBRATION_MS = 1500;

/**
 * 'preview' = saving isn't possible right now; nothing can change until it is.
 * 'recovery' = an existing save couldn't be read; nothing was created or changed.
 */
type SaveMode = 'loading' | 'ready' | 'preview' | 'recovery';
type Tab = 'dashboard' | 'focus' | 'checkin' | 'wardrobe' | 'insights' | 'badges';

export default function App() {
  const [state, setState] = useState<UserState | null>(null);
  const [saveMode, setSaveMode] = useState<SaveMode>('loading');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [openAttempt, setOpenAttempt] = useState(0);
  const [startFresh, setStartFresh] = useState(false);
  const storeRef = useRef<EmberStore<UserState> | null>(null);
  // Which store instance (epoch) and revision the screen shows; see revisionGate.ts.
  const gateRef = useRef(createRevisionGate());
  const epochRef = useRef(0);
  const deviceIdRef = useRef(getDeviceId());
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const tabContentRef = useRef<HTMLDivElement>(null);
  const [showCustomQuest, setShowCustomQuest] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isPetted, setIsPetted] = useState(false);
  const [petFlavorText, setPetFlavorText] = useState<string | null>(null);
  const flavorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isLevelingUp, setIsLevelingUp] = useState(false);
  const [celebrateBond, setCelebrateBond] = useState(false);
  const [celebrateMessage, setCelebrateMessage] = useState(false);
  const prevStageRef = useRef<DragonStage | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const settlingSessionRef = useRef<string | null>(null);
  const saveModeRef = useRef<SaveMode>('loading');
  saveModeRef.current = saveMode;

  const showFlavorText = (text: string, durationMs = FEEDBACK_MS) => {
    setPetFlavorText(text);
    if (flavorTimeoutRef.current) clearTimeout(flavorTimeoutRef.current);
    flavorTimeoutRef.current = setTimeout(() => setPetFlavorText(null), durationMs);
  };

  const withDevice = (s: UserState): UserState => ({ ...s, deviceId: deviceIdRef.current });

  const celebrate = (set: (on: boolean) => void) => {
    set(true);
    setTimeout(() => set(false), CELEBRATION_MS);
  };

  // Shows a committed save from the current store instance, ignoring older
  // revisions and anything from a store that has since been replaced.
  const show = useCallback((epoch: number, result: StoreResult<UserState>) => {
    if (!gateRef.current.accept(epoch, result.rev)) return false;
    setState({ ...result.state, deviceId: deviceIdRef.current });
    return true;
  }, []);

  /**
   * Every state change goes through here: one store transaction that settles
   * the latest saved state (a focus session that ended, a new day), applies
   * the action, and unlocks badges. The UI changes only after the commit.
   */
  const commit = useCallback((action?: (current: UserState, now: Date) => ActionResult) => {
    const store = storeRef.current;
    if (!store) {
      if (action && saveModeRef.current === 'preview') showFlavorText("Preview mode: that wasn't saved.");
      return Promise.resolve(null);
    }
    const epoch = epochRef.current;
    const now = new Date();
    let messages: string[] = [];
    let bondLevelUp = false;
    let milestones = false;
    return store
      .update(saved => {
        messages = [];
        bondLevelUp = false;
        milestones = false;
        const current = withDevice(saved);
        const settled = settle(current, now);
        if (settled.message) messages.push(settled.message);
        let next = settled.state;
        if (action) {
          const result = action(next, now);
          next = result.state;
          if (result.message) messages.push(result.message);
        }
        next = evaluateBadges(next, now);
        // Celebrate what this action earned (other tabs' changes just appear).
        bondLevelUp = bondLevel(bondTotal(next.bond)).level > bondLevel(bondTotal(current.bond)).level;
        const unlocked = next.badges.filter(b => b.unlockedAt && !current.badges.some(c => c.id === b.id && c.unlockedAt));
        if (unlocked.length) {
          milestones = true;
          messages.push(`🏅 Milestone unlocked: ${unlocked.map(b => b.name).join(', ')}`);
        }
        return next === current ? saved : next;
      })
      .then(
        result => {
          if (!show(epoch, result)) return null; // a replaced store's late result
          setSaveError(null);
          if (messages.length) showFlavorText(messages.join(' '));
          if (bondLevelUp) celebrate(setCelebrateBond);
          if (milestones) celebrate(setCelebrateMessage);
          return result;
        },
        error => {
          console.error('Ember could not save', error);
          setSaveError("Ember couldn't save that just now, so nothing changed. Please try again.");
          return null;
        },
      );
  }, [show]);

  const runAction = (action: (current: UserState, now: Date) => ActionResult) => commit(action);
  const update = (fn: (current: UserState) => UserState) => commit(current => ({ state: fn(current) }));

  // Open the save store (migrating the old localStorage save on first run).
  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};
    let epoch = 0;
    const gate = gateRef.current;
    setSaveMode('loading');
    openStore<UserState>({
      migrate: raw => migrateState(raw, new Date()),
      readLegacy: readLegacySave,
      startFreshIfLegacyUnreadable: startFresh,
      onBlocked: () => setSaveError('Ember is updating its save. Please close other Ember tabs to continue.'),
      onVersionChange: () => {
        if (cancelled || epoch !== epochRef.current) return;
        gate.retire(epoch);
        storeRef.current = null;
        setSaveMode('preview');
      },
    }).then(
      ({ store, initial }) => {
        if (cancelled) {
          store.close();
          return;
        }
        epoch = gate.begin();
        epochRef.current = epoch;
        storeRef.current = store;
        setSaveError(null);
        setStartFresh(false);
        show(epoch, initial);
        setSaveMode('ready');
        unsubscribe = store.subscribe(result => show(epoch, result));
        commit();
      },
      error => {
        if (cancelled) return;
        console.error('Ember save store unavailable', error);
        if (error instanceof LegacySaveUnreadableError) {
          // An existing save couldn't be read. Nothing was created or changed.
          setState(null);
          setSaveMode('recovery');
          return;
        }
        // Read-only preview of whatever save can still be read (nothing if it can't).
        try {
          setState(withDevice(migrateState(readLegacySave(), new Date())));
        } catch {
          setState(null);
        }
        setSaveMode('preview');
      },
    );
    return () => {
      cancelled = true;
      unsubscribe();
      if (epoch) gate.retire(epoch);
      storeRef.current?.close();
      storeRef.current = null;
    };
  }, [openAttempt, startFresh, commit, show]);

  const isPreview = saveMode === 'preview';

  // The shared focus session: tick locally, persist only transitions.
  const focus = state?.focus ?? null;
  const focusRunning = focus?.status === 'running';
  useEffect(() => {
    if (!focusRunning) return;
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), FOCUS_TICK_MS);
    return () => clearInterval(id);
  }, [focusRunning]);
  const focusTimer = focusView(focus, nowMs);
  const isFocusActive = focusTimer.status === 'running';

  // When the session's end time passes, settle it. Any tab may do this; the
  // store transaction makes sure it's rewarded once.
  useEffect(() => {
    if (focus?.status === 'running' && focus.endsAt !== null && nowMs >= focus.endsAt && settlingSessionRef.current !== focus.id) {
      settlingSessionRef.current = focus.id;
      commit();
    }
  }, [nowMs, focus, commit]);

  // Apply the theme, and cache the preference for the startup script in
  // index.html (which applies it before the first paint on the next visit).
  // Until the save loads, the startup script's choice stays in place.
  const systemDark = useSystemDark();
  const theme = state?.theme;
  const dark = theme ? resolveDark(theme, systemDark) : document.documentElement.classList.contains('dark');
  useEffect(() => {
    if (!theme) return;
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem(THEME_HINT_KEY, theme);
    } catch {
      // Only a startup hint; the save is the source of truth.
    }
  }, [theme, dark]);

  // Detect stage changes for level up animation
  useEffect(() => {
    if (state && prevStageRef.current && state.stage !== prevStageRef.current) {
      setIsLevelingUp(true);
      setTimeout(() => setIsLevelingUp(false), EVOLUTION_CELEBRATION_MS);
    }
    if (state) {
      prevStageRef.current = state.stage;
    }
  }, [state?.stage]);

  // Settle on a timer and when returning to the app (new day, ended focus session,
  // and picking up changes from other tabs where BroadcastChannel isn't available).
  useEffect(() => {
    const check = () => {
      setNowMs(Date.now());
      commit();
    };
    const interval = setInterval(check, DAY_CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, [commit]);

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

  const handleThemePreference = (preference: ThemePreference) => {
    update(current => ({ ...current, theme: preference }));
  };

  const handleResetProgress = () => {
    runAction((current, now) => ({
      state: { ...createInitialState(now), theme: current.theme, themeColor: current.themeColor, deviceId: current.deviceId },
    }));
    setActiveTab('dashboard');
    setShowResetConfirm(false);
    setShowSettings(false);
  };

  const closeSettings = useCallback(() => setShowSettings(false), []);

  // On a phone the tab content sits below the dragon, so bring it into view
  // when the player picks a tab (Home goes back to the top).
  const selectTab = (tab: Tab) => {
    setActiveTab(tab);
    const behavior: ScrollBehavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    if (tab === 'dashboard') window.scrollTo({ top: 0, behavior });
    else tabContentRef.current?.scrollIntoView({ block: 'start', behavior });
  };

  const handlePet = () => {
    const petCountBefore = state?.petCount;
    runAction(petDragon).then(result => {
      if (result && result.state.petCount !== petCountBefore) {
        setIsPetted(true);
        setTimeout(() => setIsPetted(false), 1000);
      }
    });
  };

  const handleFeed = () => runAction(feedDragon);

  const handleCheckInComplete = (energy: number, mood: number) => {
    runAction((current, now) => logCheckIn(current, energy, mood, now));
  };

  const handleFocusStart = () => {
    const id = newFocusSessionId();
    runAction((current, now) => ({ state: startFocus(current, id, now) })).then(() => setNowMs(Date.now()));
  };

  const handleFocusPause = () => {
    const id = focusTimer.id;
    if (id) runAction((current, now) => ({ state: pauseFocus(current, id, now) }));
  };

  const handleFocusReset = () => {
    const id = focusTimer.id;
    if (id) runAction(current => ({ state: resetFocus(current, id) }));
  };

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app-custom px-6">
        <div className="max-w-md w-full">
          {saveMode === 'recovery' ? (
            <RecoveryNotice onRetry={() => setOpenAttempt(n => n + 1)} onStartFresh={() => setStartFresh(true)} />
          ) : saveMode === 'preview' ? (
            <SaveStatusBanner preview onRetry={() => setOpenAttempt(n => n + 1)} />
          ) : (
            <p className="serif text-xl text-fg-muted text-center">{saveError ?? 'Waking Ember…'}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-nav min-h-screen transition-colors duration-700 bg-app-custom" style={{ backgroundColor: readableBackground(state.themeColor, dark) ?? undefined }}>
      <header className="safe-top bg-surface/80 backdrop-blur-md sticky top-0 z-50 border-b border-line transition-colors">
        <div className="max-w-2xl mx-auto flex justify-between items-center gap-2 px-page py-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 flex-shrink-0 bg-dragon-ember rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="serif text-2xl font-bold text-fg">Ember</h1>
          </div>
          <div className="flex items-center gap-1">
            <HeaderButton active={activeTab === 'insights'} onClick={() => selectTab('insights')} icon={TrendingUp} label="Insights" />
            <HeaderButton active={activeTab === 'badges'} onClick={() => selectTab('badges')} icon={Trophy} label="Milestones" />
            <HeaderButton onClick={() => setShowSettings(true)} icon={Settings} label="Settings" />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-page pt-6 sm:pt-8">
        <SaveStatusBanner preview={isPreview} onRetry={() => setOpenAttempt(n => n + 1)} />
        <StatsHeader userState={state} celebrateBond={celebrateBond} />

        <div className="bg-surface rounded-3xl p-5 sm:p-8 shadow-xl border border-line mb-8 relative overflow-hidden min-h-[75vh] flex flex-col items-center justify-center transition-colors">
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

          {state.isNapping && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 p-4 bg-surface-muted rounded-2xl text-center border border-line"
            >
              <p className="text-sm text-fg-muted">
                {state.dragonName} curled up for a nap while you were away. Welcome back! Say hi or complete a quest to wake them up.
              </p>
            </motion.div>
          )}

          {/* Content Peek Gradient */}
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-surface to-transparent pointer-events-none flex items-end justify-center pb-4 transition-colors">
            <motion.div
              animate={{ y: [0, 5, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-dragon-gold/40"
            >
              <ChevronDown className="w-6 h-6" />
            </motion.div>
          </div>
        </div>

        {/* Where a picked tab scrolls to (see selectTab). */}
        <div ref={tabContentRef} aria-hidden="true" className="scroll-below-header" />
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
                <h2 className="serif text-2xl font-bold text-fg">Daily Quests</h2>
                <button 
                  onClick={() => setShowCustomQuest(true)}
                  className="min-h-11 -mr-3 px-3 flex items-center gap-1 text-xs font-bold text-gold-fg uppercase tracking-widest hover:text-ember-fg transition-colors"
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
                timer={focusTimer}
                rewardsLeft={Math.max(0, DAILY_LIMITS.focusRewards - dailyFor(state, new Date()).focusRewards)}
                onStart={handleFocusStart}
                onPause={handleFocusPause}
                onReset={handleFocusReset}
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
              <Insights logs={state.symptomLogs} dark={dark} />
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
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

      <SettingsSheet
        isOpen={showSettings}
        themeColor={state.themeColor}
        theme={state.theme}
        onClose={closeSettings}
        onThemeChange={handleUpdateTheme}
        onThemePreference={handleThemePreference}
        onResetRequest={() => setShowResetConfirm(true)}
      />

      <ResetConfirmationModal 
        isOpen={showResetConfirm} 
        onClose={() => setShowResetConfirm(false)} 
        onConfirm={handleResetProgress} 
      />

      <FeedbackToast message={petFlavorText} celebrate={celebrateMessage} error={saveError} onDismissError={() => setSaveError(null)} />

      <nav aria-label="Main" className="nav-safe fixed bottom-0 left-0 right-0 bg-surface/80 backdrop-blur-lg border-t border-line z-50 transition-colors">
        <div className="max-w-2xl mx-auto h-[var(--nav-height)] flex items-stretch px-2">
          <NavButton active={activeTab === 'dashboard'} onClick={() => selectTab('dashboard')} icon={LayoutDashboard} label="Home" />
          <NavButton active={activeTab === 'focus'} onClick={() => selectTab('focus')} icon={Timer} label="Focus" />
          <NavButton active={activeTab === 'checkin'} onClick={() => selectTab('checkin')} icon={Heart} label="Check-in" />
          <NavButton active={activeTab === 'wardrobe'} onClick={() => selectTab('wardrobe')} icon={ShoppingBag} label="Shop" />
        </div>
      </nav>
    </div>
  );
}

function NavButton({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn("flex-1 min-w-11 flex flex-col items-center justify-center gap-0.5 transition-all", active ? "text-ember-fg" : "text-fg-muted hover:text-fg")}
    >
      <div className={cn("p-1.5 rounded-xl transition-all", active ? "bg-dragon-ember/10" : "bg-transparent")}>
        <Icon className="w-6 h-6" />
      </div>
      <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
    </button>
  );
}

function HeaderButton({ active = false, onClick, icon: Icon, label }: { active?: boolean, onClick: () => void, icon: any, label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-current={active ? 'page' : undefined}
      className={cn("w-11 h-11 rounded-xl flex items-center justify-center transition-colors", active ? "bg-dragon-gold/10 text-dragon-gold" : "text-fg-muted hover:text-fg")}
    >
      <Icon className="w-6 h-6" />
    </button>
  );
}
