import { useCallback } from 'react';

interface UseWhatsAppReturn {
  buildWhatsAppUrl: (phone: string, message: string) => string;
  openWhatsApp: (phone: string, message: string) => void;
  buildPartInquiryUrl: (phone: string, partName: string, orderNumber: string) => string;
}

export function useWhatsApp(): UseWhatsAppReturn {
  const buildWhatsAppUrl = useCallback((phone: string, message: string): string => {
    const cleanPhone = phone.replace(/\D/g, '');
    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
  }, []);

  const openWhatsApp = useCallback((phone: string, message: string): void => {
    const url = buildWhatsAppUrl(phone, message);
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [buildWhatsAppUrl]);

  const buildPartInquiryUrl = useCallback(
    (phone: string, partName: string, orderNumber: string): string => {
      const message = `Hola, tengo una duda sobre el repuesto "${partName}" de mi orden #${orderNumber}. ¿Me puedes brindar más detalles?`;
      return buildWhatsAppUrl(phone, message);
    },
    [buildWhatsAppUrl]
  );

  return {
    buildWhatsAppUrl,
    openWhatsApp,
    buildPartInquiryUrl,
  };
}
