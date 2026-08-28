import {
  existsSync,
  readFileSync,
  readdirSync,
} from "node:fs";

import {
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


if (!existsSync(DIST)) {

  console.error(
    "ERROR: dist directory not found."
  );

  console.error(
    "Run npm run build first."
  );

  process.exit(1);

}


function walk(directory) {

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


    result.push(full);

  }


  return result;

}


function pageName(file) {

  return relative(
    DIST,
    file
  )
    .replaceAll(
      "\\",
      "/"
    );

}


function countMatches(
  text,
  regex
) {

  return Array.from(
    text.matchAll(regex)
  ).length;

}


const files =
  walk(DIST);


const htmlFiles =
  files.filter(
    file =>
      file.endsWith(
        ".html"
      )
  );


const errors = [];
const warnings = [];


/* =========================================================
   REQUIRED STATIC FILES
   ========================================================= */

for (
  const required
  of [
    "robots.txt",
    "sitemap.xml",
    "404.html",
  ]
) {

  const target =
    join(
      DIST,
      required
    );


  if (
    !existsSync(target)
  ) {

    errors.push(
      `Missing static output: ${required}`
    );

  }

}


/* =========================================================
   HTML AUDIT
   ========================================================= */

for (
  const file
  of htmlFiles
) {

  const name =
    pageName(file);


  const html =
    readFileSync(
      file,
      "utf8"
    );


  /*
    TITLE
  */

  const titleCount =
    countMatches(
      html,
      /<title\b[^>]*>/gi
    );


  if (
    titleCount !== 1
  ) {

    errors.push(
      `${name}: expected 1 <title>, found ${titleCount}`
    );

  }


  /*
    META DESCRIPTION
  */

  const descriptionCount =
    countMatches(
      html,
      /<meta\b(?=[^>]*\bname=["']description["'])[^>]*>/gi
    );


  if (
    descriptionCount !== 1
  ) {

    errors.push(
      `${name}: expected 1 meta description, found ${descriptionCount}`
    );

  }


  /*
    CANONICAL
  */

  const canonicalCount =
    countMatches(
      html,
      /<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/gi
    );


  if (
    canonicalCount !== 1
  ) {

    errors.push(
      `${name}: expected 1 canonical URL, found ${canonicalCount}`
    );

  }


  /*
    H1
  */

  const h1Count =
    countMatches(
      html,
      /<h1\b[^>]*>/gi
    );


  if (
    h1Count === 0
  ) {

    warnings.push(
      `${name}: no <h1> found`
    );

  }


  if (
    h1Count > 1
  ) {

    warnings.push(
      `${name}: ${h1Count} <h1> elements found`
    );

  }


  /*
    HTML LANG
  */

  if (
    !/<html\b[^>]*\blang=["'][^"']+["']/i
      .test(html)
  ) {

    warnings.push(
      `${name}: <html> has no lang attribute`
    );

  }


  /*
    DUPLICATE IDs
  */

  const ids =
    new Map();


  for (
    const match
    of html.matchAll(
      /\bid\s*=\s*["']([^"']+)["']/gi
    )
  ) {

    const id =
      match[1];


    ids.set(
      id,
      (
        ids.get(id)
        || 0
      ) + 1
    );

  }


  for (
    const [
      id,
      occurrences,
    ]
    of ids
  ) {

    if (
      occurrences > 1
    ) {

      errors.push(
        `${name}: duplicate id "${id}" (${occurrences} times)`
      );

    }

  }


  /*
    IMG ALT
  */

  for (
    const match
    of html.matchAll(
      /<img\b[^>]*>/gi
    )
  ) {

    const tag =
      match[0];


    if (
      !/\balt\s*=/i.test(
        tag
      )
    ) {

      errors.push(
        `${name}: image without alt attribute`
      );

    }

  }


  /*
    EMPTY LINKS
  */

  for (
    const match
    of html.matchAll(
      /<a\b[^>]*\bhref\s*=\s*["']([^"']*)["'][^>]*>/gi
    )
  ) {

    const href =
      match[1]?.trim();


    if (
      !href
      || href === "#"
    ) {

      errors.push(
        `${name}: empty link href="${href || ""}"`
      );

    }

  }


  /*
    WRONG PUBLIC PATH
  */

  if (
    html.includes(
      "/public/"
    )
  ) {

    errors.push(
      `${name}: contains /public/ URL`
    );

  }


  /*
    _blank SAFETY
  */

  for (
    const match
    of html.matchAll(
      /<a\b[^>]*\btarget\s*=\s*["']_blank["'][^>]*>/gi
    )
  ) {

    const tag =
      match[0];


    if (
      !/\brel\s*=\s*["'][^"']*(noopener|noreferrer)[^"']*["']/i
        .test(tag)
    ) {

      warnings.push(
        `${name}: target="_blank" without noopener/noreferrer`
      );

    }

  }

}


/* =========================================================
   OUTPUT
   ========================================================= */

if (
  warnings.length
) {

  console.warn("");
  console.warn("WARNINGS:");

  for (
    const warning
    of warnings
  ) {

    console.warn(
      `  - ${warning}`
    );

  }

}


if (
  errors.length
) {

  console.error("");
  console.error("ERRORS:");

  for (
    const error
    of errors
  ) {

    console.error(
      `  - ${error}`
    );

  }


  console.error("");

  console.error(
    `Site audit failed (${errors.length} error(s)).`
  );

  process.exit(1);

}


console.log("");

console.log(
  `Site audit passed (${htmlFiles.length} HTML pages checked).`
);


if (
  warnings.length
) {

  console.log(
    `${warnings.length} warning(s) require review.`
  );

}
