// Apply before the app loads to avoid a light flash for returning dark-mode users.
(function () {
  var preference;
  try { preference = localStorage.getItem("tcheka-theme"); } catch (_) {}
  var dark = preference === "dark" ||
    (preference !== "light" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]').setAttribute("content", dark ? "#151519" : "#FFD43B");
})();
