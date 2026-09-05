import { upsellRepository } from './upsell.repository';

export const upsellService = {
  async getRecommendations(
    productId: string,
    type?: 'UPSELL' | 'CROSS_SELL',
    minMarginPercent?: number,
  ) {
    return upsellRepository.findRecommendations(productId, type, minMarginPercent);
  },
};
