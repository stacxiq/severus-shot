// Interface language (English / Arabic). English text is the key; Arabic is looked up here.
const AR = {
  // toolbar
  'New': 'جديد', 'Open': 'فتح', 'Save': 'حفظ', 'Undo': 'تراجع', 'Redo': 'إعادة', 'Text': 'نص', 'Screenshot': 'لقطة شاشة',
  'Image': 'صورة', 'Shape': 'شكل', 'Preview': 'المعاينة', 'Language': 'اللغة', 'Agents': 'الوكلاء', 'Export': 'تصدير',
  'New project': 'مشروع جديد', 'Open project (Ctrl+O)': 'فتح مشروع (Ctrl+O)', 'Save project (Ctrl+S)': 'حفظ المشروع (Ctrl+S)',
  'Undo (Ctrl+Z)': 'تراجع (Ctrl+Z)', 'Redo (Ctrl+Shift+Z)': 'إعادة (Ctrl+Shift+Z)', 'Agent control (MCP)': 'تحكم الوكلاء (MCP)',
  'Add text': 'إضافة نص', 'Add screenshot': 'إضافة لقطة شاشة', 'Add image': 'إضافة صورة', 'Add shape': 'إضافة شكل',
  'Caption language': 'لغة النصوص', 'Preview size': 'مقاس المعاينة', 'Switch interface language': 'تغيير لغة الواجهة',
  // slides
  'Slide': 'شريحة', 'Copy': 'نسخ', 'Delete': 'حذف', 'Add slide': 'إضافة شريحة', 'Duplicate slide': 'تكرار الشريحة', 'Delete slide': 'حذف الشريحة',
  'Drop screenshots anywhere · drag to move · corners resize · top dot rotates': 'أفلت لقطات الشاشة في أي مكان · اسحب للتحريك · الزوايا لتغيير الحجم · النقطة العلوية للتدوير',
  'Drop a screenshot': 'أفلت لقطة شاشة هنا',
  // inspector
  'Template': 'القالب', 'Theme': 'السمة', 'Apply a layout…': 'اختر تخطيطاً…', 'Apply colours…': 'اختر ألواناً…',
  'Background': 'الخلفية', 'Colour': 'لون', 'Gradient': 'تدرّج', 'Colour 1': 'اللون 1', 'Colour 2': 'اللون 2', 'Colour 3': 'اللون 3',
  'Colour 4': 'اللون 4', 'Colour 5': 'اللون 5', 'Colour 6': 'اللون 6', 'Angle': 'الزاوية', '+ Colour': '+ لون', '− Colour': '− لون',
  'Reverse': 'عكس', 'Choose image…': 'اختر صورة…', 'Darken': 'تعتيم', 'Blur': 'تمويه', 'Use on all slides': 'تطبيق على كل الشرائح',
  'Selection': 'التحديد', 'Click an element on the canvas to edit it.': 'انقر عنصراً في اللوحة لتعديله.',
  'Font': 'الخط', 'Load font file…': 'تحميل ملف خط…', 'Use on all text': 'تطبيق على كل النصوص', 'Size': 'الحجم', 'Weight': 'السُمك',
  'Align': 'المحاذاة', 'Left': 'يسار', 'Centre': 'وسط', 'Right': 'يمين', 'Auto': 'تلقائي', 'Direction': 'الاتجاه',
  'Auto-detect': 'كشف تلقائي', 'Left to right': 'من اليسار إلى اليمين', 'Right to left': 'من اليمين إلى اليسار',
  'Line height': 'ارتفاع السطر', 'Spacing': 'تباعد الأحرف', 'Italic': 'مائل', 'Shadow': 'ظل', 'Reflection': 'انعكاس',
  'Phone image…': 'صورة الهاتف…', 'Tablet image…': 'صورة اللوحي…', 'Replace image…': 'استبدال الصورة…', 'Device': 'الجهاز',
  'Frame colour': 'لون الإطار', 'Corners': 'الزوايا', 'Add gradient': 'إضافة تدرّج', 'Remove gradient': 'إزالة التدرّج',
  'Thickness': 'السماكة', 'Dot size': 'حجم النقاط', 'New outline': 'شكل جديد', 'Position': 'الموضع', 'Rotation': 'الدوران',
  'Opacity': 'الشفافية', 'To front': 'إلى الأمام', 'To back': 'إلى الخلف', 'Duplicate': 'تكرار', 'Languages': 'اللغات',
  'Add': 'إضافة', 'Add code, e.g. ar': 'أضف رمز لغة، مثل ar', 'Remove': 'إزالة', 'embedded image': 'صورة مضمّنة', 'none': 'لا يوجد',
  '100 Thin': '100 نحيف', '300 Light': '300 خفيف', '400 Regular': '400 عادي', '500 Medium': '500 متوسط', '600 Semibold': '600 شبه عريض',
  '700 Bold': '700 عريض', '800 Heavy': '800 ثقيل', '900 Black': '900 أسود',
  // templates
  'Caption on top, device below': 'النص في الأعلى والجهاز في الأسفل', 'Device on top, caption below': 'الجهاز في الأعلى والنص في الأسفل',
  'Tilted device': 'جهاز مائل', 'Two devices': 'جهازان', 'Spotlight: glow and ring behind the device': 'إضاءة: توهّج وحلقة خلف الجهاز',
  'Playful: blobs, sparkles and a clay device': 'مرِح: أشكال حرّة ولمعات وجهاز طيني', 'Frameless screenshot card': 'لقطة بلا إطار',
  'Big text, no device': 'نص كبير بلا جهاز',
  // themes
  'Midnight': 'منتصف الليل', 'Sunrise': 'شروق', 'Ocean': 'محيط', 'Mint': 'نعناع', 'Paper': 'ورق', 'Peach (soft)': 'خوخي (هادئ)',
  'Sky (soft)': 'سماوي (هادئ)', 'Sage (soft)': 'مريمية (هادئ)', 'Grape': 'عنبي',
  // frames
  'Auto (phone / tablet)': 'تلقائي (هاتف / لوحي)', 'Phone, island': 'هاتف بجزيرة', 'Phone, notch': 'هاتف بنتوء',
  'Android, punch-hole': 'أندرويد بثقب كاميرا', 'Tablet': 'لوحي', 'Clay (soft, flat)': 'طيني (ناعم ومسطّح)', 'Outline': 'خط خارجي',
  'Glass': 'زجاجي', 'Frameless': 'بلا إطار',
  // shapes
  'Rectangle': 'مستطيل', 'Ellipse': 'بيضاوي', 'Pill': 'كبسولة', 'Ring': 'حلقة', 'Arc': 'قوس', 'Blob': 'شكل حر', 'Soft glow': 'توهّج ناعم',
  'Star': 'نجمة', 'Sparkle': 'لمعة', 'Triangle': 'مثلث', 'Dot grid': 'شبكة نقاط', 'Squiggle': 'خط متموّج',
  // sizes
  'Android phone': 'هاتف أندرويد', 'Android 7" tablet': 'لوحي أندرويد 7"', 'Android 10" tablet': 'لوحي أندرويد 10"',
  // export dialog
  'Export for the stores': 'تصدير للمتاجر', 'Sizes': 'المقاسات', 'Options': 'خيارات', 'Current slide only': 'الشريحة الحالية فقط',
  'Also make a ZIP': 'إنشاء ملف ZIP أيضاً', 'Format': 'الصيغة', 'PNG (flat RGB)': 'PNG (RGB بلا شفافية)', 'Folder': 'المجلد',
  'Choose…': 'اختيار…', 'Close': 'إغلاق', 'Export needs the desktop app.': 'التصدير يحتاج إلى تطبيق سطح المكتب.',
  'Rendering {0} of {1}…': 'جارٍ إنشاء {0} من {1}…', 'Done: {0} file(s) in {1}': 'تم: {0} ملف في {1}', 'Warnings:': 'تنبيهات:',
  'Pick at least one size and one language': 'اختر مقاساً واحداً ولغة واحدة على الأقل', 'Choose an output folder': 'اختر مجلد الإخراج',
  // agents dialog
  'Control Severus Shot from an AI agent': 'التحكم في Severus Shot عبر وكيل ذكاء اصطناعي',
  'While this window is open, agents can edit and export this project through MCP.': 'ما دامت هذه النافذة مفتوحة، يستطيع الوكلاء تعديل هذا المشروع وتصديره عبر MCP.',
  'HTTP (app running)': 'HTTP (التطبيق يعمل)', 'stdio (starts the app if needed)': 'stdio (يشغّل التطبيق عند الحاجة)', 'Done': 'تم',
  'Listening on {0} (this computer only).': 'يستمع على {0} (هذا الحاسوب فقط).', 'Agent control needs the desktop app.': 'تحكم الوكلاء يحتاج إلى تطبيق سطح المكتب.',
  'Agent control is not running: {0}': 'تحكم الوكلاء لا يعمل: {0}',
  // library, templates, elements
  'Projects': 'المشاريع', 'Projects (Ctrl+O)': 'المشاريع (Ctrl+O)', 'Templates': 'القوالب', 'Templates (G)': 'القوالب (G)', 'Logo': 'شعار',
  'Elements': 'عناصر', 'Video': 'فيديو', 'Add text (T)': 'إضافة نص (T)', 'Add screenshot (S)': 'إضافة لقطة شاشة (S)',
  'Add logo or image (L)': 'إضافة شعار أو صورة (L)', 'Stickers and shapes (E)': 'ملصقات وأشكال (E)', 'Motion video (Ctrl+Shift+E)': 'فيديو متحرك (Ctrl+Shift+E)',
  'Export images (Ctrl+E)': 'تصدير الصور (Ctrl+E)', 'Shortcuts (?)': 'الاختصارات (?)',
  'Click a layout to use it on this slide, or press + to add it as a new slide. Your captions and screenshots are kept.': 'انقر تخطيطاً لتطبيقه على هذه الشريحة، أو اضغط + لإضافته كشريحة جديدة. تبقى نصوصك ولقطاتك كما هي.',
  'Use on this slide': 'استخدام في هذه الشريحة', 'Add as a new slide': 'إضافة كشريحة جديدة', 'Slide added': 'أُضيفت الشريحة',
  'Logo or image': 'شعار أو صورة', 'Stickers and components': 'ملصقات ومكوّنات', 'Shapes': 'الأشكال', 'Sticker': 'ملصق', 'Kind': 'النوع', 'Text colour': 'لون النص',
  'Star rating': 'تقييم بالنجوم', 'Award laurel': 'إكليل جائزة', 'Feature pill': 'شارة ميزة', 'Speech bubble': 'فقاعة كلام', 'Burst badge': 'شارة نجمية',
  'Notification card': 'بطاقة إشعار', 'Check mark': 'علامة صح', 'Curved arrow': 'سهم منحنٍ', 'Underline stroke': 'خط تسطير', 'Emoji': 'إيموجي',
  'Left-aligned caption': 'نص بمحاذاة البداية', 'Zoomed-in device': 'جهاز مكبَّر', 'Rating stars and device': 'نجوم التقييم مع الجهاز',
  'Award laurel and device': 'إكليل الجائزة مع الجهاز', 'Feature pills and device': 'شارات الميزات مع الجهاز', 'Floating notifications': 'إشعارات عائمة',
  'Panorama, left half': 'بانوراما، النصف الأيسر', 'Panorama, right half': 'بانوراما، النصف الأيمن', 'Device on a colour card': 'جهاز على بطاقة ملوّنة',
  'Three devices fan': 'ثلاثة أجهزة متراصّة', 'Customer review': 'رأي عميل', 'Feature checklist': 'قائمة ميزات',
  'New project name': 'اسم المشروع الجديد', 'Open file…': 'فتح ملف…', 'Projects are saved automatically in': 'تُحفظ المشاريع تلقائياً في',
  'No projects yet. Create your first one.': 'لا توجد مشاريع بعد. أنشئ مشروعك الأول.', 'The project library needs the desktop app.': 'مكتبة المشاريع تحتاج إلى تطبيق سطح المكتب.',
  'Project created': 'تم إنشاء المشروع', 'Delete project': 'حذف المشروع', 'Delete "{0}"? This cannot be undone.': 'حذف "{0}"؟ لا يمكن التراجع عن ذلك.',
  // video
  'Motion video': 'فيديو متحرك', 'Animation': 'الحركة', 'Transition': 'الانتقال', 'Seconds per slide': 'ثوانٍ لكل شريحة', 'Frame rate': 'معدل الإطارات',
  'Export MP4': 'تصدير MP4', 'Cancel': 'إلغاء', 'Cancelled': 'أُلغي', 'Length': 'المدة', 'Rendering frame {0} of {1}…': 'جارٍ إنشاء الإطار {0} من {1}…',
  'Video export needs ffmpeg installed (macOS: brew install ffmpeg). The preview works without it.': 'تصدير الفيديو يحتاج إلى تثبيت ffmpeg (على macOS: brew install ffmpeg). المعاينة تعمل بدونه.',
  'Rise and fade in': 'صعود مع ظهور تدريجي', 'Fade in': 'ظهور تدريجي', 'Pop in': 'ظهور بنبضة', 'Slide in from the side': 'انزلاق من الجانب',
  'Device slides up': 'الجهاز يصعد من الأسفل', 'No animation': 'بلا حركة', 'Cross-fade': 'تلاشٍ متقاطع', 'Push': 'دفع', 'Cut': 'قطع مباشر',
  // agents
  'Connect an AI agent': 'ربط وكيل ذكاء اصطناعي', 'Agent': 'الوكيل', 'Copied': 'تم النسخ', 'Select the text and copy it': 'حدّد النص وانسخه',
  'Severus Shot speaks MCP, an open standard, so any agent that supports it can edit and export your project while this window is open.': 'يدعم Severus Shot بروتوكول MCP المفتوح، لذا يستطيع أي وكيل يدعمه تعديل مشروعك وتصديره ما دامت هذه النافذة مفتوحة.',
  'Run in a terminal': 'نفّذ في الطرفية', 'Any other MCP client': 'أي عميل MCP آخر', 'HTTP endpoint, or launch this command for stdio': 'عنوان HTTP، أو شغّل هذا الأمر لوضع stdio',
  // shortcuts
  'Keyboard shortcuts': 'اختصارات لوحة المفاتيح', 'Open the project list': 'فتح قائمة المشاريع', 'Previous / next project': 'المشروع السابق / التالي',
  'Export images': 'تصدير الصور', 'Template gallery': 'معرض القوالب', 'Stickers and shapes': 'ملصقات وأشكال', 'Add text / screenshot / logo': 'إضافة نص / لقطة شاشة / شعار',
  'New slide': 'شريحة جديدة', 'Previous / next slide': 'الشريحة السابقة / التالية', 'Undo / redo': 'تراجع / إعادة', 'Copy, paste, duplicate': 'نسخ، لصق، تكرار',
  'Bring to front / send to back': 'إلى الأمام / إلى الخلف', 'Nudge (hold Shift for bigger steps)': 'تحريك دقيق (مع Shift لخطوات أكبر)',
  'Delete the selected element': 'حذف العنصر المحدد', 'Show this list': 'عرض هذه القائمة', 'On a Mac, use ⌘ in place of Ctrl.': 'على ماك استخدم ⌘ بدلاً من Ctrl.',
  // 0.3
  'Search commands': 'ابحث في الأوامر', 'Search commands (Ctrl+K)': 'ابحث في الأوامر (Ctrl+K)', 'Project name': 'اسم المشروع', 'Saving…': 'جارٍ الحفظ…',
  'Icons': 'أيقونات', 'Icons (I)': 'أيقونات (I)', 'Fonts': 'الخطوط', 'Fonts (F)': 'الخطوط (F)', 'Keys': 'اختصارات', 'Icon': 'أيقونة',
  'Search 2,000 icons': 'ابحث في 2000 أيقونة', 'Loading icons…': 'جارٍ تحميل الأيقونات…', 'No icon matches that search.': 'لا توجد أيقونة مطابقة.',
  'Showing the first 240. Type to narrow the list.': 'تُعرض أول 240 أيقونة. اكتب لتضييق القائمة.', 'Change icon': 'تغيير الأيقونة', 'Line weight': 'سُمك الخط',
  'Backdrop': 'الخلفية', 'Backdrop colour': 'لون الخلفية', 'None': 'بدون', 'Circle': 'دائرة', 'Square': 'مربع',
  'Search fonts or type a Google Fonts name': 'ابحث عن خط أو اكتب اسم خط من Google Fonts', 'Applies to the selected text.': 'يُطبَّق على النص المحدد.',
  'Nothing is selected, so a font applies to all captions.': 'لا يوجد تحديد، لذا يُطبَّق الخط على كل النصوص.', 'In this project': 'في هذا المشروع', 'Included': 'مرفقة مع التطبيق',
  'Installed on this computer': 'مثبّتة على هذا الحاسوب', 'No font matches that search.': 'لا يوجد خط مطابق.', 'Get "{0}" from Google Fonts': 'جلب "{0}" من Google Fonts',
  'Downloading…': 'جارٍ التنزيل…', 'Font: {0}': 'الخط: {0}', 'Browse fonts': 'تصفّح الخطوط', 'Arabic': 'عربية', 'Sans-serif': 'بلا زوائد', 'Display': 'عناوين',
  'Serif': 'بزوائد', 'Handwriting': 'خط يدوي', 'Type a command…': 'اكتب أمراً…', 'No command matches.': 'لا يوجد أمر مطابق.', 'Icons / fonts': 'الأيقونات / الخطوط',
  'Idle motion': 'حركة مستمرة', 'Keep elements floating': 'إبقاء العناصر طافية', 'Music': 'الموسيقى', 'Audio file': 'ملف الصوت', 'Volume': 'مستوى الصوت', 'Listen': 'استماع',
  'No music': 'بلا موسيقى', 'My own audio file…': 'ملف صوتي من عندي…', 'Calm pad': 'هادئة', 'Upbeat pulse': 'نشيطة', 'Lo-fi keys': 'لو-فاي', 'Bright pluck': 'مشرقة',
  'Drop and bounce': 'سقوط مع ارتداد', 'Zoom out into place': 'تصغير إلى الموضع', 'Swing in': 'دخول متأرجح', 'Slide up': 'انزلاق للأعلى', 'Zoom through': 'تكبير عابر', 'Wipe': 'مسح',
  'Button': 'زر', 'Callout': 'تنبيه توضيحي', 'Ribbon': 'شريط', 'Price tag': 'بطاقة سعر', 'Stat card': 'بطاقة رقم', 'Chart card': 'بطاقة مخطط', 'Progress ring': 'حلقة تقدّم',
  'User avatars': 'صور المستخدمين', 'Toggle switch': 'مفتاح تبديل', 'Quote marks': 'علامتا اقتباس', 'Highlighter': 'قلم تظليل', 'Confetti': 'قصاصات احتفال',
  'Concentric rings': 'حلقات متداخلة', 'Half circle': 'نصف دائرة', 'Diamond': 'معيّن', 'Hexagon': 'سداسي', 'Heart': 'قلب', 'Plus': 'علامة زائد', 'Stripes': 'خطوط مائلة', 'Wave': 'موجة',
  // messages
  'Saved': 'تم الحفظ', 'Font added: {0}': 'أُضيف الخط: {0}', 'All text now uses {0}': 'كل النصوص تستخدم الآن {0}',
  'A project needs at least one slide': 'يحتاج المشروع إلى شريحة واحدة على الأقل', 'Background applied to all slides': 'طُبّقت الخلفية على كل الشرائح',
  'Copied. Paste on any slide.': 'تم النسخ. الصق في أي شريحة.', 'Use a language code such as en, ar or pt-BR': 'استخدم رمز لغة مثل en أو ar أو pt-BR',
  'Discard unsaved changes?': 'هل تريد تجاهل التغييرات غير المحفوظة؟', 'New caption': 'نص جديد', 'Drop to add': 'أفلت للإضافة',
};

