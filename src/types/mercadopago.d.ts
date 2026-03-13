type MercadoPagoCardForm = {
  getCardFormData?: () => {
    token?: string;
    paymentMethodId?: string;
    issuerId?: string;
    installments?: string | number;
    cardholderEmail?: string;
    identificationType?: string;
    identificationNumber?: string;
  };
  unmount?: () => void;
  destroy?: () => void;
};

type MercadoPagoInstance = {
  cardForm: (config: Record<string, unknown>) => MercadoPagoCardForm;
};

type MercadoPagoConstructor = new (publicKey: string, options?: { locale?: string }) => MercadoPagoInstance;

declare global {
  interface Window {
    MercadoPago?: MercadoPagoConstructor;
  }
}

export {};
