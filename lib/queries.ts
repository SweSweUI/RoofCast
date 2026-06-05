// Public data-access surface. Backed by the dispatcher (Supabase or SQLite).
// All functions are async. Kept as a stable import path for existing consumers.
export * from './data';
