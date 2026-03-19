import type { SwitchState, CommandResult } from '../types';

// Ortak komut çalışma bağlamı
export interface CommandContext {
  language: 'tr' | 'en';
  devices?: any[];
  connections?: any[];
  deviceStates: Map<string, SwitchState>;
}

// Tüm komut handler'ları için standart imza
export type CommandHandler = (
  state: SwitchState,
  input: string,
  ctx: CommandContext
) => CommandResult;
