(function () {
  "use strict";

  var cfg = window.VOTE_CONFIG;
  var MAX_PICKS = 3;
  var DEMO = !cfg.supabaseUrl || !cfg.supabaseAnonKey;
  var picks = []; // option ids, index 0 = first choice

  // ---- Cookie / storage helpers --------------------------------------------
  function getCookie(name) {
    var m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : null;
  }
  function setCookie(name, value) {
    var secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = name + "=" + encodeURIComponent(value) +
      "; Max-Age=31536000; Path=/; SameSite=Lax" + secure;
  }
  function store(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }
  function read(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  // A persistent anonymous ID, kept in both a cookie and localStorage so
  // clearing just one of them doesn't reset it.
  function getVoterToken() {
    var token = getCookie("voter_id") || read("voter_id");
    if (!token) token = uuid();
    setCookie("voter_id", token);
    store("voter_id", token);
    return token;
  }

  function hasVoted() {
    return getCookie("has_voted") === "1" || read("has_voted") === "1";
  }
  function markVoted() {
    setCookie("has_voted", "1");
    store("has_voted", "1");
    store("vote_picks", JSON.stringify(picks));
  }

  // ---- Already voted? Skip straight to the confirmation page ---------------
  if (hasVoted()) {
    location.replace("thanks.html?status=already");
    return;
  }

  // ---- Render --------------------------------------------------------------
  var $ = function (id) { return document.getElementById(id); };
  document.title = cfg.title;
  $("title").textContent = cfg.title;
  $("question").textContent = cfg.question;
  $("intro").textContent = cfg.intro;
  $("demo-banner").hidden = !DEMO;

  var optionsEl = $("options");
  var labels = {};
  cfg.options.forEach(function (opt) {
    labels[opt.id] = opt.label;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "option";
    btn.dataset.id = opt.id;
    btn.setAttribute("aria-pressed", "false");
    btn.innerHTML =
      '<span class="badge" aria-hidden="true"></span>' +
      '<span class="option-text"><strong></strong><span class="muted"></span></span>';
    btn.querySelector("strong").textContent = opt.label;
    btn.querySelector(".option-text .muted").textContent = opt.description || "";
    btn.addEventListener("click", function () { toggle(opt.id); });
    optionsEl.appendChild(btn);
  });

  function toggle(id) {
    var i = picks.indexOf(id);
    if (i >= 0) picks.splice(i, 1);
    else if (picks.length < MAX_PICKS) picks.push(id);
    else { showError("You've already picked 3. Tap one to remove it first."); return; }
    showError("");
    update();
  }

  function update() {
    optionsEl.querySelectorAll(".option").forEach(function (btn) {
      var rank = picks.indexOf(btn.dataset.id) + 1;
      btn.classList.toggle("selected", rank > 0);
      btn.classList.toggle("locked", rank === 0 && picks.length >= MAX_PICKS);
      btn.setAttribute("aria-pressed", rank > 0 ? "true" : "false");
      btn.querySelector(".badge").textContent = rank > 0 ? rank : "";
      btn.setAttribute("aria-label", btn.querySelector("strong").textContent +
        (rank > 0 ? ", ranked " + rank : ""));
    });
    document.querySelectorAll(".pick").forEach(function (slot, i) {
      var id = picks[i];
      slot.classList.toggle("filled", !!id);
      slot.querySelector(".pick-label").textContent =
        id ? labels[id] : ["First", "Second", "Third"][i] + " choice";
    });
    $("submit").disabled = picks.length !== MAX_PICKS;
  }

  function showError(msg) {
    $("error").textContent = msg;
    $("error").hidden = !msg;
  }

  $("reset").addEventListener("click", function () {
    picks = [];
    showError("");
    update();
  });

  // ---- Submit --------------------------------------------------------------
  $("vote-form").addEventListener("submit", function (e) {
    e.preventDefault();
    if (picks.length !== MAX_PICKS) return;

    var btn = $("submit");
    btn.disabled = true;
    btn.textContent = "Submitting…";
    showError("");

    submitVote()
      .then(function (res) {
        if (res.ok) {
          markVoted();
          location.href = "thanks.html";
        } else if (res.reason === "already_voted") {
          markVoted();
          location.href = "thanks.html?status=already";
        } else {
          throw new Error(res.reason || "unknown");
        }
      })
      .catch(function (err) {
        console.error(err);
        showError("Sorry, something went wrong submitting your vote. Please try again.");
        btn.disabled = false;
        btn.textContent = "Submit my vote";
      });
  });

  function submitVote() {
    if (DEMO) return Promise.resolve({ ok: true });

    var url = cfg.supabaseUrl.replace(/\/$/, "") + "/rest/v1/rpc/cast_vote";
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: cfg.supabaseAnonKey,
        Authorization: "Bearer " + cfg.supabaseAnonKey,
      },
      body: JSON.stringify({
        p_token: getVoterToken(),
        p_first: picks[0],
        p_second: picks[1],
        p_third: picks[2],
      }),
    }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  getVoterToken();
  update();
})();
