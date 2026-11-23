import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from '../icons';

export interface ModalProps {
  open: boolean;
  title: string;
  onClose?: () => void;
  children: ReactNode;
  /** Échap et clic sur le fond ferment la fenêtre. */
  dismissable?: boolean;
  size?: 'sm' | 'md' | 'lg';
  /** Fond transparent (la table reste visible derrière). */
  translucent?: boolean;
  hideTitle?: boolean;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const SIZES = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' };

/** Fenêtre modale accessible : focus piégé, Échap, retour du focus à la fermeture. */
export function Modal({
  open,
  title,
  onClose,
  children,
  dismissable = true,
  size = 'md',
  translucent = false,
  hideTitle = false,
}: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first =
      panel?.querySelector<HTMLElement>('[data-autofocus]') ??
      panel?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissable) {
        e.stopPropagation();
        onClose?.();
      }
      if (e.key === 'Tab' && panel) {
        const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (items.length === 0) return;
        const firstItem = items[0] as HTMLElement;
        const lastItem = items[items.length - 1] as HTMLElement;
        if (e.shiftKey && document.activeElement === firstItem) {
          e.preventDefault();
          lastItem.focus();
        } else if (!e.shiftKey && document.activeElement === lastItem) {
          e.preventDefault();
          firstItem.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      returnFocus.current?.focus?.();
    };
  }, [open, dismissable, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className={`fixed inset-0 z-[100] flex items-center justify-center p-4 ${
            translucent ? 'bg-black/35' : 'bg-black/70 backdrop-blur-sm'
          }`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => {
            if (dismissable && e.target === e.currentTarget) onClose?.();
          }}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={`panel relative max-h-[90vh] w-full overflow-y-auto p-5 sm:p-6 ${SIZES[size]}`}
            initial={{ scale: 0.92, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          >
            <h2
              id={titleId}
              className={hideTitle ? 'sr-only' : 'mb-4 pr-8 font-display text-xl font-bold'}
            >
              {title}
            </h2>
            {dismissable && onClose && (
              <button
                type="button"
                className="btn-ghost absolute right-3 top-3 h-9 min-h-0 w-9 px-0 text-muted"
                onClick={onClose}
                aria-label="Fermer"
              >
                <CloseIcon />
              </button>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
