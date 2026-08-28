import {
  releaseInfo,
} from "./release";


export const changelogReleases = [
  {
    id: "current-beta",

    label:
      releaseInfo.version === "Beta"
        ? "Current Beta"
        : releaseInfo.version,

    channel: "Beta",

    summaryVi:
      "Tập trung vào translation quality, Manga context và khả năng giữ bản dịch nhất quán hơn.",

    summaryEn:
      "Focused on translation quality, Manga context and more consistent translations.",

    items: [
      {
        type: "new",

        title:
          "Cross-page Manga Context",

        titleVi:
          "Context Manga qua nhiều trang",

        descriptionVi:
          "Manga Session có thể sử dụng recent context phù hợp từ các trang trước để hỗ trợ bản dịch hiện tại.",

        descriptionEn:
          "Manga Session can use relevant recent context from previous pages to support the current translation.",

        area:
          "Manga",

        guide:
          "/guide/manga",
      },

      {
        type: "new",

        title:
          "Character Consistency Memory",

        titleVi:
          "Character Consistency Memory",

        descriptionVi:
          "Các mapping nhân vật đáng tin cậy có thể hỗ trợ giảm thay đổi tên không cần thiết giữa những lần xuất hiện.",

        descriptionEn:
          "Trusted character mappings can help reduce unnecessary name variation across repeated appearances.",

        area:
          "Manga",

        guide:
          "/guide/manga#manga-continuity",
      },

      {
        type: "new",

        title:
          "User Correction Support",

        titleVi:
          "User Correction",

        descriptionVi:
          "Người dùng có thể sửa bản dịch chưa đúng và sử dụng correction như một tín hiệu đáng tin cậy trong workflow.",

        descriptionEn:
          "Users can correct inaccurate translations and use corrections as trusted signals in the workflow.",

        area:
          "Translation",

        guide:
          "/guide/manga#manga-correction",
      },

      {
        type: "improved",

        title:
          "Batch Translation Consistency",

        titleVi:
          "Cải thiện Batch Translation",

        descriptionVi:
          "Cải thiện cách nhiều block trong cùng batch sử dụng thông tin chung để giảm sự khác biệt không cần thiết.",

        descriptionEn:
          "Improved how blocks within the same batch use shared information to reduce unnecessary variation.",

        area:
          "Translation",

        guide:
          "/guide/manga#manga-batch",
      },

      {
        type: "improved",

        title:
          "Translation Quality Checks",

        titleVi:
          "Translation Quality Checks",

        descriptionVi:
          "Tăng cường kiểm tra chất lượng trước khi một translation result được sử dụng trong workflow tiếp theo.",

        descriptionEn:
          "Strengthened quality checks before a translation result continues through the workflow.",

        area:
          "Quality",
      },

      {
        type: "fixed",

        title:
          "Manga Correction Scope",

        titleVi:
          "Correction cập nhật đúng Manga bubble",

        descriptionVi:
          "Correction của một block manga được giới hạn đúng vào block tương ứng thay vì ảnh hưởng nhầm nội dung khác.",

        descriptionEn:
          "A Manga block correction is now scoped to the correct block instead of affecting unrelated content.",

        area:
          "Manga",

        guide:
          "/guide/manga#manga-correction",
      },
    ],
  },


  {
    id: "translation-foundation",

    label:
      "Translation Foundation",

    channel:
      "Beta",

    summaryVi:
      "Nền tảng dành cho Translation Profiles, memory, provenance và workflow dịch có kiểm soát.",

    summaryEn:
      "Foundation work for Translation Profiles, memory, provenance and controlled translation workflows.",

    items: [
      {
        type: "new",

        title:
          "Translation Profiles",

        titleVi:
          "Translation Profiles",

        descriptionVi:
          "Cho phép tách cấu hình dịch theo loại nội dung và kết hợp Glossary, Character Rules cùng các instruction liên quan.",

        descriptionEn:
          "Allows translation configuration to be separated by content type with Glossary entries, Character Rules and related instructions.",

        area:
          "Profiles",

        guide:
          "/guide/profile",
      },

      {
        type: "new",

        title:
          "Personal Translation Memory",

        titleVi:
          "Personal Translation Memory",

        descriptionVi:
          "Bổ sung memory cá nhân để hỗ trợ những trường hợp lặp lại phù hợp mà không thay thế source hiện tại.",

        descriptionEn:
          "Added personal translation memory to support relevant repeated cases without replacing the current source.",

        area:
          "Memory",

        guide:
          "/guide/profile?tab=context",
      },

      {
        type: "improved",

        title:
          "Context-safe Translation Memory",

        titleVi:
          "Translation Memory an toàn với context",

        descriptionVi:
          "Cải thiện cách memory được tái sử dụng để giảm nguy cơ một translation cũ bị áp dụng vào context không phù hợp.",

        descriptionEn:
          "Improved how memory is reused to reduce the risk of applying an old translation to an unrelated context.",

        area:
          "Memory",
      },

      {
        type: "improved",

        title:
          "Translation Provenance",

        titleVi:
          "Translation Provenance",

        descriptionVi:
          "Giữ thêm thông tin về nguồn và quá trình tạo translation để workflow phía sau có thể phân biệt dữ liệu rõ hơn.",

        descriptionEn:
          "Preserves more information about the source and generation path so later workflows can distinguish translation data more clearly.",

        area:
          "Quality",
      },
    ],
  },


  {
    id: "product-workflows",

    label:
      "Product Workflows",

    channel:
      "Beta",

    summaryVi:
      "Mở rộng AitraNova từ Quick Translate sang Manga, Documents và Learning.",

    summaryEn:
      "Expanded AitraNova from Quick Translate into Manga, Documents and Learning.",

    items: [
      {
        type: "new",

        title:
          "Manga Session",

        titleVi:
          "Manga Session",

        descriptionVi:
          "Workflow liên tục dành cho việc xử lý nhiều trang manga thay vì dịch từng ảnh hoàn toàn độc lập.",

        descriptionEn:
          "A continuous workflow for handling multiple Manga pages rather than translating every image independently.",

        area:
          "Manga",

        guide:
          "/guide/manga",
      },

      {
        type: "new",

        title:
          "Document Readers",

        titleVi:
          "Document Readers",

        descriptionVi:
          "Bổ sung workflow đọc TXT, EPUB, PDF Text và PDF OCR.",

        descriptionEn:
          "Added workflows for TXT, EPUB, PDF Text and PDF OCR.",

        area:
          "Documents",

        guide:
          "/guide/documents",
      },

      {
        type: "new",

        title:
          "Learning System",

        titleVi:
          "Learning System",

        descriptionVi:
          "Vocabulary, Grammar và Review cho phép tiếp tục học từ chính nội dung đang đọc và dịch.",

        descriptionEn:
          "Vocabulary, Grammar and Review make it possible to continue learning from the content being read and translated.",

        area:
          "Learning",

        guide:
          "/guide/learning",
      },

      {
        type: "improved",

        title:
          "Quick Translate Workflow",

        titleVi:
          "Quick Translate Workflow",

        descriptionVi:
          "Cải thiện luồng từ screen selection, OCR, translation đến overlay để thao tác nhanh hơn.",

        descriptionEn:
          "Improved the flow from screen selection and OCR to translation and overlay for faster use.",

        area:
          "Desktop",

        guide:
          "/guide/quick",
      },
    ],
  },
];


export const changelogStats = {
  releases:
    changelogReleases.length,

  items:
    changelogReleases.reduce(
      (total, release) =>
        total + release.items.length,
      0
    ),

  new:
    changelogReleases.reduce(
      (total, release) =>
        total
        + release.items.filter(
          (item) =>
            item.type === "new"
        ).length,
      0
    ),

  improved:
    changelogReleases.reduce(
      (total, release) =>
        total
        + release.items.filter(
          (item) =>
            item.type === "improved"
        ).length,
      0
    ),

  fixed:
    changelogReleases.reduce(
      (total, release) =>
        total
        + release.items.filter(
          (item) =>
            item.type === "fixed"
        ).length,
      0
    ),
};
