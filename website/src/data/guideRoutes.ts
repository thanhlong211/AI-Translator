export const guideRoutes: Record<string, string> = {
  "getting-started": "/guide#getting-started",

  installation: "/guide/installation",

  quick: "/guide/quick",

  shortcuts: "/guide/quick#shortcuts",

  manga: "/guide/manga",

  documents: "/guide/documents",

  profile: "/guide/profile",

  glossary: "/guide/profile?tab=glossary",

  characters: "/guide/profile?tab=characters",

  learning: "/guide/learning",

  vocabulary: "/guide/learning?tab=vocabulary",

  review: "/guide/learning?tab=review",

  troubleshooting: "/guide/troubleshooting",
};


export const getGuideHref = (
  id: string
) => (
  guideRoutes[id]
  ?? `/guide#${id}`
);
