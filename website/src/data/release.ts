const githubReleaseUrl =
  "https://github.com/thanhlong211/AI-Translator/releases";


const configuredDownloadUrl =
  import.meta.env.PUBLIC_DOWNLOAD_URL?.trim()
  || "";


const configuredVersion =
  import.meta.env.PUBLIC_APP_VERSION?.trim()
  || "";


const configuredSha256 =
  import.meta.env.PUBLIC_RELEASE_SHA256?.trim()
  || "";


export const releaseInfo = {
  version:
    configuredVersion
    || "Beta",

  platform:
    "Windows",

  channel:
    "Beta",

  downloadUrl:
    configuredDownloadUrl
    || githubReleaseUrl,

  githubReleaseUrl,

  hasDirectDownload:
    Boolean(
      configuredDownloadUrl
    ),

  sha256:
    configuredSha256,

  hasChecksum:
    Boolean(
      configuredSha256
    ),
};
