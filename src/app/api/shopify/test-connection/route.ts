import { NextResponse } from 'next/server';
import { getAccessToken, getPrimaryLocationId, getShopifyConfig } from '@/lib/shopify/client';

export async function GET() {
  try {
    const config = getShopifyConfig();
    const token = await getAccessToken();
    const locationId = await getPrimaryLocationId();

    return NextResponse.json({
      connected: true,
      shopDomain: config.shopDomain,
      apiVersion: config.apiVersion,
      hasToken: Boolean(token),
      locationId: locationId || 'No location found',
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        connected: false,
        error: error.message || 'Connection failed',
      },
      { status: 500 }
    );
  }
}
