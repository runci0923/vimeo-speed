(function () {
  'use strict';

  var PRESETS = [1, 1.25, 1.5, 1.75, 2];
  var DEFAULT_SPEED = 1.5;

  var presetsEl = document.getElementById('presets');
  var customInput = document.getElementById('customSpeed');
  var applyBtn = document.getElementById('applyCustom');
  var statusEl = document.getElementById('status');

  function renderPresets(activeSpeed) {
    presetsEl.innerHTML = '';
    PRESETS.forEach(function (speed) {
      var btn = document.createElement('button');
      btn.className = 'speed-btn' + (speed === activeSpeed ? ' active' : '');
      btn.textContent = speed + 'x';
      btn.addEventListener('click', function () {
        setSpeed(speed);
      });
      presetsEl.appendChild(btn);
    });
  }

  function setSpeed(speed) {
    speed = Math.max(0.5, Math.min(4, speed));
    chrome.storage.sync.set({ defaultSpeed: speed }, function () {
      renderPresets(speed);
      customInput.value = '';
      statusEl.textContent = speed + 'x beallitva';
      updateBadge(speed);
      setTimeout(function () { statusEl.textContent = ''; }, 1500);
    });
  }

  function updateBadge(speed) {
    var text = speed === 1 ? '' : speed + 'x';
    chrome.action.setBadgeText({ text: text });
    chrome.action.setBadgeBackgroundColor({ color: '#4a6cf7' });
  }

  // Apply custom speed
  applyBtn.addEventListener('click', function () {
    var val = parseFloat(customInput.value);
    if (!isNaN(val) && val >= 0.5 && val <= 4) {
      setSpeed(val);
    }
  });

  customInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      applyBtn.click();
    }
  });

  // Load current speed
  chrome.storage.sync.get({ defaultSpeed: DEFAULT_SPEED }, function (data) {
    renderPresets(data.defaultSpeed);
    updateBadge(data.defaultSpeed);
  });
})();
