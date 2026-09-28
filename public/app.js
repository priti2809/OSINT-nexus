// Aegis OSINT Dashboard - Client Side Engine

document.addEventListener("DOMContentLoaded", () => {
    initTabNavigation();
    initUsernameLookup();
    initGeoIPLookup();
    initDNSRecon();
    initURLReputation();
    initMetadataExtractor();
});

// Global state variables
let usernameResultsCache = [];
let leafletMap = null;
let mapMarker = null;

// Base API URL helper to support running the HTML page directly as a file (file://)
function getApiUrl(endpoint) {
    if (window.location.protocol === 'file:') {
        return `http://127.0.0.1:8000${endpoint}`;
    }
    return endpoint;
}

// ----------------------------------------------------
// 1. Tab Navigation Controller
// ----------------------------------------------------
function initTabNavigation() {
    const navItems = document.querySelectorAll(".nav-item");
    const tabPanels = document.querySelectorAll(".tab-panel");

    navItems.forEach(item => {
        item.addEventListener("click", () => {
            const targetTabId = item.getAttribute("data-tab");
            
            // Switch navigation states
            navItems.forEach(nav => nav.classList.remove("active"));
            item.classList.add("active");
            
            // Switch displayed panels
            tabPanels.forEach(panel => {
                panel.classList.remove("active");
                if (panel.id === targetTabId) {
                    panel.classList.add("active");
                }
            });

            // Special trigger: resize leaflet map when entering geoip tab
            if (targetTabId === "tab-geoip" && leafletMap) {
                setTimeout(() => {
                    leafletMap.invalidateSize();
                }, 100);
            }
        });
    });
}

// ----------------------------------------------------
// 2. Reverse Username Lookup
// ----------------------------------------------------
function initUsernameLookup() {
    const searchBtn = document.getElementById("username-search-btn");
    const searchInput = document.getElementById("username-search-input");
    const progressContainer = document.getElementById("username-progress-container");
    const progressFill = document.getElementById("username-progress-fill");
    const progressText = document.getElementById("username-progress-text");
    const resultsGrid = document.getElementById("username-results-grid");
    const filterBtns = document.querySelectorAll(".filter-btn");

    searchBtn.addEventListener("click", performSearch);
    searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") performSearch();
    });

    filterBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            filterBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            applyUsernameFilter(btn.getAttribute("data-filter"));
        });
    });

    function performSearch() {
        const username = searchInput.value.trim();
        if (!username) return;

        // Reset UI state
        resultsGrid.innerHTML = "";
        progressContainer.style.display = "block";
        progressText.style.display = "block";
        progressFill.style.style = "0%";
        progressText.innerText = "Initialising scanning matrix...";
        searchBtn.disabled = true;

        // Smoothly animate the loading bar to represent requests in progress
        let simulatedProgress = 0;
        const progressInterval = setInterval(() => {
            if (simulatedProgress < 90) {
                simulatedProgress += Math.floor(Math.random() * 8) + 2;
                progressFill.style.width = `${Math.min(90, simulatedProgress)}%`;
                progressText.innerText = `Scanning platform structures... (${Math.min(90, simulatedProgress)}%)`;
            }
        }, 150);

        // Perform the API call to the Python backend
        fetch(getApiUrl(`/api/search_username?username=${encodeURIComponent(username)}`))
            .then(res => {
                if (!res.ok) throw new Error("Search command failed");
                return res.json();
            })
            .then(data => {
                clearInterval(progressInterval);
                progressFill.style.width = "100%";
                progressText.innerText = "Matrix scan completed successfully!";
                
                // Cache results globally for sorting & filtering
                usernameResultsCache = data.results;
                
                setTimeout(() => {
                    progressContainer.style.display = "none";
                    progressText.style.display = "none";
                    searchBtn.disabled = false;
                    renderUsernameResults(usernameResultsCache);
                }, 600);
            })
            .catch(err => {
                clearInterval(progressInterval);
                progressFill.style.width = "100%";
                progressText.innerText = "Error parsing network records.";
                searchBtn.disabled = false;
                resultsGrid.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; color: var(--danger); padding: 40px 0;">
                        Failed to connect to backend server scanner.
                    </div>
                `;
            });
    }
}

function renderUsernameResults(results) {
    const grid = document.getElementById("username-results-grid");
    grid.innerHTML = "";

    if (results.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px 0;">
                No profiles detected matching search criteria.
            </div>
        `;
        return;
    }

    results.forEach(res => {
        const card = document.createElement("a");
        card.href = res.url;
        card.target = "_blank";
        card.className = "profile-card";
        
        let statusBadgeClass = "status-notfound";
        let statusLabel = "Not Found";
        if (res.status === "Found") {
            statusBadgeClass = "status-found";
            statusLabel = "Target Found";
        } else if (res.status.startsWith("Restricted")) {
            statusBadgeClass = "status-restricted";
            statusLabel = "Blocked / Regulated";
        }

        card.innerHTML = `
            <div class="profile-card-top">
                <span class="profile-name">${res.platform}</span>
                <span class="profile-card-status ${statusBadgeClass}">${statusLabel}</span>
            </div>
            <span class="table-badge badge-${res.category.toLowerCase()}" style="align-self: flex-start; margin-bottom: 20px;">
                ${res.category}
            </span>
            ${res.status === "Found" || res.status.startsWith("Restricted") ? `
                <div class="profile-card-bottom">
                    <span>LAUNCH LINK</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </div>
            ` : `<div style="font-size: 0.85rem; color: var(--text-muted); font-weight:600;">UNAVAILABLE</div>`}
        `;
        grid.appendChild(card);
    });
}

function applyUsernameFilter(filter) {
    let filtered = [];

    if (filter === "all") {
        filtered = usernameResultsCache;
    } else if (filter === "found") {
        filtered = usernameResultsCache.filter(r => r.status === "Found" || r.status.startsWith("Restricted"));
    } else {
        filtered = usernameResultsCache.filter(r => r.category.toLowerCase() === filter);
    }

    renderUsernameResults(filtered);
}

// ----------------------------------------------------
// 3. IP Geolocation Lookup
// ----------------------------------------------------
function initGeoIPLookup() {
    const searchBtn = document.getElementById("ip-search-btn");
    const searchInput = document.getElementById("ip-search-input");

    searchBtn.addEventListener("click", performGeoIP);
    searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") performGeoIP();
    });

    // Populate with default client IP on load
    performGeoIP();

    function performGeoIP() {
        const ip = searchInput.value.trim();
        searchBtn.disabled = true;

        fetch(getApiUrl(`/api/geoip?ip=${encodeURIComponent(ip)}`))
            .then(res => {
                if (!res.ok) throw new Error("GeoIP request failed");
                return res.json();
            })
            .then(data => {
                searchBtn.disabled = false;
                if (data.status === "fail") {
                    alert(`Resolution Failed: ${data.message || "Unknown IP format"}`);
                    return;
                }

                // Render parameters
                document.getElementById("geo-query").innerText = data.query;
                document.getElementById("geo-country").innerText = `${data.country} (${data.countryCode})`;
                document.getElementById("geo-city").innerText = `${data.city}, ${data.regionName || ""}`;
                document.getElementById("geo-coords").innerText = `${data.lat}, ${data.lon}`;
                document.getElementById("geo-isp").innerText = data.isp || "-";
                document.getElementById("geo-org").innerText = data.org || data.as || "-";
                document.getElementById("geo-timezone").innerText = data.timezone || "-";

                // Initialize/Update Map
                renderLeafletMap(data.lat, data.lon, data.city);
            })
            .catch(err => {
                searchBtn.disabled = false;
                console.error(err);
            });
    }
}

