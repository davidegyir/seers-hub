const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY;
const APP_BASE_URL = process.env.APP_BASE_URL;

if (!FLW_SECRET_KEY) {
  throw new Error('FLW_SECRET_KEY is not set');
}

if (!APP_BASE_URL) {
  throw new Error('APP_BASE_URL is not set');
}

export async function createFlutterwaveCheckout(params: {
  amount: number;
  currency: string;
  txRef: string;
  email: string;
  name?: string | null;
  title: string;
  description?: string | null;
}) {
  const response = await fetch('https://api.flutterwave.com/v3/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${FLW_SECRET_KEY}`,
    },
    body: JSON.stringify({
      tx_ref: params.txRef,
      amount: params.amount,
      currency: params.currency,
      redirect_url: `${APP_BASE_URL}/payments/callback`,
      payment_options: 'card,banktransfer,ussd,mobilemoney',
      customer: {
        email: params.email,
        name: params.name || params.email,
      },
      customizations: {
        title: params.title,
        description: params.description || params.title,
      },
    }),
  });

  const data = await response.json();

  if (!response.ok || data.status !== 'success' || !data.data?.link) {
    throw new Error(data?.message || 'Failed to create Flutterwave checkout');
  }

  return data.data.link as string;
}

export async function verifyFlutterwaveTransaction(txId: string | number) {
  const response = await fetch(
    `https://api.flutterwave.com/v3/transactions/${txId}/verify`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${FLW_SECRET_KEY}`,
      },
    }
  );

  const data = await response.json();

  if (!response.ok || data.status !== 'success') {
    throw new Error(data?.message || 'Failed to verify Flutterwave transaction');
  }

  return data.data;
}