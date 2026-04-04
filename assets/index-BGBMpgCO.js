(function(){const c=document.createElement("link").relList;if(c&&c.supports&&c.supports("modulepreload"))return;for(const e of document.querySelectorAll('link[rel="modulepreload"]'))u(e);new MutationObserver(e=>{for(const t of e)if(t.type==="childList")for(const o of t.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&u(o)}).observe(document,{childList:!0,subtree:!0});function l(e){const t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),e.crossOrigin==="use-credentials"?t.credentials="include":e.crossOrigin==="anonymous"?t.credentials="omit":t.credentials="same-origin",t}function u(e){if(e.ep)return;e.ep=!0;const t=l(e);fetch(e.href,t)}})();const p="modulepreload",g=function(a){return"/Dhun-Supper-Club/"+a},m={},h=function(c,l,u){let e=Promise.resolve();if(l&&l.length>0){let o=function(n){return Promise.all(n.map(s=>Promise.resolve(s).then(d=>({status:"fulfilled",value:d}),d=>({status:"rejected",reason:d}))))};document.getElementsByTagName("link");const r=document.querySelector("meta[property=csp-nonce]"),f=(r==null?void 0:r.nonce)||(r==null?void 0:r.getAttribute("nonce"));e=o(l.map(n=>{if(n=g(n),n in m)return;m[n]=!0;const s=n.endsWith(".css"),d=s?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${n}"]${d}`))return;const i=document.createElement("link");if(i.rel=s?"stylesheet":p,s||(i.as="script"),i.crossOrigin="",i.href=n,f&&i.setAttribute("nonce",f),document.head.appendChild(i),s)return new Promise((E,_)=>{i.addEventListener("load",E),i.addEventListener("error",()=>_(new Error(`Unable to preload CSS for ${n}`)))})}))}function t(o){const r=new Event("vite:preloadError",{cancelable:!0});if(r.payload=o,window.dispatchEvent(r),!r.defaultPrevented)throw o}return e.then(o=>{for(const r of o||[])r.status==="rejected"&&t(r.reason);return c().catch(t)})},I={VITE_FIREBASE_APP_ID:"1:700497675876:web:7efbbb072850b796b40171"},y=document.getElementById("root"),b=I,S=!!b.VITE_FIREBASE_APP_ID;S?h(()=>import("./bootstrap-Sko6n_ip.js"),[]):y.innerHTML=`
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem;font-family:system-ui,sans-serif;background:#fafafa;color:#171717;">
      <div style="max-width:28rem;line-height:1.6;">
        <h1 style="font-size:1.25rem;font-weight:600;margin:0 0 1rem;">Site configuration missing</h1>
        <p style="margin:0 0 1rem;color:#525252;font-size:0.9375rem;">
          This build does not include Firebase settings. GitHub Pages builds need
          <strong> repository secrets</strong> so Vite can embed them at build time.
        </p>
        <p style="margin:0 0 1rem;color:#525252;font-size:0.9375rem;">
          In GitHub: <strong>Settings → Secrets and variables → Actions</strong>, add:
          <code style="display:block;margin-top:0.5rem;padding:0.75rem;background:#fff;border:1px solid #e5e5e5;font-size:0.8125rem;word-break:break-all;">
            VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID,<br/>
            VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_MESSAGING_SENDER_ID, VITE_FIREBASE_APP_ID</code>
        </p>
        <p style="margin:0 0 1rem;color:#737373;font-size:0.8125rem;">
          Optional: <code>VITE_FIREBASE_FIRESTORE_DATABASE_ID</code>, <code>VITE_STRIPE_PUBLIC_KEY</code>.
        </p>
        <p style="margin:0;color:#737373;font-size:0.8125rem;">
          For reservations and checkout, deploy <code>server.ts</code> somewhere, add secret <code>VITE_API_BASE_URL</code>
          (your API origin, no trailing slash), and on the API set <code>CORS_ORIGINS</code> to your GitHub Pages origin
          (e.g. <code>https://YOUR_USERNAME.github.io</code>). Then push to <code>main</code> to redeploy.
        </p>
      </div>
    </div>`;export{h as _};
