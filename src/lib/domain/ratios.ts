// Staff-to-child ratio compliance.

export interface RatioStatus { children: number; staff: number; ratio: number; requiredStaff: number; ok: boolean }

export function ratioStatus(children: number, staff: number, ratio: number): RatioStatus {
  const requiredStaff = children === 0 ? 0 : Math.ceil(children / ratio);
  return { children, staff, ratio, requiredStaff, ok: staff >= requiredStaff };
}
