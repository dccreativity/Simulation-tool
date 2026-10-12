'use client';

import { LogIn, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { LeafMark } from '@/components/navigation/brand';

export function AuthForm() {
  const { user, configured, signIn, signUp, signOut } = useAuth();
  const params = useSearchParams();
  const router = useRouter();
  const notify = useToast();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(params.get('confirmed') ? 'Your email is confirmed. Sign in to continue.' : null);

  if (user) {
    return (
      <Card className="p-6 text-center">
        <p className="text-lg font-semibold text-ink">You’re signed in</p>
        <p className="mt-1 text-sm text-ink-3">{user.email}</p>
        <p className="mt-3 text-sm text-ink-2">Investigations you save to your Field Notebook now sync to your account.</p>
        <div className="mt-5 flex justify-center gap-2">
          <Button onClick={() => router.push('/notebook')}>Open Field Notebook</Button>
          <Button variant="secondary" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </Card>
    );
  }

  const submit = async () => {
    setError(null);
    setInfo(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email address.');
    if (password.length < 8) return setError('Choose a password of at least 8 characters.');
    setBusy(true);
    if (mode === 'in') {
      const r = await signIn(email, password);
      setBusy(false);
      if (r.error) return setError(r.error);
      notify({ tone: 'success', title: 'Signed in', body: 'Your notebook will sync to your account.' });
      router.push(params.get('next') || '/notebook');
    } else {
      const r = await signUp(email, password, name.trim() || email.split('@')[0]);
      setBusy(false);
      if (r.error) return setError(r.error);
      if (r.needsConfirmation) {
        setInfo('Check your inbox: we sent a link to confirm your email address. Then come back and sign in.');
        setMode('in');
      } else {
        notify({ tone: 'success', title: 'Account created' });
        router.push('/notebook');
      }
    }
  };

  return (
    <Card className="p-6 sm:p-8">
      <div className="mb-6 flex flex-col items-center text-center">
        <LeafMark className="size-10 text-teal" />
        <h1 className="mt-3 text-2xl font-semibold text-ink">{mode === 'in' ? 'Sign in' : 'Create your account'}</h1>
        <p className="mt-1 text-sm text-ink-3">An account keeps your Field Notebook safe and in sync across devices. Everything else works without one.</p>
      </div>
      {!configured ? (
        <Callout tone="info" title="Accounts are not set up for this deployment.">
          You can still use every simulation and statistics tool — your work is saved on this device.
        </Callout>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          noValidate
        >
          <Tabs
            label="Sign in or create an account"
            value={mode}
            onChange={(m) => {
              setMode(m);
              setError(null);
            }}
            items={[
              { id: 'in', label: 'Sign in' },
              { id: 'up', label: 'Create account' },
            ]}
            className="self-center"
          />
          {info && <Callout tone="success">{info}</Callout>}
          {error && <Callout tone="danger" title="Something went wrong while signing in.">{error}</Callout>}
          {mode === 'up' && (
            <Field label="Your name" htmlFor="au-name" hint="Shown only to you.">
              <Input id="au-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} />
            </Field>
          )}
          <Field label="Email" htmlFor="au-email">
            <Input id="au-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </Field>
          <Field label="Password" htmlFor="au-pw" hint={mode === 'up' ? 'At least 8 characters.' : undefined}>
            <Input id="au-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} required minLength={8} />
          </Field>
          <Button type="submit" size="lg" loading={busy} icon={mode === 'in' ? <LogIn className="size-4" aria-hidden /> : <UserPlus className="size-4" aria-hidden />}>
            {mode === 'in' ? 'Sign in' : 'Create account'}
          </Button>
          <p className="text-center text-xs text-ink-3">
            Or{' '}
            <Link href="/simulation" className="text-teal-700 underline">
              continue as a guest
            </Link>
            .
          </p>
        </form>
      )}
    </Card>
  );
}
