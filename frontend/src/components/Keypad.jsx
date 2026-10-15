import { Delete } from 'lucide-react';
import { cn } from '@/lib/utils';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', null, '0', 'del'];

export default function Keypad({ onKey, onDelete, disabled }) {
  return (
    <div className="mx-auto grid w-full max-w-xs grid-cols-3 gap-2">
      {KEYS.map((k, i) =>
        k === null ? <div key={i} /> : (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => (k === 'del' ? onDelete() : onKey(k))}
            aria-label={k === 'del' ? 'Delete' : k}
            className="flex h-14 items-center justify-center rounded-xl text-xl font-medium tabular transition-colors hover:bg-accent active:scale-95 active:bg-accent disabled:opacity-50"
          >
            {k === 'del' ? <Delete className="size-5 text-muted-foreground" /> : k}
          </button>
        )
      )}
    </div>
  );
}

export function PinDots({ length, total = 6, error }) {
  return (
    <div className={cn('flex justify-center gap-3', error && 'animate-shake')}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'size-3 rounded-full border-2 transition-all',
            i < length ? (error ? 'border-destructive bg-destructive' : 'scale-110 border-primary bg-primary') : 'border-muted-foreground/30'
          )}
        />
      ))}
    </div>
  );
}
