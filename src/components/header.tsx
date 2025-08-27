import { Sparkles } from 'lucide-react';

export function Header() {
  return (
    <header className="flex h-16 items-center border-b bg-card px-6">
      <div className="flex items-center gap-2">
        <Sparkles className="size-6 text-primary" />
        <h1 className="font-headline text-xl font-semibold tracking-tight text-foreground">
          Magic Markup
        </h1>
      </div>
    </header>
  );
}
