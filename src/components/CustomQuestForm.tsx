import React, { useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { Plus, X, Sparkles, Sun, Pill, Timer, Heart, Palette } from 'lucide-react';
import { Quest, QuestType, CustomQuestType } from '../types';
import { cn } from '../lib/utils';

interface CustomQuestFormProps {
  onAdd: (quest: Quest) => void;
  onClose: () => void;
  customQuestTypes: CustomQuestType[];
  onAddType: (type: CustomQuestType) => void;
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

export function CustomQuestForm({ onAdd, onClose, customQuestTypes, onAddType }: CustomQuestFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [target, setTarget] = useState(1);
  const [selectedType, setSelectedType] = useState<QuestType>('custom');
  const [isCreatingType, setIsCreatingType] = useState(false);
  
  // New type state
  const [newTypeLabel, setNewTypeLabel] = useState('');
  const [newTypeIcon, setNewTypeIcon] = useState('Sparkles');
  const [newTypeColor, setNewTypeColor] = useState(AVAILABLE_COLORS[0].value);

  const allTypes = [...DEFAULT_TYPES, ...customQuestTypes];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newQuest: Quest = {
      id: `custom_${Date.now()}`,
      title,
      description,
      type: selectedType,
      completed: false,
      points: 10 * target,
      isDaily: true,
      isCustom: true,
      progress: 0,
      target: Math.max(1, target),
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
    <div className="bg-white rounded-3xl p-8 shadow-2xl border border-dragon-gold/10 max-w-md w-full mx-auto max-h-[90vh] overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="serif text-2xl font-bold text-dragon-ink">
          {isCreatingType ? 'New Quest Type' : 'Add Custom Quest'}
        </h2>
        <button onClick={onClose} className="p-2 text-dragon-muted hover:text-dragon-ink">
          <X className="w-6 h-6" />
        </button>
      </div>

      {isCreatingType ? (
        <div className="space-y-6">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-dragon-muted mb-2">
              Type Label
            </label>
            <input
              type="text"
              value={newTypeLabel}
              onChange={(e) => setNewTypeLabel(e.target.value)}
              placeholder="e.g., Hobbies, Work, Self-care"
              className="w-full px-4 py-3 rounded-xl bg-dragon-warm border-none focus:ring-2 focus:ring-dragon-gold text-dragon-ink"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-dragon-muted mb-2">
              Pick an Icon
            </label>
            <div className="grid grid-cols-6 gap-2">
              {AVAILABLE_ICONS.map((iconName) => {
                const Icon = (LucideIcons[iconName as keyof typeof LucideIcons] as any) || Sparkles;
                return (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => setNewTypeIcon(iconName)}
                    className={cn(
                      "p-2 rounded-lg flex items-center justify-center transition-all",
                      newTypeIcon === iconName ? "bg-dragon-gold text-white" : "bg-dragon-warm text-dragon-muted hover:bg-dragon-gold/10"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-dragon-muted mb-2">
              Pick a Color
            </label>
            <div className="grid grid-cols-3 gap-2">
              {AVAILABLE_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setNewTypeColor(color.value)}
                  className={cn(
                    "px-3 py-2 rounded-lg text-xs font-bold transition-all border",
                    newTypeColor === color.value ? "border-dragon-gold bg-dragon-gold/5" : "border-transparent bg-dragon-warm"
                  )}
                >
                  <span className={cn(color.value.split(' ')[0])}>{color.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setIsCreatingType(false)}
              className="flex-1 py-3 bg-dragon-warm text-dragon-ink rounded-xl font-bold"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateType}
              className="flex-1 py-3 bg-dragon-gold text-white rounded-xl font-bold"
            >
              Create Type
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-dragon-muted mb-2">
              Quest Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Put one dish away"
              className="w-full px-4 py-3 rounded-xl bg-dragon-warm border-none focus:ring-2 focus:ring-dragon-gold text-dragon-ink"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-dragon-muted mb-2">
              Category
            </label>
            <div className="grid grid-cols-2 gap-2">
              {allTypes.map((t) => {
                const Icon = (LucideIcons[t.icon as keyof typeof LucideIcons] as any) || Sparkles;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedType(t.id)}
                    className={cn(
                      "px-3 py-2 rounded-xl text-left transition-all border flex items-center gap-2",
                      selectedType === t.id ? "border-dragon-gold bg-dragon-gold/5" : "border-transparent bg-dragon-warm"
                    )}
                  >
                    <div className={cn("p-1.5 rounded-lg", t.color)}>
                      <Icon className="w-3 h-3" />
                    </div>
                    <span className="text-xs font-bold text-dragon-ink truncate">{t.label}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setIsCreatingType(true)}
                className="px-3 py-2 rounded-xl text-left transition-all border border-dashed border-dragon-gold/30 hover:border-dragon-gold flex items-center gap-2"
              >
                <div className="p-1.5 rounded-lg bg-dragon-warm text-dragon-gold">
                  <Plus className="w-3 h-3" />
                </div>
                <span className="text-xs font-bold text-dragon-gold">New Type</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-dragon-muted mb-2">
              Target Steps (e.g., 4 glasses of water)
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={target}
              onChange={(e) => setTarget(parseInt(e.target.value) || 1)}
              className="w-full px-4 py-3 rounded-xl bg-dragon-warm border-none focus:ring-2 focus:ring-dragon-gold text-dragon-ink"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-dragon-muted mb-2">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A small step for you, a big gain for Ember."
              className="w-full px-4 py-3 rounded-xl bg-dragon-warm border-none focus:ring-2 focus:ring-dragon-gold text-dragon-ink h-24 resize-none"
            />
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-dragon-gold text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-dragon-gold/90 transition-all shadow-xl shadow-dragon-gold/20"
          >
            <Plus className="w-5 h-5" />
            Add Quest
          </button>
        </form>
      )}
    </div>
  );
}
