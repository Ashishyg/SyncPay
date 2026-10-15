import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Title row at the top of a screen. `back` shows a back button (true = history back, string = path).
export default function PageHeader({ title, description, back, children }) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center gap-3 pb-4">
      {back && (
        <Button variant="ghost" size="icon" className="-ml-2 shrink-0" aria-label="Back"
          onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}>
          <ArrowLeft />
        </Button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-bold tracking-tight lg:text-2xl">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}
