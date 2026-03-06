(function () {
  'use strict';

  const PRESETS = [1, 1.25, 1.5, 1.75, 2];
  const DEFAULT_SPEED = 1.5;
  const MAX_RETRIES_PER_SECOND = 10;
  const THROTTLE_WINDOW_MS = 1000;

  let desiredSpeed = DEFAULT_SPEED;
  const processedVideos = new WeakSet();

  function startObserving() {
    document.querySelectorAll('video').forEach(initSpeedControl);

    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var addedNodes = mutations[i].addedNodes;
        for (var j = 0; j < addedNodes.length; j++) {
          var node = addedNodes[j];
          if (node.nodeType !== Node.ELEMENT_NODE) continue;

          if (node.nodeName === 'VIDEO') {
            initSpeedControl(node);
          } else if (node.querySelectorAll) {
            var videos = node.querySelectorAll('video');
            for (var k = 0; k < videos.length; k++) {
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
  }

  // Load saved speed from storage, THEN start observing videos
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.sync.get({ defaultSpeed: DEFAULT_SPEED }, function (data) {
      desiredSpeed = data.defaultSpeed;
      startObserving();
    });

    chrome.storage.onChanged.addListener(function (changes) {
      if (changes.defaultSpeed) {
        desiredSpeed = changes.defaultSpeed.newValue;
        document.querySelectorAll('video').forEach(function (v) {
          v.playbackRate = desiredSpeed;
        });
        updateAllOverlays();
      }
    });
  } else {
    startObserving();
  }

  function updateAllOverlays() {
    var isPreset = PRESETS.indexOf(desiredSpeed) !== -1;
    document.querySelectorAll('.vg-speed-overlay').forEach(function (overlay) {
      var buttons = overlay.querySelectorAll('.vg-speed-btn');
      buttons.forEach(function (btn) {
        var speed = parseFloat(btn.dataset.speed);
        btn.classList.toggle('vg-active', speed === desiredSpeed);
      });
      var input = overlay.querySelector('.vg-custom-input');
      if (input) {
        input.value = isPreset ? '' : desiredSpeed;
      }
    });
  }

  function createOverlay(video) {
    var wrapper = video.closest('.player_area, .player, [data-player], .video-player') || video.parentElement;
    if (!wrapper || wrapper.querySelector('.vg-speed-overlay')) return;

    // Ensure wrapper is positioned
    var wrapperStyle = getComputedStyle(wrapper);
    if (wrapperStyle.position === 'static') {
      wrapper.style.position = 'relative';
    }

    var overlay = document.createElement('div');
    overlay.className = 'vg-speed-overlay';

    var style = document.createElement('style');
    style.textContent = [
      '.vg-speed-overlay {',
      '  position: absolute;',
      '  top: 8px;',
      '  right: 8px;',
      '  z-index: 99999;',
      '  display: flex;',
      '  gap: 4px;',
      '  align-items: center;',
      '  background: rgba(0,0,0,0.7);',
      '  border-radius: 6px;',
      '  padding: 6px 10px;',
      '  opacity: 0;',
      '  transition: opacity 0.2s;',
      '  pointer-events: none;',
      '}',
      '.vg-speed-overlay.vg-visible {',
      '  opacity: 1;',
      '  pointer-events: auto;',
      '}',
      '.vg-speed-btn {',
      '  background: transparent;',
      '  color: #ccc;',
      '  border: none;',
      '  padding: 4px 7px;',
      '  font-size: 12px;',
      '  font-family: -apple-system, system-ui, sans-serif;',
      '  cursor: pointer;',
      '  border-radius: 4px;',
      '  line-height: 1;',
      '  font-weight: 500;',
      '}',
      '.vg-speed-btn:hover {',
      '  background: rgba(255,255,255,0.15);',
      '  color: #fff;',
      '}',
      '.vg-speed-btn.vg-active {',
      '  background: rgba(255,255,255,0.25);',
      '  color: #fff;',
      '  font-weight: 700;',
      '}',
      '.vg-speed-divider {',
      '  width: 1px;',
      '  background: rgba(255,255,255,0.2);',
      '  margin: 2px 3px;',
      '}',
      '.vg-custom-input {',
      '  width: 36px;',
      '  background: rgba(255,255,255,0.1);',
      '  color: #ccc;',
      '  border: 1px solid rgba(255,255,255,0.2);',
      '  padding: 3px 4px;',
      '  font-size: 11px;',
      '  font-family: -apple-system, system-ui, sans-serif;',
      '  border-radius: 4px;',
      '  text-align: center;',
      '  line-height: 1;',
      '  outline: none;',
      '}',
      '.vg-custom-input:focus {',
      '  border-color: rgba(255,255,255,0.5);',
      '  color: #fff;',
      '}',
      '.vg-custom-input::placeholder {',
      '  color: rgba(255,255,255,0.3);',
      '}',
      '.vg-custom-apply {',
      '  background: transparent;',
      '  color: #ccc;',
      '  border: none;',
      '  padding: 3px 2px 3px 0;',
      '  font-size: 13px;',
      '  cursor: pointer;',
      '  border-radius: 4px;',
      '  line-height: 1;',
      '}',
      '.vg-custom-apply:hover {',
      '  background: rgba(255,255,255,0.15);',
      '  color: #fff;',
      '}'
    ].join('\n');

    if (!document.querySelector('#vg-styles')) {
      style.id = 'vg-styles';
      document.head.appendChild(style);
    }

    PRESETS.forEach(function (speed) {
      var btn = document.createElement('button');
      btn.className = 'vg-speed-btn' + (speed === desiredSpeed ? ' vg-active' : '');
      btn.textContent = speed + 'x';
      btn.dataset.speed = speed;
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        desiredSpeed = speed;
        video.playbackRate = speed;
        // Save to storage
        if (typeof chrome !== 'undefined' && chrome.storage) {
          chrome.storage.sync.set({ defaultSpeed: speed });
        }
        updateAllOverlays();
      });
      overlay.appendChild(btn);
    });

    // Divider between presets and custom input
    var divider = document.createElement('div');
    divider.className = 'vg-speed-divider';
    overlay.appendChild(divider);

    // Custom speed input
    var customInput = document.createElement('input');
    customInput.type = 'text';
    customInput.className = 'vg-custom-input';
    customInput.placeholder = '...';
    customInput.inputMode = 'decimal';

    function applyCustomSpeed() {
      var raw = customInput.value.replace(',', '.');
      var val = parseFloat(raw);
      if (!isNaN(val) && val >= 0.5 && val <= 4) {
        desiredSpeed = val;
        video.playbackRate = val;
        if (typeof chrome !== 'undefined' && chrome.storage) {
          chrome.storage.sync.set({ defaultSpeed: val });
        }
        updateAllOverlays();
        // Show the applied value in the input (keep it visible)
        customInput.value = val % 1 === 0 ? val.toString() : val.toString();
        customInput.blur();
      }
    }

    customInput.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
    });
    customInput.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Enter') applyCustomSpeed();
    });
    overlay.appendChild(customInput);

    // Apply button (checkmark)
    var applyBtn = document.createElement('button');
    applyBtn.className = 'vg-custom-apply';
    applyBtn.textContent = '\u2713';
    applyBtn.title = 'Alkalmaz';
    applyBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      applyCustomSpeed();
    });
    overlay.appendChild(applyBtn);

    wrapper.appendChild(overlay);

    // Flash overlay briefly when video starts playing
    var hasFlashed = false;
    function flashOverlay() {
      if (hasFlashed) return;
      hasFlashed = true;
      overlay.classList.add('vg-visible');
      setTimeout(function () {
        if (!wrapper.matches(':hover')) {
          overlay.classList.remove('vg-visible');
        }
      }, 2000);
    }
    video.addEventListener('play', flashOverlay);
    // If video is already playing (overlay created after play started), flash now
    if (!video.paused) {
      flashOverlay();
    }

    // Show on hover over wrapper
    wrapper.addEventListener('mouseenter', function () {
      overlay.classList.add('vg-visible');
    });
    wrapper.addEventListener('mouseleave', function () {
      overlay.classList.remove('vg-visible');
    });
  }

  function initSpeedControl(video) {
    if (processedVideos.has(video)) return;
    processedVideos.add(video);

    video.playbackRate = desiredSpeed;

    video.addEventListener('loadedmetadata', function () {
      video.playbackRate = desiredSpeed;
    }, { once: true });

    // Re-apply on play (Vimeo resets speed on some state changes)
    video.addEventListener('play', function () {
      if (video.playbackRate !== desiredSpeed) {
        video.playbackRate = desiredSpeed;
      }
    });

    // Track user-initiated vs Vimeo-programmatic speed changes
    // User clicks Vimeo speed menu → ratechange fires with isTrusted context
    // Vimeo resets speed programmatically → we re-apply desiredSpeed
    var settingSpeed = false;
    var lastUserInteraction = 0;
    var initTime = Date.now();

    // Any click/touch on the page = potential user speed change via Vimeo menu
    document.addEventListener('click', function () {
      lastUserInteraction = Date.now();
    }, true);

    video.addEventListener('ratechange', function () {
      if (settingSpeed) return;
      if (video.playbackRate === desiredSpeed) return;

      // Ignore ratechange in the first 2s after init — Vimeo resets speed on load
      var timeSinceInit = Date.now() - initTime;
      if (timeSinceInit < 2000) {
        settingSpeed = true;
        video.playbackRate = desiredSpeed;
        settingSpeed = false;
        return;
      }

      // If ratechange happens within 500ms of a click, treat as user-initiated
      // But only if the click was AFTER init (not the navigation click)
      var timeSinceInteraction = Date.now() - lastUserInteraction;
      if (timeSinceInteraction < 500 && lastUserInteraction > initTime) {
        // User changed speed via Vimeo's own menu — accept it
        desiredSpeed = video.playbackRate;
        if (typeof chrome !== 'undefined' && chrome.storage) {
          chrome.storage.sync.set({ defaultSpeed: desiredSpeed });
        }
        updateAllOverlays();
        return;
      }

      // Vimeo programmatic reset — re-apply desired speed
      settingSpeed = true;
      video.playbackRate = desiredSpeed;
      settingSpeed = false;
    });

    // Create overlay after a short delay to ensure player DOM is ready
    setTimeout(function () { createOverlay(video); }, 500);
  }

})();
