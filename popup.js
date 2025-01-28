document.addEventListener('DOMContentLoaded', () => {
  // دامنه‌ها:
  const DEEPSIK_DOMAIN = 'https://www.deepseek.com';
  const GBT_DOMAIN = 'https://chatgpt.com';

  // آیکن‌ها/دکمه‌ها
  const toggleDeepsik = document.getElementById('toggle-deepsik');
  const toggleGbt = document.getElementById('toggle-gbt');

  // ابتدا از Storage می‌خوانیم که چه دامنه‌هایی غیرفعال هستند
  chrome.storage.sync.get(['excludedSites'], (result) => {
    let excludedSites = result.excludedSites || [];

    // آیا DeepSeek در لیست غیرفعال است؟
    updateSiteToggleUI(toggleDeepsik, isSiteExcluded(excludedSites, DEEPSIK_DOMAIN));
    // آیا ChatGPT در لیست غیرفعال است؟
    updateSiteToggleUI(toggleGbt, isSiteExcluded(excludedSites, GBT_DOMAIN));

    // وقتی روی DeepSeek کلیک می‌شود
    toggleDeepsik.addEventListener('click', () => {
      excludedSites = toggleExclusion(excludedSites, DEEPSIK_DOMAIN, toggleDeepsik);
    });

    // وقتی روی ChatGPT کلیک می‌شود
    toggleGbt.addEventListener('click', () => {
      excludedSites = toggleExclusion(excludedSites, GBT_DOMAIN, toggleGbt);
    });
  });

  /**
   * توابع کمکی
   */

  // بررسی اینکه آیا این دامنه در لیست غیرفعال‌ها هست یا خیر
  function isSiteExcluded(excludedSites, fullDomain) {
    // fullDomain مثلاً "https://www.deepseek.com" یا "chatgpt.com"
    return excludedSites.includes(fullDomain);
  }

  // تابع اصلی برای فعال/غیرفعال کردن دامنه و ارسال پیام به تب جاری
  function toggleExclusion(excludedSites, fullDomain, element) {
    const index = excludedSites.indexOf(fullDomain);
    let isExcluded = false;

    if (index > -1) {
      // یعنی قبلاً غیرفعال بوده، حالا می‌خواهیم فعال کنیم
      excludedSites.splice(index, 1);
      isExcluded = false;
      // پیام ارسال می‌کنیم که استایل مجدداً اعمال شود
      sendMessageToActiveTab('applyStyles', fullDomain);
    } else {
      // یعنی فعال بوده، حالا می‌خواهیم غیرفعال کنیم
      excludedSites.push(fullDomain);
      isExcluded = true;
      // پیام ارسال می‌کنیم که استایل حذف شود
      sendMessageToActiveTab('removeStyles', fullDomain);
    }

    // ذخیرهٔ وضعیت جدید در storage
    chrome.storage.sync.set({ excludedSites }, () => {
      updateSiteToggleUI(element, isExcluded);
    });

    return excludedSites;
  }

  // ظاهر آیکن را به‌روزرسانی می‌کند (مثلاً Gray برای غیرفعال)
  function updateSiteToggleUI(element, isExcluded) {
    const img = element.querySelector('img');
    if (isExcluded) {
      img.style.filter = 'grayscale(100%)';
      element.title = 'افزونه در این سایت غیرفعال است.';
    } else {
      img.style.filter = 'none';
      element.title = 'افزونه در این سایت فعال است.';
    }
  }

  /**
   * تابعی برای ارسال پیام به تب جاری.
   * - اگر دامنه فعلی با fullDomain (و زیردامنه‌ها) منطبق باشد، پیام فرستاده می‌شود.
   */
  function sendMessageToActiveTab(action, fullDomain) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs.length) return;
      const activeTab = tabs[0];
      try {
        const url = new URL(activeTab.url);
        const currentHost = url.hostname; // مثلاً "sub.deepseek.com" یا "www.chatgpt.com"
        const baseDomain = extractHostname(fullDomain); // مثلاً "www.deepseek.com" یا "chatgpt.com"

        if (domainMatches(currentHost, baseDomain)) {
          // دامنه فعلی زیرمجموعه یا برابر با baseDomain است
          chrome.tabs.sendMessage(activeTab.id, { action }, (response) => {
            console.log('Response from content script:', response);
          });
        } else {
          console.log('دامنه فعلی با', baseDomain, 'همخوانی ندارد.');
        }
      } catch (e) {
        console.error('Cannot parse URL:', e);
      }
    });
  }

  /**
   * استخراج hostname از یک رشته که ممکن است حاوی https باشد
   * مثلاً "https://www.deepseek.com" => "www.deepseek.com"
   */
  function extractHostname(input) {
    try {
      const urlObj = new URL(input);
      return urlObj.hostname; // "www.deepseek.com"
    } catch (e) {
      return input; // اگر نتوانست پارس کند، همان رشته برگردد
    }
  }

  /**
   * بررسی می‌کند آیا currentHost برابر یا زیرمجموعهٔ baseDomain هست
   * مثلاً: 
   *   - currentHost="sub.deepseek.com", baseDomain="deepseek.com" => true
   *   - currentHost="www.deepseek.com", baseDomain="deepseek.com" => true
   */
  function domainMatches(currentHost, baseDomain) {
    // حذف www. از ابتدای هر دو برای ساده‌تر شدن
    currentHost = currentHost.replace(/^www\./, '');
    baseDomain = baseDomain.replace(/^www\./, '');
    // اگر هاست دقیقاً برابر بود
    if (currentHost === baseDomain) return true;
    // یا اگر هاست به ".baseDomain" ختم می‌شود
    return currentHost.endsWith('.' + baseDomain);
  }
});
