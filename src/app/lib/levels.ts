// Level configuration - shared between client and server
// This file is NOT a server action, so it can export objects

export const LEVEL_CONFIG = {
    0: { name: 'Tutorial', description: 'Primeiro contato', theme: '🎓' },
    1: { name: 'Carteira', description: 'Dinheiro vivo', theme: '🟢' },
    2: { name: 'Organização', description: 'Onde o dinheiro está', theme: '🟡' },
    3: { name: 'Crédito', description: 'Dinheiro que não é seu', theme: '🔵' },
    4: { name: 'Planejamento', description: 'Dominar o tempo', theme: '🟣' }
} as const;

export type UserLevel = 0 | 1 | 2 | 3 | 4;
