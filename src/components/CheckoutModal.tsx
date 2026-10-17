/**
 * CheckoutModal Component
 * Re-exports the unified PaymentModal checkout component.
 */
export { default as CheckoutModal, default } from './PaymentModal';
export type { 
  PaymentModalProps as CheckoutModalProps, 
  PaymentModalProps, 
  PaymentSuccessData,
  OnlinePaymentGatewayModalProps
} from './PaymentModal';
