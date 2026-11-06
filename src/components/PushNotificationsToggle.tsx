import { useEffect, useState } from 'react';
import { useSnackbar } from 'notistack';
import { Bell, BellOff } from 'lucide-react';
import { CustomSwitch } from '@/components/ui/CustomSwitch';
import {
  isPushSupported,
  shouldShowToggle,
  getPermissionState,
  urlBase64ToUint8Array,
  getPushOptOut,
  setPushOptOut,
  getExistingSubscription,
  serializeSubscription,
  PUSH_STORAGE_KEY,
  makeSubscribeOptions,
} from '@/utils/pushUtils';
import { api } from '@/services/api';

export function PushNotificationsToggle() {
  const { enqueueSnackbar } = useSnackbar();
  const [isSupported, setIsSupported] = useState(false);
  const [showToggle, setShowToggle] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isUnsubscribing, setIsUnsubscribing] = useState(false);
  const [swReady, setSwReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const supported = isPushSupported();
    console.log('[PushNotificationsToggle] isPushSupported:', supported);
    setIsSupported(supported);
    if (supported) {
      const show = shouldShowToggle();
      console.log('[PushNotificationsToggle] shouldShowToggle:', show);
      setShowToggle(show);
    }
  }, []);

  useEffect(() => {
    if (!isSupported) return;
    navigator.serviceWorker.ready.then(() => {
      console.log('[PushNotificationsToggle] SW ready');
      setSwReady(true);
    });
  }, [isSupported]);

  const handleToggleChange = async (checked: boolean) => {
    console.log('[PushNotificationsToggle] toggle changed:', checked);
    if (!swReady) return;

    if (checked) {
      await subscribe();
    } else {
      await unsubscribe();
    }
  };

  const subscribe = async () => {
    if (isSubscribing) return;
    setIsSubscribing(true);

    try {
      const permission = Notification.permission;

      if (permission === 'denied') {
        enqueueSnackbar('Las notificaciones están bloqueadas. Habilítalas en los ajustes del navegador.', {
          variant: 'error',
          persist: true,
        });
        return;
      }

      if (permission === 'default') {
        const result = await Notification.requestPermission();
        if (result !== 'granted') {
          enqueueSnackbar('Permiso denegado para notificaciones.', { variant: 'warning' });
          return;
        }
      }

      // Obtener clave VAPID pública
      const { public_key } = await api.pushPublicKey();
      const applicationServerKey = urlBase64ToUint8Array(public_key);

      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe(
        makeSubscribeOptions(applicationServerKey)
      );

      const payload = serializeSubscription(subscription);
      await api.pushSubscribe(payload);

      setPushOptOut(false);
      enqueueSnackbar('Notificaciones activadas', { variant: 'success' });
    } catch (error) {
      console.error('[PushNotificationsToggle] Error suscribiendo:', error);
      const apiError = error as { status?: number; statusText?: string; body?: { statusText?: string } };
      if (apiError?.status === 503 || apiError?.statusText === 'OfflineMode') {
        enqueueSnackbar('Sin conexión. Se reintentará al activar de nuevo.', { variant: 'warning' });
      } else {
        enqueueSnackbar('Error al activar notificaciones.', { variant: 'error' });
      }
    } finally {
      setIsSubscribing(false);
    }
  };

  const unsubscribe = async () => {
    if (isUnsubscribing) return;
    setIsUnsubscribing(true);

    try {
      const subscription = await getExistingSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }

      // Notificar al backend (idempotente)
      const payload = { endpoint: subscription?.endpoint || '' };
      await api.pushUnsubscribe(payload.endpoint);

      setPushOptOut(true);
      enqueueSnackbar('Notificaciones desactivadas', { variant: 'success' });
    } catch (error) {
      console.error('[PushNotificationsToggle] Error desuscribiendo:', error);
      const apiError = error as { status?: number; statusText?: string; body?: { statusText?: string } };
      if (apiError?.status === 503 || apiError?.statusText === 'OfflineMode') {
        enqueueSnackbar('Sin conexión. Se reintentará al desactivar de nuevo.', { variant: 'warning' });
        // Rollback UI
        return;
      } else {
        enqueueSnackbar('Error al desactivar notificaciones.', { variant: 'error' });
      }
    } finally {
      setIsUnsubscribing(false);
    }
  };

  // Determinar estado inicial del toggle
  const getInitialChecked = () => {
    console.log('[PushNotificationsToggle] getInitialChecked - isSupported:', isSupported, 'showToggle:', showToggle, 'permission:', Notification.permission, 'optOut:', getPushOptOut());
    if (!isSupported || !showToggle) return false;
    if (getPushOptOut()) return false;
    return Notification.permission === 'granted';
  };

  // Si no hay soporte para Push, no mostrar nada
  if (!isSupported) {
    return null;
  }

  // Mientras se determina si se debe mostrar (SSR), mostrar un placeholder
  if (!showToggle) {
    return (
      <div className="flex items-center gap-3 p-4 border rounded-xl bg-slate-50 animate-pulse">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-200">
            <div className="h-5 w-5 rounded-full bg-slate-300" />
          </div>
          <div>
            <div className="h-4 w-24 bg-slate-200 rounded" />
            <div className="h-3 w-32 bg-slate-200 rounded mt-1" />
          </div>
        </div>
        <div className="ml-auto">
          <div className="h-6 w-11 bg-slate-200 rounded-full" />
        </div>
      </div>
    );
  }

  const checked = getInitialChecked();
  const isLoading = isSubscribing || isUnsubscribing;

  return (
    <div className="flex items-center gap-3 p-4 border rounded-xl bg-slate-50">
      <div className="flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100">
          {checked ? <Bell className="h-5 w-5 text-brand-600" /> : <BellOff className="h-5 w-5 text-slate-400" />}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">Notificaciones Push</p>
          <p className="text-xs text-slate-500">Recibe avisos aunque la app esté cerrada</p>
        </div>
      </div>
      <div className="ml-auto">
        <CustomSwitch
          checked={checked}
          onChange={handleToggleChange}
          disabled={!swReady || isLoading}
          label={checked ? 'Activadas' : 'Desactivadas'}
        />
        {isLoading && <span className="ml-2 text-xs text-slate-500">Actualizando...</span>}
      </div>
    </div>
  );
}