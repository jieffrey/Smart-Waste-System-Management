import type { ReportCategory } from "@/types/api";

// How each waste category is handled: what it is, how to handle it, where it can go. One mapping for the web
// admin (English). The mobile app has the same mapping in Indonesian: Mobile/src/constants/handling.ts.
// Keep the two in step.
export type HandlingGuide = { what: string; handle: string[]; goesTo: string };

export const HANDLING: Record<ReportCategory, HandlingGuide> = {
  organic: {
    what: "Food scraps, peels, leaves and garden waste: anything that rots.",
    handle: ["Keep it separate from plastic and paper.", "Collect it in a closed container; it smells within a day."],
    goesTo: "Composting (household compost bin, community composting site or the TPS3R).",
  },
  paper: {
    what: "Cardboard, newspapers, office paper and paper packaging.",
    handle: ["Keep it dry; wet or food-soiled paper can't be recycled.", "Flatten boxes and bundle them."],
    goesTo: "Recycling: a waste bank (bank sampah) or a paper collector.",
  },
  plastic: {
    what: "Bottles, cups, bags, food packaging and other plastics.",
    handle: ["Separate it from other waste and empty any leftovers.", "Rinse quickly and crush bottles to save space."],
    goesTo: "A waste bank (bank sampah) or recycling collector; mixed or dirty plastic goes to residual waste.",
  },
};
