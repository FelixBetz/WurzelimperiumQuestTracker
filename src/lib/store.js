// Nur noch UI-Einstellungen (Filter etc.) – reiner In-Memory-State, kein
// localStorage. Der Fortschritt selbst ist read-only und kommt aus
// src/data/progress.json bzw. dem Live-Stand (siehe data.js).
import { writable } from 'svelte/store';
import { level } from './data.js';

export const settings = writable({
  // Startwert aus dem Live-Stand bzw. progress.json ("level").
  level,
  hideCompleted: true,
  recoMode: 'current', // 'current' = aktuelle Quest je Reihe, 'open' = alle offenen
  recoRespectLevel: true,
});
