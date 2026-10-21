import { useEffect, useRef } from 'react';
import { Pencil, RotateCcw, Trash2, X } from 'lucide-react';
import { Quest } from '../types';
import { Dialog } from './Dialog';

/** Which part of the options dialog is showing. `seen` is the progress the player is correcting. */
export type QuestOptionsView = { view: 'menu' } | { view: 'correct'; seen: number } | { view: 'delete' };

interface QuestOptionsProps {
  /** The quest, or null when the dialog is closed (or the quest is gone). */
  quest: Quest | null;
  state: QuestOptionsView;
  canCorrect: boolean;
  onView: (view: QuestOptionsView) => void;
  onCorrect: (id: string, seen: number) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

/**
 * A quest's options: correct a mistaken tap (only the shown progress changes;
 * nothing earned is taken back), and for custom quests, edit or delete. Each
 * correction and delete asks for confirmation, with Cancel focused first.
 */
export function QuestOptions(props: QuestOptionsProps) {
  const { quest, onClose } = props;
  return (
    <Dialog
      open={quest !== null}
      onClose={onClose}
      labelledBy="quest-options-title"
      describedBy="quest-options-description"
      variant="sheet"
      panelClassName="sheet-safe max-w-md bg-surface rounded-t-3xl shadow-2xl border-t border-line px-6 pt-6"
    >
      {quest && <Content {...props} quest={quest} />}
    </Dialog>
  );
}

function Content({ quest, state, canCorrect, onView, onCorrect, onEdit, onDelete, onClose }: QuestOptionsProps & { quest: Quest }) {
  // Switching views removes the pressed button, so focus moves to the new heading.
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownRef = useRef(state.view);
  useEffect(() => {
    if (shownRef.current !== state.view) headingRef.current?.focus();
    shownRef.current = state.view;
  }, [state.view]);

  const oneStep = quest.target === 1;
  const correctLabel = oneStep ? 'Mark as not done' : 'Undo one step';
  const heading = (text: string) => (
    <h2 id="quest-options-title" ref={headingRef} tabIndex={-1} className="serif text-2xl font-bold text-fg outline-none break-words pr-10">
      {text}
    </h2>
  );
  const close = (
    <button onClick={onClose} aria-label="Close" className="absolute top-3 right-3 w-11 h-11 flex items-center justify-center text-fg-muted hover:text-fg">
      <X className="w-5 h-5" />
    </button>
  );
  const cancel = (
    <button onClick={onClose} data-autofocus className="w-full min-h-11 py-3 bg-surface-muted text-fg rounded-2xl font-bold">
      Cancel
    </button>
  );

  if (state.view === 'correct') {
    const after = state.seen - 1;
    return (
      <>
        {close}
        {heading(oneStep ? 'Mark as not done?' : 'Undo one step?')}
        <p id="quest-options-description" className="text-sm text-fg-muted mt-2 mb-6">
          {oneStep ? (
            <>"{quest.title}" goes back to not done.</>
          ) : (
            <>"{quest.title}" goes back to {after}/{quest.target}.</>
          )}{' '}
          Everything you've earned today stays yours, and doing it again won't earn it twice.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => onCorrect(quest.id, state.seen)}
            className="w-full min-h-11 py-3 bg-fg text-surface rounded-2xl font-bold flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-5 h-5" />
            {correctLabel}
          </button>
          {cancel}
        </div>
      </>
    );
  }

  if (state.view === 'delete') {
    return (
      <>
        {close}
        {heading('Delete this quest?')}
        <p id="quest-options-description" className="text-sm text-fg-muted mt-2 mb-6">
          "{quest.title}" will be removed from your quests. Everything you've earned from it stays yours.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => onDelete(quest.id)}
            className="w-full min-h-11 py-3 bg-danger-solid text-white rounded-2xl font-bold flex items-center justify-center gap-2"
          >
            <Trash2 className="w-5 h-5" />
            Delete Quest
          </button>
          {cancel}
        </div>
      </>
    );
  }

  return (
    <>
      {close}
      {heading(quest.title)}
      <p id="quest-options-description" className="text-sm text-fg-muted mt-2 mb-6">
        {canCorrect ? 'Tapped by mistake? You can correct it. Nothing you earned is taken back.' : 'Change or remove this quest.'}
      </p>
      <div className="flex flex-col gap-3">
        {canCorrect && (
          <button
            onClick={() => onView({ view: 'correct', seen: quest.progress })}
            className="w-full min-h-11 py-3 px-4 bg-surface-muted text-fg rounded-2xl font-bold flex items-center gap-3"
          >
            <RotateCcw className="w-5 h-5 flex-shrink-0" />
            {correctLabel}
            {!oneStep && <span className="ml-auto text-sm text-fg-muted">{quest.progress}/{quest.target}</span>}
          </button>
        )}
        {quest.isCustom && (
          <>
            <button
              onClick={() => onEdit(quest.id)}
              className="w-full min-h-11 py-3 px-4 bg-surface-muted text-fg rounded-2xl font-bold flex items-center gap-3"
            >
              <Pencil className="w-5 h-5 flex-shrink-0" />
              Edit Quest
            </button>
            <button
              onClick={() => onView({ view: 'delete' })}
              className="w-full min-h-11 py-3 px-4 bg-surface-muted text-fg rounded-2xl font-bold flex items-center gap-3"
            >
              <Trash2 className="w-5 h-5 flex-shrink-0 text-danger-solid" />
              Delete Quest
            </button>
          </>
        )}
      </div>
    </>
  );
}
