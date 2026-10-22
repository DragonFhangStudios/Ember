import { KeyboardEvent, ReactNode, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '../lib/utils';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** Id of the element that names the dialog (usually its heading). */
  labelledBy: string;
  /** Id of the element that describes it, if any. */
  describedBy?: string;
  /** 'sheet' slides up from the bottom; 'center' is a centered card. */
  variant?: 'center' | 'sheet';
  /** Classes for the visible panel (size, background, padding, …). */
  panelClassName?: string;
  children: ReactNode;
}

/**
 * An accessible modal dialog on the native <dialog> element. showModal()
 * makes the rest of the page inert (no focus, clicks, or screen-reader
 * access) and stacks nested dialogs, so Escape closes only the top one.
 * On top of that, Tab stays inside the dialog (browsers otherwise step out to
 * their own toolbar), focus starts on the first control (or the one marked
 * `data-autofocus`), and on close it returns to whatever opened the dialog.
 */
export function Dialog(props: DialogProps) {
  return <AnimatePresence>{props.open && <OpenDialog {...props} />}</AnimatePresence>;
}

/** What opened each dialog, for returning focus when it closes. */
const openers = new WeakMap<HTMLDialogElement, HTMLElement | null>();

const TABBABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Returns focus after a dialog closes: to its opener or, if that is gone or
 * still blocked by another dialog (e.g. Settings closing while Reset on top
 * of it closes too), to whatever opened the dialog the opener was in.
 */
function restoreFocus(opener: HTMLElement | null) {
  for (let target = opener; target; ) {
    if (target.isConnected) {
      target.focus();
      if (document.activeElement === target) return;
    }
    const outer = target.closest('dialog');
    target = outer ? openers.get(outer) ?? null : null;
  }
}

function OpenDialog({ onClose, labelledBy, describedBy, variant = 'center', panelClassName, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  const closingRef = useRef(false);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const dialog = ref.current!;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    openers.set(dialog, opener);
    closingRef.current = false;
    dialog.showModal();
    // The browser focuses the first focusable area, which can be a scrolling
    // panel (Chrome treats scrollers as focusable), so pick the control ourselves.
    const firstControl = [...dialog.querySelectorAll<HTMLElement>(TABBABLE)].find(
      el => !el.hasAttribute('disabled') && el.getClientRects().length > 0,
    );
    (dialog.querySelector<HTMLElement>('[data-autofocus]') ?? firstControl)?.focus();
    return () => {
      closingRef.current = true;
      if (dialog.open) dialog.close();
      restoreFocus(opener);
    };
  }, []);

  // Keeps Tab and Shift+Tab cycling through this dialog's controls.
  const keepFocusInside = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (e.key !== 'Tab') return;
    const tabbable = [...ref.current!.querySelectorAll<HTMLElement>(TABBABLE)].filter(
      el => !el.hasAttribute('disabled') && el.getClientRects().length > 0,
    );
    if (tabbable.length === 0) return;
    const first = tabbable[0];
    const last = tabbable[tabbable.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const sheet = variant === 'sheet';
  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      // Escape: close through React so the exit animation plays.
      onCancel={e => {
        e.preventDefault();
        onCloseRef.current();
      }}
      // The browser may still close it directly (e.g. a repeated Escape). The
      // event arrives later, so ignore it if the dialog is open again by then.
      onClose={() => {
        if (!closingRef.current && !ref.current?.open) onCloseRef.current();
      }}
      onKeyDown={keepFocusInside}
      className="m-0 h-full max-h-none w-full max-w-none overflow-hidden border-0 bg-transparent p-0 text-fg backdrop:bg-transparent"
    >
      <div className={cn('flex h-full w-full justify-center', sheet ? 'items-end' : 'items-center p-4 sm:p-6')}>
        <motion.div
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => onCloseRef.current()}
          className="absolute inset-0 bg-dragon-ink/50 backdrop-blur-sm"
        />
        <motion.div
          initial={sheet ? { y: '100%' } : { scale: 0.9, opacity: 0, y: 20 }}
          animate={sheet ? { y: 0 } : { scale: 1, opacity: 1, y: 0 }}
          exit={sheet ? { y: '100%' } : { scale: 0.9, opacity: 0, y: 20 }}
          transition={sheet ? { type: 'tween', duration: 0.25 } : undefined}
          className={cn('relative w-full', panelClassName)}
        >
          {children}
        </motion.div>
      </div>
    </dialog>
  );
}
