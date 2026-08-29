const githubReleaseUrl =
  "https://github.com/thanhlong211/AI-Translator/releases";


const productionVersion =
  "1.0.0";


const productionDownloadUrl =
  "https://github.com/thanhlong211/AI-Translator/releases/download/v1.0.0-beta/AitraNova-Setup-1.0.0-x64.exe";


const productionSha256 =
  "91A2FF19096F4CAA14E2C9F5BC8DFE8A160E29E91A9BEB1C8F6F96C6FF5C5FA9";


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
    || productionVersion,

  platform:
    "Windows",

  channel:
    "Beta",

  downloadUrl:
    configuredDownloadUrl
    || productionDownloadUrl,

  githubReleaseUrl,

  hasDirectDownload:
    Boolean(
      configuredDownloadUrl
      || productionDownloadUrl
    ),

  sha256:
    configuredSha256
    || productionSha256,

  hasChecksum:
    Boolean(
      configuredSha256
      || productionSha256
    ),
};
