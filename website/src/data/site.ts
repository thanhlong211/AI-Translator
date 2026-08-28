const configuredSiteUrl =
  import.meta.env.PUBLIC_SITE_URL?.trim()
  || "";

const configuredOgImage =
  import.meta.env.PUBLIC_OG_IMAGE?.trim()
  || "";

export const siteConfig = {
  name: "AitraNova",

  url: (
    configuredSiteUrl
    || "https://aitranova.com"
  ).replace(
    /\/+$/,
    ""
  ),

  defaultDescription:
    "AitraNova is a context-aware desktop translation app for screen translation, manga, documents and language learning.",

  ogImage:
    configuredOgImage,

  themeColor:
    "#ded9e9",

  locale:
    "vi_VN",

  language:
    "vi",
};
