declare module '@cashfreepayments/cashfree-js' {
  export interface CashfreeLoadOptions {
    mode: 'sandbox' | 'production';
  }

  export interface CashfreeDropinStyle {
    theme?: 'light' | 'dark';
    backgroundColor?: string;
    color?: string;
    fontSize?: string;
    fontFamily?: string;
    errorColor?: string;
  }

  export interface CashfreeDropinConfig {
    paymentSessionId?: string;
    components?: string[];
    onSuccess?: (data: any) => void;
    onFailure?: (data: any) => void;
    style?: CashfreeDropinStyle;
  }

  export interface CashfreeCheckoutOptions {
    paymentSessionId: string;
    redirectTarget?: '_self' | '_modal' | '_blank';
    returnUrl?: string;
  }

  export interface CashfreeInstance {
    checkout: (options: CashfreeCheckoutOptions) => Promise<any> | void;
    initialiseDropin?: (element: HTMLElement | null, config: CashfreeDropinConfig) => any;
    dropin?: (element: HTMLElement | null, config: CashfreeDropinConfig) => any;
  }

  export function load(options: CashfreeLoadOptions): Promise<CashfreeInstance | null>;
}
