import { create } from 'zustand';

export const useEventStore = create((set) => ({
  events: [],
  alerts: [],
  filter: 'ALL',
  setEvents: (events) => set({ events }),
  addAlert: (alert) => set((state) => ({
    alerts: [alert, ...state.alerts].slice(0, 20)
  })),
  setFilter: (filter) => set({ filter }),
}));

export const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem('aegis_token') || null,
  setAuth: (user, token) => {
    localStorage.setItem('aegis_token', token);
    localStorage.setItem('aegis_username', user);
    set({ user, token });
  },
  logout: () => {
    localStorage.removeItem('aegis_token');
    set({ user: null, token: null });
  },
}));
