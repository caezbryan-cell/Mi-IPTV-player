var allChannels = [];
var categories = {};
var activeCategory = "TODOS";
var hlsPlayer = null;

// Lista de servidores Proxy CORS oficiales y de alta disponibilidad para evitar bloqueos en servidores privados
const CORS_PROXIES = [
    "", // Intento directo
    "https://api.allorigins.win/raw?url=",
    "https://corsproxy.io/?",
    "https://proxy.cors.sh/"
];

document.addEventListener("DOMContentLoaded", function () {
    var modal = document.getElementById("modal");
    var changeBtn = document.getElementById("btn-change-m3u");
    var searchInput = document.getElementById("global-search");
    var menuBtn = document.getElementById("btn-menu");
    var sidebar = document.getElementById("sidebar");
    var closeVideoBtn = document.getElementById("btn-close-video");

    var btnLoadXtream = document.getElementById("btn-load-xtream");
    var btnLoadUrl = document.getElementById("btn-load-url");
    var fileInput = document.getElementById("m3u-file-input");
    var fileUploadTrigger = document.getElementById("file-upload-trigger");

    var tabXtream = document.getElementById("btn-tab-xtream");
    var tabUrl = document.getElementById("btn-tab-url");
    var tabFile = document.getElementById("btn-tab-file");

    if (tabXtream) tabXtream.addEventListener("click", function() { switchTab('xtream-tab', this); });
    if (tabUrl) tabUrl.addEventListener("click", function() { switchTab('url-tab', this); });
    if (tabFile) tabFile.addEventListener("click", function() { switchTab('file-tab', this); });

    if (fileUploadTrigger) {
        fileUploadTrigger.addEventListener("click", function() {
            fileInput.click();
        });
    }

    // Comprobar credenciales guardadas de Xtream Codes
    var savedXcUrl = localStorage.getItem("iptv_xc_url");
    var savedXcUser = localStorage.getItem("iptv_xc_user");
    var savedXcPass = localStorage.getItem("iptv_xc_pass");
    var savedUrl = localStorage.getItem("iptv_m3u_url");

    if (savedXcUrl && savedXcUser && savedXcPass) {
        modal.style.display = "none";
        loadXtreamWithProxies(savedXcUrl, savedXcUser, savedXcPass, 0);
    } else if (savedUrl) {
        modal.style.display = "none";
        loadM3UWithProxies(savedUrl, 0);
    }

    if (btnLoadXtream) {
        btnLoadXtream.addEventListener("click", function () {
            var server = document.getElementById("xc-url").value.trim();
            var user = document.getElementById("xc-user").value.trim();
            var pass = document.getElementById("xc-pass").value.trim();

            if (server && user && pass) {
                localStorage.setItem("iptv_xc_url", server);
                localStorage.setItem("iptv_xc_user", user);
                localStorage.setItem("iptv_xc_pass", pass);
                localStorage.removeItem("iptv_m3u_url");

                modal.style.display = "none";
                loadXtreamWithProxies(server, user, pass, 0);
            } else {
                alert("Por favor completa los campos de Servidor, Usuario y Contraseña.");
            }
        });
    }

    if (btnLoadUrl) {
        btnLoadUrl.addEventListener("click", function () {
            var url = document.getElementById("m3u-url").value.trim();
            if (url) {
                localStorage.setItem("iptv_m3u_url", url);
                localStorage.removeItem("iptv_xc_url");
                modal.style.display = "none";
                loadM3UWithProxies(url, 0);
            }
        });
    }

    if (fileInput) {
        fileInput.addEventListener("change", function (e) {
            var file = e.target.files[0];
            if (file) {
                var reader = new FileReader();
                reader.onload = function (evt) {
                    modal.style.display = "none";
                    parseM3U(evt.target.result);
                };
                reader.readAsText(file);
            }
        });
    }

    if (changeBtn) {
        changeBtn.addEventListener("click", function () {
            modal.style.display = "flex";
        });
    }

    if (searchInput) {
        searchInput.addEventListener("input", function () {
            renderGrid(this.value.toLowerCase());
        });
    }

    if (menuBtn) {
        menuBtn.addEventListener("click", function () {
            sidebar.classList.toggle("open");
        });
    }

    if (closeVideoBtn) {
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
    }
});

function switchTab(tabId, btnElement) {
    var buttons = document.querySelectorAll('.tab-btn');
    var contents = document.querySelectorAll('.tab-content');
    
    for (var i = 0; i < buttons.length; i++) buttons[i].classList.remove('active');
    for (var j = 0; j < contents.length; j++) contents[j].classList.remove('active');
    
    btnElement.classList.add('active');
    document.getElementById(tabId).classList.add('active');
}

function loadXtreamWithProxies(server, user, pass, proxyIndex) {
    var cleanServer = server.replace(/\/$/, "");
    if (!cleanServer.startsWith("http://") && !cleanServer.startsWith("https://")) {
        cleanServer = "http://" + cleanServer;
    }
    // Soporte para formato M3U Plus de Xtream Codes
    var targetUrl = cleanServer + "/get.php?username=" + user + "&password=" + pass + "&type=m3u_plus&output=ts";
    loadM3UWithProxies(targetUrl, proxyIndex);
}

function loadM3UWithProxies(url, proxyIndex) {
    if (proxyIndex >= CORS_PROXIES.length) {
        alert("Error: No se pudo conectar con el servidor privado. Verifica que la URL, usuario y contraseña sean correctos o prueba usando la pestaña 'Archivo Local (.m3u)'.");
        document.getElementById("modal").style.display = "flex";
        return;
    }

    var prefix = CORS_PROXIES[proxyIndex];
    var fetchUrl = prefix ? prefix + encodeURIComponent(url) : url;

    fetch(fetchUrl)
        .then(function (response) {
            if (!response.ok) throw new Error("HTTP error " + response.status);
            return response.text();
        })
        .then(function (data) {
            if (!data || (data.indexOf("#EXTINF") === -1 && data.indexOf("#EXTM3U") === -1)) {
                throw new Error("La respuesta no es una lista M3U válida");
            }
            parseM3U(data);
        })
        .catch(function (err) {
            console.warn("Proxy index " + proxyIndex + " falló. Probando siguiente método...", err);
            loadM3UWithProxies(url, proxyIndex + 1);
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
    if (!folderList) return;
    folderList.innerHTML = "";

    var groups = Object.keys(categories);
    groups.forEach(function (group) {
        var li = document.createElement("li");
        li.className = "folder-item" + (group === activeCategory ? " active" : "");
        li.innerHTML = '<i class="fa-solid fa-folder"></i> <span>' + group + '</span>';
        li.onclick = function () {
            selectCategory(group);
            var sidebar = document.getElementById("sidebar");
            if (sidebar) sidebar.classList.remove("open");
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
    if (!container) return;
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
            var logoUrl = (ch.logo && ch.logo.startsWith("http")) ? ch.logo : defaultLogo;

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

    if (videoContainer) videoContainer.style.display = "block";
    if (title) title.innerText = ch.name;

    if (Hls.isSupported() && ch.url.includes(".m3u8")) {
        if (hlsPlayer) hlsPlayer.destroy();
        hlsPlayer = new Hls();
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
