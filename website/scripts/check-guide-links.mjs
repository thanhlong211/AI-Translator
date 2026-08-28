import {
  existsSync,
  readFileSync,
  readdirSync,
} from "node:fs";

import {
  join,
  extname,
} from "node:path";


const ROOT =
  process.cwd();


const GUIDE_DIR =
  join(
    ROOT,
    "src",
    "pages",
    "guide"
  );


const REGISTRY =
  join(
    ROOT,
    "src",
    "data",
    "guideRoutes.ts"
  );


const SOURCE_DIRS = [
  join(
    ROOT,
    "src",
    "pages",
    "guide"
  ),

  join(
    ROOT,
    "src",
    "components"
  ),
];


function walk(
  dir
) {

  const result = [];


  for (
    const entry
    of readdirSync(
      dir,
      {
        withFileTypes: true,
      }
    )
  ) {

    const full =
      join(
        dir,
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


    if (
      [
        ".astro",
        ".ts",
        ".js",
        ".mjs",
      ].includes(
        extname(
          entry.name
        )
      )
    ) {

      result.push(
        full
      );

    }

  }


  return result;

}


function cleanGuidePath(
  url
) {

  const path =
    url
      .split(/[?#]/)[0]
      .replace(
        /\/+$/,
        ""
      );


  return (
    path
    || "/guide"
  );

}


function routeExists(
  url
) {

  const path =
    cleanGuidePath(
      url
    );


  if (
    path === "/guide"
  ) {

    return existsSync(
      join(
        GUIDE_DIR,
        "index.astro"
      )
    );

  }


  if (
    !path.startsWith(
      "/guide/"
    )
  ) {
    return true;
  }


  const relative =
    path.slice(
      "/guide/".length
    );


  return (
    existsSync(
      join(
        GUIDE_DIR,
        `${relative}.astro`
      )
    )
    ||
    existsSync(
      join(
        GUIDE_DIR,
        relative,
        "index.astro"
      )
    )
  );

}


const urls =
  new Set();


/* ---------------------------------------------------------
   Shared registry
   --------------------------------------------------------- */

const registryText =
  readFileSync(
    REGISTRY,
    "utf8"
  );


for (
  const match
  of registryText.matchAll(
    /:\s*["'](\/guide[^"']*)["']/g
  )
) {

  urls.add(
    match[1]
  );

}


/* ---------------------------------------------------------
   Literal guide hrefs
   --------------------------------------------------------- */

for (
  const dir
  of SOURCE_DIRS
) {

  for (
    const file
    of walk(dir)
  ) {

    const source =
      readFileSync(
        file,
        "utf8"
      );


    for (
      const match
      of source.matchAll(
        /href\s*=\s*["'](\/guide[^"']*)["']/g
      )
    ) {

      urls.add(
        match[1]
      );

    }

  }

}


/* ---------------------------------------------------------
   Validate
   --------------------------------------------------------- */

const broken =
  [];


for (
  const url
  of urls
) {

  if (
    !routeExists(
      url
    )
  ) {

    broken.push(
      url
    );

  }

}


if (
  broken.length
) {

  console.error(
    "ERROR: broken Guide routes found:"
  );


  for (
    const url
    of broken
  ) {

    console.error(
      `  - ${url}`
    );

  }


  process.exit(1);

}


console.log(
  `Guide link check passed (${urls.size} routes checked).`
);
