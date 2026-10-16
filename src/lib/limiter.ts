/**
 * Oddiy navbat: bir vaqtda `concurrency` tadan ortiq og'ir ish bajarilmaydi.
 * Bepul Gemini tarifi daqiqasiga so'rovlarni cheklaydi, shuning uchun MVP'da
 * Redis/BullMQ o'rniga shu yetarli. Foydalanuvchilar ko'paygach BullMQ'ga o'tamiz.
 */
export class Limiter {
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(private readonly concurrency: number) {}

  get queued() {
    return this.waiting.length;
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.concurrency) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    this.active++;
    try {
      return await task();
    } finally {
      this.active--;
      this.waiting.shift()?.();
    }
  }
}
