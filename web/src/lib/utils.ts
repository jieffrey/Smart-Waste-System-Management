import { createCn } from "cn/config";

// Class merging (clsx + tailwind-merge style). Our type scale uses custom size names, so they are
// registered as font sizes; otherwise `cn("text-small", "text-ink")` would treat text-small as a color
// and drop it.
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [{ text: ["micro", "small", "body", "heading", "title", "display"] }],
    },
  },
});
