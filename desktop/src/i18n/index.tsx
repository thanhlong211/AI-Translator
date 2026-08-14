import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState
} from "react";

import type {
    PropsWithChildren
} from "react";

export type UiLocale = "vi" | "en";

export interface UiLocaleOption {
    code: UiLocale;
    label: string;
    nativeLabel: string;
    intlLocale: string;
}

const STORAGE_KEY = "aiTranslator.ui.locale.v1";

export const AVAILABLE_UI_LOCALES: UiLocaleOption[] = [
    {
        code: "vi",
        label: "Vietnamese",
        nativeLabel: "Tiếng Việt",
        intlLocale: "vi-VN"
    },
    {
        code: "en",
        label: "English",
        nativeLabel: "English",
        intlLocale: "en-US"
    }
];

/*
 * Catalog mở rộng để thêm language pack mà không đổi app logic.
 * Chỉ vi/en được bật trong 14.10.2; các locale khác sẽ được thêm
 * bằng file message riêng ở các batch sau.
 */
export const PLANNED_UI_LOCALES = [
    "ja-JP",
    "ko-KR",
    "zh-CN",
    "zh-TW",
    "fr-FR",
    "de-DE",
    "es-ES",
    "th-TH",
    "id-ID"
] as const;

const messages: Record<UiLocale, Record<string, string>> = {
    vi: {
        "language.eyebrow": "LANGUAGE",
        "language.title": "Ngôn ngữ giao diện",
        "language.description": "Chọn ngôn ngữ hiển thị của AI Translator.",
        "language.field": "Ngôn ngữ",
        "language.saved": "Thay đổi được áp dụng ngay và lưu trên máy này.",

        "theme.eyebrow": "APPEARANCE",
        "theme.title": "Giao diện",
        "theme.description": "Chọn giao diện sáng, tối hoặc tự động theo hệ điều hành.",
        "theme.system": "Hệ thống",
        "theme.systemDescription": "Tự động theo Windows/macOS",
        "theme.light": "Sáng",
        "theme.lightDescription": "Luôn dùng giao diện sáng",
        "theme.dark": "Tối",
        "theme.darkDescription": "Luôn dùng giao diện tối",
        "theme.current": "Đang dùng",

        "settings.nav.aria": "Nhóm cài đặt",
        "settings.nav.general": "Chung",
        "settings.nav.generalDescription": "Giao diện & ngôn ngữ",
        "settings.nav.account": "Tài khoản",
        "settings.nav.accountDescription": "Đăng nhập & bảo mật",
        "settings.nav.plan": "Gói & thiết bị",
        "settings.nav.planDescription": "Quyền dùng & phiên đăng nhập",
        "settings.nav.reading": "Đọc & học",
        "settings.nav.readingDescription": "Reader, Study & phím tắt",
        "settings.nav.advanced": "Nâng cao",
        "settings.nav.advancedDescription": "Khôi phục & trạng thái dịch vụ",
        "settings.group.generalEyebrow": "GENERAL",
        "settings.group.generalSummary": "Cá nhân hóa giao diện và ngôn ngữ hiển thị của AI Translator.",
        "settings.group.accountEyebrow": "ACCOUNT & SECURITY",
        "settings.group.accountSummary": "Quản lý tài khoản, phương thức đăng nhập và mật khẩu của bạn.",
        "settings.group.planEyebrow": "PLAN & DEVICES",
        "settings.group.planSummary": "Xem gói hiện tại, bảng giá, quyền sử dụng và các thiết bị đang đăng nhập.",
        "settings.group.readingEyebrow": "READING & LEARNING",
        "settings.group.readingSummary": "Thiết lập trải nghiệm đọc, học, font Novel Reader và phím tắt toàn cục.",
        "settings.group.advancedEyebrow": "ADVANCED",
        "settings.group.advancedSummary": "Xem lại hướng dẫn, khôi phục cài đặt ứng dụng và kiểm tra dịch vụ.",
        "settings.group.sectionLabel": "Cài đặt theo nhóm",

        "sidebar.workspace": "Không gian làm việc",
        "sidebar.translate": "Dịch",
        "sidebar.translateDescription": "Manga & vùng màn hình",
        "sidebar.novel": "Novel Reader",
        "sidebar.novelDescription": "TXT · EPUB · PDF",
        "sidebar.study": "Học tập",
        "sidebar.studyDescription": "Phân tích câu",
        "sidebar.vocabulary": "Từ vựng",
        "sidebar.vocabularyDescription": "Kho cá nhân",
        "sidebar.grammar": "Ngữ pháp",
        "sidebar.grammarDescription": "Cấu trúc đã lưu",
        "sidebar.review": "Ôn tập",
        "sidebar.reviewDescription": "Thẻ đến hạn",
        "sidebar.profiles": "Profiles",
        "sidebar.profilesDescription": "Phong cách & nhân vật",
        "sidebar.memory": "Bộ nhớ dịch",
        "sidebar.memoryDescription": "Bản sửa cá nhân",
        "sidebar.history": "Lịch sử",
        "sidebar.historyDescription": "Phiên gần đây",
        "sidebar.settings": "Cài đặt",
        "sidebar.settingsDescription": "Tài khoản & ứng dụng",

        "topbar.translate.title": "Dịch màn hình",
        "topbar.translate.subtitle": "Dịch manga và bất kỳ vùng nội dung nào trên màn hình",
        "topbar.novel.title": "Novel Reader TXT",
        "topbar.novel.subtitle": "Đọc và dịch TXT, EPUB, PDF theo ngữ cảnh",
        "topbar.study.title": "Chế độ học",
        "topbar.study.subtitle": "Dịch, hiểu từ vựng và ngữ pháp ngay khi đọc",
        "topbar.vocabulary.title": "Từ vựng của tôi",
        "topbar.vocabulary.subtitle": "Kho từ cá nhân được xây từ nội dung bạn đọc",
        "topbar.grammar.title": "Cấu trúc / Ngữ pháp",
        "topbar.grammar.subtitle": "Lưu cấu trúc để theo dõi và ôn lại",
        "topbar.review.title": "Ôn tập",
        "topbar.review.subtitle": "Ôn thẻ đến hạn hoặc luyện thêm theo nhu cầu",
        "topbar.profiles.title": "Hồ sơ dịch",
        "topbar.profiles.subtitle": "Phong cách dịch, nhân vật và thuật ngữ",
        "topbar.memory.title": "Bộ nhớ dịch",
        "topbar.memory.subtitle": "Ưu tiên các bản sửa bạn đã lưu cho những lần dịch sau",
        "topbar.history.title": "Lịch sử",
        "topbar.history.subtitle": "Các phiên dịch và học gần đây",
        "topbar.settings.title": "Cài đặt",
        "topbar.settings.subtitle": "Tài khoản, giao diện và tùy chọn ứng dụng",
        "topbar.backendOnline": "Sẵn sàng",
        "topbar.backendOffline": "Mất kết nối",
        "topbar.notSignedIn": "Chưa đăng nhập",
        "topbar.openAccount": "Mở tài khoản",
        "topbar.signedIn": "Đã đăng nhập",

        "status.quickTranslate": "Dịch nhanh",
        "status.study": "Học",
        "status.profile": "Hồ sơ",
        "status.noProfile": "Chưa chọn",
        "status.ready": "Sẵn sàng",
        "status.offline": "Mất kết nối",

        "settings.auth.accountEyebrow": "ACCOUNT",
        "settings.auth.accountTitle": "Tài khoản AI Translator",
        "settings.auth.accountDescription": "Đăng nhập, bảo mật và quản lý các phương thức liên kết.",
        "settings.auth.welcomeEyebrow": "AI TRANSLATOR ACCOUNT",
        "settings.auth.welcomeTitle": "Một tài khoản cho trải nghiệm đọc và học của bạn",
        "settings.auth.welcomeDescription": "Đăng nhập để giữ hồ sơ dịch, từ vựng và tiến độ học gắn với tài khoản của bạn.",
        "settings.auth.benefitProfiles": "Giữ hồ sơ dịch và tùy chọn nhân vật nhất quán",
        "settings.auth.benefitLearning": "Lưu từ vựng, ngữ pháp và lịch sử ôn tập",
        "settings.auth.benefitSignIn": "Đăng nhập linh hoạt bằng Google, Facebook hoặc email",
        "settings.auth.signInTab": "Đăng nhập",
        "settings.auth.registerTab": "Đăng ký",
        "settings.auth.signInTitle": "Chào mừng trở lại",
        "settings.auth.signInDescription": "Tiếp tục với tài khoản bạn đã dùng trước đây.",
        "settings.auth.registerTitle": "Tạo tài khoản",
        "settings.auth.registerDescription": "Bắt đầu với email hoặc một tài khoản mạng xã hội.",
        "settings.auth.serviceReady": "Dịch vụ đăng nhập sẵn sàng",
        "settings.auth.serviceOffline": "Không thể kết nối dịch vụ đăng nhập",
        "settings.auth.continueWith": "Tiếp tục với",
        "settings.auth.waitingFor": "Đang chờ",
        "settings.auth.providerUnavailable": "Tạm thời chưa khả dụng",
        "settings.auth.providersUnavailable": "Google và Facebook hiện chưa khả dụng.",
        "settings.auth.orEmail": "hoặc tiếp tục bằng email",
        "settings.auth.email": "Email",
        "settings.auth.password": "Mật khẩu",
        "settings.auth.emailPlaceholder": "you@example.com",
        "settings.auth.passwordPlaceholder": "Nhập mật khẩu",
        "settings.auth.newPasswordPlaceholder": "Tạo mật khẩu",
        "settings.auth.processing": "Đang xử lý...",
        "settings.auth.signIn": "Đăng nhập",
        "settings.auth.createAccount": "Tạo tài khoản",
        "settings.auth.forgotPassword": "Quên mật khẩu?",
        "settings.auth.secureNote": "Thông tin đăng nhập được xử lý qua kết nối bảo mật.",
        "settings.auth.restoreSession": "Khôi phục phiên đã lưu",
        "settings.auth.accountActive": "Tài khoản đang hoạt động",
        "settings.auth.verified": "Đã xác thực",
        "settings.auth.linkedAccounts": "Tài khoản liên kết",
        "settings.auth.linkedAccountsDescription": "Dùng cùng một tài khoản AI Translator với các phương thức đăng nhập đã liên kết.",
        "settings.auth.refresh": "Làm mới",
        "settings.auth.linked": "Đã liên kết",
        "settings.auth.notLinked": "Chưa liên kết",
        "settings.auth.link": "Liên kết",
        "settings.auth.waiting": "Đang chờ...",
        "settings.auth.logout": "Đăng xuất",

        "onboarding.aria": "Hướng dẫn bắt đầu",
        "onboarding.title": "Bắt đầu trong 5 bước",
        "onboarding.lead": "Đăng nhập, chọn Hồ sơ dịch, sau đó dùng phím tắt khi đọc nội dung bạn muốn.",
        "onboarding.step1.title": "Đăng nhập và chọn Hồ sơ dịch",
        "onboarding.step1.body": "Hồ sơ dịch lưu phong cách, thuật ngữ và cách xưng hô của nhân vật.",
        "onboarding.step2.title": "Quét khung truyện",
        "onboarding.step2.before": "Nhấn",
        "onboarding.step2.after": "rồi kéo chọn một khung manga hoặc vùng có nhiều lời thoại để dịch cùng lúc.",
        "onboarding.step3.title": "Sang trang manga tiếp theo",
        "onboarding.step3.before": "Sau khi chuyển trang, nhấn",
        "onboarding.step3.after": "để quét lại vùng cũ và tiếp tục theo ngữ cảnh trang trước.",
        "onboarding.step4.title": "Dịch nhanh",
        "onboarding.step4.before": "Nhấn",
        "onboarding.step4.after": "rồi kéo một vùng chữ cần dịch.",
        "onboarding.step5.title": "Study",
        "onboarding.step5.before": "Nhấn",
        "onboarding.step5.after": "để vừa dịch vừa phân tích từ vựng và ngữ pháp.",
        "onboarding.note": "Overlay mặc định tự ẩn khi đổi cửa sổ/tab. Có thể Pin hoặc đổi hành vi trong Settings.",
        "onboarding.close": "Đóng hướng dẫn",
        "onboarding.start": "Bắt đầu sử dụng"
    },
    en: {
        "language.eyebrow": "LANGUAGE",
        "language.title": "Interface language",
        "language.description": "Choose the display language for AI Translator.",
        "language.field": "Language",
        "language.saved": "Changes apply immediately and are saved on this device.",

        "theme.eyebrow": "APPEARANCE",
        "theme.title": "Appearance",
        "theme.description": "Choose light, dark, or automatically follow your operating system.",
        "theme.system": "System",
        "theme.systemDescription": "Follow Windows/macOS automatically",
        "theme.light": "Light",
        "theme.lightDescription": "Always use the light theme",
        "theme.dark": "Dark",
        "theme.darkDescription": "Always use the dark theme",
        "theme.current": "Active",

        "settings.nav.aria": "Settings groups",
        "settings.nav.general": "General",
        "settings.nav.generalDescription": "Appearance & language",
        "settings.nav.account": "Account",
        "settings.nav.accountDescription": "Sign-in & security",
        "settings.nav.plan": "Plan & devices",
        "settings.nav.planDescription": "Access & signed-in sessions",
        "settings.nav.reading": "Reading & study",
        "settings.nav.readingDescription": "Reader, Study & shortcuts",
        "settings.nav.advanced": "Advanced",
        "settings.nav.advancedDescription": "Recovery & service status",
        "settings.group.generalEyebrow": "GENERAL",
        "settings.group.generalSummary": "Personalize the appearance and interface language of AI Translator.",
        "settings.group.accountEyebrow": "ACCOUNT & SECURITY",
        "settings.group.accountSummary": "Manage your account, sign-in methods, and password.",
        "settings.group.planEyebrow": "PLAN & DEVICES",
        "settings.group.planSummary": "View your current plan, pricing, access, and signed-in devices.",
        "settings.group.readingEyebrow": "READING & LEARNING",
        "settings.group.readingSummary": "Configure reading, study, Novel Reader fonts, and global shortcuts.",
        "settings.group.advancedEyebrow": "ADVANCED",
        "settings.group.advancedSummary": "Reopen the guide, restore app preferences, and check service availability.",
        "settings.group.sectionLabel": "Grouped settings",

        "sidebar.workspace": "Workspace",
        "sidebar.translate": "Translate",
        "sidebar.translateDescription": "Manga & screen regions",
        "sidebar.novel": "Novel Reader",
        "sidebar.novelDescription": "TXT · EPUB · PDF",
        "sidebar.study": "Study",
        "sidebar.studyDescription": "Sentence analysis",
        "sidebar.vocabulary": "Vocabulary",
        "sidebar.vocabularyDescription": "Personal library",
        "sidebar.grammar": "Grammar",
        "sidebar.grammarDescription": "Saved patterns",
        "sidebar.review": "Review",
        "sidebar.reviewDescription": "Due cards",
        "sidebar.profiles": "Profiles",
        "sidebar.profilesDescription": "Style & characters",
        "sidebar.memory": "Translation Memory",
        "sidebar.memoryDescription": "Personal corrections",
        "sidebar.history": "History",
        "sidebar.historyDescription": "Recent sessions",
        "sidebar.settings": "Settings",
        "sidebar.settingsDescription": "Account & App",

        "topbar.translate.title": "Screen Translation",
        "topbar.translate.subtitle": "Translate manga and any content area on your screen",
        "topbar.novel.title": "Novel Reader TXT",
        "topbar.novel.subtitle": "Read and translate TXT, EPUB, and PDF in context",
        "topbar.study.title": "Study Mode",
        "topbar.study.subtitle": "Translate, understand vocabulary, and study grammar as you read",
        "topbar.vocabulary.title": "My Vocabulary",
        "topbar.vocabulary.subtitle": "A personal word library built from what you read",
        "topbar.grammar.title": "Patterns / Grammar",
        "topbar.grammar.subtitle": "Save grammar patterns to track and review later",
        "topbar.review.title": "Review",
        "topbar.review.subtitle": "Review due cards or practice whenever you want",
        "topbar.profiles.title": "Translation Profiles",
        "topbar.profiles.subtitle": "Translation style, characters, and terminology",
        "topbar.memory.title": "Translation Memory",
        "topbar.memory.subtitle": "Reuse corrections you saved in future translations",
        "topbar.history.title": "History",
        "topbar.history.subtitle": "Recent translation and study sessions",
        "topbar.settings.title": "Settings",
        "topbar.settings.subtitle": "Account, appearance, and app preferences",
        "topbar.backendOnline": "Ready",
        "topbar.backendOffline": "Offline",
        "topbar.notSignedIn": "Not signed in",
        "topbar.openAccount": "Open account",
        "topbar.signedIn": "Signed in",

        "status.quickTranslate": "Quick translate",
        "status.study": "Study",
        "status.profile": "Profile",
        "status.noProfile": "Not selected",
        "status.ready": "Ready",
        "status.offline": "Offline",

        "settings.auth.accountEyebrow": "ACCOUNT",
        "settings.auth.accountTitle": "AI Translator account",
        "settings.auth.accountDescription": "Sign in, secure your account, and manage connected sign-in methods.",
        "settings.auth.welcomeEyebrow": "AI TRANSLATOR ACCOUNT",
        "settings.auth.welcomeTitle": "One account for your reading and learning experience",
        "settings.auth.welcomeDescription": "Sign in to keep translation profiles, vocabulary, and learning progress attached to your account.",
        "settings.auth.benefitProfiles": "Keep translation profiles and character preferences consistent",
        "settings.auth.benefitLearning": "Save vocabulary, grammar, and review history",
        "settings.auth.benefitSignIn": "Sign in flexibly with Google, Facebook, or email",
        "settings.auth.signInTab": "Sign in",
        "settings.auth.registerTab": "Create account",
        "settings.auth.signInTitle": "Welcome back",
        "settings.auth.signInDescription": "Continue with the account you used before.",
        "settings.auth.registerTitle": "Create your account",
        "settings.auth.registerDescription": "Get started with email or a social account.",
        "settings.auth.serviceReady": "Sign-in service is ready",
        "settings.auth.serviceOffline": "Unable to reach the sign-in service",
        "settings.auth.continueWith": "Continue with",
        "settings.auth.waitingFor": "Waiting for",
        "settings.auth.providerUnavailable": "Temporarily unavailable",
        "settings.auth.providersUnavailable": "Google and Facebook are currently unavailable.",
        "settings.auth.orEmail": "or continue with email",
        "settings.auth.email": "Email",
        "settings.auth.password": "Password",
        "settings.auth.emailPlaceholder": "you@example.com",
        "settings.auth.passwordPlaceholder": "Enter your password",
        "settings.auth.newPasswordPlaceholder": "Create a password",
        "settings.auth.processing": "Working...",
        "settings.auth.signIn": "Sign in",
        "settings.auth.createAccount": "Create account",
        "settings.auth.forgotPassword": "Forgot password?",
        "settings.auth.secureNote": "Your sign-in information is handled over a secure connection.",
        "settings.auth.restoreSession": "Restore saved session",
        "settings.auth.accountActive": "Account active",
        "settings.auth.verified": "Verified",
        "settings.auth.linkedAccounts": "Connected accounts",
        "settings.auth.linkedAccountsDescription": "Use one AI Translator account with any connected sign-in method.",
        "settings.auth.refresh": "Refresh",
        "settings.auth.linked": "Connected",
        "settings.auth.notLinked": "Not connected",
        "settings.auth.link": "Connect",
        "settings.auth.waiting": "Waiting...",
        "settings.auth.logout": "Sign out",

        "onboarding.aria": "Getting started guide",
        "onboarding.title": "Get started in 5 steps",
        "onboarding.lead": "Sign in, choose a Translation Profile, then use shortcuts while reading the content you want.",
        "onboarding.step1.title": "Sign in and choose a Translation Profile",
        "onboarding.step1.body": "Your Translation Profile keeps translation style, terminology, and character speech preferences.",
        "onboarding.step2.title": "Scan a manga panel",
        "onboarding.step2.before": "Press",
        "onboarding.step2.after": "then drag over a manga panel or an area with multiple lines of dialogue to translate them together.",
        "onboarding.step3.title": "Move to the next manga page",
        "onboarding.step3.before": "After changing pages, press",
        "onboarding.step3.after": "to rescan the same area and continue with context from the previous page.",
        "onboarding.step4.title": "Quick Translate",
        "onboarding.step4.before": "Press",
        "onboarding.step4.after": "then drag over the text you want to translate.",
        "onboarding.step5.title": "Study",
        "onboarding.step5.before": "Press",
        "onboarding.step5.after": "to translate while vocabulary and grammar are analyzed for study.",
        "onboarding.note": "The overlay hides automatically when you switch windows or tabs. You can Pin it or change this behavior in Settings.",
        "onboarding.close": "Close guide",
        "onboarding.start": "Start using AI Translator"
    }
};

