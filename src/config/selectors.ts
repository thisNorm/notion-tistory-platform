export const TISTORY_SELECTORS = {
  title: [
    'input[name="title"]',
    'input[placeholder*="제목"]',
    'textarea[placeholder*="제목"]',
    ".editor-title input",
    ".cover-title input",
  ],
  editor: [
    '[contenteditable="true"]',
    ".ProseMirror",
    ".editor-contents",
    "textarea",
    ".CodeMirror-code",
  ],
  mediaButton: [
    'button[aria-label*="이미지"]',
    'button[title*="이미지"]',
    ".btn-image",
    ".editor-image-button",
  ],
  fileInput: [
    'input[type="file"]',
    'input[accept*="image"]',
    ".file-image input[type='file']",
  ],
  publishTrigger: [
    'button[aria-label*="발행"]',
    'button[title*="발행"]',
    "button.btn-publish",
    ".publish-layer button",
  ],
  publishConfirm: [
    'button[aria-label*="공개 발행"]',
    'button[title*="공개 발행"]',
    "button.btn_ok",
    ".layer_btn_type1",
  ],
};

export const DEFAULT_TISTORY_WRITE_PATH = "/manage/newpost";
