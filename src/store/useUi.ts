import { create } from 'zustand';

interface ConfirmSpec {
  title: string;
  text: string;
  ok: string;
  run: () => void;
}

interface UiState {
  menu: boolean;
  openMenu: () => void;
  closeMenu: () => void;

  toast: string;
  toastOn: boolean;
  flash: (text: string) => void;

  confirm: ConfirmSpec | null;
  ask: (c: ConfirmSpec) => void;
  closeConfirm: () => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useUi = create<UiState>((set) => ({
  menu: false,
  openMenu: () => set({ menu: true }),
  closeMenu: () => set({ menu: false }),

  toast: '',
  toastOn: false,
  flash: (text) => {
    clearTimeout(toastTimer);
    set({ toast: text, toastOn: true });
    toastTimer = setTimeout(() => set({ toastOn: false }), 3000);
  },

  confirm: null,
  ask: (c) => set({ confirm: c }),
  closeConfirm: () => set({ confirm: null }),
}));

/** Imperative toast, for use outside React components. */
export const flash = (text: string) => useUi.getState().flash(text);