/*
 * Compatibility bridge cho UI cũ còn hard-code text trực tiếp trong JSX.
 * Component mới nên dùng t(key). Bridge này giúp 14.10.2 đổi gần như toàn bộ
 * UI hiện tại sang English mà không làm rủi ro refactor hàng nghìn dòng.
 */
const legacyEnglish: Record<string, string> = {
    "Dịch": "Translate",
    "Học tập": "Study",
    "Từ vựng": "Vocabulary",
    "Ngữ pháp": "Grammar",
    "Ôn tập": "Review",
    "Bộ nhớ dịch": "Translation Memory",
    "Lịch sử": "History",
    "Cài đặt": "Settings",
    "Tài khoản AI Translator": "AI Translator Account",
    "Đăng nhập": "Sign in",
    "Đăng ký": "Register",
    "Đăng xuất": "Sign out",
    "Đang xử lý...": "Processing...",
    "Tạo tài khoản": "Create account",
    "Khôi phục phiên đã lưu": "Restore saved session",
    "Đã xác thực": "Verified",
    "Thiết bị đăng nhập": "Signed-in devices",
    "Thu hồi": "Revoke",
    "Làm mới": "Refresh",
    "Chưa có dữ liệu thiết bị.": "No device data yet.",
    "Thu hồi refresh session của từng máy.": "Revoke the refresh session for individual devices.",
    "Gói sử dụng": "Current plan",
    "Gói & giá": "Plans & pricing",
    "BẢNG GIÁ ĐANG BÁN": "AVAILABLE PRICING",
    "Hàng tháng": "Monthly",
    "Hàng năm": "Yearly",
    "Trọn đời": "Lifetime",
    "· Niêm yết": "· List price",
    "Chưa có plan đang mở bán": "No plans are currently on sale",
    "Kết nối backend để tải bảng giá hiện tại.": "Connect to the backend to load current pricing.",
    "Xem Plan & License": "View Plan & License",
    "Kiểm tra Plans & Features và Pricing trong Admin.": "Check Plans & Features and Pricing in Admin.",
    "Quyền tính năng được lấy từ backend. Desktop không tự quyết định gói trả phí.": "Feature access is provided by the backend. Desktop does not decide paid-plan access.",
    "Mật khẩu": "Password",
    "Mật khẩu hiện tại": "Current password",
    "Mật khẩu mới": "New password",
    "Xác nhận mật khẩu": "Confirm password",
    "Xác nhận mật khẩu mới": "Confirm new password",
    "Quên mật khẩu?": "Forgot password?",
    "Mã đặt lại mật khẩu": "Password reset code",
    "Đặt mật khẩu mới": "Set new password",
    "Tài khoản liên kết": "Connected accounts",
    "Chưa liên kết": "Not connected",
    "Dùng cùng một AI Translator account khi đăng nhập bằng provider khác.": "Use the same AI Translator account when signing in with another provider.",
    "Social Login chưa được cấu hình hoặc backend chưa sẵn sàng.": "Social Login is not configured or the backend is not ready.",
    "hoặc đăng nhập bằng": "or sign in with",
    "Mặc định khi đọc truyện": "Reading defaults",
    "Các lựa chọn này được lưu ở Desktop và áp dụng cho Global Shortcut.": "These choices are saved on Desktop and applied to Global Shortcuts.",
    "Study level mặc định": "Default Study level",
    "Tự động · Khuyên dùng": "Automatic · Recommended",
    "Tự động lưu từ mới": "Automatically save new vocabulary",
    "Tự động lưu từ vựng": "Automatically save vocabulary",
    "Tự động lưu ngữ pháp": "Automatically save grammar",
    "Tự ẩn khi đổi tab/cửa sổ": "Auto-hide when switching tabs/windows",
    "Tắt nếu muốn overlay ở lại cho tới khi Close/scan mới.": "Turn this off to keep the overlay visible until Close or a new scan.",
    "Độ trong suốt": "Opacity",
    "Cỡ chữ overlay": "Overlay font size",
    "Trình độ giải thích": "Explanation level",
    "Hướng dẫn & khôi phục": "Guide & recovery",
    "Hướng dẫn bắt đầu": "Getting started guide",
    "Xem lại hướng dẫn": "View guide again",
    "Khôi phục cài đặt mặc định": "Restore default settings",
    "Font chữ khi đọc Novel": "Novel Reader font",
    "Font Reader": "Reader font",
    "Tự động": "Automatic",
    "Font hệ thống": "System font",
    "Font tùy chỉnh": "Custom font",
    "Lưu font": "Save font",
    "Reset font": "Reset font",
    "Dùng tên font đã cài trên Windows. App vẫn nối thêm fallback để giảm lỗi glyph.": "Use a font installed on Windows. The app still adds fallback fonts to reduce missing glyphs.",

    "Dịch bất kỳ vùng nào trên màn hình": "Translate any area on your screen",
    "Quét màn hình": "Scan screen",
    "Đang chọn vùng...": "Selecting area...",
    "Bạn cần đăng nhập trước khi sử dụng AI Translation.": "You need to sign in before using AI Translation.",
    "Java backend hiện không kết nối được.": "The Java backend is currently unreachable.",
    "Không thể kết nối dịch vụ. Vui lòng thử lại.": "Unable to reach the service. Please try again.",
    "Văn bản gốc": "Source text",
    "Bản dịch": "Translation",
    "Bản dịch sẽ xuất hiện tại đây": "The translation will appear here",
    "Nội dung OCR sẽ xuất hiện tại đây": "OCR text will appear here",
    "Sao chép": "Copy",
    "Xóa context": "Clear context",
    "Chưa lưu": "Unsaved",
    "Nhấn “Lưu Profile” trước khi quét để Java Prompt Engine dùng thay đổi mới.": "Save the Profile before scanning so the Java Prompt Engine uses your latest changes.",
    "Profile đang có thay đổi chưa lưu. Hãy lưu trước khi quét.": "This Profile has unsaved changes. Save it before scanning.",

    "Chế độ học": "Study Mode",
    "Bạn cần đăng nhập trước khi sử dụng Study Mode.": "You need to sign in before using Study Mode.",
    "Câu đang học": "Current sentence",
    "Chưa có câu đang học": "No sentence is being studied",
    "Câu tiếp theo": "Next sentence",
    "Bản dịch hiện trước, phân tích học tập hoàn tất sau": "The translation appears first; study analysis finishes afterward",
    "Bản dịch đã sẵn sàng": "Translation ready",
    "Cách đọc": "Reading",
    "Ý chính": "Main idea",
    "Cấu trúc": "Structure",
    "Ghi chú": "Notes",
    "Từ vựng của tôi": "My Vocabulary",
    "Cấu trúc / Ngữ pháp của tôi": "My Patterns / Grammar",
    "Tìm Kanji, Hiragana, Romaji hoặc nghĩa...": "Search Kanji, Hiragana, Romaji, or meaning...",
    "Tìm pattern hoặc ý nghĩa...": "Search pattern or meaning...",
    "Tất cả": "All",
    "Yêu thích": "Favorite",
    "Bỏ yêu thích": "Remove favorite",
    "Chưa có từ phù hợp": "No matching vocabulary",
    "Chưa có cấu trúc đã lưu": "No saved grammar patterns",
    "Gặp": "Encounters",
    "Đã gặp": "Encountered",
    "Tiến độ": "Progress",
    "Ghi chú cá nhân": "Personal note",
    "Sửa": "Edit",
    "Xóa": "Delete",
    "Hủy": "Cancel",
    "Lưu": "Save",

    "Ôn tập bằng trắc nghiệm": "Multiple-choice review",
    "Đến hạn": "Due",
    "Ôn tự do": "Free practice",
    "Ôn tập ngay": "Review now",
    "Ôn lại phiên vừa rồi": "Repeat last session",
    "Chế độ ôn lại": "Practice mode",
    "Không đổi dueAt": "Does not change dueAt",
    "Không tăng mastery": "Does not increase mastery",
    "Sai → gặp lại cuối phiên": "Wrong → appears again at the end",
    "Phím 1–4 để chọn đáp án": "Press 1–4 to choose an answer",
    "Bỏ qua card này": "Skip this card",
    "Đúng": "Correct",
    "Sai": "Wrong",
    "Chưa có review trắc nghiệm.": "No review questions yet.",
    "Chưa đủ dữ liệu tạo 4 đáp án": "Not enough data to create 4 choices",
    "Card này chưa bị chấm.": "This card has not been graded yet.",
    "Card sẽ quay lại cuối phiên": "This card will return at the end of the session",

    "Tiến độ học của bạn": "Your learning progress",
    "Accuracy 14 ngày": "14-day accuracy",
    "Đã ôn": "Reviewed",
    "Chuỗi học": "Study streak",
    "Ngày hoạt động": "Active days",
    "Item yếu": "Weak items",
    "Chưa có item nào bị đánh dấu yếu.": "No weak items yet.",
    "Hoạt động ôn tập": "Review activity",
    "Review gần đây": "Recent reviews",
    "Mở Review": "Open Review",
    "24 giờ qua": "Last 24 hours",
    "Đúng 24h": "Correct in 24h",
    "Sai 24h": "Wrong in 24h",
    "ngày liên tiếp": "consecutive days",
    "lượt trong 14 ngày": "reviews in 14 days",
    "cần ôn theo SRS": "due for SRS review",
    "chính xác": "accuracy",

    "Translation Profiles": "Translation Profiles",
    "Tên Profile": "Profile name",
    "Phong cách": "Style",
    "Giữ honorifics": "Keep honorifics",
    "Giữ Senpai / Sensei / Sama": "Keep Senpai / Sensei / Sama",
    "Custom Instructions": "Custom Instructions",
    "Character Rules": "Character Rules",
    "Thuật ngữ": "Terminology",
    "Thuật ngữ bắt buộc để bản dịch nhất quán qua nhiều câu.": "Required terminology keeps translations consistent across sentences.",
    "Dùng để kiểm soát xưng hô, tên gọi và tính cách từng nhân vật.": "Use this to control pronouns, names, and each character's personality.",
    "Chưa có Character Rule.": "No Character Rules yet.",
    "Chưa có thuật ngữ.": "No terminology yet.",
    "+ Nhân vật": "+ Character",
    "+ Thuật ngữ": "+ Term",
    "+ Tạo Profile": "+ Create Profile",
    "Xóa Profile": "Delete Profile",
    "Đặt mặc định": "Set as default",
    "Chọn hoặc tạo một Profile.": "Choose or create a Profile.",

    "Bộ nhớ dịch của bạn": "Your Translation Memory",
    "Các bản sửa bạn chủ động lưu. Exact-match sẽ ưu tiên dùng bộ nhớ này trước khi gọi AI.": "Corrections you explicitly save. Exact matches use this memory before calling AI.",
    "Tìm câu nguồn hoặc bản dịch đã sửa...": "Search source text or corrected translation...",
    "Nguồn": "Source",
    "Đích": "Target",
    "Từ nguồn": "Source language",
    "Ngôn ngữ nguồn": "Source language",
    "Ngôn ngữ đích": "Target language",
    "Bản sửa cá nhân": "Personal correction",
    "Đã dùng lại": "Reused",
    "AI calls tránh được": "AI calls avoided",
    "Chưa có Translation Memory": "No Translation Memory yet",
    "Dịch một câu, sửa kết quả rồi bấm “Lưu bản sửa”. Memory sẽ xuất hiện ở đây.": "Translate a sentence, correct it, then click “Save correction”. It will appear here.",
    "Cho phép dùng bản sửa để cải thiện AI": "Allow this correction to improve AI results",
    "Chỉ gửi khi bạn bấm “Lưu bản sửa”.": "Only sent when you click “Save correction”.",

    "Novel Reader": "Novel Reader",
    "Thư viện của bạn": "Your library",
    "Tìm novel": "Search novels",
    "Tìm trong novel": "Search in novel",
    "Tên novel hoặc chapter...": "Novel or chapter title...",
    "Đọc nguyên văn và bản dịch song song": "Read source and translation side by side",
    "Đọc và dịch novel là tính năng PRO": "Reading and translating novels is a PRO feature",
    "Bạn cần đăng nhập trước khi dịch novel.": "You need to sign in before translating novels.",
    "Dịch đoạn này": "Translate this passage",
    "Bookmark đoạn này": "Bookmark this passage",
    "Đi tới bookmark...": "Go to bookmark...",
    "Nhảy tới...": "Jump to...",
    "Trang tiếp theo": "Next page",
    "Trang sau →": "Next page →",
    "← Trang trước": "← Previous page",
    "Độ rộng trang": "Page width",
    "Cỡ chữ": "Font size",
    "Giãn dòng": "Line spacing",
    "Theme đọc": "Reader theme",
    "Chế độ hiển thị": "Display mode",
    "Gọn": "Compact",
    "Rộng": "Wide",
    "Nhỏ": "Small",
    "Lớn": "Large",
    "Rất lớn": "Extra large",
    "Dễ đọc": "Readable",
    "Tiêu chuẩn": "Standard",
    "Tự động là lựa chọn an toàn nhất khi novel có nhiều ngôn ngữ.": "Automatic is the safest choice when a novel contains multiple languages.",

    "Dịch nhanh": "Quick Translate",
    "Quét khung truyện": "Scan manga panel",
    "Sang trang manga tiếp theo": "Next manga page",
    "Toàn màn hình": "Full screen",
    "Chọn 1 vùng": "Select an area",
    "Thao tác": "Actions",
    "Trạng thái": "Status",
    "Bản ghi": "Records",
    "Tổng": "Total",
    "Tổng từ": "Total words",
    "Tìm": "Search",
    "Hiển thị": "Display",
    "Không dùng": "Disabled",
    "Mới": "New",
    "Đang học": "Learning",
    "Đã thuộc": "Mastered",
    "Cần ôn thêm": "Needs more review",

    // 14.10.2 hotfix: Review/SRS coverage
    "Yếu": "Weak",
    "Khá thuộc": "Familiar",
    "TỪ VỰNG": "VOCABULARY",
    "NGỮ PHÁP": "GRAMMAR",
    "Cần ôn lại": "Needs review",
    "Còn yếu": "Still weak",
    "Đang tiến bộ": "Improving",
    "Đã khá chắc": "Fairly solid",
    "Chưa đủ dữ liệu để tạo bộ ôn tự do 4 đáp án. Cần ít nhất 4 nghĩa khác nhau trong Vocabulary hoặc Grammar.": "Not enough data to create a four-choice free-practice set. You need at least four different meanings in Vocabulary or Grammar.",
    "SRS dùng cho card đến hạn.": "SRS is used for due cards.",
    "Khi muốn học thêm, dùng Ôn tự do hoặc Ôn lại phiên vừa rồi.": "When you want extra practice, use Free practice or Repeat last session.",
    "SRS dùng cho card đến hạn. Khi muốn học thêm, dùng Ôn tự do hoặc Ôn lại phiên vừa rồi.": "SRS is used for due cards. When you want extra practice, use Free practice or Repeat last session.",
    "Đang tạo...": "Creating...",
    "Đang làm lại các card của phiên SRS vừa rồi.": "Repeating the cards from your latest SRS session.",
    "Đang luyện các item trong thư viện, ưu tiên item yếu.": "Practicing library items, prioritizing weak items.",
    "chỉ tính SRS thật": "real SRS only",
    "Đã xong bộ ôn lại": "Practice set completed",
    "Không còn card đến hạn": "No due cards left",
    "Không còn card đến hạn.": "No due cards left.",
    "Bạn có thể làm lại bộ này hoặc quay về lịch SRS.": "You can repeat this set or return to the SRS schedule.",
    "Card đã học sẽ quay lại khi đến dueAt. Nếu muốn ôn ngay, dùng chế độ ôn lại.": "Reviewed cards return when they reach their due time. Use practice mode if you want to review them now.",
    "Làm lại bộ này": "Repeat this set",
    "Kiểm tra card đến hạn": "Check due cards",
    "Trong câu:": "In sentence:",
    "Chính xác:": "Accuracy:",
    "Đúng:": "Correct:",
    "Chuỗi đúng:": "Correct streak:",
    "✓ Chính xác": "✓ Correct",
    "✕ Chưa đúng": "✕ Not correct",
    "Đáp án:": "Answer:",
    "Không thay lịch SRS / mastery": "Does not change SRS schedule / mastery",
    "Đánh giá tự động:": "Automatic evaluation:",
    "Độ chính xác:": "Accuracy:",
    "Ôn lại không làm thay đổi lịch SRS": "Practice does not change the SRS schedule",
    "Mức thuộc được tính từ lịch sử đúng/sai": "Mastery is calculated from your correct/incorrect history",
    "Hai kiểu ôn khác nhau": "Two different review modes",
    "Đến hạn:": "Due:",
    "Ôn tự do / Làm lại:": "Free practice / Repeat:",
    "đây là SRS thật, đúng/sai sẽ cập nhật mastery và dueAt.": "this is real SRS; correct/incorrect answers update mastery and dueAt.",
    "chỉ luyện trí nhớ, không tác động lịch. Sai sẽ được đưa về cuối phiên để gặp lại.": "memory practice only; it does not affect the schedule. Incorrect cards return at the end of the session.",

    // 14.10.4 UI cleanup: keep implementation details out of normal product UI.
    "Quản lý tài khoản và cách bạn đăng nhập.": "Manage your account and sign-in options.",
    "Đăng nhập an toàn bằng tài khoản bạn chọn.": "Sign in securely with the account you choose.",
    "Tạm thời chưa khả dụng.": "Temporarily unavailable.",
    "Đăng nhập Google/Facebook hiện chưa khả dụng.": "Google/Facebook sign-in is currently unavailable.",
    "Dùng một tài khoản AI Translator với các phương thức đăng nhập đã liên kết.": "Use one AI Translator account with your connected sign-in methods.",
    "Các gói hiện có và mức giá tương ứng.": "Available plans and their current prices.",
    "Không thể tải bảng giá lúc này.": "Pricing is unavailable right now.",
    "Chưa có gói đang mở bán.": "No plans are currently available.",
    "Tính năng có trong gói hiện tại của bạn.": "Features included in your current plan.",
    "tính năng": "features",
    "Quản lý các thiết bị đang đăng nhập vào tài khoản.": "Manage devices currently signed in to your account.",
    "Thiết bị đã đăng nhập": "Signed-in device",
    "Thiết lập mặc định khi dịch và học.": "Default preferences for translation and study.",
    "Tự động lưu từ mới vào Vocabulary.": "Automatically save new words to Vocabulary.",
    "Tự động lưu mẫu ngữ pháp vào Grammar.": "Automatically save grammar patterns to Grammar.",
    "Nhập tên font đã cài trên máy.": "Enter the name of a font installed on your computer.",
    "Các phím tắt vẫn hoạt động khi AI Translator đang chạy nền.": "Shortcuts keep working while AI Translator is running in the background.",
    "Trạng thái dịch vụ": "Service status",
    "Dịch vụ sẵn sàng": "Service ready",
    "Dịch vụ tạm thời không khả dụng": "Service temporarily unavailable",
    "Thử lại": "Try again",
    "Quản lý phong cách dịch, nhân vật và thuật ngữ cho từng nội dung.": "Manage translation style, characters, and terminology for each title.",
    "Hồ sơ dịch": "Translation Profile",
    "Quét một khung truyện hoặc vùng nội dung bạn muốn dịch.": "Scan a manga panel or any content area you want to translate.",
    "Kéo chọn một khung truyện hoặc vùng manga để dịch cùng lúc": "Drag over a manga panel or manga area to translate it together",
    "Dịch nhanh một vùng chữ": "Quickly translate a text area",
    "Quét toàn bộ màn hình": "Scan the entire screen",
    "Lưu Hồ sơ": "Save Profile",
    "Hãy lưu Hồ sơ trước khi quét để dùng các thay đổi mới.": "Save the Profile before scanning to use your latest changes.",
    "Dịch ngay và tự động phân tích từ vựng, ngữ pháp sau đó.": "Translate immediately, then analyze vocabulary and grammar automatically.",
    "Nhận diện câu": "Recognize sentence",
    "Hiện bản dịch": "Show translation",
    "Phân tích học tập": "Study analysis",
    "AI đang phân tích cách đọc, cấu trúc, ngữ pháp và từ vựng. Bạn có thể quét câu tiếp theo ngay.": "AI is analyzing reading, structure, grammar, and vocabulary. You can scan the next sentence right away.",
    "Lưu từ vựng, theo dõi số lần gặp và tiến độ học.": "Save vocabulary and track encounters and learning progress.",
    "Lưu các mẫu ngữ pháp bạn gặp để theo dõi và ôn lại.": "Save grammar patterns you encounter so you can track and review them later.",
    "Ôn các thẻ đến hạn hoặc luyện thêm theo nhu cầu.": "Review due cards or practice more whenever you want.",
    "cần ôn": "due for review",
    "trong phiên ôn đến hạn": "in due-card review",
    "Không ảnh hưởng lịch ôn": "Does not affect your review schedule",
    "Kết quả sẽ cập nhật tiến độ và lịch ôn.": "Results update your progress and review schedule.",
    "Các bản sửa bạn lưu sẽ được ưu tiên để bản dịch sau nhất quán hơn.": "Corrections you save are reused to keep future translations more consistent.",
    "Lần đã tái sử dụng": "Reuses",
    "Theo dõi tiến độ ôn tập gần đây.": "Track your recent review progress.",
    "Nâng cấp để đọc và dịch TXT, EPUB và PDF ngay trong AI Translator.": "Upgrade to read and translate TXT, EPUB, and PDF in AI Translator.",
    "Đọc TXT, EPUB và PDF trong cùng một thư viện.": "Read TXT, EPUB, and PDF files in one library.",
    "Xóa khỏi thư viện không xóa file gốc trên máy.": "Removing an item from the library does not delete the original file.",
    "Không thể nhận bản dịch lúc này. Vui lòng thử lại.": "Could not get a translation right now. Please try again.",
    "PDF OCR chưa sẵn sàng. Hãy khởi động lại ứng dụng và thử lại.": "PDF OCR is not ready. Restart the app and try again.",
    "Đã mở PDF scan.": "Scanned PDF opened.",

    // 14.10.2 hotfix: Novel Reader coverage
    "Chưa xác định chapter": "Unknown chapter",
    "Mở hoặc thêm TXT / EPUB / PDF để bắt đầu đọc.": "Open or add a TXT / EPUB / PDF file to start reading.",
    "Không mở được tài liệu Novel.": "Could not open the novel document.",
    "Không tìm thấy đoạn văn nào trong tài liệu.": "No readable passages were found in the document.",
    "Đang thêm novel vào thư viện...": "Adding novel to the library...",
    "Đã hủy chọn file.": "File selection cancelled.",
    "Không mở được file TXT nào.": "Could not open any TXT file.",
    "Đang thêm EPUB vào thư viện...": "Adding EPUB to the library...",
    "Đã hủy chọn EPUB.": "EPUB selection cancelled.",
    "Không mở được file EPUB nào.": "Could not open any EPUB file.",
    "Đang phân tích PDF có text...": "Analyzing text PDF...",
    "Đã hủy chọn PDF.": "PDF selection cancelled.",
    "Không mở được PDF có text nào.": "Could not open any text PDF.",
    "PDF OCR Reader yêu cầu gói PRO.": "PDF OCR Reader requires a PRO plan.",
    "Electron preload chưa có PDF OCR API. Hãy restart Desktop sau khi áp patch.": "Electron preload does not have the PDF OCR API yet. Restart Desktop after applying the patch.",
    "PDF OCR thất bại.": "PDF OCR failed.",
    "Không nhận diện được text ở các trang PDF đã chọn.": "No text was recognized on the selected PDF pages.",
    "Đang kiểm tra PDF scan...": "Checking scanned PDF...",
    "Đã hủy chọn PDF OCR.": "PDF OCR selection cancelled.",
    "Không mở được PDF scan nào.": "Could not open any scanned PDF.",
    "Đã mở PDF scan · OCR cache sẽ được tái sử dụng ở lần đọc sau.": "Scanned PDF opened · OCR cache will be reused next time.",
    "Không đọc được metadata PDF OCR.": "Could not read PDF OCR metadata.",
    "Đã gỡ novel khỏi thư viện. File gốc trên máy không bị xóa.": "Removed the novel from the library. The original file on your computer was not deleted.",
    "Hãy mở TXT, EPUB hoặc PDF trước.": "Open a TXT, EPUB, or PDF file first.",
    "Profile đang có thay đổi chưa lưu. Hãy lưu Profile trước khi dịch.": "The Profile has unsaved changes. Save it before translating.",
    "Đã dịch tới cuối file.": "Reached the end of the file.",
    "Backend không trả về bản dịch novel.": "The backend did not return a novel translation.",
    "FREE vẫn dùng Quick Translate. PRO mở Novel Reader TXT/EPUB/PDF Text/PDF OCR, Study Mode và Manga Session; MANGA+ mở thêm Continuous Manga.": "FREE still includes Quick Translate. PRO unlocks Novel Reader TXT/EPUB/PDF Text/PDF OCR, Study Mode, and Manga Session; MANGA+ also unlocks Continuous Manga.",
    "TXT, EPUB, PDF có text và PDF scan đều được xử lý cục bộ trên Desktop. PDF scan dùng PaddleOCR local; chỉ text bạn yêu cầu dịch mới được gửi backend.": "TXT, EPUB, text PDFs, and scanned PDFs are processed locally on Desktop. Scanned PDFs use local PaddleOCR; only text you ask to translate is sent to the backend.",
    "TXT yêu cầu gói PRO": "TXT requires a PRO plan",
    "Thêm TXT": "Add TXT",
    "EPUB yêu cầu gói PRO": "EPUB requires a PRO plan",
    "Thêm EPUB": "Add EPUB",
    "PDF Text Reader yêu cầu gói PRO": "PDF Text Reader requires a PRO plan",
    "Thêm PDF có text": "Add text PDF",
    "PDF OCR Reader yêu cầu gói PRO": "PDF OCR Reader requires a PRO plan",
    "Thêm PDF scan / ảnh": "Add scanned PDF / image",
    "Đang OCR...": "Running OCR...",
    "Đang đọc": "Reading",
    "Tiếp tục": "Continue",
    "Gỡ": "Remove",
    "Không tìm thấy novel phù hợp.": "No matching novels found.",
    "Chưa có tài liệu. Thêm TXT, EPUB, PDF Text hoặc PDF OCR để bắt đầu.": "No documents yet. Add TXT, EPUB, PDF Text, or PDF OCR to get started.",
    "Dịch sang": "Translate to",
    "Mỗi lần dịch": "Per translation batch",
    "Tự động nhận diện": "Auto-detect",
    "Tiếng Việt": "Vietnamese",
    "Tiếng Anh": "English",
    "2 cột": "Two columns",
    "Nguyên văn": "Source",
    "Reset đọc": "Reset reader",
    "Tìm nguyên văn hoặc bản dịch...": "Search source or translation...",
    "Nhập từ khóa để tìm": "Enter a keyword to search",
    "← Trước": "← Previous",
    "★ Đã bookmark": "★ Bookmarked",
    "☆ Bookmark đoạn này": "☆ Bookmark this passage",
    "Đoạn đã lưu": "Saved passage",
    " · Không có chapter marker": " · No chapter markers",
    "← 20 đoạn": "← 20 passages",
    "20 đoạn →": "20 passages →",
    "OCR 3 trang tiếp": "OCR next 3 pages",
    "Đang dịch...": "Translating...",
    "Chưa dịch": "Not translated",
    "← Trang đọc trước": "← Previous reader page",
    "Trang đọc sau →": "Next reader page →",
    "TXT, EPUB, PDF có text và PDF scan đều được xử lý cục bộ trên Desktop.": "TXT, EPUB, text PDFs, and scanned PDFs are processed locally on Desktop.",
    "PDF scan dùng PaddleOCR local; chỉ text bạn yêu cầu dịch mới được gửi backend.": "Scanned PDFs use local PaddleOCR; only text you ask to translate is sent to the backend.",
    "FREE vẫn dùng Quick Translate. PRO mở Novel Reader TXT/EPUB/PDF Text/PDF OCR,": "FREE still includes Quick Translate. PRO unlocks Novel Reader TXT/EPUB/PDF Text/PDF OCR,",
    "Study Mode và Manga Session; MANGA+ mở thêm Continuous Manga.": "Study Mode and Manga Session; MANGA+ also unlocks Continuous Manga.",

    // 14.10.2 hotfix v2: direct coverage for multi-node JSX and remaining desktop UI.
    "Profile được lưu trong MySQL và Java sẽ dùng toàn bộ rules bên dưới để build prompt.": "Profiles are stored in MySQL, and Java uses all rules below to build the prompt.",
    "Chưa có profile.": "No profiles yet.",
    "Tên": "Name",
    "Dịch thành": "Translate as",
    "Ma lực": "Mana",
    "Không dùng năng lượng ma thuật": "Do not use magical energy",
    "Ví dụ: Dịch tự nhiên. Frieren xưng tôi. Không Việt hóa tên phép thuật...": "Example: Translate naturally. Frieren uses first-person pronouns. Do not localize spell names...",
    "Frieren xưng tôi. Fern gọi Frieren là sư phụ...": "Frieren uses first-person pronouns. Fern calls Frieren her master...",

    "Dịch khung truyện, manga hoặc vùng trên màn hình": "Translate a manga panel or any area on screen",
    "Với manga, nên dùng Quét khung truyện để chỉ OCR vùng nội dung cần đọc, tránh menu trình duyệt, tab và chữ ngoài truyện.": "For manga, use Scan manga panel so OCR only reads the content area and avoids browser menus, tabs, and unrelated text.",
    "Kéo chọn một khung truyện hoặc vùng manga; OCR tất cả bubble trong vùng đó và dịch một lần": "Drag over a manga panel or manga area; OCR all bubbles in that area and translate them together",
    "Dịch nhanh một vùng chữ thành một bubble": "Quickly translate one text area as a single bubble",
    "Thử nghiệm: OCR toàn bộ màn hình, có thể bắt cả UI trình duyệt/game": "Experimental: OCR the entire screen; browser/game UI may also be captured",
    "Lưu Profile": "Save Profile",
    "Ví dụ: Nhân vật chính xưng tôi. Không dịch Senpai. Ưu tiên hội thoại manga tự nhiên...": "Example: The main character uses first-person pronouns. Keep Senpai untranslated. Prefer natural manga dialogue...",
    "Bạn đã chỉnh bản dịch trước đó": "You edited this translation",
    "Lưu bản sửa": "Save correction",
    "Hoàn thành": "Completed",

    "Fast Translate chạy song song với Study Analyzer. Bạn có thể đọc bản dịch và quét câu tiếp theo mà không phải chờ toàn bộ grammar/vocabulary.": "Fast Translate runs in parallel with Study Analyzer. You can read the translation and scan the next sentence without waiting for all grammar and vocabulary analysis.",
    "Quét câu tiếp": "Scan next sentence",
    "Quét câu để học": "Scan sentence to study",
    "AUTO · Tự điều chỉnh": "AUTO · Adaptive",
    "Chỉ vocabulary item, không lưu cả câu.": "Vocabulary items only; the full sentence is not saved.",
    "Chỉ lưu pattern + giải thích, không lưu cả câu truyện.": "Only the pattern and explanation are saved; the full story sentence is not stored.",
    "Bản dịch nhanh sẽ hiện trước; cấu trúc/ngữ pháp/từ vựng cập nhật sau.": "The quick translation appears first; structure, grammar, and vocabulary update afterward.",
    "nhận diện câu": "recognize sentence",
    "hiện overlay trước": "show overlay first",
    "hoàn thiện background": "finish in background",
    "AI đang phân tích Hiragana, cấu trúc, ngữ pháp và từ vựng ở background. Bạn có thể quét câu tiếp theo ngay.": "AI is analyzing Hiragana, structure, grammar, and vocabulary in the background. You can scan the next sentence immediately.",
    "Sẵn sàng học": "Ready to study",

    "Kho từ riêng của tài khoản. Từ được chống trùng, đếm số lần gặp và theo dõi tiến độ NEW / LEARNING / KNOWN.": "Your personal vocabulary library. Entries are deduplicated, encounter counts are tracked, and progress is recorded as NEW / LEARNING / KNOWN.",
    "★ Chỉ yêu thích": "★ Favorites only",
    "Bật “Tự động lưu từ mới” trong Study Mode hoặc bấm “+ Lưu” trên một từ trong câu phân tích.": "Enable “Automatically save new vocabulary” in Study Mode or click “+ Save” on a word in the sentence analysis.",
    "Chỉ yêu thích": "Favorites only",

    "Chọn nghĩa đúng": "Choose the correct meaning",
    "Sai:": "Wrong:",

    // 14.10.4 final polish
    "Chỉ lưu từ vựng, không lưu cả câu.": "Only vocabulary is saved, not the full sentence.",
    "Chỉ lưu mẫu ngữ pháp và giải thích.": "Only the grammar pattern and explanation are saved.",
    "Từ vựng đã lưu:": "Vocabulary saved:",
    "Ngữ pháp đã lưu:": "Grammar saved:",
    "Ngữ cảnh:": "Context:",
    "Nhân vật:": "Characters:",
    "Hồ sơ đang có thay đổi chưa lưu.": "The Profile has unsaved changes.",
    "Bật “Tự động lưu ngữ pháp” trong Study hoặc bấm “+ Lưu” trên thẻ ngữ pháp.": "Enable “Automatically save grammar” in Study or click “+ Save” on a grammar card.",
    "Đang làm lại các thẻ của phiên ôn vừa rồi.": "Repeating the cards from your previous review session.",
    "Đang luyện các mục trong thư viện, ưu tiên mục cần ôn thêm.": "Practicing library items, prioritizing those that need more review.",
    "Luyện thêm": "Extra practice",
    "đã thuộc hoàn toàn": "fully mastered",
    "Chưa có mục nào cần ưu tiên ôn thêm.": "No items currently need extra attention.",
    "Mở ôn tập": "Open review",
    "Lượt ôn gần đây": "Recent reviews",
    "có ít nhất 1 lượt ôn": "at least 1 review",
    "Bản sửa sẽ xuất hiện ở đây.": "Your saved corrections will appear here.",
    "Không đọc được thông tin PDF.": "Could not read PDF information.",
    "Tự động lưu từ mới.": "Automatically save new vocabulary.",
    "Tự động lưu mẫu ngữ pháp.": "Automatically save grammar patterns.",
    "Bản dịch trên màn hình": "On-screen translation",
    "Tắt nếu muốn bản dịch ở lại cho tới khi bạn đóng hoặc quét lại.": "Turn this off to keep the translation visible until you close it or scan again.",
    "Cỡ chữ bản dịch": "Translation text size",
    "Trình độ giải thích mặc định": "Default explanation level",
    "Chỉ đặt lại cài đặt ứng dụng. Tài khoản, hồ sơ dịch, từ vựng, ngữ pháp và lịch sử ôn tập sẽ được giữ nguyên.": "Only app settings are reset. Your account, translation profiles, vocabulary, grammar, and review history are kept.",
    "Học:": "Study:",
    "Trình độ:": "Level:",
    "Hiển thị:": "Display:",
    "Tự ẩn · 96%": "Auto-hide · 96%",
    "Manga liên tục": "Continuous Manga",
    "Thuật ngữ:": "Terminology:",
    "Nội dung nhận diện sẽ xuất hiện tại đây": "Recognized text will appear here",
    "Phiên Manga": "Manga Session",
    "Mức sử dụng:": "Usage:",
    "Mã giấy phép": "License key",
    "Kích hoạt giấy phép": "Activate license",
    "Kiểm tra kết nối mạng rồi thử lại.": "Check your network connection and try again.",
    "Hết hạn:": "Expires:",
    "✓ Có": "✓ Included",
    "— Chưa có": "— Not included",

};

