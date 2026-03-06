(function () {
  'use strict';

  const TARGET_SPEED = 1.5;
  const MAX_RETRIES_PER_SECOND = 10;
  const THROTTLE_WINDOW_MS = 1000;

  const processedVideos = new WeakSet();

  function applySpeed(video) {
    video.playbackRate = TARGET_SPEED;
  }

  function initSpeedControl(video) {
    if (processedVideos.has(video)) return;
    processedVideos.add(video);

    applySpeed(video);

    video.addEventListener('loadedmetadata', function () {
      applySpeed(video);
    }, { once: true });

    let settingSpeed = false;
    let retryCount = 0;
    let windowStart = Date.now();

    video.addEventListener('ratechange', function () {
      if (settingSpeed) return;
      if (video.playbackRate === TARGET_SPEED) return;

      const now = Date.now();
      if (now - windowStart >= THROTTLE_WINDOW_MS) {
        retryCount = 0;
        windowStart = now;
      }

      if (retryCount >= MAX_RETRIES_PER_SECOND) return;

      retryCount++;
      settingSpeed = true;
      video.playbackRate = TARGET_SPEED;
      settingSpeed = false;
    });
  }

  document.querySelectorAll('video').forEach(initSpeedControl);

  const observer = new MutationObserver(function (mutations) {
    for (let i = 0; i < mutations.length; i++) {
      const addedNodes = mutations[i].addedNodes;
      for (let j = 0; j < addedNodes.length; j++) {
        const node = addedNodes[j];
        if (node.nodeType !== Node.ELEMENT_NODE) continue;

        if (node.nodeName === 'VIDEO') {
          initSpeedControl(node);
        } else if (node.querySelectorAll) {
          const videos = node.querySelectorAll('video');
          for (let k = 0; k < videos.length; k++) {
            initSpeedControl(videos[k]);
          }
        }
      }
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();
