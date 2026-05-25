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

type MercadoPagoBrickInstance = {
  unmount?: () => void;
};

type MercadoPagoBricksBuilder = {
  create: (
    kind: string,
    containerId: string,
    settings: Record<string, unknown>
  ) => Promise<MercadoPagoBrickInstance>;
};

type MercadoPagoInstance = {
  cardForm: (config: Record<string, unknown>) => MercadoPagoCardForm;
  bricks: () => MercadoPagoBricksBuilder;
};

type MercadoPagoConstructor = new (publicKey: string, options?: { locale?: string }) => MercadoPagoInstance;

declare global {
  interface Window {
    MercadoPago?: MercadoPagoConstructor;
  }
}

export {};
