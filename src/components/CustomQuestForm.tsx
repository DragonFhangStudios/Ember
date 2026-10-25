import React, { useEffect, useId, useRef, useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { Check, Plus, X, Sparkles, Sun, Pill, Timer, Heart, Palette } from 'lucide-react';
import { Quest, QuestType, CustomQuestType } from '../types';
import { cn } from '../lib/utils';
import { chipClasses, labelClasses } from '../lib/questColors';
import { CUSTOM_QUEST_ENERGY_PER_STEP, CUSTOM_QUEST_TARGET_MAX, CustomQuestDetails, DAILY_LIMITS, customQuestTarget, formatRewardAmount } from '../lib/progression';

interface CustomQuestFormProps {
  onAdd: (quest: Quest) => void;
  onClose: () => void;
  customQuestTypes: CustomQuestType[];
  onAddType: (type: CustomQuestType) => void;
  /** Editing an existing quest: the form starts with its details and saves them. */
  editing?: Quest;
  onSave?: (details: CustomQuestDetails) => void;
  /** What custom quests can still earn today, all together. */
  allowanceLeft?: { energy: number; bond: number };
}

const DEFAULT_TYPES = [
  { id: 'routine', label: 'Routine', icon: 'Sun', color: 'text-blue-500 bg-blue-50' },
  { id: 'medication', label: 'Vitality', icon: 'Pill', color: 'text-dragon-gold bg-dragon-gold/10' },
  { id: 'focus', label: 'Focus', icon: 'Timer', color: 'text-dragon-ember bg-dragon-ember/10' },
  { id: 'symptom', label: 'Check-in', icon: 'Heart', color: 'text-rose-500 bg-rose-50' },
  { id: 'custom', label: 'Custom', icon: 'Sparkles', color: 'text-purple-500 bg-purple-50' },
];

const AVAILABLE_ICONS = ['Sparkles', 'Sun', 'Pill', 'Timer', 'Heart', 'Zap', 'Star', 'Moon', 'Coffee', 'Book', 'Music', 'Dumbbell'];
const AVAILABLE_COLORS = [
  { label: 'Purple', value: 'text-purple-500 bg-purple-50' },
  { label: 'Blue', value: 'text-blue-500 bg-blue-50' },
  { label: 'Green', value: 'text-emerald-500 bg-emerald-50' },
  { label: 'Yellow', value: 'text-amber-500 bg-amber-50' },
  { label: 'Red', value: 'text-rose-500 bg-rose-50' },
  { label: 'Orange', value: 'text-orange-500 bg-orange-50' },
];

export function CustomQuestForm({ onAdd, onClose, customQuestTypes, onAddType, editing, onSave, allowanceLeft }: CustomQuestFormProps) {
  const [title, setTitle] = useState(editing?.title ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [target, setTarget] = useState(editing?.target ?? 1);
  const [selectedType, setSelectedType] = useState<QuestType>(editing?.type ?? 'custom');
  const [isCreatingType, setIsCreatingType] = useState(false);
  
  // New type state
  const [newTypeLabel, setNewTypeLabel] = useState('');
  const [newTypeIcon, setNewTypeIcon] = useState('Sparkles');
  const [newTypeColor, setNewTypeColor] = useState(AVAILABLE_COLORS[0].value);

  const allTypes = [...DEFAULT_TYPES, ...customQuestTypes];
  const fieldId = useId();

  // Switching views removes the button that was pressed, so move focus to the
  // new view's heading (which also renames the dialog for screen readers).
  const titleRef = useRef<HTMLHeadingElement>(null);
  const shownViewRef = useRef(isCreatingType);
  useEffect(() => {
    if (shownViewRef.current !== isCreatingType) titleRef.current?.focus();
    shownViewRef.current = isCreatingType;
  }, [isCreatingType]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const steps = customQuestTarget(target);

    if (editing) {
      onSave?.({ title, description, type: selectedType, target: steps });
      onClose();
      return;
    }

    const newQuest: Quest = {
      id: `custom_${Date.now()}`,
      title,
      description,
      type: selectedType,
      completed: false,
      points: CUSTOM_QUEST_ENERGY_PER_STEP * steps,
      isDaily: true,
      isCustom: true,
      progress: 0,
      target: steps,
    };

    onAdd(newQuest);
    onClose();
  };

  const handleCreateType = () => {
    if (!newTypeLabel.trim()) return;
    
    const newType: CustomQuestType = {
      id: `type_${Date.now()}`,
      label: newTypeLabel,
      icon: newTypeIcon,
      color: newTypeColor,
    };

    onAddType(newType);
    setSelectedType(newType.id);
    setIsCreatingType(false);
    setNewTypeLabel('');
  };

  return (
    <div className="bg-surface rounded-3xl p-6 sm:p-8 shadow-2xl border border-line max-w-md w-full mx-auto max-h-[90vh] overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 id="custom-quest-title" ref={titleRef} tabIndex={-1} className="serif text-2xl font-bold text-fg outline-none">
          {isCreatingType ? 'New Quest Type' : editing ? 'Edit Quest' : 'Add Custom Quest'}
        </h2>
        <button onClick={onClose} aria-label="Close" className="w-11 h-11 -mr-2 flex-shrink-0 flex items-center justify-center text-fg-muted hover:text-fg">
          <X className="w-6 h-6" />
        </button>
      </div>

      {isCreatingType ? (
        <div className="space-y-6">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-fg-muted mb-2">
              Type Label
            </label>
            <input
              type="text"
              value={newTypeLabel}
              onChange={(e) => setNewTypeLabel(e.target.value)}
              placeholder="e.g., Hobbies, Work, Self-care"
              className="w-full px-4 py-3 rounded-xl bg-surface-muted border-none focus:ring-2 focus:ring-dragon-gold text-fg"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-fg-muted mb-2">
              Pick an Icon
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {AVAILABLE_ICONS.map((iconName) => {
                const Icon = (LucideIcons[iconName as keyof typeof LucideIcons] as any) || Sparkles;
                return (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => setNewTypeIcon(iconName)}
                    aria-label={iconName}
                    aria-pressed={newTypeIcon === iconName}
                    className={cn(
                      "min-h-11 rounded-lg flex items-center justify-center transition-all",
                      newTypeIcon === iconName ? "bg-dragon-gold text-dragon-ink" : "bg-surface-muted text-fg-muted hover:bg-dragon-gold/10"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-fg-muted mb-2">
              Pick a Color
            </label>
            <div className="grid grid-cols-3 gap-2">
              {AVAILABLE_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setNewTypeColor(color.value)}
                  className={cn(
                    "min-h-11 px-3 py-2 rounded-lg text-xs font-bold transition-all border",
                    newTypeColor === color.value ? "border-dragon-gold bg-dragon-gold/5" : "border-transparent bg-surface-muted"
                  )}
                >
                  <span className={labelClasses(color.value)}>{color.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setIsCreatingType(false)}
              className="flex-1 py-3 bg-surface-muted text-fg rounded-xl font-bold"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateType}
              className="flex-1 py-3 bg-dragon-gold text-dragon-ink rounded-xl font-bold"
            >
              Create Type
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor={`${fieldId}-title`} className="block text-xs font-bold uppercase tracking-widest text-fg-muted mb-2">
              Quest Title
            </label>
            <input
              id={`${fieldId}-title`}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Put one dish away"
              className="w-full px-4 py-3 rounded-xl bg-surface-muted border-none focus:ring-2 focus:ring-dragon-gold text-fg"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-fg-muted mb-2">
              Category
            </label>
            <p className="text-xs text-fg-muted -mt-1 mb-2">
              Categories help you organize. All custom quests earn the same rewards.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {allTypes.map((t) => {
                const Icon = (LucideIcons[t.icon as keyof typeof LucideIcons] as any) || Sparkles;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedType(t.id)}
                    aria-pressed={selectedType === t.id}
                    className={cn(
                      "min-h-11 px-3 py-2 rounded-xl text-left transition-all border flex items-center gap-2 min-w-0",
                      selectedType === t.id ? "border-dragon-gold bg-dragon-gold/5" : "border-transparent bg-surface-muted"
                    )}
                  >
                    <div className={cn("p-1.5 rounded-lg", chipClasses(t.color))}>
                      <Icon className="w-3 h-3" />
                    </div>
                    <span className="text-xs font-bold text-fg truncate">{t.label}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setIsCreatingType(true)}
                className="min-h-11 px-3 py-2 rounded-xl text-left transition-all border border-dashed border-dragon-gold/30 hover:border-dragon-gold flex items-center gap-2"
              >
                <div className="p-1.5 rounded-lg bg-surface-muted text-dragon-gold">
                  <Plus className="w-3 h-3" />
                </div>
                <span className="text-xs font-bold text-gold-fg">New Type</span>
              </button>
            </div>
          </div>

          <div>
            <label htmlFor={`${fieldId}-target`} className="block text-xs font-bold uppercase tracking-widest text-fg-muted mb-2">
              Target Steps (e.g., 4 glasses of water)
            </label>
            <input
              id={`${fieldId}-target`}
              type="number"
              min="1"
              max={CUSTOM_QUEST_TARGET_MAX}
              value={target}
              onChange={(e) => setTarget(parseInt(e.target.value) || 1)}
              aria-describedby={`${fieldId}-allowance`}
              className="w-full px-4 py-3 rounded-xl bg-surface-muted border-none focus:ring-2 focus:ring-dragon-gold text-fg"
            />
            <p id={`${fieldId}-allowance`} data-allowance className="text-xs text-fg-muted mt-2">
              Each step can earn up to {CUSTOM_QUEST_ENERGY_PER_STEP} energy, subject to the shared daily allowance: up to{' '}
              {DAILY_LIMITS.customQuestEnergy} energy and {DAILY_LIMITS.customQuestGrowth} Bond a day from all custom quests together.
              Finishing one can still count toward your streak.
              {allowanceLeft &&
                (allowanceLeft.energy > 0 || allowanceLeft.bond > 0
                  ? ` Left today: ${allowanceLeft.energy} energy and ${formatRewardAmount(allowanceLeft.bond)} Bond.`
                  : " Today's is all earned.")}
            </p>
          </div>

          <div>
            <label htmlFor={`${fieldId}-description`} className="block text-xs font-bold uppercase tracking-widest text-fg-muted mb-2">
              Description (Optional)
            </label>
            <textarea
              id={`${fieldId}-description`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A small step for you, a big gain for Ember."
              className="w-full px-4 py-3 rounded-xl bg-surface-muted border-none focus:ring-2 focus:ring-dragon-gold text-fg h-24 resize-none"
            />
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-dragon-gold text-dragon-ink rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-dragon-gold/90 transition-all shadow-xl shadow-dragon-gold/20"
          >
            {editing ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            {editing ? 'Save Changes' : 'Add Quest'}
          </button>
        </form>
      )}
    </div>
  );
}
