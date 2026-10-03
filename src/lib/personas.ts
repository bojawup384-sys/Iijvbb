/**
 * Barq v9 — personas (أوضاع), slash commands and quick follow-ups.
 * Shared by the client (UI) and the server (system-prompt block).
 * The server only ever trusts the persona *id*, never client-sent text.
 */

export type PersonaId =
  | "default"
  | "dev"
  | "research"
  | "teacher"
  | "writer"
  | "darija"
  | "business"
  | "translator";

export type Persona = {
  id: PersonaId;
  label: string;
  emoji: string;
  hint: string;
  /** appended to the system prompt on the server */
  prompt: string;
};

export const PERSONAS: Persona[] = [
  {
    id: "default",
    label: "برق",
    emoji: "⚡",
    hint: "المساعد العادي",
    prompt: "",
  },
  {
    id: "dev",
    label: "مبرمج",
    emoji: "💻",
    hint: "كود نظيف وحلول عملية",
    prompt:
      "الوضع الحالي: مهندس برمجيات أول. اكتب كودًا كاملًا يعمل، اشرح القرار التقني في سطرين، نبّه إلى الأخطاء الشائعة والأمان، واقترح اختبارًا سريعًا. لا تحشُ الكلام.",
  },
  {
    id: "research",
    label: "باحث",
    emoji: "🔬",
    hint: "تحليل عميق ومنظّم",
    prompt:
      "الوضع الحالي: باحث دقيق. قسّم الجواب إلى: الخلاصة، التفاصيل، الحجج المؤيدة والمعارضة، ثم حدود المعرفة. فرّق بين الحقيقة والتقدير، ولا تخترع مصادر أو أرقامًا. إن لم تكن متأكدًا فقل ذلك صراحة.",
  },
  {
    id: "teacher",
    label: "أستاذ",
    emoji: "🎓",
    hint: "يشرح خطوة بخطوة",
    prompt:
      "الوضع الحالي: أستاذ صبور. اشرح من البسيط إلى المعقّد بأمثلة من الحياة اليومية، ثم اطرح سؤال تحقّق واحدًا في النهاية ليتأكد الطالب أنه فهم.",
  },
  {
    id: "writer",
    label: "كاتب",
    emoji: "✍️",
    hint: "نصوص بأسلوب جميل",
    prompt:
      "الوضع الحالي: كاتب محترف. اهتم بالإيقاع والصور والجمل القصيرة القوية، وتجنّب الكليشيهات. قدّم نسخة جاهزة للنشر، وعند الحاجة نسخة ثانية بنبرة مختلفة.",
  },
  {
    id: "darija",
    label: "خويا",
    emoji: "🇩🇿",
    hint: "دردشة بالدارجة الجزائرية",
    prompt:
      "الوضع الحالي: صديق جزائري ذكي. تكلّم بالدارجة الجزائرية بشكل طبيعي وخفيف الظل، وبقي دقيقًا في المعلومة. استعمل الفصحى أو الفرنسية فقط عند الحاجة لمصطلح تقني.",
  },
  {
    id: "business",
    label: "تاجر",
    emoji: "📈",
    hint: "مشاريع وتسويق وبيع",
    prompt:
      "الوضع الحالي: مستشار أعمال للسوق الجزائري والعربي. أعطِ خطوات قابلة للتنفيذ هذا الأسبوع، وأرقامًا تقريبية بالدينار عند الإمكان، ونبّه إلى القوانين والتكاليف الخفية. ركّز على الربح والواقعية.",
  },
  {
    id: "translator",
    label: "مترجم",
    emoji: "🌍",
    hint: "عربي · فرنسي · إنجليزي",
    prompt:
      "الوضع الحالي: مترجم محترف. ترجم المعنى وليس الكلمات، حافظ على النبرة، واعرض نسخة رسمية ونسخة عامية عندما يختلف الأسلوب. اذكر ملاحظة قصيرة إن كانت هناك عبارة تحتمل أكثر من معنى.",
  },
];

const BY_ID = new Map(PERSONAS.map((p) => [p.id, p]));

export function isPersonaId(v: unknown): v is PersonaId {
  return typeof v === "string" && BY_ID.has(v as PersonaId);
}

