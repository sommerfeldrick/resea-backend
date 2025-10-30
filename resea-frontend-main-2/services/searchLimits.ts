import { authService } from './authService';

interface SearchQuota {
  used: number;
  total: number;
  resetDate: Date;
}

class SearchLimitService {
  private readonly STORAGE_KEY = 'search_quota';
  
  private getQuota(): SearchQuota {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (!stored) return this.initializeQuota();
    const quota = JSON.parse(stored);
    quota.resetDate = new Date(quota.resetDate); // Convert string back to Date
    return quota;
  }
  
  private initializeQuota(): SearchQuota {
    const quota: SearchQuota = {
      used: 0,
      total: this.getMaxSearchesByPlan(),
      resetDate: this.getNextResetDate()
    };
    this.saveQuota(quota);
    return quota;
  }
  
  private getMaxSearchesByPlan(): number {
    const user = authService.getUser();
    const planInfo = user?.plan_type || 'basic';
    switch(planInfo) {
      case 'premium': return 20;
      case 'standard': return 10;
      default: return 5;
    }
  }
  
  async canPerformSearch(): Promise<boolean> {
    const quota = this.getQuota();
    if (new Date() > new Date(quota.resetDate)) {
      return this.initializeQuota().used < this.getMaxSearchesByPlan();
    }
    return quota.used < quota.total;
  }
  
  async recordSearch(): Promise<void> {
    const quota = this.getQuota();
    if (new Date() > new Date(quota.resetDate)) {
      // Se passou da data de reset, inicializa nova quota
      this.initializeQuota();
      return this.recordSearch();
    }
    quota.used++;
    this.saveQuota(quota);
  }
  
  getSearchesLeft(): number {
    const quota = this.getQuota();
    if (new Date() > new Date(quota.resetDate)) {
      return this.getMaxSearchesByPlan();
    }
    return Math.max(0, quota.total - quota.used);
  }
  
  private saveQuota(quota: SearchQuota): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(quota));
  }
  
  private getNextResetDate(): Date {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth;
  }
}

export const searchLimits = new SearchLimitService();