function renderLeafletMap(lat, lon, cityName) {
    const mapDiv = document.getElementById("geo-map");
    
    // Clear inner HTML if initializing for the first time
    if (!leafletMap) {
        leafletMap = L.map(mapDiv, {
            zoomControl: false
        }).setView([lat, lon], 12);
        
        // Add zoom controls at custom position
        L.control.zoom({ position: 'topright' }).addTo(leafletMap);

        // Premium sleek CartoDB Dark Matter tiles
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(leafletMap);
    } else {
        leafletMap.setView([lat, lon], 12);
    }

    // Update marker placement
    if (mapMarker) {
        mapMarker.setLatLng([lat, lon]).setPopupContent(`Resolved Coordinates: ${cityName}`);
    } else {
        // High visibility custom pulse marker
        mapMarker = L.marker([lat, lon]).addTo(leafletMap)
            .bindPopup(`Resolved Coordinates: ${cityName}`)
            .openPopup();
    }
}

// ----------------------------------------------------
// 4. DNS & Domain Recon
// ----------------------------------------------------
function initDNSRecon() {
    const searchBtn = document.getElementById("dns-search-btn");
    const searchInput = document.getElementById("dns-search-input");
    const dnsIpOutput = document.getElementById("dns-ip-output");
    const headersTbody = document.getElementById("dns-headers-tbody");
    const scoreDial = document.getElementById("security-score-dial");
    const scoreLabel = document.getElementById("security-score-label");
    const checklist = document.getElementById("security-checklist");

    searchBtn.addEventListener("click", performDNSRecon);
    searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") performDNSRecon();
    });

    function performDNSRecon() {
        const domain = searchInput.value.trim();
        if (!domain) return;
        searchBtn.disabled = true;

        fetch(getApiUrl(`/api/domain_info?domain=${encodeURIComponent(domain)}`))
            .then(res => res.json())
            .then(data => {
                searchBtn.disabled = false;
                if (data.error) {
                    dnsIpOutput.innerText = "Error: Resolving DNS details";
                    return;
                }

                // Render Resolved IP
                dnsIpOutput.innerText = `A Record IP: ${data.ip}`;

                // Render HTTP Response Headers
                headersTbody.innerHTML = "";
                if (data.headers.length === 0) {
                    headersTbody.innerHTML = `<tr><td colspan="2" style="text-align: center; color: var(--text-muted);">Headers could not be resolved.</td></tr>`;
                } else {
                    data.headers.forEach(h => {
                        const tr = document.createElement("tr");
                        tr.innerHTML = `
                            <td style="font-family: var(--font-mono); color: var(--secondary); font-weight:600;">${h.header}</td>
                            <td style="font-family: var(--font-mono); font-size:0.8rem; word-break:break-all;">${h.value}</td>
                        `;
                        headersTbody.appendChild(tr);
                    });
                }

                // Render Security Score
                const score = data.security.score;
                scoreDial.innerText = `${score}%`;
                
                // Style the Score dial based on marks
                scoreDial.className = "score-dial"; // reset
                if (score >= 80) {
                    scoreDial.classList.add("score-excellent");
                    scoreLabel.innerText = "EXCELLENT SHIELD";
                } else if (score >= 50) {
                    scoreDial.classList.add("score-medium");
                    scoreLabel.innerText = "VULNERABLE / POOR CONFIG";
                } else {
                    scoreDial.classList.add("score-low");
                    scoreLabel.innerText = "CRITICAL / RISK DETECTED";
                }

                // Render Security checklist details
                checklist.innerHTML = "";
                data.security.details.forEach(item => {
                    const li = document.createElement("li");
                    if (item.includes("+")) {
                        li.className = "list-success-item";
                        li.innerHTML = `<span style="font-size: 1.15rem;">✓</span> <span>${item}</span>`;
                    } else {
                        li.className = "list-danger-item";
                        li.innerHTML = `<span style="font-size: 1.15rem;">✗</span> <span>${item}</span>`;
                    }
                    checklist.appendChild(li);
                });
            })
            .catch(err => {
                searchBtn.disabled = false;
                console.error(err);
            });
    }
}

