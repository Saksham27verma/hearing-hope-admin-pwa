'use client';

import { useEffect, useState } from 'react';
import { Button, Tooltip } from '@mui/material';
import { Download } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Renders an "Install App" button when the browser fires `beforeinstallprompt`.
 * Hidden after the user has installed/dismissed.
 */
export default function InstallPwaButton() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
    };
    const installedHandler = () => {
      setInstalled(true);
      setEvt(null);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  if (!evt || installed) return null;

  const handleInstall = async () => {
    try {
      await evt.prompt();
      const choice = await evt.userChoice;
      if (choice.outcome === 'accepted') {
        setEvt(null);
      }
    } catch {
      /* ignore */
    }
  };

  return (
    <Tooltip title="Install Hope Admin">
      <Button
        size="small"
        variant="outlined"
        color="primary"
        startIcon={<Download size={16} />}
        onClick={handleInstall}
        sx={{ display: { xs: 'none', sm: 'inline-flex' }, height: 36 }}
      >
        Install
      </Button>
    </Tooltip>
  );
}
