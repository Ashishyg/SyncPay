import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Logo({ className, showText = true }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/30">
        <Zap className="size-5" fill="currentColor" />
      </div>
      {showText && (
        <div className="leading-tight">
          <p className="text-base font-semibold tracking-tight">SyncPay</p>
          <p className="text-[11px] text-muted-foreground">Offline payments</p>
        </div>
      )}
    </div>
  );
}
