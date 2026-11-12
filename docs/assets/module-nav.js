/* Keep module subject tabs in sync when a technical anchor changes. */
(() => {
  "use strict";
  function sync() {
    const tabbar=document.querySelector(".syndes-module-tabs");
    if(!tabbar)return;
    const tabs=[...tabbar.querySelectorAll("a")];
    const here=new URL(window.location.href);
    // Old anchored technical URLs must land on their new, independent page.
    // Keep the unanchored full reference available for historical citations.
    if (here.pathname.endsWith("/REFERENCIA-TECNICA/")) {
      const targets={
        "#endpoints-http":"APIS",
        "#schemas-sql":"DADOS",
        "#pacote-publico":"CONTRATOS",
        "#dependencias-declaradas":"DEPENDENCIAS",
        "#classes-e-interfaces":"CODIGO",
        "#metodos":"CODIGO",
        "#frontend-identificado":"CODIGO",
        "#gateway-go":"CODIGO"
      };
      const target=targets[here.hash];
      if (target) {
        window.location.replace(new URL("../"+target+"/",here).href);
        return;
      }
    }
    const same=tabs.filter(a=>new URL(a.href,here).pathname===here.pathname);
    let chosen=same.find(a=>new URL(a.href,here).hash===here.hash);
    if(!chosen) chosen=same.find(a=>!new URL(a.href,here).hash)||same[0];
    for (const a of tabs) {
      a.removeAttribute("aria-current");
      if(a===chosen)a.setAttribute("aria-current","page");
    }
  }
  if (document.readyState==="loading")document.addEventListener("DOMContentLoaded",sync);
  else sync();
  window.addEventListener("hashchange",sync);
  if (typeof document$!=="undefined" && document$.subscribe)document$.subscribe(sync);
})();
