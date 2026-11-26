export interface ShopifyCredentials {
  shopDomain: string;
  apiVersion: string;
  accessToken?: string;
  clientId?: string;
  clientSecret?: string;
}

export interface ShopifyLocation {
  id: string;
  name?: string;
}

export interface ShopifyUserError {
  field?: string[];
  message: string;
}

export interface ShopifyProductSetResponse {
  data?: {
    productSet?: {
      product?: {
        id: string;
        title: string;
        handle: string;
        variants?: {
          nodes: Array<{
            id: string;
            price: string;
            inventoryQuantity: number;
          }>;
        };
      };
      userErrors?: ShopifyUserError[];
    };
    locations?: {
      nodes: Array<{
        id: string;
      }>;
    };
  };
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
    extensions?: {
      code?: string;
      cost?: {
        requestedQueryCost: number;
        actualQueryCost: number;
        throttleStatus: {
          maximumAvailable: number;
          currentlyAvailable: number;
          restoreRate: number;
        };
      };
    };
  }>;
  extensions?: {
    cost?: {
      requestedQueryCost: number;
      actualQueryCost: number;
      throttleStatus: {
        maximumAvailable: number;
        currentlyAvailable: number;
        restoreRate: number;
      };
    };
  };
}

export interface PushResult {
  productId: string;
  success: boolean;
  shopifyId?: string;
  shopifyHandle?: string;
  shopifyUrl?: string;
  title: string;
  errors?: string[];
}
