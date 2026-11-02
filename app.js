var allChannels = [];
var categories = [];
var filteredChannels = [];
var activeCat = "TODOS";
var player = null;

document.addEventListener("DOMContentLoaded", function () {
    player = document.getElementById("videoPlayer");
    var modal = document.getElementById("modal");
    var m3uInput = document.getElementById("m3u-url");
    var loadBtn = document.getElementById("btn-load");
    var changeBtn = document.getElementById("btn-change-url");
    var catSearch = document.getElementById("cat-search");
    var chanSearch = document.getElementById("chan-search");

    var savedUrl = localStorage.getItem("iptv_m3u_url");
    if (savedUrl) {
        m3uInput.value = savedUrl;
        modal.style.display = "none";
        fetchM3U(savedUrl);
    }

    loadBtn.addEventListener("click", function () {
        var url = m3uInput.value.trim();
        if (url) {
            localStorage.setItem("iptv_m3u_url", url);
            modal.style.display = "none";
            fetchM3U(url);
        }
    });

    changeBtn.addEventListener("click", function () {
        modal.style.display = "flex";
    });

    catSearch.addEventListener("input", function () {
        renderCategories(this.value.toLowerCase());
    });

    chanSearch.addEventListener("input", function () {
        renderChannels(this.value.toLowerCase());
    });
});

function fetchM3U(url) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && (xhr.status === 200 || xhr.status === 0)) {
            parseM3U(xhr.responseText);
        }
    };
    xhr.send();
}

function parseM3U(data) {
    allChannels = [];
    var catMap = { "TODOS": true };
    var lines = data.split("\n");
    var currentName = "", currentGroup = "GENERAL";

    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (line.indexOf("#EXTINF:") === 0) {
            var parts = line.split(",");
            currentName = parts[parts.length - 1].trim();
            var match = line.match(/group-title="([^"]+)"/);
            currentGroup = (match && match[1]) ? match[1].trim() : "GENERAL";
            catMap[currentGroup] = true;
        } else if (line.length > 0 && line.indexOf("#") !== 0) {
            allChannels.push({ name: currentName || ("Canal " + (allChannels.length + 1)), group: currentGroup, url: line });
            currentName = ""; currentGroup = "GENERAL";
        }
    }

    categories = Object.keys(catMap);
    renderCategories("");
    filterCategory("TODOS");
}

function renderCategories(filterText) {
    var ul = document.getElementById("cat-list");
    ul.innerHTML = "";
    for (var i = 0; i < categories.length; i++) {
        if (!filterText || categories[i].toLowerCase().indexOf(filterText) !== -1) {
            var li = document.createElement("li");
            li.innerText = categories[i];
            if (categories[i] === activeCat) li.className = "active";
            li.onclick = (function (cat) {
                return function () {
                    activeCat = cat;
                    renderCategories(document.getElementById("cat-search").value.toLowerCase());
                    filterCategory(cat);
                };
            })(categories[i]);
            ul.appendChild(li);
        }
    }
}

function filterCategory(catName) {
    activeCat = catName;
    filteredChannels = [];
    for (var i = 0; i < allChannels.length; i++) {
        if (catName === "TODOS" || allChannels[i].group === catName) {
            filteredChannels.push(allChannels[i]);
        }
    }
    renderChannels("");
}

function renderChannels(filterText) {
    var ul = document.getElementById("chan-list");
    ul.innerHTML = "";
    var fragment = document.createDocumentFragment();
    var count = 0;

    for (var i = 0; i < filteredChannels.length; i++) {
        var ch = filteredChannels[i];
        if (!filterText || ch.name.toLowerCase().indexOf(filterText) !== -1) {
            var li = document.createElement("li");
            li.innerText = (i + 1) + ". " + ch.name;
            li.onclick = (function (channel) {
                return function () {
                    playChannel(channel);
                };
            })(ch);
            fragment.appendChild(li);
            count++;
            if (count >= 100) break; // Limit visible items for smooth performance
        }
    }
    ul.appendChild(fragment);
}

function playChannel(ch) {
    document.getElementById("chan-title").innerText = ch.name;
    player.src = ch.url;
    player.play();
}