import { useState } from 'react';
import type { Resource } from '../data/resources';
import { getRememberedEmail, rememberEmail, startDownload } from './resourceDownload';

/** Shared download-gate flow: skip the email modal if we already have a remembered email, otherwise open it. */
export function useResourceGate() {
  const [gateResource, setGateResource] = useState<Resource | null>(null);

  const handleDownload = (resource: Resource) => {
    const remembered = getRememberedEmail();
    if (remembered) { startDownload(resource); return; }
    setGateResource(resource);
  };

  const handleGateSuccess = (email: string) => {
    rememberEmail(email);
    if (gateResource) startDownload(gateResource);
    setGateResource(null);
  };

  return { gateResource, handleDownload, handleGateSuccess, closeGate: () => setGateResource(null) };
}
