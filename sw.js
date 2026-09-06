/* 이야기공방 서비스 워커

   목적은 하나다 — 설치할 수 있게 만드는 것. 브라우저가 앱으로 인정하려면
   서비스 워커가 있어야 한다.

   오프라인은 아직 아니다. 화면 파일은 캐시되지만 로그인 단계에서 멤버 확인을
   서버에 물어보기 때문에, 연결이 없으면 로그인 화면에서 멈춘다.
   오프라인까지 되게 하려면 afterSignIn 을 손봐야 한다 (한 번 확인된 계정은
   브라우저에 기억해뒀다가 통신이 안 될 때 그걸로 통과시키는 식).

   전략은 "네트워크 우선".
   캐시를 먼저 주면 배포한 게 반영되지 않아 사용자가 옛날 화면에 갇힌다. 서비스 워커는
   한 번 잘못 심으면 사용자가 지우기 어렵다. 그래서 항상 서버에 먼저 물어보고,
   실패했을 때만 캐시를 꺼낸다. 느려지는 건 첫 요청 한 번뿐이고, 갇히는 일은 없다.

   슈파베이스 호출은 손대지 않는다. 다른 출처인 데다, 데이터 요청을 캐시하면
   지운 이야기가 되살아나는 것처럼 보인다. */

const CACHE  = "storyforge-v1";
const ASSETS = [
  "./", "./index.html", "./privacy.html", "./manifest.webmanifest",
  "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png"
];

self.addEventListener("install", function(e){
  // 하나라도 없으면 addAll 이 통째로 실패한다. 개별로 담아 실패를 무시한다.
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      return Promise.all(ASSETS.map(function(u){ return c.add(u).catch(function(){}); }));
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE; })
                            .map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(e){
  const req = e.request;
  if(req.method !== "GET") return;

  let url;
  try{ url = new URL(req.url); }catch(err){ return; }
  if(url.origin !== self.location.origin) return;   // 슈파베이스·구글은 그대로 통과

  e.respondWith(
    fetch(req).then(function(res){
      if(res && res.status === 200 && res.type === "basic"){
        const copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put(req, copy); });
      }
      return res;
    }).catch(function(){
      return caches.match(req).then(function(hit){
        if(hit) return hit;
        // 주소를 직접 열었는데 캐시에 없으면 앱 화면이라도 띄운다
        if(req.mode === "navigate") return caches.match("./index.html");
        return Response.error();
      });
    })
  );
});
