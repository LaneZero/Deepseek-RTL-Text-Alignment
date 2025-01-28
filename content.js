(function () {
  // ------- توابع کمکی دامنه (درصورت نیاز) -------
  function extractHostname(input) {
    try {
      return new URL(input).hostname;
    } catch (e) {
      return input;
    }
  }

  function domainMatches(currentHost, baseDomain) {
    currentHost = currentHost.replace(/^www\./, '');
    baseDomain = baseDomain.replace(/^www\./, '');
    return (currentHost === baseDomain) || currentHost.endsWith('.' + baseDomain);
  }

  // ---------- تابع حذف استایل‌های اعمال‌شده ----------
  function removeStylesFromProcessedElements() {
    const processedElements = document.querySelectorAll('[data-rtl-processed="true"]');
    processedElements.forEach(el => {
      el.style.direction = '';
      el.style.textAlign = '';
      el.style.fontFamily = '';
      el.removeAttribute('data-rtl-processed');
    });
  }

  // ---------- تابع اصلی اعمال RTL و فونت برای متن‌های فارسی ----------
  function initRtlExtension() {
    const config = {
      ignoredTags: new Set(['CODE', 'PRE', 'SCRIPT', 'STYLE']),
      minPersianChars: 2,
      importantTags: new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI']),
      fontFamily: 'Vazirmatn'
    };

    function isPersianText(text) {
      // Regex برای حروف فارسی
      const persianRegex = /[\u0600-\u06FF\uFB50-\uFB9F\u0750-\u077F]/g;
      const matches = text.match(persianRegex);
      return matches && matches.length >= config.minPersianChars;
    }

    function shouldIgnoreElement(element) {
      return (
        !element ||
        config.ignoredTags.has(element.tagName) ||
        // اگر مایل هستید وجود dir="ltr" را نادیده نگیرید، این خط را حذف کنید:
        element.getAttribute('dir') === 'ltr' ||
        element.getAttribute('data-rtl-processed') === 'true'
      );
    }

    function hasAnyPersianText(element) {
      const textContent = element.textContent || '';
      return isPersianText(textContent);
    }

    function applyPersianStyles(element) {
      if (!element || shouldIgnoreElement(element)) return;

      element.style.direction = 'rtl';
      element.style.textAlign = 'right';
      element.style.fontFamily = config.fontFamily;
      element.setAttribute('data-rtl-processed', 'true');

      // اعمال استایل به والدهای "مهم"
      let parent = element.parentElement;
      while (parent) {
        if (config.importantTags.has(parent.tagName) && !shouldIgnoreElement(parent)) {
          parent.style.direction = 'rtl';
          parent.style.textAlign = 'right';
          parent.style.fontFamily = config.fontFamily;
          parent.setAttribute('data-rtl-processed', 'true');
        }
        parent = parent.parentElement;
      }
    }

    function processPersianElements(element) {
      if (shouldIgnoreElement(element)) return;

      // اگر خود تگ "مهم" باشد و متن فارسی داشته باشد
      if (config.importantTags.has(element.tagName) && hasAnyPersianText(element)) {
        applyPersianStyles(element);
        return;
      }

      // جستجوی نودهای متنی
      const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
            return isPersianText(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
          }
        }
      );

      let node;
      while ((node = walker.nextNode())) {
        const parent = node.parentElement;
        if (parent) applyPersianStyles(parent);
      }

      // بررسی مجدد هدینگ‌ها و لیست‌ها
      element.querySelectorAll('h1, h2, h3, h4, h5, h6, ul, ol, li').forEach(elem => {
        if (hasAnyPersianText(elem)) {
          applyPersianStyles(elem);
        }
      });
    }

    // ------ Debounce برای جلوگیری از فراخوانی زیاد -------
    function debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    }

    const processInitialContent = debounce(() => {
      processPersianElements(document.body);
    }, 100);

    const observer = new MutationObserver(
      debounce((mutations) => {
        mutations.forEach((mutation) => {
          // 1) اگر نودهای جدید اضافه شدند (childList)
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                processPersianElements(node);
              }
            });
          }
          // 2) اگر محتوای یک Text Node تغییر کرد (characterData)
          else if (mutation.type === 'characterData') {
            const parent = mutation.target.parentElement;
            if (parent) {
              processPersianElements(parent);
            }
          }
        });
      }, 100)
    );

    // اجرای اولیه (برای محتوای از قبل موجود)
    processInitialContent();

    // آغاز نظارت بر تغییرات DOM
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true // ← رصد تغییر متن در نودهای متنی
    });

    // قطع نظارت هنگام ترک صفحه
    window.addEventListener('unload', () => {
      observer.disconnect();
    });
  }

  // -- بررسی لیست دامنه‌های غیرفعال (excludedSites) --
  chrome.storage.sync.get(['excludedSites'], (result) => {
    const excludedSites = result.excludedSites || [];
    const currentDomain = window.location.hostname;

    // اگر دامنه/زیر دامنه فعلی در لیست غیرفعال نباشد، افزونه را فعال کن
    const isExcluded = excludedSites.some((dom) => {
      const baseDom = extractHostname(dom);
      return domainMatches(currentDomain, baseDom);
    });

    if (!isExcluded) {
      initRtlExtension();
    }
  });

  // -- گوش دادن به پیام‌های پاپ‌آپ برای حذف یا اعمال مجدد استایل --
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'applyStyles') {
      initRtlExtension();
      sendResponse({ status: 'applied' });
    } else if (message.action === 'removeStyles') {
      removeStylesFromProcessedElements();
      sendResponse({ status: 'removed' });
    }
  });
})();
