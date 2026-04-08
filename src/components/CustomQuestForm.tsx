import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Quest } from '../types';

interface CustomQuestFormProps {
  onAdd: (quest: Quest) => void;
  onClose: () => void;
}

export function CustomQuestForm({ onAdd, onClose }: CustomQuestFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newQuest: Quest = {
      id: `custom_${Date.now()}`,
      title,
      description,
      type: 'custom',
      completed: false,
      points: 10,
      isDaily: true,
      isCustom: true,
    };

    onAdd(newQuest);
    onClose();
  };

  return (
    <div className="bg-white rounded-3xl p-8 shadow-2xl border border-dragon-gold/10 max-w-md w-full mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="serif text-2xl font-bold text-dragon-ink">Add Custom Quest</h2>
        <button onClick={onClose} className="p-2 text-dragon-muted hover:text-dragon-ink">
          <X className="w-6 h-6" />
        </button>
      </div>

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
    </div>
  );
}
