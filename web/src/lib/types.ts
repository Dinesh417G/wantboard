export const CATEGORIES = [
  "Electronics & components",
  "Industrial & raw materials",
  "Rare & collectibles",
  "Books & media",
  "Fashion & handmade",
  "Home & tools",
  "Auto & spare parts",
  "Other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const PLATFORM_FEE = 0.06;

export type Seller = {
  id: string;
  name: string;
  paypalEmail: string;
  categories: Category[];
  createdAt: string;
};

export type Bid = {
  id: string;
  sellerId: string;
  price: number;
  deliveryDate: string;
  note: string;
  createdAt: string;
};

export type RequestStatus =
  | "draft" // posted, budget not yet secured
  | "open" // budget held by PayPal, sellers can bid
  | "awarded" // winning price captured, waiting for delivery
  | "shipped"
  | "completed" // buyer confirmed, seller paid out
  | "cancelled" // hold voided or payment refunded
  ;

export type WantRequest = {
  id: string;
  title: string;
  description: string;
  category: Category;
  neededBy: string;
  budget: number;
  preferences: string[];
  buyerName: string;
  status: RequestStatus;
  createdAt: string;
  bids: Bid[];
  events: { at: string; text: string }[];
  paypal: {
    orderId?: string;
    authorizationId?: string;
    authorizationExpires?: string;
    captureId?: string;
    refundId?: string;
    payoutBatchId?: string;
  };
  winningBidId?: string;
  fee?: number;
  sellerPayout?: number;
  shipNote?: string;
};

export type Db = { sellers: Seller[]; requests: WantRequest[] };
