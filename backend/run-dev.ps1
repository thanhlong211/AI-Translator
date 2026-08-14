$ErrorActionPreference = "Stop"

if (-not (Get-Command mvn -ErrorAction SilentlyContinue)) {
    Write-Error "Không tìm thấy Maven. Có thể chạy trực tiếp bằng IntelliJ IDEA."
    exit 1
}

$secureOpenAiKey = Read-Host "Nhập OPENAI_API_KEY" -AsSecureString
$openAiBstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureOpenAiKey)

$secureDbPassword = Read-Host "Nhập DB_PASSWORD" -AsSecureString
$dbBstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureDbPassword)

$jwtSecret = Read-Host "Nhập JWT_SECRET_BASE64"

try {
    $env:OPENAI_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($openAiBstr)
    $env:DB_USERNAME = "ai_translator"
    $env:DB_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($dbBstr)
    $env:JWT_SECRET_BASE64 = $jwtSecret

    mvn spring-boot:run
}
finally {
    Remove-Item Env:OPENAI_API_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:DB_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:JWT_SECRET_BASE64 -ErrorAction SilentlyContinue

    if ($openAiBstr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($openAiBstr)
    }
    if ($dbBstr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($dbBstr)
    }
}
