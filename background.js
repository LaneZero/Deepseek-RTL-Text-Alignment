chrome.action.onClicked.addListener(() => {
  // وقتی روی آیکن کلیک می‌شود، صفحه options.html باز شود
  chrome.runtime.openOptionsPage();
});