interface I18nContextValue {
    locale: UiLocale;
    intlLocale: string;
    availableLocales: UiLocaleOption[];
    setLocale: (locale: UiLocale) => void;
    t: (key: string, fallback?: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function loadInitialLocale(): UiLocale {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === "en" || saved === "vi") {
            return saved;
        }
    } catch {
        // localStorage may be unavailable in a restricted renderer.
    }

    return "vi";
}

interface LegacyEnglishPattern {
    pattern: RegExp;
    translate: (match: RegExpMatchArray) => string;
}

/*
 * Dynamic UI labels cannot be covered by a literal-only map because React
 * renders values such as `6 đoạn`, `0% chính xác`, and reader progress at
 * runtime. Patterns are fully anchored so user/novel/OCR content is never
 * translated by a loose substring replacement.
 */
const legacyEnglishPatterns: LegacyEnglishPattern[] = [
    { pattern: /^(\d+) đoạn$/, translate: (m) => `${m[1]} passages` },
    { pattern: /^(\d+) câu$/, translate: (m) => `${m[1]} sentences` },
    { pattern: /^(\d+) câu trước$/, translate: (m) => `${m[1]} previous sentences` },
    { pattern: /^(\d+) lần$/, translate: (m) => `${m[1]} times` },
    { pattern: /^(\d+) chapter$/, translate: (m) => `${m[1]} chapters` },
    { pattern: /^(\d+) bookmark$/, translate: (m) => `${m[1]} ${m[1] === "1" ? "bookmark" : "bookmarks"}` },
    { pattern: /^(TXT|EPUB|PDF Text|PDF OCR) · (\d+) chapter · (\d+) bookmark · (.+)$/, translate: (m) => `${m[1]} · ${m[2]} ${m[2] === "1" ? "chapter" : "chapters"} · ${m[3]} ${m[3] === "1" ? "bookmark" : "bookmarks"} · ${m[4] === "Tiếng Việt" ? "Vietnamese" : m[4] === "Tiếng Anh" ? "English" : m[4]}` },
    { pattern: /^(\d+) tài liệu · TXT\/EPUB\/PDF Text\/PDF OCR lưu cục bộ · không xóa file gốc khi gỡ khỏi Library\.$/, translate: (m) => `${m[1]} documents · TXT/EPUB/PDF Text/PDF OCR stored locally · removing an item does not delete the original file.` },
    { pattern: /^(\d+)% chính xác$/, translate: (m) => `${m[1]}% accuracy` },
    { pattern: /^(\d+) card còn trong phiên$/, translate: (m) => `${m[1]} cards left in this session` },
    { pattern: /^(\d+) kết quả$/, translate: (m) => `${m[1]} results` },
    { pattern: /^Đoạn (\d+)\/(\d+) · đã dịch (\d+)$/, translate: (m) => `Passage ${m[1]}/${m[2]} · ${m[3]} translated` },
    { pattern: /^Trang (\d+)\/(.+?) · (\d+) đoạn OCR · đã dịch (\d+)$/, translate: (m) => `Page ${m[1]}/${m[2]} · ${m[3]} OCR passages · ${m[4]} translated` },
    { pattern: /^ · (\d+)\/(.+?) trang đã OCR$/, translate: (m) => ` · ${m[1]}/${m[2]} pages OCRed` },
    { pattern: /^Dịch (\d+) đoạn tiếp$/, translate: (m) => `Translate next ${m[1]} passages` },
    { pattern: /^Tiếp tục đọc · đoạn (\d+)\/(\d+)\.$/, translate: (m) => `Continue reading · passage ${m[1]}/${m[2]}.` },
    { pattern: /^Đã mở (\d+) đoạn văn\.$/, translate: (m) => `Opened ${m[1]} passages.` },
    { pattern: /^Đang dịch đoạn (\d+)–(\d+)\.\.\.$/, translate: (m) => `Translating passages ${m[1]}–${m[2]}...` },
    { pattern: /^Đã dịch (\d+) đoạn\.$/, translate: (m) => `Translated ${m[1]} passages.` },
    { pattern: /^Đang OCR PDF · trang (\d+)–(\d+)\.\.\.$/, translate: (m) => `Running PDF OCR · pages ${m[1]}–${m[2]}...` },
    { pattern: /^PDF OCR đã xử lý đủ (\d+) trang\.$/, translate: (m) => `PDF OCR processed all ${m[1]} pages.` },
    { pattern: /^Đang mở (.+)\.\.\.$/, translate: (m) => `Opening ${m[1]}...` },
    { pattern: /^Đã chuyển ngôn ngữ nguồn sang (.+)\.$/, translate: (m) => `Source language changed to ${m[1]}.` },
    { pattern: /^Đã chuyển ngôn ngữ đích sang (.+)\. Reader đã chuyển tới đoạn cần dịch bằng ngôn ngữ mới\.$/, translate: (m) => `Target language changed to ${m[1]}. The reader moved to the next passage that needs translation in the new language.` },
    { pattern: /^Trang (\d+)$/, translate: (m) => `Page ${m[1]}` },
    { pattern: /^Hiển thị (\d+)–(\d+)$/, translate: (m) => `Showing ${m[1]}–${m[2]}` },
    { pattern: /^(\d+) tài liệu · Xóa khỏi thư viện không xóa file gốc trên máy\.$/, translate: (m) => `${m[1]} documents · Removing an item from the library does not delete the original file.` },
    { pattern: /^Hồ sơ #(\d+)$/, translate: (m) => `Profile #${m[1]}` },
    { pattern: /^Hoạt động gần đây: (.+)$/, translate: (m) => `Recently active: ${m[1]}` },
    { pattern: /^✓ (\d+) tính năng$/, translate: (m) => `✓ ${m[1]} features` }
];

function translateLegacyLiteral(
    source: string,
    locale: UiLocale
) {
    if (locale !== "en") {
        return source;
    }

    const normalized = source
        .replace(/\s+/g, " ")
        .trim();

    const exact = legacyEnglish[normalized];
    if (exact) {
        return exact;
    }

    for (const entry of legacyEnglishPatterns) {
        const match = normalized.match(entry.pattern);
        if (match) {
            return entry.translate(match);
        }
    }

    return source;
}

const textNodeSource = new WeakMap<Text, string>();
const textNodeLastOutput = new WeakMap<Text, string>();
const attributeSource = new WeakMap<Element, Map<string, string>>();
const attributeLastOutput = new WeakMap<Element, Map<string, string>>();

function withOriginalWhitespace(
    raw: string,
    translated: string
) {
    const leading = raw.match(/^\s*/)?.[0] || "";
    const trailing = raw.match(/\s*$/)?.[0] || "";
    return `${leading}${translated}${trailing}`;
}

function translateTextNode(
    node: Text,
    locale: UiLocale
) {
    const parent = node.parentElement;
    if (!parent) {
        return;
    }

    if (
        parent.closest(
            "script,style,[data-i18n-ignore='true']"
        )
    ) {
        return;
    }

    const current = node.nodeValue || "";
    const previousOutput = textNodeLastOutput.get(node);
    let source = textNodeSource.get(node);

    if (
        source === undefined ||
        (
            previousOutput !== undefined &&
            current !== previousOutput
        )
    ) {
        source = current;
        textNodeSource.set(node, source);
    }

    const core = source.trim();
    if (!core) {
        textNodeLastOutput.set(node, source);
        return;
    }

    const translatedCore = translateLegacyLiteral(
        core,
        locale
    );
    const output = withOriginalWhitespace(
        source,
        translatedCore
    );

    textNodeLastOutput.set(node, output);
    if (current !== output) {
        node.nodeValue = output;
    }
}

const elementTextSource = new WeakMap<Element, string>();
const elementTextLastOutput = new WeakMap<Element, string>();

const LEGACY_TEXT_EXCLUDED_SELECTOR = [
    "script",
    "style",
    "textarea",
    "input",
    "[contenteditable='true']",
    "[data-i18n-ignore='true']",
    ".result-editor",
    ".review-prompt",
    ".review-option-grid",
    ".novel-reader-source",
    ".novel-reader-translation",
    ".novel-passage-source",
    ".novel-passage-translation",
    ".novel-library-item-main > strong",
    ".novel-library-author",
    ".novel-library-item-main > span",
    ".library-word-title strong",
    ".library-reading strong",
    ".library-reading span",
    ".library-meaning strong",
    ".library-meaning span",
    ".grammar-library-head > div:first-child strong",
    ".grammar-library-head > div:first-child > span",
    ".grammar-library-explanation",
    ".memory-text-block",
    ".weak-item-main > strong",
    ".weak-item-main > span"
].join(",");

/*
 * React can render one visible label as multiple adjacent Text nodes, e.g.
 * `{count}% chính xác` or a paragraph broken across JSX lines. Translating
 * each Text node independently misses those labels. For leaf UI elements we
 * safely translate the combined textContent while keeping editable/user
 * content excluded above.
 */
function translateLeafElementText(
    element: Element,
    locale: UiLocale
) {
    if (
        element.matches(LEGACY_TEXT_EXCLUDED_SELECTOR) ||
        element.closest("[data-i18n-ignore='true']") ||
        element.children.length > 0
    ) {
        return;
    }

    const tag = element.tagName.toLowerCase();
    if (![
        "button", "option", "label", "span", "small", "strong", "b",
        "p", "h1", "h2", "h3", "h4", "h5", "h6", "legend", "th", "td", "div"
    ].includes(tag)) {
        return;
    }

    const current = element.textContent || "";
    const previousOutput = elementTextLastOutput.get(element);
    let source = elementTextSource.get(element);

    if (
        source === undefined ||
        (
            previousOutput !== undefined &&
            current !== previousOutput
        )
    ) {
        source = current;
        elementTextSource.set(element, source);
    }

    const core = source.replace(/\s+/g, " ").trim();
    if (!core) {
        elementTextLastOutput.set(element, source);
        return;
    }

    const translatedCore = translateLegacyLiteral(core, locale);
    const output = withOriginalWhitespace(source, translatedCore);
    elementTextLastOutput.set(element, output);

    if (current !== output && translatedCore !== core) {
        element.textContent = output;
    } else if (locale === "vi" && current !== source) {
        element.textContent = source;
    }
}

const TRANSLATABLE_ATTRIBUTES = [
    "placeholder",
    "title",
    "aria-label"
] as const;

function translateElementAttributes(
    element: Element,
    locale: UiLocale
) {
    let sources = attributeSource.get(element);
    if (!sources) {
        sources = new Map<string, string>();
        attributeSource.set(element, sources);
    }

    let lastOutputs = attributeLastOutput.get(element);
    if (!lastOutputs) {
        lastOutputs = new Map<string, string>();
        attributeLastOutput.set(element, lastOutputs);
    }

    for (const attribute of TRANSLATABLE_ATTRIBUTES) {
        if (!element.hasAttribute(attribute)) {
            continue;
        }

        const current = element.getAttribute(attribute) || "";
        const previousOutput = lastOutputs.get(attribute);
        let source = sources.get(attribute);

        if (
            source === undefined ||
            (
                previousOutput !== undefined &&
                current !== previousOutput
            )
        ) {
            source = current;
            sources.set(attribute, source);
        }

        const output = translateLegacyLiteral(source, locale);
        lastOutputs.set(attribute, output);
        if (current !== output) {
            element.setAttribute(attribute, output);
        }
    }
}

function translateTree(
    root: ParentNode,
    locale: UiLocale
) {
    const elements: Element[] = [];
    if (root instanceof Element) {
        elements.push(root);
    }
    elements.push(...Array.from(root.querySelectorAll("*")));

    // First translate attributes and combined leaf text. Doing this before
    // the Text-node pass fixes labels split by JSX formatting/expressions.
    for (const element of elements) {
        translateElementAttributes(element, locale);
        translateLeafElementText(element, locale);
    }

    const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT
    );

    let current: Node | null = walker.nextNode();
    while (current) {
        translateTextNode(current as Text, locale);
        current = walker.nextNode();
    }
}