/** Server: turn an untrusted id into a safe system-prompt block. */
export function personaBlock(id: unknown): string {
  if (!isPersonaId(id) || id === "default") return "";
  const p = BY_ID.get(id);
  return p && p.prompt ? `\n\n[${p.label}] ${p.prompt}` : "";
}

/* ------------------------------------------------------------------ */
/* Slash commands                                                       */
/* ------------------------------------------------------------------ */

export type SlashCommand = {
  cmd: string;
  label: string;
  hint: string;
  /** text put in the box; the user finishes it */
  template: string;
  /** send straight away (no extra text needed) */
  instant?: boolean;
};

export const SLASH_COMMANDS: SlashCommand[] = [
  { cmd: "لخص", label: "لخّص", hint: "خلاصة في نقاط", template: "لخّص لي هذا النص في 5 نقاط واضحة:\n\n" },
  { cmd: "ترجم", label: "ترجم", hint: "إلى العربية أو الفرنسية", template: "ترجم هذا النص ترجمة طبيعية (وقل لي إن كان فيه معنى مزدوج):\n\n" },
  { cmd: "اشرح", label: "اشرح", hint: "ببساطة وبمثال", template: "اشرح لي بشكل بسيط مع مثال من الحياة اليومية:\n\n" },
  { cmd: "كود", label: "اكتب كود", hint: "كود كامل يعمل", template: "اكتب لي كودًا كاملًا يعمل لـ:\n\n" },
  { cmd: "صحح", label: "صحّح الكود", hint: "ابحث عن الأخطاء", template: "ابحث عن الأخطاء في هذا الكود وأعطني النسخة المصحّحة مع شرح قصير لكل خطأ:\n\n```\n\n```" },
  { cmd: "ايميل", label: "اكتب رسالة", hint: "رسمية أو ودّية", template: "اكتب لي رسالة (بريد إلكتروني) مهنية ومختصرة حول:\n\n" },
  { cmd: "خطة", label: "خطة عمل", hint: "خطوات وجدول", template: "ضع لي خطة عملية بخطوات وجدول زمني لـ:\n\n" },
  { cmd: "قارن", label: "قارن", hint: "جدول مقارنة", template: "قارن بين الخيارين التاليين في جدول، ثم اعطني توصية واضحة:\n\n" },
  { cmd: "افكار", label: "أفكار", hint: "10 أفكار مختلفة", template: "أعطني 10 أفكار مختلفة وأصيلة حول:\n\n" },
  { cmd: "حسّن", label: "حسّن النص", hint: "أسلوب أقوى", template: "حسّن هذا النص لغويًا وأسلوبيًا مع الحفاظ على المعنى:\n\n" },
  { cmd: "اختبرني", label: "اختبرني", hint: "أسئلة تدريب", template: "اختبرني في الموضوع التالي بـ 5 أسئلة، واحدًا واحدًا، وصحّح إجابتي بعد كل سؤال:\n\n" },
  { cmd: "سيو", label: "SEO", hint: "عناوين ووصف وكلمات", template: "حسّن SEO لهذا المنتج/الصفحة: عنوان، وصف، 10 كلمات مفتاحية، وأفكار محتوى:\n\n" },
];

export function matchSlash(input: string): SlashCommand[] | null {
  if (!input.startsWith("/") || input.includes("\n")) return null;
  const q = input.slice(1).trim().toLowerCase();
  const list = SLASH_COMMANDS.filter(
    (c) => !q || c.cmd.includes(q) || c.label.includes(q) || c.hint.includes(q)
  );
  return list.length ? list : null;
}

/* ------------------------------------------------------------------ */
/* Quick follow-ups shown under the last answer                         */
/* ------------------------------------------------------------------ */

export const FOLLOW_UPS: { label: string; prompt: string }[] = [
  { label: "اختصر", prompt: "اختصر الجواب السابق في 3 أسطر." },
  { label: "اشرح أكثر", prompt: "اشرح الجواب السابق بتفصيل أكثر مع مثال." },
  { label: "بالدارجة", prompt: "عاود لي الجواب السابق بالدارجة الجزائرية بكلمات بسيطة." },
  { label: "En français", prompt: "Reformule la réponse précédente en français." },
  { label: "جدول", prompt: "حوّل الجواب السابق إلى جدول منظّم." },
];
