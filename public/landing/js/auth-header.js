/**
 * 랜딩 페이지: 로그인 여부에 따라 헤더·CTA 버튼 상태 적용.
 * /api/me (credentials: include)로 세션 확인 후 DOM 갱신.
 */
(function () {
  function applyLoggedInState() {
    var headerAuth = document.getElementById("header-auth");
    if (!headerAuth) return;

    var ctaBanner = document.getElementById("cta-banner");
    var ctaEvent = document.getElementById("cta-event");

    headerAuth.innerHTML =
      '<a href="/manage" class="wptp12 wpbp12 wprp16 wplp16 tptp10 tpbp10 tprp14 tplp14 mptp8 mpbp8 mprp12 mplp12 wbr99 bco_4 wfs16 tfs14 wfW6 wlh10">관리</a>' +
      '<a href="/api/auth/signout" class="wptp12 wpbp12 wprp16 wplp16 tptp10 tpbp10 tprp14 tplp14 mptp8 mpbp8 mprp12 mplp12 wbr99 bco_gray10 wdf wAc wg8 mg4 wfs16 tfs14 wfW6 wlh10 co_white">로그아웃</a>';

    if (ctaBanner) {
      ctaBanner.href = "/manage";
      ctaBanner.textContent = "관리 페이지로 이동";
    }
    if (ctaEvent) {
      ctaEvent.href = "/manage";
      ctaEvent.textContent = "관리 페이지로 이동";
    }
  }

  function init() {
    fetch("/api/me", { credentials: "include" })
      .then(function (res) {
        if (res.ok) applyLoggedInState();
      })
      .catch(function () {});
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