export function I18nProvider({
    children
}: PropsWithChildren) {
    const [locale, setLocaleState] = useState<UiLocale>(
        loadInitialLocale
    );

    const setLocale = (next: UiLocale) => {
        setLocaleState(next);
        try {
            localStorage.setItem(STORAGE_KEY, next);
        } catch {
            // Preference remains active for the current session.
        }
    };

    const option = AVAILABLE_UI_LOCALES.find(
        (item) => item.code === locale
    ) || AVAILABLE_UI_LOCALES[0];

    const value = useMemo<I18nContextValue>(() => ({
        locale,
        intlLocale: option.intlLocale,
        availableLocales: AVAILABLE_UI_LOCALES,
        setLocale,
        t: (key: string, fallback?: string) =>
            messages[locale][key] ||
            messages.vi[key] ||
            fallback ||
            key
    }), [locale, option.intlLocale]);

    useEffect(() => {
        document.documentElement.lang = locale;
        translateTree(document.body, locale);

        const observer = new MutationObserver((records) => {
            for (const record of records) {
                if (record.type === "characterData") {
                    const text = record.target as Text;
                    const parent = text.parentElement;
                    if (parent) {
                        translateLeafElementText(parent, locale);
                    }
                    translateTextNode(text, locale);
                    continue;
                }

                if (record.type === "attributes") {
                    if (record.target instanceof Element) {
                        translateElementAttributes(record.target, locale);
                    }
                    continue;
                }

                for (const addedNode of record.addedNodes) {
                    if (addedNode.nodeType === Node.TEXT_NODE) {
                        translateTextNode(addedNode as Text, locale);
                    } else if (
                        addedNode instanceof Element
                    ) {
                        translateTree(addedNode, locale);
                    }
                }

                if (record.target instanceof Element) {
                    translateLeafElementText(record.target, locale);
                }
            }
        });

        observer.observe(document.body, {
            subtree: true,
            childList: true,
            characterData: true,
            attributes: true,
            attributeFilter: [
                ...TRANSLATABLE_ATTRIBUTES
            ]
        });

        return () => observer.disconnect();
    }, [locale]);

    return (
        <I18nContext.Provider value={value}>
            {children}
        </I18nContext.Provider>
    );
}

export function useI18n() {
    const value = useContext(I18nContext);
    if (!value) {
        throw new Error("useI18n must be used inside I18nProvider");
    }
    return value;
}
