var allChannels = [];
var categories = {};
var activeCategory = "TODOS";
var hlsPlayer = null;

const CORS_PROXIES = [
    "",
    "https://api.allorigins.win/raw?url=",
    "https://corsproxy.io/?"
];

document.addEventListener("DOMContentLoaded", function () {
    var modal = document.getElementById("modal");
    var m3uInput = document.getElementById("m3u-url");
    var loadBtn = document.getElementById("btn-load");
    var changeBtn = document.getElementById("btn-change-m3u");
    var searchInput = document.getElementById("global-search");
    var menuBtn = document.getElementById("btn-menu");
    var sidebar = document.getElementById("sidebar");
    var closeVideoBtn = document.getElementById("btn-close-video");

    var savedUrl = localStorage.getItem("iptv_m3u_url");
    if (savedUrl) {
        m3uInput.value = savedUrl;
        modal.style.display = "none";
        fetchM3UWithProxy(savedUrl, 0);
    }

    loadBtn.addEventListener("click", function () {
        var url = m3uInput.value.trim();
        if (url) {
            localStorage.setItem("iptv_m3u_url", url);
            modal.style.display = "none";
            fetchM3UWithProxy(url, 0);
        }
    });

    changeBtn.addEventListener("click", function () {
        modal.style.display = "flex";
    });

    searchInput.addEventListener("input", function () {
        renderGrid(this.value.toLowerCase());
    });

    menuBtn.addEventListener("click", function () {
        sidebar.classList.toggle("open");
    });

    closeVideoBtn.addEventListener("click", function () {
        var videoContainer = document.getElementById("video-container");
        var player = document.getElementById("videoPlayer");
        videoContainer.style.display = "none";
        player.pause();
        if (hlsPlayer) {
            hlsPlayer.destroy();
            hlsPlayer = null;
        }
    });
});

function fetchM3UWithProxy(url, proxyIndex) {
    if (proxyIndex >= CORS_PROXIES.length) {
        alert("Error: No se pudo obtener la lista IPTV. Verifica que la URL esté activa.");
        return;
    }

    var targetUrl = CORS_PROXIES[proxyIndex] ? CORS_PROXIES[proxyIndex] + encodeURIComponent(url) : url;
    
    fetch(targetUrl)
        .then(response => {
            if (!response.ok) throw new Error("HTTP error " + response.status);
            return response.text();
        })
        .then(data => {
            parseM3U(data);
        })
        .catch(err => {
            console.warn("Proxy index " + proxyIndex + " falló. Intentando el siguiente...", err);
            fetchM3UWithProxy(url, proxyIndex + 1);
        });
}

function parseM3U(data) {
    allChannels = [];
    categories = { "TODOS": [] };

    var lines = data.split("\n");
    var currentChannel = {};

    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (line.indexOf("#EXTINF:") === 0) {
            var nameMatch = line.match(/,(.+)$/);
            var logoMatch = line.match(/tvg-logo="([^"]+)"/);
            var groupMatch = line.match(/group-title="([^"]+)"/);

            currentChannel = {
                name: nameMatch ? nameMatch[1].trim() : "Canal Sin Nombre",
                logo: logoMatch ? logoMatch[1] : "",
                group: groupMatch ? groupMatch[1].trim() : "GENERAL"
            };
        } else if (line.length > 0 && line.indexOf("#") !== 0) {
            currentChannel.url = line;
            allChannels.push(currentChannel);

            if (!categories[currentChannel.group]) {
                categories[currentChannel.group] = [];
            }
            categories[currentChannel.group].push(currentChannel);
            categories["TODOS"].push(currentChannel);

            currentChannel = {};
        }
    }

    renderFolders();
    selectCategory("TODOS");
}

function renderFolders() {
    var folderList = document.getElementById("folder-list");
    folderList.innerHTML = "";

    var groups = Object.keys(categories);
    groups.forEach(function (group) {
        var li = document.createElement("li");
        li.className = "folder-item" + (group === activeCategory ? " active" : "");
        li.innerHTML = '<i class="fa-solid fa-folder"></i> <span>' + group + '</span>';
        li.onclick = function () {
            selectCategory(group);
            document.getElementById("sidebar").classList.remove("open");
        };
        folderList.appendChild(li);
    });
}

function selectCategory(catName) {
    activeCategory = catName;
    renderFolders();
    renderGrid("");
}

function renderGrid(searchTerm) {
    var container = document.getElementById("grid-container");
    container.innerHTML = "";

    var channelList = categories[activeCategory] || [];
    var fragment = document.createDocumentFragment();

    var count = 0;
    for (var i = 0; i < channelList.length; i++) {
        var ch = channelList[i];
        if (!searchTerm || ch.name.toLowerCase().indexOf(searchTerm) !== -1) {
            var card = document.createElement("div");
            card.className = "channel-card";
            
            var defaultLogo = 'https://via.placeholder.com/300x169/151824/00d2ff?text=' + encodeURIComponent(ch.name);
            var logoUrl = ch.logo ? ch.logo : defaultLogo;

            card.innerHTML = `
                <div class="poster-wrapper">
                    <img class="poster-img" src="${logoUrl}" onerror="this.src='${defaultLogo}'" alt="${ch.name}">
                </div>
                <div class="channel-info">
                    <div class="channel-name">${ch.name}</div>
                </div>
            `;

            card.onclick = (function (channel) {
                return function () {
                    playChannel(channel);
                };
            })(ch);

            fragment.appendChild(card);
            count++;
            if (count >= 200) break;
        }
    }

    container.appendChild(fragment);
}

function playChannel(ch) {
    var videoContainer = document.getElementById("video-container");
    var player = document.getElementById("videoPlayer");
    var title = document.getElementById("current-channel");

    videoContainer.style.display = "block";
    title.innerText = ch.name;

    if (Hls.isSupported() && ch.url.includes(".m3u8")) {
        if (hlsPlayer) hlsPlayer.destroy();
        hlsPlayer = new Hls({
            xhrSetup: function (xhr, url) {
                // Cross-origin fallback tuning
            }
        });
        hlsPlayer.loadSource(ch.url);
        hlsPlayer.attachMedia(player);
        hlsPlayer.on(Hls.Events.MANIFEST_PARSED, function () {
            player.play();
        });
    } else {
        player.src = ch.url;
        player.play();
    }
}
