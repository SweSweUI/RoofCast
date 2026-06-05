// Minimal ambient types for the built-in node:sqlite module (experimental in
// @types/node at time of writing). Covers only the surface we use.
declare module 'node:sqlite' {
  export interface StatementSync {
    all(...params: unknown[]): any[];
    get(...params: unknown[]): any;
    run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
  }
  export class DatabaseSync {
    constructor(path: string, options?: { readOnly?: boolean; open?: boolean });
    prepare(sql: string): StatementSync;
    exec(sql: string): void;
    close(): void;
  }
}
