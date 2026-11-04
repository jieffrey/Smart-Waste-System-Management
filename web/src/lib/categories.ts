// The ONE place that maps waste classes to their colors (docs/design-system.md, "Waste categories").
// Charts need raw hex values; components use the matching CSS variables from globals.css.
import type { ReportCategory } from "@/types/api";

export const CATEGORY_COLORS: Record<ReportCategory, { hex: string; cssVar: string; swatchClass: string }> = {
  organic: { hex: "#FF4A1C", cssVar: "var(--color-cat-organic)", swatchClass: "bg-cat-organic" },
  paper: { hex: "#121212", cssVar: "var(--color-cat-paper)", swatchClass: "bg-cat-paper" },
  plastic: { hex: "#2B4BD8", cssVar: "var(--color-cat-plastic)", swatchClass: "bg-cat-plastic" },
};
