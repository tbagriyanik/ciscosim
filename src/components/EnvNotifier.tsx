'use client';

import { useEffect } from 'react';
import { checkEnvStatus } from '@/app/actions/envCheck';
import { useToast } from '@/hooks/use-toast';

export function EnvNotifier() {
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;

    // Only notify in development mode or if explicitly enabled to prevent unnecessary toasts for end-users
    if (process.env.NODE_ENV !== 'development') return;

    // Check session storage to only trigger once per session
    if (typeof window !== 'undefined' && sessionStorage.getItem('env_notified')) return;

    async function verifyEnv() {
      try {
        const status = await checkEnvStatus();
        if (!mounted) return;
        sessionStorage.setItem('env_notified', 'true');

        if (!status.hasEnv) {
          toast({
            variant: 'destructive',
            title: 'Çevre Değişkenleri Eksik (.env)',
            description: '.env dosyası veya temel çevre değişkenleri tanımlı değil.',
          });
          return;
        }

        const missingParts: string[] = [];
        if (!status.hasSheetsKey) {
          missingParts.push('GOOGLE_SHEETS_CONTACT_URL');
        }
        if (!status.hasKvKeys) {
          missingParts.push('KV_REST_API_URL / KV_REST_API_TOKEN');
        }
        if (!status.hasCertSecret) {
          missingParts.push('CERTIFICATE_SECRET');
        }
        if (!status.hasExamHmacKey) {
          missingParts.push('EXAM_HMAC_KEY');
        }

        if (missingParts.length > 0) {
          // Log to console in dev mode instead of blocking full screen with destructive toasts
          console.warn(`[Dev Warning] Missing ENV variables: ${missingParts.join(', ')}`);
        }
      } catch (error) {
        console.error('Env status check failed:', error);
      }
    }

    verifyEnv();

    return () => {
      mounted = false;
    };
  }, [toast]);

  return null;
}