// ----------------------------------------------------
// 5. URL Reputation & Redirect Tracer
// ----------------------------------------------------
function initURLReputation() {
    const searchBtn = document.getElementById("url-search-btn");
    const searchInput = document.getElementById("url-search-input");
    const pathDiv = document.getElementById("url-redirect-path");
    const scoreDial = document.getElementById("url-safety-dial");
    const scoreLabel = document.getElementById("url-safety-label");
    const threatList = document.getElementById("url-threat-list");

    searchBtn.addEventListener("click", performURLReputation);
    searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") performURLReputation();
    });

    function performURLReputation() {
        const url = searchInput.value.trim();
        if (!url) return;
        searchBtn.disabled = true;

        fetch(getApiUrl(`/api/url_reputation?url=${encodeURIComponent(url)}`))
            .then(res => res.json())
            .then(data => {
                searchBtn.disabled = false;
                if (data.error) {
                    pathDiv.innerHTML = `<span style="color: var(--danger);">Error: Link target blocked connections.</span>`;
                    return;
                }

                // Render hops list
                pathDiv.innerHTML = "";
                
                // Add initial URL hop
                const initSpan = document.createElement("div");
                initSpan.style.padding = "10px";
                initSpan.style.background = "rgba(255,255,255,0.02)";
                initSpan.style.borderRadius = "6px";
                initSpan.innerHTML = `<strong style="color: var(--secondary);">[ENTRY NODE]</strong> ${data.initial_url}`;
                pathDiv.appendChild(initSpan);

                // Add redirect intermediate hops
                data.redirect_hops.forEach((hop, idx) => {
                    const arrow = document.createElement("div");
                    arrow.style.textAlign = "center";
                    arrow.style.color = "var(--primary)";
                    arrow.innerHTML = "▼ Redirects with status code " + hop.code;
                    pathDiv.appendChild(arrow);

                    const hopSpan = document.createElement("div");
                    hopSpan.style.padding = "10px";
                    hopSpan.style.background = "rgba(168,85,247,0.05)";
                    hopSpan.style.borderLeft = "2px solid var(--primary)";
                    hopSpan.style.borderRadius = "6px";
                    hopSpan.innerHTML = `<strong>[HOP ${idx + 1}]</strong> ${hop.redirect_to}`;
                    pathDiv.appendChild(hopSpan);
                });

                if (data.redirect_hops.length > 0) {
                    const arrowEnd = document.createElement("div");
                    arrowEnd.style.textAlign = "center";
                    arrowEnd.style.color = "var(--success)";
                    arrowEnd.innerHTML = "▼ Resolves to";
                    pathDiv.appendChild(arrowEnd);
                }

                // Add final resolved destination
                const finalSpan = document.createElement("div");
                finalSpan.style.padding = "10px";
                finalSpan.style.background = "rgba(16,185,129,0.05)";
                finalSpan.style.borderRadius = "6px";
                finalSpan.style.borderLeft = "2px solid var(--success)";
                finalSpan.innerHTML = `<strong style="color: var(--success);">[FINAL ENDPOINT]</strong> ${data.final_url}`;
                pathDiv.appendChild(finalSpan);

                // Render Safety Score dial
                const score = data.safety.score;
                scoreDial.innerText = `${score}%`;
                scoreDial.className = "score-dial"; // reset
                scoreLabel.innerText = data.safety.status.toUpperCase();

                if (score >= 80) {
                    scoreDial.classList.add("score-excellent");
                } else if (score >= 50) {
                    scoreDial.classList.add("score-medium");
                } else {
                    scoreDial.classList.add("score-low");
                }

                // Render threat descriptors
                threatList.innerHTML = "";
                data.safety.flags.forEach(flag => {
                    const li = document.createElement("li");
                    if (flag.includes("No risk")) {
                        li.className = "list-success-item";
                        li.innerHTML = `<span style="font-size: 1.15rem;">✓</span> <span>${flag}</span>`;
                    } else {
                        li.className = "list-danger-item";
                        li.innerHTML = `<span style="font-size: 1.15rem;">⚠</span> <span>${flag}</span>`;
                    }
                    threatList.appendChild(li);
                });
            })
            .catch(err => {
                searchBtn.disabled = false;
                console.error(err);
            });
    }
}

