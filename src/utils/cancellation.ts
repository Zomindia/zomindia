export const CANCELLATION_GRACE_PERIOD_SECONDS = 60;

export const getBookingCreatedMs = (createdAt: any): number => {
  if (!createdAt) return Date.now();
  if (typeof createdAt?.toMillis === "function") return createdAt.toMillis();
  if (typeof createdAt?.toDate === "function") return createdAt.toDate().getTime();
  if (createdAt instanceof Date) return createdAt.getTime();
  if (typeof createdAt === "number") return createdAt;
  if (typeof createdAt === "string") {
    const parsed = new Date(createdAt).getTime();
    if (!isNaN(parsed)) return parsed;
  }
  return Date.now();
};

export const getCancellationSecondsRemaining = (
  createdAt: any,
  nowMs: number = Date.now()
): number => {
  const createdMs = getBookingCreatedMs(createdAt);
  const elapsedSeconds = Math.max(0, Math.floor((nowMs - createdMs) / 1000));
  return Math.max(0, CANCELLATION_GRACE_PERIOD_SECONDS - elapsedSeconds);
};
