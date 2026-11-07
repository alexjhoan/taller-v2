import { useEffect, useState } from "react";
import { useSnackbar } from "notistack";
import { Bell, BellOff, AlertCircle, Info } from "lucide-react";
import { CustomSwitch } from "@/components/ui/CustomSwitch";
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
  ensureServiceWorkerRegistered,
} from "@/utils/pushUtils";
import { api } from "@/services/api";

export function PushNotificationsToggle() {
  const { enqueueSnackbar } = useSnackbar();
  const [isSupported, setIsSupported] = useState(false);
  const [showToggle, setShowToggle] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isUnsubscribing, setIsUnsubscribing] = useState(false);
  const [swReady, setSwReady] = useState(false);
  const [supportError, setSupportError] = useState<string | null>(null);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const supported = isPushSupported();
    console.log("[PushNotificationsToggle] isPushSupported:", supported);
    if (!supported) {
      setSupportError("Push API no soportada en este navegador. Use Chrome/Edge/Firefox real (no headless/incognito).");
    } else {
      setSupportError(null);
    }
    setIsSupported(supported);
    if (supported) {
      const show = shouldShowToggle();
      console.log("[PushNotificationsToggle] shouldShowToggle:", show);
      setShowToggle(show);
    } else {
      setShowToggle(true); // Siempre mostrar para debug
    }
  }, []);

  useEffect(() => {
    if (!isSupported) return;
    // Registrado explícito: sin esto, serviceWorker.ready no resuelve nunca
    // porque nada en la app registra el SW.
    ensureServiceWorkerRegistered()
      .then(() => navigator.serviceWorker.ready)
      .then(() => {
        console.log("[PushNotificationsToggle] SW ready");
        setSwReady(true);
      })
      .catch((e) => console.error("[PushNotificationsToggle] SW error:", e));
  }, [isSupported]);

  const handleToggleChange = async (checked: boolean) => {
    console.log("[PushNotificationsToggle] toggle changed:", checked);
    setSubscriptionError(null);
    if (!swReady) {
      enqueueSnackbar("Service Worker no listo aún", { variant: "warning" });
      return;
    }

    if (checked) {
      await subscribe();
    } else {
      await unsubscribe();
    }
  };

  const subscribe = async () => {
    if (isSubscribing) return;
    setIsSubscribing(true);
    setSubscriptionError(null);

    try {
      const permission = Notification.permission;

      if (permission === "denied") {
        enqueueSnackbar("Las notificaciones están bloqueadas. Habilítalas en los ajustes del navegador.", {
          variant: "error",
          persist: true,
        });
        return;
      }

      if (permission === "default") {
        const result = await Notification.requestPermission();
        if (result !== "granted") {
          enqueueSnackbar("Permiso denegado para notificaciones.", { variant: "warning" });
          return;
        }
      }

      // Obtener clave VAPID pública
      console.log("[PushNotificationsToggle] Obteniendo clave VAPID...");
      const { public_key } = await api.pushPublicKey();
      console.log("[PushNotificationsToggle] Clave VAPID recibida:", public_key ? "OK" : "VACÍA");
      if (!public_key) {
        throw new Error("Clave VAPID pública vacía");
      }
      const applicationServerKey = urlBase64ToUint8Array(public_key);

      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe(makeSubscribeOptions(applicationServerKey));
      console.log("[PushNotificationsToggle] Suscripción creada:", subscription.endpoint);

      const payload = serializeSubscription(subscription);
      console.log("[PushNotificationsToggle] Enviando suscripción al backend...");
      await api.pushSubscribe(payload);

      setPushOptOut(false);
      enqueueSnackbar("Notificaciones activadas", { variant: "success" });
    } catch (error) {
      console.error("[PushNotificationsToggle] Error suscribiendo:", error);
      const apiError = error as {
        status?: number;
        statusText?: string;
        body?: { statusText?: string };
        message?: string;
      };
      let errorMsg = "Error al activar notificaciones.";
      if (apiError?.status === 503 || apiError?.statusText === "OfflineMode") {
        errorMsg = "Sin conexión. Se reintentará al activar de nuevo.";
      } else if (apiError?.status === 401) {
        errorMsg = "Sesión expirada. Inicie sesión nuevamente.";
      } else if (apiError?.status === 403) {
        errorMsg = "No tiene permisos para suscribirse.";
      } else if (apiError?.message) {
        errorMsg = apiError.message;
      }
      setSubscriptionError(errorMsg);
      enqueueSnackbar(errorMsg, { variant: "error" });
    } finally {
      setIsSubscribing(false);
    }
  };

  const unsubscribe = async () => {
    if (isUnsubscribing) return;
    setIsUnsubscribing(true);
    setSubscriptionError(null);

    try {
      const subscription = await getExistingSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }

      // Notificar al backend (idempotente)
      const payload = { endpoint: subscription?.endpoint || "" };
      await api.pushUnsubscribe(payload.endpoint);

      setPushOptOut(true);
      enqueueSnackbar("Notificaciones desactivadas", { variant: "success" });
    } catch (error) {
      console.error("[PushNotificationsToggle] Error desuscribiendo:", error);
      const apiError = error as { status?: number; statusText?: string; body?: { statusText?: string } };
      let errorMsg = "Error al desactivar notificaciones.";
      if (apiError?.status === 503 || apiError?.statusText === "OfflineMode") {
        errorMsg = "Sin conexión. Se reintentará al desactivar de nuevo.";
      }
      setSubscriptionError(errorMsg);
      enqueueSnackbar(errorMsg, { variant: "error" });
    } finally {
      setIsUnsubscribing(false);
    }
  };

  // Determinar estado inicial del toggle
  const getInitialChecked = () => {
    console.log(
      "[PushNotificationsToggle] getInitialChecked - isSupported:",
      isSupported,
      "showToggle:",
      showToggle,
      "permission:",
      Notification.permission,
      "optOut:",
      getPushOptOut(),
    );
    if (!isSupported || !showToggle) return false;
    if (getPushOptOut()) return false;
    return Notification.permission === "granted";
  };

  // Mientras se determina si se debe mostrar (SSR), mostrar un placeholder
  if (!showToggle) {
    return (
      <div className='flex items-center gap-3 p-4 border rounded-xl bg-slate-50 animate-pulse'>
        <div className='flex items-center gap-2'>
          <div className='flex h-10 w-10 items-center justify-center rounded-lg bg-slate-200'>
            <div className='h-5 w-5 rounded-full bg-slate-300' />
          </div>
          <div>
            <div className='h-4 w-24 bg-slate-200 rounded' />
            <div className='h-3 w-32 bg-slate-200 rounded mt-1' />
          </div>
        </div>
        <div className='ml-auto'>
          <div className='h-6 w-11 bg-slate-200 rounded-full' />
        </div>
      </div>
    );
  }

  const checked = getInitialChecked();
  const isLoading = isSubscribing || isUnsubscribing;

  return (
    <div className='flex items-center gap-3 p-4 border rounded-xl bg-slate-50'>
      <div className='flex items-center gap-2'>
        <div className='flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100'>
          {checked ? <Bell className='h-5 w-5 text-brand-600' /> : <BellOff className='h-5 w-5 text-slate-400' />}
        </div>
        <div>
          <p className='text-sm font-semibold text-slate-800'>Notificaciones Push</p>
          <p className='text-xs text-slate-500'>Recibe avisos aunque la app esté cerrada</p>
        </div>
      </div>
      <div className='ml-auto'>
        <CustomSwitch
          checked={checked}
          onChange={handleToggleChange}
          disabled={!swReady || isLoading}
          label={checked ? "Activadas" : "Desactivadas"}
        />
        {isLoading && <span className='ml-2 text-xs text-slate-500'>Actualizando...</span>}
        {subscriptionError && (
          <div className='mt-2 ml-14'>
            <Info className='h-4 w-4 text-red-500 inline-block mr-1' />
            <span className='text-xs text-red-600'>{subscriptionError}</span>
          </div>
        )}
      </div>
    </div>
  );
}
