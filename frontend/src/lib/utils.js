import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const formatINR = (paise, decimals = 2) =>
  '₹' + ((paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
