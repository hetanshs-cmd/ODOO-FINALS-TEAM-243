export interface RecommendationRule {
  id: string;
  source_product_id: string;
  recommended_product_id: string;
  recommendation_type: 'UPSELL' | 'CROSS_SELL';
  priority: number;
  reason: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
}
