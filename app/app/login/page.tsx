'use client';

import { Button } from '@mantine/core';
import { IconLogin2 } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import { useEffect } from 'react';
import Landing from '@/components/Landing';

function handleSignIn() {
  const callbackUrl = localStorage.getItem('postLoginRedirect') ?? '/home';
  signIn('keycloak', { callbackUrl });
}

export default function SignInPage() {
  const router = useRouter();
  const { data: session } = useSession();

  useEffect(() => {
    if (session) {
      router.push('/home');
    } else {
      const callbackUrl = localStorage.getItem('postLoginRedirect');
      if (callbackUrl) {
        signIn('keycloak', { callbackUrl });
      }
    }
  }, [session, router]);

  return (
    <div className="my-12">
      <div className="mb-8 flex justify-center">
        <Button size="lg" color="primary" leftSection={<IconLogin2 />} onClick={handleSignIn}>
          Sign in
        </Button>
      </div>
      <Landing />
    </div>
  );
}