// ----------------------------------------------------
// 6. Local File Metadata Extractor
// ----------------------------------------------------
function initMetadataExtractor() {
    const dropzone = document.getElementById("meta-dropzone");
    const fileInput = document.getElementById("meta-file-input");
    const resultPanel = document.getElementById("meta-result-panel");
    const resultsGrid = document.getElementById("meta-results-grid");

    // Open file explorer on click
    dropzone.addEventListener("click", () => fileInput.click());

    // Highlight area when dragging files over
    ["dragenter", "dragover"].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropzone.style.borderColor = "var(--secondary)";
            dropzone.style.background = "rgba(6, 182, 212, 0.05)";
        }, false);
    });

    ["dragleave", "drop"].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropzone.style.borderColor = "rgba(168, 85, 247, 0.35)";
            dropzone.style.background = "rgba(16, 12, 30, 0.4)";
        }, false);
    });

    // Handle dropped files
    dropzone.addEventListener("drop", (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            handleUploadedFile(files[0]);
        }
    });

    // Handle selected files
    fileInput.addEventListener("change", (e) => {
        const files = e.target.files;
        if (files.length > 0) {
            handleUploadedFile(files[0]);
        }
    });

    function handleUploadedFile(file) {
        // Stream raw bytes directly to Python server API
        const reader = new FileReader();
        reader.onload = function(e) {
            const rawBytes = e.target.result;
            
            fetch(getApiUrl("/api/extract_metadata"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/octet-stream",
                    "X-Filename": file.name
                },
                body: rawBytes
            })
            .then(res => res.json())
            .then(metadata => {
                renderMetadata(metadata);
            })
            .catch(err => {
                console.error("Failed to parse metadata", err);
                alert("Failed to analyze file metadata.");
            });
        };
        reader.readAsArrayBuffer(file);
    }

    function renderMetadata(metadata) {
        resultsGrid.innerHTML = "";
        resultPanel.classList.add("active");
        
        // Loop key values and create display cards
        for (const [key, value] of Object.entries(metadata)) {
            const metaItem = document.createElement("div");
            metaItem.className = "meta-item";
            
            if (key === "Map Link") {
                metaItem.innerHTML = `
                    <div class="meta-label">${key}</div>
                    <div class="meta-val">
                        <a href="${value}" target="_blank" style="color: var(--secondary); font-weight: 700; text-decoration: none; border-bottom: 1px dashed var(--secondary); padding-bottom: 2px;">
                            View GPS Coordinates on Map ➔
                        </a>
                    </div>
                `;
            } else {
                metaItem.innerHTML = `
                    <div class="meta-label">${key}</div>
                    <div class="meta-val">${value}</div>
                `;
            }
            resultsGrid.appendChild(metaItem);
        }
    }
}