let lang = 'en';
try {
  const saved = localStorage.getItem('severus.ui');
  lang = saved === 'ar' || saved === 'en' ? saved : (navigator.language || 'en').toLowerCase().startsWith('ar') ? 'ar' : 'en';
} catch (_) { /* storage can be unavailable; English is the fallback */ }

export const uiLang = () => lang;
export const isRtlUi = () => lang === 'ar';

export function t(key, ...vars) {
  let s = (lang === 'ar' && AR[key]) || key;
  vars.forEach((v, i) => { s = s.split(`{${i}}`).join(String(v)); });
  return s;
}

export function setUiLang(next) {
  lang = next === 'ar' ? 'ar' : 'en';
  try { localStorage.setItem('severus.ui', lang); } catch (_) { /* ignore */ }
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
}

const SKIP = new Set(['TEXTAREA', 'SCRIPT', 'STYLE', 'PRE', 'CANVAS', 'SVG', 'svg']);
// Translates text, titles and placeholders under root. The English original is remembered
// on each node so the interface can switch back and forth.
export function localize(root = document.body) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) {
    if (!n.parentElement || SKIP.has(n.parentElement.tagName) || n.parentElement.closest('[data-no-i18n]')) continue;
    if (n.__key === undefined) n.__key = n.nodeValue;
    const key = n.__key.trim();
    if (!key) continue;
    const out = t(key);
    n.nodeValue = out === key ? n.__key : n.__key.replace(key, out);
  }
  const scope = root.querySelectorAll ? root : document;
  for (const el of scope.querySelectorAll('[title], [placeholder]')) {
    for (const attr of ['title', 'placeholder']) {
      if (!el.hasAttribute(attr)) continue;
      const store = `i18n${attr}`;
      if (el.dataset[store] === undefined) el.dataset[store] = el.getAttribute(attr);
      el.setAttribute(attr, t(el.dataset[store]));
    }
  }
}
