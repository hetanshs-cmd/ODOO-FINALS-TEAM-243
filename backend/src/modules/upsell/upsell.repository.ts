import { db } from '../../config/database';

export interface RecommendedProduct {
  recommended_product_id: string;
  name: string;
  base_price: string;
  cost_price: string | null;
  margin_percent: number | null;
  recommendation_type: 'UPSELL' | 'CROSS_SELL';
  priority: number;
  reason: string | null;
}

export const upsellRepository = {
  /**
   * Active recommendations for a source product, ordered by priority, with
   * an optional margin-threshold filter (docs/development-workflow.md
   * Block 5: "co-purchase ranking endpoint + margin-threshold filter").
   * margin_percent is null when a product has no cost_price on record.
   */
  async findRecommendations(
    sourceProductId: string,
    type: 'UPSELL' | 'CROSS_SELL' | undefined,
    minMarginPercent: number | undefined
  ): Promise<RecommendedProduct[]> {
    const conditions = ["rr.status = 'ACTIVE'", "p.status = 'ACTIVE'", 'rr.source_product_id = $1'];
    const params: unknown[] = [sourceProductId];

    if (type) {
      params.push(type);
      conditions.push(`rr.recommendation_type = $${params.length}`);
    }

    const havingMargin = minMarginPercent !== undefined;
    if (havingMargin) params.push(minMarginPercent);

    const { rows } = await db.query(
      `SELECT p.id AS recommended_product_id, p.name, p.base_price, p.cost_price,
              CASE WHEN p.cost_price IS NULL OR p.base_price = 0 THEN NULL
                   ELSE ROUND(((p.base_price - p.cost_price) / p.base_price * 100)::numeric, 2)
              END AS margin_percent,
              rr.recommendation_type, rr.priority, rr.reason
       FROM recommendation_rules rr
       JOIN products p ON p.id = rr.recommended_product_id
       WHERE ${conditions.join(' AND ')}
       ${havingMargin ? `AND (p.cost_price IS NULL OR ((p.base_price - p.cost_price) / NULLIF(p.base_price, 0) * 100) >= $${params.length})` : ''}
       ORDER BY rr.priority ASC`,
      params
    );
    return rows as RecommendedProduct[];
  },
};
