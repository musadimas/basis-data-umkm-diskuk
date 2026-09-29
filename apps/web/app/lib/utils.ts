import type { ClassValue } from "clsx"
import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Nilai query vue-router berupa satu string (bukan daftar atau kosong). */
export function isQueryString(value: string | null | (string | null)[] | undefined): value is string {
  return typeof value === "string"
}
