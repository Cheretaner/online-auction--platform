export interface AuctionItemRecord {
  id: string;
  auctionId: string;
  title: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  estimatedValue: number | null;
  categoryId: string | null;
  aiCategorySuggestion: string | null;
  aiSubCategory: string | null;
  aiConfidence: number | null;
  aiRationale: string | null;
  condition: string | null;
  aiModel: string | null;
  categorySource: string;
  region: string | null;
  city: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CategoryRecord {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
