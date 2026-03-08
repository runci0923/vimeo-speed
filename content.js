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
      '  position: absolute !important;',
      '  top: 8px !important;',
      '  right: 8px !important;',
      '  z-index: 99999 !important;',
      '  display: flex !important;',
      '  gap: 4px !important;',
      '  align-items: center !important;',
      '  background: rgba(20, 16, 36, 0.85) !important;',
      '  border: 1px solid rgba(255,255,255,0.08) !important;',
      '  border-radius: 100px !important;',
      '  padding: 4px !important;',
      '  opacity: 0;',
      '  transition: opacity 0.2s;',
      '  pointer-events: none;',
      '  font-family: ui-monospace, "SF Mono", Menlo, monospace !important;',
      '}',
      '.vg-speed-overlay.vg-visible {',
      '  opacity: 1 !important;',
      '  pointer-events: auto !important;',
      '}',
      '.vg-speed-btn {',
      '  background: transparent !important;',
      '  color: rgba(255,255,255,0.55) !important;',
      '  border: none !important;',
      '  padding: 5px 12px !important;',
      '  font-size: 12px !important;',
      '  font-family: ui-monospace, "SF Mono", Menlo, monospace !important;',
      '  cursor: pointer !important;',
      '  border-radius: 100px !important;',
      '  line-height: 1 !important;',
      '  font-weight: 400 !important;',
      '  transition: color 0.15s, background 0.15s;',
      '  margin: 0 !important;',
      '  min-width: 0 !important;',
      '  box-sizing: border-box !important;',
      '}',
      '.vg-speed-btn:hover {',
      '  color: rgba(255,255,255,0.85) !important;',
      '}',
      '.vg-speed-btn.vg-active {',
      '  background: #e04640 !important;',
      '  color: #fff !important;',
      '  font-weight: 500 !important;',
      '}',
      '.vg-speed-divider {',
      '  width: 1px;',
      '  height: 14px;',
      '  background: rgba(255,255,255,0.12);',
      '  margin: 0 2px;',
      '}',
      '.vg-custom-input {',
      '  width: 38px;',
      '  background: rgba(255,255,255,0.06);',
      '  color: rgba(255,255,255,0.55);',
      '  border: 1px solid rgba(255,255,255,0.1);',
      '  padding: 5px 4px;',
      '  font-size: 11px;',
      '  font-family: ui-monospace, "SF Mono", Menlo, monospace;',
      '  border-radius: 100px;',
      '  text-align: center;',
      '  line-height: 1;',
      '  outline: none;',
      '  transition: border-color 0.15s, color 0.15s;',
      '}',
      '.vg-custom-input:focus {',
      '  border-color: rgba(255,255,255,0.3);',
      '  color: #fff;',
      '}',
      '.vg-custom-input::placeholder {',
      '  color: rgba(255,255,255,0.2);',
      '}',
      '.vg-custom-apply {',
      '  background: transparent;',
      '  color: rgba(255,255,255,0.55);',
      '  border: none;',
      '  padding: 5px 6px;',
      '  font-size: 12px;',
      '  font-family: ui-monospace, "SF Mono", Menlo, monospace;',
      '  cursor: pointer;',
      '  border-radius: 100px;',
      '  line-height: 1;',
      '  transition: color 0.15s;',
      '}',
      '.vg-custom-apply:hover {',
      '  color: #fff;',
      '}'
    ].join('\n');

    var existingStyle = document.querySelector('#vg-styles');
    if (existingStyle) existingStyle.remove();
    style.id = 'vg-styles';
    document.head.appendChild(style);

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
