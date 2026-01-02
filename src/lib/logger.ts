/**
 * Logger condicional - apenas em desenvolvimento
 * Em produção, os console.logs são completamente removidos
 */

const isDev = process.env.NODE_ENV === 'development';

export const logger = {
  log: (...args: any[]) => {
    if (isDev) console.log(...args);
  },
  
  error: (...args: any[]) => {
    if (isDev) console.error(...args);
  },
  
  warn: (...args: any[]) => {
    if (isDev) console.warn(...args);
  },
  
  info: (...args: any[]) => {
    if (isDev) console.info(...args);
  },
  
  // Sempre loga (para erros críticos que precisam ser capturados)
  always: (...args: any[]) => {
    console.log(...args);
  }
};
