import {
  existsSync,
  readFileSync,
  readdirSync,
} from "node:fs";

import {
  extname,
  join,
  relative,
} from "node:path";


const ROOT =
  process.cwd();


const DIST =
  join(
    ROOT,
    "dist"
  );


if (
  !existsSync(
    DIST
  )
) {

  console.error(
    "ERROR: dist directory not found."
  );

  console.error(
    "Run npm run build first."
  );

  process.exit(1);

}


function walk(
  directory
) {

  const result = [];


  for (
    const entry
    of readdirSync(
      directory,
      {
        withFileTypes: true,
      }
    )
  ) {

    const full =
      join(
        directory,
        entry.name
      );


    if (
      entry.isDirectory()
    ) {

      result.push(
        ...walk(full)
      );

      continue;

    }


    result.push(
      full
    );

  }


  return result;

}


const files =
  walk(
    DIST
  );


const htmlFiles =
  files.filter(
    file =>
      file.endsWith(
        ".html"
      )
  );


function routeForHtml(
  file
) {

  const rel =
    relative(
      DIST,
      file
    )
      .replaceAll(
        "\\",
        "/"
      );


  if (
    rel === "index.html"
  ) {
    return "/";
  }


  if (
    rel.endsWith(
      "/index.html"
    )
  ) {

    return (
      "/"
      + rel.slice(
        0,
        -"index.html".length
      )
    );

  }


  return (
    "/"
    + rel
  );

}


function resolveTargetFile(
  pathname
) {

  let normalized =
    decodeURIComponent(
      pathname
    );


  if (
    !normalized.startsWith("/")
  ) {
    normalized =
      `/${normalized}`;
  }


  if (
    normalized === "/"
  ) {

    const candidate =
      join(
        DIST,
        "index.html"
      );


    return existsSync(candidate)
      ? candidate
      : null;

  }


  const withoutLeading =
    normalized.replace(
      /^\/+/,
      ""
    );


  /*
    Asset or explicit extension.
  */

  if (
    extname(
      withoutLeading
    )
  ) {

    const candidate =
      join(
        DIST,
        withoutLeading
      );


    return existsSync(candidate)
      ? candidate
      : null;

  }


  /*
    Astro directory route:
    /features
      -> dist/features/index.html
  */

  const directoryIndex =
    join(
      DIST,
      withoutLeading,
      "index.html"
    );


  if (
    existsSync(
      directoryIndex
    )
  ) {
    return directoryIndex;
  }


  /*
    Fallback flat html route.
  */

  const flatHtml =
    join(
      DIST,
      `${withoutLeading}.html`
    );


  if (
    existsSync(
      flatHtml
    )
  ) {
    return flatHtml;
  }


  return null;

}


function escapeRegex(
  value
) {

  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

}


const broken =
  [];


const fragmentWarnings =
  [];


let checked =
  0;


for (
  const htmlFile
  of htmlFiles
) {

  const html =
    readFileSync(
      htmlFile,
      "utf8"
    );


  const currentRoute =
    routeForHtml(
      htmlFile
    );


  const hrefRegex =
    /href\s*=\s*["']([^"']+)["']/g;


  for (
    const match
    of html.matchAll(
      hrefRegex
    )
  ) {

    const href =
      match[1]?.trim();


    if (
      !href
      || href.startsWith(
        "javascript:"
      )
      || href.startsWith(
        "mailto:"
      )
      || href.startsWith(
        "tel:"
      )
      || href.startsWith(
        "data:"
      )
      || href.startsWith(
        "//"
      )
    ) {
      continue;
    }


    /*
      External links are not checked here.
    */

    if (
      /^https?:\/\//i.test(
        href
      )
    ) {
      continue;
    }


    let url;


    try {

      url =
        new URL(
          href,
          `https://internal.local${currentRoute}`
        );

    } catch {

      broken.push({
        source:
          currentRoute,

        href,

        reason:
          "invalid URL",
      });

      continue;

    }


    if (
      url.hostname
      !== "internal.local"
    ) {
      continue;
    }


    checked++;


    const targetFile =
      resolveTargetFile(
        url.pathname
      );


    if (
      !targetFile
    ) {

      broken.push({
        source:
          currentRoute,

        href,

        reason:
          "target not found",
      });

      continue;

    }


    /*
      Missing anchors are warnings rather than hard errors.
      This is useful for interactive guide sections.
    */

    if (
      url.hash
      && targetFile.endsWith(
        ".html"
      )
    ) {

      let fragment;

      try {

        fragment =
          decodeURIComponent(
            url.hash.slice(1)
          );

      } catch {

        fragment =
          url.hash.slice(1);

      }


      if (
        fragment
      ) {

        const targetHtml =
          readFileSync(
            targetFile,
            "utf8"
          );


        const idRegex =
          new RegExp(
            `id=["']${escapeRegex(fragment)}["']`
          );


        if (
          !idRegex.test(
            targetHtml
          )
        ) {

          fragmentWarnings.push({
            source:
              currentRoute,

            href,

            fragment,
          });

        }

      }

    }

  }

}


if (
  fragmentWarnings.length
) {

  console.warn(
    ""
  );

  console.warn(
    "WARN: internal fragments not found:"
  );


  for (
    const warning
    of fragmentWarnings
  ) {

    console.warn(
      `  ${warning.source} -> ${warning.href}`
    );

  }

}


if (
  broken.length
) {

  console.error(
    ""
  );

  console.error(
    "ERROR: broken internal links found:"
  );


  for (
    const item
    of broken
  ) {

    console.error(
      `  ${item.source} -> ${item.href} (${item.reason})`
    );

  }


  process.exit(1);

}


console.log(
  ""
);

console.log(
  `Internal link check passed (${checked} links checked).`
);


if (
  fragmentWarnings.length
) {

  console.log(
    `${fragmentWarnings.length} fragment warning(s) require review.`
  );

}
