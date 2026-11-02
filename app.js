var allChannels = [];
var categories = {};
var activeCategory = "TODOS";
var hlsPlayer = null;

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

    // Verificar si hay datos Xtream guardados
    var savedXcUrl = localStorage.getItem("iptv_xc_url");
    var savedXcUser = localStorage.getItem("iptv_xc_user");
    var savedXcPass = localStorage.getItem("iptv_xc_pass");

    // Verificar si hay URL guardada
    var savedUrl = localStorage.getItem("iptv_m3u_url");

    if (savedXcUrl && savedXcUser && savedXcPass) {
        modal.style.display = "none";
        loadXtream(savedXcUrl, savedXcUser, savedXcPass);
    } else if (savedUrl) {
        modal.style.display = "none";
        loadM3U(savedUrl);
    }

    // Cargar Xtream Codes
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
            loadXtream(server, user, pass);
        } else {
            alert("Por favor completa los campos de Servidor, Usuario y Contraseña.");
        }
    });

    // Cargar URL M3U
    btnLoadUrl.addEventListener("click", function () {
        var url = document.getElementById("m3u-url").value.trim();
        if (url) {
            localStorage.setItem("iptv_m3u_url", url);
            localStorage.removeItem("iptv_xc_url");
            modal.style.display = "none";
            loadM3U(url);
        }
    });

    // Cargar Archivo Local .m3u
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

// Función para armar la URL Xtream Codes y solicitar la lista
function loadXtream(server, user, pass) {
    var cleanServer = server.replace(/\/$/, "");
    if (!cleanServer.startsWith("http://") && !cleanServer.startsWith("https://")) {
        cleanServer = "http://" + cleanServer;
    }
    // Generar la URL completa M3U Plus para servidores Xtream
    var generatedUrl = cleanServer + "/get.php?username=" + user + "&password=" + pass + "&type=m3u_plus&output=ts";
    loadM3U(generatedUrl);
}

// Función de carga con compatibilidad directa y respaldo por proxy si es necesario
function loadM3U(url) {
    fetch(url)
        .then(function (response) {
            if (!response.ok) throw new Error("Error HTTP directo");
            return response.text();
        })
        .then(function (data) {
            if (!data || data.indexOf("#EXTINF") === -1) {
                throw new Error("Formato M3U no válido");
            }
            parseM3U(data);
        })
        .catch(function (err) {
            console.warn("Intentando vía Proxy de respaldo...", err);
            var proxyUrl = "https://api.allorigins.win/raw?url=" + encodeURIComponent(url);
            fetch(proxyUrl)
                .then(function (res) {
                    if (!res.ok) throw new Error("Error en Proxy");
                    return res.text();
                })
                .then(function (proxyData) {
                    if (!proxyData || proxyData.indexOf("#EXTINF") === -1) {
                        throw new Error("Proxy devolvió datos no válidos");
                    }
                    parseM3U(proxyData);
                })
                .catch(function (finalErr) {
                    console.error("Carga de lista fallida:", finalErr);
                    alert("No se pudo cargar la lista por red debido a bloqueos de seguridad. Puedes probar usando la pestaña 'Archivo Local (.m3u)' descargando tu lista previamente.");
                });
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
