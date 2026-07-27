// Nur noch UI-Einstellungen (Filter etc.) – reiner In-Memory-State, kein
// localStorage. Der Fortschritt selbst ist read-only und kommt aus
// src/data/progress.json (siehe data.js) – er wird ausschließlich durch
// Bearbeiten dieser Datei geändert.
import { writable } from 'svelte/store';
import progressData from '../data/progress.json';

export const settings = writable({
  // Startwert aus progress.json ("level"); das Eingabefeld kann ihn live ändern.
  level: progressData.level ?? null,
  hideCompleted: true,
  recoMode: 'current', // 'current' = aktuelle Quest je Reihe, 'open' = alle offenen
  recoRespectLevel: true,
});
