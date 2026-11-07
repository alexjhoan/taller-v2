import { useState, useRef } from 'react';
import { useSnackbar } from 'notistack';
import { Bell, BellOff, CheckCircle, AlertCircle, Loader2, ArrowRight, Zap, Key, Shield, RefreshCw, Info, Zap as ZapIcon } from 'lucide-react';
import { CustomButton } from '@/components/ui/CustomButton';
import { CustomCard } from '@/components/ui/CustomCard';
import { CustomBadge } from '@/components/ui/CustomBadge';
import { api } from '@/services/api';
import { urlBase64ToUint8Array, isPushSupported, shouldShowToggle, getPushOptOut, serializeSubscription, getExistingSubscription, ensureServiceWorkerRegistered } from '@/utils/pushUtils';
import { useUserContext } from '@/context/UserContext';

interface PushDebugStep {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'success' | 'error';
  error?: string;
  action?: () => Promise<void>;
}

export function PushNotificationsDebugger(): JSX.Element {
  const { user } = useUserContext();
  const { enqueueSnackbar } = useSnackbar();
  // Ref para leer el usuario actual al ejecutar un paso (evita capturas obsoletas)
  const userRef = useRef(user);
  userRef.current = user;
  const [steps, setSteps] = useState<PushDebugStep[]>([
    {
      id: 1,
      title: 'Verificar soporte del navegador',
      description: 'Comprobar si el navegador soporta Push API, Service Worker y Notification API',
      status: 'pending',
      action: async () => {
        const supported = 
          'Notification' in window &&
          'serviceWorker' in navigator &&
          'PushManager' in window;
        if (!supported) throw new Error('Push API no soportada en este navegador');
      }
    },
    {
      id: 2,
      title: 'Verificar permiso de notificaciones',
      description: 'Verificar y solicitar permiso de notificaciones si es necesario',
      status: 'pending',
      action: async () => {
        const permission = Notification.permission;
        if (permission === 'denied') {
          throw new Error('Notificaciones bloqueadas. Habilítalas en ajustes del navegador.');
        }
        if (permission === 'default') {
          const result = await Notification.requestPermission();
          if (result !== 'granted') {
            throw new Error('Permiso denegado para notificaciones');
          }
        }
      }
    },
    {
      id: 3,
      title: 'Verificar Service Worker',
      description: 'Verificar que el Service Worker está registrado y activo',
      status: 'pending',
      action: async () => {
        // Registrar explícitamente si nadie lo ha hecho (en dev nada lo hace,
        // y serviceWorker.ready no resuelve sin registro previo)
        const registration = await ensureServiceWorkerRegistered();
        const active = registration.active ?? (await navigator.serviceWorker.ready).active;
        if (!active) throw new Error('Service Worker no activo');
      }
    },
    {
      id: 4,
      title: 'Obtener clave VAPID pública',
      description: 'Obtener la clave pública VAPID del backend para suscribirse',
      status: 'pending',
      action: async () => {
        // El backend responde con el envoltorio { status, body: { public_key }, statusText }
        const data = await api.pushPublicKey() as unknown as { body?: { public_key?: string } };
        const publicKey = data.body?.public_key;
        if (!publicKey) throw new Error('Clave VAPID vacía — ¿endpoint implementado en backend?');
        localStorage.setItem('vapidPublicKey', publicKey);
      }
    },
    {
      id: 5,
      title: 'Suscribirse a Push',
      description: 'Crear suscripción push en el navegador y enviarla al backend',
      status: 'pending',
      action: async () => {
        const publicKey = localStorage.getItem('vapidPublicKey');
        if (!publicKey) throw new Error('Clave VAPID no disponible (ejecuta el paso 4)');

        const applicationServerKey = urlBase64ToUint8Array(publicKey);
        const subscription = await navigator.serviceWorker.ready.then(reg =>
          reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey as BufferSource
          })
        );

        await api.pushSubscribe(serializeSubscription(subscription, navigator.userAgent));
      }
    },
    {
      id: 6,
      title: 'Enviar notificación de prueba',
      description: 'Enviar notificación de prueba desde el backend',
      status: 'pending',
      action: async () => {
        const currentUserId = userRef.current?.id;
        if (!currentUserId) throw new Error('ID de usuario no disponible en la sesión');

        await api.post('/api/push/test', {
          user_ids: [currentUserId],
          title: '🧪 Prueba de notificación',
          body: 'Esta es una notificación de prueba desde el panel de debug',
          order_id: 0
        });
      }
    }
  ]);

  const [currentStep, setCurrentStep] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  const runStep = async (stepIndex: number): Promise<boolean> => {
    const step = steps[stepIndex];
    setSteps(prev => prev.map((s, i) => 
      i === stepIndex ? { ...s, status: 'running' } : s
    ));
    setIsRunning(true);

    try {
      await step.action?.();
      setSteps(prev => prev.map((s, i) => 
        i === stepIndex ? { ...s, status: 'success' } : s
      ));
      setCurrentStep(stepIndex + 1);
      return true;
    } catch (error: any) {
      setSteps(prev => prev.map((s, i) => 
        i === stepIndex ? { ...s, status: 'error', error: error.message } : s
      ));
      return false;
    }
  };


  // Ref para poder cancelar la secuencia desde "Reiniciar" sin depender
  // de cierres (closures) obsoletos del estado isRunning.
  const cancelRef = useRef(false);

  const runAll = async () => {
    cancelRef.current = false;
    setIsRunning(true);
    for (let i = 0; i < steps.length; i++) {
      if (cancelRef.current) break;
      const ok = await runStep(i);
      if (!ok) break; // frenar ante el primer error
    }
    if (!cancelRef.current) setCurrentStep(steps.length);
    setIsRunning(false);
  };

  const reset = () => {
    cancelRef.current = true; // detiene la secuencia en curso
    setSteps(prev => prev.map(s => ({ ...s, status: 'pending', error: undefined })));
    setCurrentStep(0);
    setIsRunning(false);
  };

  return (
    <div className="mb-6">
      <CustomCard className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
              <Zap className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Debug Push Notifications</h3>
              <p className="text-sm text-slate-500">Paso a paso para configurar y probar notificaciones push</p>
            </div>
          </div>
          <div className="flex gap-2">
            <CustomButton
              variant="secondary"
              size="sm"
              onClick={reset}
              disabled={isRunning}
              leftIcon={<RefreshCw className="h-4 w-4" />}
            >
              Reiniciar
            </CustomButton>
            <CustomButton
              size="sm"
              onClick={runAll}
              disabled={isRunning}
              leftIcon={<Zap className="h-4 w-4" />}
            >
              {isRunning ? 'Ejecutando...' : 'Ejecutar Todo'}
            </CustomButton>
          </div>
        </div>

        <div className="space-y-3">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`flex items-start gap-3 p-4 rounded-xl border transition-all ${
                step.status === 'running' ? 'border-purple-300 bg-purple-50' :
                step.status === 'success' ? 'border-emerald-300 bg-emerald-50' :
                step.status === 'error' ? 'border-red-300 bg-red-50' :
                'border-slate-200 bg-white'
              }`}
            >
              <div className="flex-shrink-0 flex items-center justify-center">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                  step.status === 'running' ? 'bg-purple-100 text-purple-600 animate-pulse' :
                  step.status === 'success' ? 'bg-emerald-100 text-emerald-600' :
                  step.status === 'error' ? 'bg-red-100 text-red-600' :
                  'bg-slate-100 text-slate-400'
                }`}>
                  {step.status === 'running' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : step.status === 'success' ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : step.status === 'error' ? (
                    <AlertCircle className="h-4 w-4" />
                  ) : (
                    step.id
                  )
                }</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800">{step.title}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{step.description}</p>
                  </div>
                  {step.status === 'error' && step.error && (
                    <div className="flex-shrink-0 ml-2">
                      <span className="inline-flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                        <AlertCircle className="h-3 w-3" />
                        {step.error}
                      </span>
                    </div>
                  )}
                </div>
                {step.status === 'pending' && currentStep === index && !isRunning && (
                  <div className="mt-3 pt-2 border-t border-slate-200">
                    <CustomButton
                      size="sm"
                      onClick={() => runStep(index)}
                      disabled={isRunning}
                      leftIcon={<Zap className="h-3.5 w-3.5" />}
                    >
                      Ejecutar este paso
                    </CustomButton>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Status Summary */}
        <div className="mt-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-2 rounded-lg bg-white">
              <p className="text-2xl font-bold text-purple-600">
                {steps.filter(s => s.status === 'success').length}
              </p>
              <p className="text-xs text-slate-500">Completados</p>
            </div>
            <div className="p-2 rounded-lg bg-white">
              <p className="text-2xl font-bold text-red-600">
                {steps.filter(s => s.status === 'error').length}
              </p>
              <p className="text-xs text-slate-500">Errores</p>
            </div>
            <div className="p-2 rounded-lg bg-white">
              <p className="text-2xl font-bold text-purple-600">
                {steps.filter(s => s.status === 'running').length}
              </p>
              <p className="text-xs text-slate-500">En progreso</p>
            </div>
            <div className="p-2 rounded-lg bg-white">
              <p className="text-2xl font-bold text-slate-400">
                {steps.filter(s => s.status === 'pending').length}
              </p>
              <p className="text-xs text-slate-500">Pendientes</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-4 pt-4 border-t border-slate-200">
          <h4 className="text-sm font-semibold text-slate-700 mb-3">Acciones Rápidas</h4>
          <div className="flex flex-wrap gap-2">
            <CustomButton
              variant="secondary"
              size="sm"
              onClick={() => {
                localStorage.removeItem('vapidPublicKey');
                localStorage.removeItem('pushNotificationsEnabled');
                enqueueSnackbar('Datos de push limpiados', { variant: 'info' });
              }}
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Limpiar Datos Push
            </CustomButton>
            <CustomButton
              variant="secondary"
              size="sm"
              onClick={() => {
                navigator.serviceWorker.ready.then(reg => reg.pushManager.getSubscription())
                  .then(sub => sub?.unsubscribe())
                  .then(() => enqueueSnackbar('Suscripción eliminada', { variant: 'success' }));
              }}
              leftIcon={<Shield className="h-3.5 w-3.5" />}
            >
              Desuscribir Local
            </CustomButton>
            <CustomButton
              variant="secondary"
              size="sm"
              onClick={() => {
                Notification.requestPermission().then(p => 
                  enqueueSnackbar(`Permiso: ${p}`, { variant: p === 'granted' ? 'success' : 'warning' })
                );
              }}
              leftIcon={<Bell className="h-3.5 w-3.5" />}
            >
              Solicitar Permiso
            </CustomButton>
          </div>
        </div>
      </CustomCard>
    </div>
  );
}

export default PushNotificationsDebugger;