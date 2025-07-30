export interface PostedDeal {
  dealId: string;
  messageId: string;
  title: string;
  store: string;
  platform: string;
  salePrice: string | null;
  normalPrice: string | null;
  savings: string | null;
  dealRating: string | null;
  imageUrl: string | null;
  url: string | null;
  postedAt: Date | null;
  postedPrice?: number | null;
  lowestEver?: boolean;
  historicalLow?: number | null;
  expiresAt?: Date | null;
}
