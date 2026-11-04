import { useState, useEffect } from 'react';
import { CustomButton } from '@/components/ui/CustomButton';
import { CustomDialog } from '@/components/ui/CustomDialog';
import { Download, X, Smartphone } from 'lucide-react';

interface PWAInstallPromptProps {
  /** Mostrar automáticamente después de un tiempo (en ms) */
  autoShowDelay?: number;
  /** Solo mostrar en dispositivos móviles */
  mobileOnly?: boolean;
}

export function PWAInstallPrompt({ 
  autoShowDelay = 30000, 
  mobileOnly = true 
}: PWAInstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Detectar si es iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);
    setIsIOS(isIOSDevice);

    // Detectar si ya está instalado (modo standalone)
    const standalone = window.matchMedia('(display-mode: standalone)').matches || 
                       (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    // Si ya está instalado, no mostrar
    if (standalone) return;

    // Evento beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Mostrar automáticamente después del delay (solo en mobile si mobileOnly)
      if (!mobileOnly || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        setTimeout(() => setShowPrompt(true), autoShowDelay);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Detectar si la app se instaló
    window.addEventListener('appinstalled', () => {
      setDeferredPrompt(null);
      setShowPrompt(false);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [autoShowDelay, mobileOnly]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('Usuario aceptó la instalación');
    } else {
      console.log('Usuario rechazó la instalación');
    }
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // No volver a mostrar hasta próxima sesión
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  // No mostrar si ya está instalado, no hay prompt, o es desktop (si mobileOnly)
  if (isStandalone || !deferredPrompt || (mobileOnly && !isIOS && !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent))) {
    return null;
  }

  // Verificar si ya fue dismissido recientemente (24h)
  const dismissed = localStorage.getItem('pwa-install-dismissed');
  if (dismissed && Date.now() - parseInt(dismissed) < 24 * 60 * 60 * 1000) {
    return null;
  }

  return (
    <CustomDialog
      open={showPrompt}
      onClose={handleDismiss}
      title="Instalar Mecaflow"
      maxWidth="sm"
      hideCloseButton
    >
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100">
          <Smartphone className="h-8 w-8 text-brand-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Instalar Mecaflow</h3>
          <p className="mt-2 text-sm text-slate-600">
            {isIOS
              ? 'Agrega Mecaflow a tu pantalla de inicio para acceder rápido sin abrir el navegador.'
              : 'Instala Mecaflow como una app nativa para acceso rápido y funcionalidad offline.'}
          </p>
        </div>

        {isIOS ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left">
            <p className="text-sm font-medium text-slate-800 mb-2">En iOS (Safari):</p>
            <ol className="space-y-1 text-sm text-slate-600 list-decimal list-inside">
              <li>Toca el botón <strong>Compartir</strong> (cuadrado con flecha arriba)</li>
              <li>Desplázate y selecciona <strong>"Añadir a pantalla de inicio"</strong></li>
              <li>Toca <strong>"Añadir"</strong> en la esquina superior derecha</li>
            </ol>
          </div>
        ) : (
          <div className="flex justify-end gap-3 pt-2">
            <CustomButton variant="secondary" onClick={handleDismiss}>
              <X className="h-4 w-4" />
              Ahora no
            </CustomButton>
            <CustomButton onClick={handleInstall} leftIcon={<Download className="h-4 w-4" />}>
              Instalar
            </CustomButton>
          </div>
        )}
      </div>
    </CustomDialog>
  );
}

// Type augmentation for beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}