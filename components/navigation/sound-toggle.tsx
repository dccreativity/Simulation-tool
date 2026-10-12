'use client';

import { Volume2, VolumeX } from 'lucide-react';
import { useEffect } from 'react';
import { useSettingsStore } from '@/lib/store/settings-store';
import { startAmbience, stopAmbience } from '@/lib/sound/sound';
import { cn } from '@/lib/cn';

export function SoundToggle({ className, withLabel = false }: { className?: string; withLabel?: boolean }) {
  const sound = useSettingsStore((s) => s.sound);
  const setSound = useSettingsStore((s) => s.setSound);
  return (
    <button
      type="button"
      onClick={() => setSound(!sound)}
      aria-pressed={sound}
      aria-label={sound ? 'Turn sound off' : 'Turn sound on'}
      title={sound ? 'Sound on' : 'Sound off'}
      className={cn('inline-flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm text-ink-2 hover:bg-teal-50 hover:text-ink', className)}
    >
      {sound ? <Volume2 className="size-[1.1rem]" aria-hidden /> : <VolumeX className="size-[1.1rem]" aria-hidden />}
      {withLabel && <span>{sound ? 'Sound on' : 'Sound off'}</span>}
    </button>
  );
}

/** Plays the optional ambience while sound and ambience are both on. */
export function AmbienceController() {
  const sound = useSettingsStore((s) => s.sound);
  const ambience = useSettingsStore((s) => s.ambience);
  useEffect(() => {
    if (sound && ambience) startAmbience();
    else stopAmbience();
    return () => stopAmbience();
  }, [sound, ambience]);
  return null;
}
