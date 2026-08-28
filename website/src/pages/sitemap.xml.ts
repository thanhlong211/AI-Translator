import {
  siteConfig,
} from "../data/site";


export const prerender =
  true;


const routes = [
  "/",

  "/features",

  "/download",

  "/guide",

  "/guide/installation",

  "/guide/quick",

  "/guide/manga",

  "/guide/documents",

  "/guide/profile",

  "/guide/learning",

  "/guide/troubleshooting",

  "/faq",

  "/about",

  "/roadmap",

  "/changelog",
];


function escapeXml(
  value: string
) {

  return value
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&apos;"
    );

}


export function GET() {

  const urls =
    routes
      .map(
        route => {

          const url =
            new URL(
              route,
              `${siteConfig.url}/`
            ).toString();


          return [
            "  <url>",
            `    <loc>${escapeXml(url)}</loc>`,
            "  </url>",
          ].join("\n");

        }
      )
      .join("\n");


  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',

    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',

    urls,

    "</urlset>",

    "",
  ].join("\n");


  return new Response(
    xml,
    {
      headers: {
        "Content-Type":
          "application/xml; charset=utf-8",
      },
    }
  );

}
