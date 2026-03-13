import { createMercadoPagoPayment, getMercadoPagoPayment, refundMercadoPagoPayment } from "@/lib/payments/providers/mercadopago";
import { PaymentProvider, ProviderPaymentCreateInput, ProviderPaymentResult, ProviderRefundInput } from "@/lib/payments/types";

export async function createProviderPayment(provider: PaymentProvider, input: ProviderPaymentCreateInput): Promise<ProviderPaymentResult> {
  switch (provider) {
    case "MERCADOPAGO":
      return createMercadoPagoPayment(input);
    default:
      throw new Error(`Proveedor no soportado: ${provider}`);
  }
}

export async function getProviderPayment(provider: PaymentProvider, providerPaymentId: string): Promise<ProviderPaymentResult> {
  switch (provider) {
    case "MERCADOPAGO":
      return getMercadoPagoPayment(providerPaymentId);
    default:
      throw new Error(`Proveedor no soportado: ${provider}`);
  }
}

export async function refundProviderPayment(provider: PaymentProvider, input: ProviderRefundInput): Promise<ProviderPaymentResult> {
  switch (provider) {
    case "MERCADOPAGO":
      return refundMercadoPagoPayment(input);
    default:
      throw new Error(`Proveedor no soportado: ${provider}`);
  }
}
