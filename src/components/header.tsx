import { KeyRound, Sparkles } from 'lucide-react';
import { IconButton } from './icon-button';
import icon from "@/icon.jpg";
import Image from 'next/image';
import Link from 'next/link';

interface HeaderProps {
  onApiKeyClick: () => void;
}

export function Header({ onApiKeyClick }: HeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6">
      <div className="flex items-center gap-2 w-1/3">
        <Image src={icon} alt="Magic Markup Icon" width="32" height="32" className="rounded-xl"/>
        <h1 className="font-headline text-xl font-semibold tracking-tight text-foreground">
          Magic Markup
        </h1>
      </div>
      <div className="flex-1 text-center font-code text-xs text-muted-foreground">
        <Link href="https://github.com/mbleigh/magic-markup" target="_blank" className="underline hover:text-foreground">open source</Link> by <Link href="https://mbleigh.dev/" target="_blank" className="underline hover:text-foreground">Michael Bleigh</Link> with <Link href="https://genkit.dev" target="_blank" className="underline hover:text-foreground">Genkit</Link> and Gemini 2.5 Flash
      </div>
      <div className="flex justify-end w-1/3">
        <IconButton icon={KeyRound} tooltip="Change API Key" onClick={onApiKeyClick} />
      </div>
    </header>
  );
}
