            const DATA_URL = "https://raw.githubusercontent.com/majacanavan/handwriting/main/names.txt";
            const IMAGE_BASE = "https://majacanavan.github.io/handwriting/images/";
            const CACHE_KEY = "botanical-signatures-names-v1";
            const PAGE_SIZE = 50;
            let data = [];
            let activeLetter = "";
            let query = "";
            let visibleCount = PAGE_SIZE;

            function norm(s) {
            	return (s || "")
            		.normalize("NFD")
            		.replace(/[\u0300-\u036f]/g, "")
            		.toLowerCase()
            		.trim();
            }

            function wildcardRegex(pattern) {
            	const escaped = norm(pattern).replace(/[.+^${}()|[\]\\]/g, "\\$&");
            	try {
            		return new RegExp(escaped.replace(/\*/g, ".*").replace(/\?/g, "."), "i");
            	} catch (e) {
            		return null;
            	}
            }

            function matchesSearch(row) {
            	if (!query) return true;
            	const re = wildcardRegex(query);
            	return !!re && (re.test(norm(row.name)) || re.test(norm(row.other)));
            }

            function parseNamesTxt(text) {
            	return text
            		.replace(/^\uFEFF/, "")
            		.split(/\r?\n/)
            		.filter((x) => x.trim())
            		.map((line) => {
            			const p = line.split("\t");
            			return {
            				name: (p[0] || "").trim(),
            				other: (p[1] || "").trim(),
            				dates: (p[2] || "").trim(),
            				source: (p[4] || "").trim(),
            				sourceUrl: (p[5] || "").trim(),
            			};
            		})
            		.filter((r) => r.name)
            		.sort(
            			(a, b) =>
            			a.name.localeCompare(b.name, undefined, {
            				sensitivity: "base",
            				numeric: true
            			}) ||
            			a.source.localeCompare(b.source, undefined, {
            				sensitivity: "base"
            			})
            		);
            }

            function imageName(name) {
            	return (
            		name
            		.replace(/^\uFEFF/, "")
            		.replace(/['’]/g, "")
            		.replace(/&/g, "and")
            		.replace(/[,:;()[\]{}]/g, "")
            		.replace(/\s+/g, "-")
            		.replace(/[\/\\?%#"]/g, "")
            		.replace(/-+/g, "-")
            		.replace(/^-|-$/g, "") + ".png"
            	);
            }

            function imageUrl(name) {
            	return IMAGE_BASE + encodeURIComponent(imageName(name));
            }

            let imageManifest = [];
            let imageOccurrenceMap = new WeakMap();

            function prepareImageManifest() {
            	imageOccurrenceMap = new WeakMap();

            	if (!Array.isArray(imageManifest)) {
            		console.warn("images.json is not an array.");
            		return;
            	}

            	const entriesByName = new Map();

            	imageManifest.forEach((entry) => {
            		if (!entry || !entry.name) return;

            		const key = norm(entry.name);

            		if (!entriesByName.has(key)) {
            			entriesByName.set(key, []);
            		}

            		entriesByName.get(key).push(entry);
            	});

            	const occurrence = new Map();

            	data.forEach((row) => {
            		const key = norm(row.name);
            		const index = occurrence.get(key) || 0;

            		const entries = entriesByName.get(key) || [];
            		const entry = entries[index];

            		occurrence.set(key, index + 1);

            		if (
            			entry &&
            			Array.isArray(entry.images) &&
            			entry.images.length
            		) {
            			imageOccurrenceMap.set(
            				row,
            				entry.images.map(
            					(file) =>
            					IMAGE_BASE +
            					encodeURIComponent(file)
            				)
            			);
            		}
            	});
            }

            function signatureUrls(row) {
            	const listed = imageOccurrenceMap.get(row);

            	if (Array.isArray(listed) && listed.length) {
            		return listed;
            	}

            	return [imageUrl(row.name)];
            }

            function makeSignature(row, rowIndex) {
            	const urls = signatureUrls(row);
            	const wrap = document.createElement("div");
            	wrap.className = "signature-wrap";

            	const carousel = document.createElement("div");
            	carousel.className = "signature-carousel";
            	carousel.id = "carousel-" + rowIndex;
            	carousel.dataset.index = "0";

            	const img = document.createElement("img");
            	img.className = "lazy-image carousel-img";
            	img.dataset.src = urls[0];
            	img.dataset.carouselUrls = JSON.stringify(urls);
            	img.alt = "Signature of " + row.name;
            	img.onclick = () => openViewer(carousel);

            	if (urls.length > 1) {
            		const prev = document.createElement("button");
            		prev.className = "carousel-btn";
            		prev.type = "button";
            		prev.textContent = "‹";
            		prev.setAttribute("aria-label", "Previous signature");
            		prev.onclick = () => moveCarousel(carousel, -1);

            		const next = document.createElement("button");
            		next.className = "carousel-btn";
            		next.type = "button";
            		next.textContent = "›";
            		next.setAttribute("aria-label", "Next signature");
            		next.onclick = () => moveCarousel(carousel, 1);

            		const count = document.createElement("div");
            		count.className = "carousel-count";
            		count.textContent = "1 / " + urls.length;

            		carousel.append(prev, img, next);
            		wrap.append(carousel, count);
            	} else {
            		carousel.append(img);
            		wrap.append(carousel);
            	}

            	return wrap;
            }

            let activeViewerCarousel = null;
            let viewerZoom = 1;

            function openViewer(carousel) {
            	const img = carousel.querySelector("img");
            	if (!img) return;
            	activeViewerCarousel = carousel;
            	viewerZoom = 1;
            	document.getElementById("zoomViewer").classList.add("open");
            	document.body.style.overflow = "hidden";
            	updateViewer();
            }

            function updateViewer() {
            	if (!activeViewerCarousel) return;
            	const img = activeViewerCarousel.querySelector("img");
            	const urls = JSON.parse(img.dataset.carouselUrls || "[]");
            	const current = Number(activeViewerCarousel.dataset.index || 0);
            	const viewerImg = document.getElementById("zoomImage");
            	viewerImg.src = urls[current];
            	viewerImg.alt = img.alt;
            	viewerImg.style.transform = "scale(" + viewerZoom + ")";
            	document.getElementById("zoomLevel").textContent = Math.round(viewerZoom * 100) + "%";
            	document.getElementById("zoomCaption").textContent = current + 1 + " / " + urls.length;
            	const multi = urls.length > 1;
            	document.getElementById("zoomPrev").style.display = multi ? "" : "none";
            	document.getElementById("zoomNext").style.display = multi ? "" : "none";
            }

            function changeZoom(amount) {
            	viewerZoom = Math.max(0.5, Math.min(4, viewerZoom + amount));
            	updateViewer();
            }

            function resetZoom() {
            	viewerZoom = 1;
            	updateViewer();
            }

            function closeViewer() {
            	document.getElementById("zoomViewer").classList.remove("open");
            	document.body.style.overflow = "";
            	activeViewerCarousel = null;
            }
            document.getElementById("zoomPrev").onclick = () => {
            	if (!activeViewerCarousel) return;
            	moveCarousel(activeViewerCarousel, -1);
            	updateViewer();
            };
            document.getElementById("zoomNext").onclick = () => {
            	if (!activeViewerCarousel) return;
            	moveCarousel(activeViewerCarousel, 1);
            	updateViewer();
            };
            document.getElementById("zoomViewer").addEventListener("click", (e) => {
            	if (e.target.id === "zoomViewer") closeViewer();
            });
            document.addEventListener("keydown", (e) => {
            	const viewer = document.getElementById("zoomViewer");
            	if (!viewer.classList.contains("open")) return;
            	if (e.key === "Escape") closeViewer();
            	if (e.key === "ArrowLeft") document.getElementById("zoomPrev").click();
            	if (e.key === "ArrowRight") document.getElementById("zoomNext").click();
            	if (e.key === "+") changeZoom(0.2);
            	if (e.key === "-") changeZoom(-0.2);
            });

            function moveCarousel(carousel, direction) {
            	const img = carousel.querySelector("img");
            	if (!img) return;
            	const urls = JSON.parse(img.dataset.carouselUrls);
            	let current = Number(carousel.dataset.index || 0);
            	current = (current + direction + urls.length) % urls.length;
            	carousel.dataset.index = current;
            	img.src = urls[current];
            	img.removeAttribute("data-src");
            	const countEl = carousel.parentElement.querySelector(".carousel-count");
            	if (countEl) countEl.textContent = current + 1 + " / " + urls.length;
            }

            function initial(name) {
            	const c = norm(name).charAt(0);
            	return /^[a-z]$/.test(c) ? c : "#";
            }

            function makeLetters() {
            	const box = document.getElementById("letters");
            	box.innerHTML = "";
            	const all = document.createElement("button");
            	all.textContent = "All";
            	all.className = activeLetter === "" ? "active" : "";
            	all.onclick = () => {
            		activeLetter = "";
            		visibleCount = PAGE_SIZE;
            		render();
            	};
            	box.appendChild(all);
            	for (let i = 0; i < 26; i++) {
            		const l = String.fromCharCode(97 + i),
            			b = document.createElement("button");
            		b.textContent = l.toUpperCase();
            		b.className = activeLetter === l ? "active" : "";
            		b.onclick = () => {
            			activeLetter = l;
            			visibleCount = PAGE_SIZE;
            			render();
            		};
            		box.appendChild(b);
            	}
            }

            function makeTextCell(label, text, bold = false) {
            	const d = document.createElement("div");
            	const lab = document.createElement("div");
            	lab.className = "mobile-label";
            	lab.textContent = label;
            	d.appendChild(lab);
            	const v = document.createElement(bold ? "strong" : "span");
            	v.textContent = text || "—";
            	d.appendChild(v);
            	return d;
            }

            function makeEntry(row, rowIndex) {
            	const e = document.createElement("div");
            	e.className = "entry";
            	e.appendChild(makeTextCell("Name", row.name, true));
            	e.appendChild(makeTextCell("Other name(s) / Spelling(s)", row.other));
            	e.appendChild(makeTextCell("Date(s)", row.dates));
            	const sig = document.createElement("div");
            	sig.className = "signature-box";
            	sig.appendChild(makeSignature(row, rowIndex));
            	e.appendChild(sig);
            	const source = document.createElement("div");
            	source.className = "source";
            	const sl = document.createElement("div");
            	sl.className = "mobile-label";
            	sl.textContent = "Source";
            	source.appendChild(sl);
            	if (row.sourceUrl) {
            		const a = document.createElement("a");
            		a.href = row.sourceUrl;
            		a.target = "_blank";
            		a.rel = "noopener";
            		a.textContent = row.source || "Source";
            		source.appendChild(a);
            	} else source.appendChild(document.createTextNode(row.source || "—"));
            	e.appendChild(source);
            	return e;
            }

            const imageObserver = new IntersectionObserver(
            	(entries) => {
            		entries.forEach((entry) => {
            			if (!entry.isIntersecting) return;
            			const img = entry.target;
            			img.src = img.dataset.src;
            			img.onload = () => imageObserver.unobserve(img);
            			img.onerror = () => {
            				const m = document.createElement("div");
            				m.className = "missing";
            				m.textContent = "Image not added yet";
            				img.replaceWith(m);
            				imageObserver.unobserve(img);
            			};
            		});
            	}, {
            		rootMargin: "500px 0px"
            	}
            );

            function render() {
            	makeLetters();
            	const rows = data.filter(
            		(r) => (!activeLetter || initial(r.name) === activeLetter) && matchesSearch(r)
            	);
            	const shown = rows.slice(0, visibleCount);
            	document.getElementById("status").textContent =
            		rows.length.toLocaleString() +
            		" entries" +
            		(query ? ' matching "' + query + '"' : activeLetter ? " in " + activeLetter.toUpperCase() : "") +
            		(rows.length > shown.length ? "  —  showing " + shown.length : "");
            	const box = document.getElementById("results");
            	box.innerHTML = "";
            	const wrap = document.createElement("div");
            	wrap.className = "table-wrap";
            	const head = document.createElement("div");
            	head.className = "column-head";
            	["Name", "Other name(s) / Spelling(s)", "Date(s)", "Signature", "Source"].forEach((x) => {
            		const d = document.createElement("div");
            		d.textContent = x;
            		head.appendChild(d);
            	});
            	wrap.appendChild(head);
            	const frag = document.createDocumentFragment();
            	shown.forEach((r, i) => frag.appendChild(makeEntry(r, i)));
            	wrap.appendChild(frag);
            	box.appendChild(wrap);
            	wrap.querySelectorAll(".lazy-image").forEach((img) => imageObserver.observe(img));
            	if (shown.length < rows.length) {
            		const more = document.createElement("button");
            		more.className = "load-more";
            		more.textContent = `Load next ${Math.min(PAGE_SIZE, rows.length - shown.length)} entries`;
            		more.onclick = () => {
            			visibleCount += PAGE_SIZE;
            			render();
            		};
            		box.appendChild(more);
            	}
            }

            async function loadData() {
            	try {
            		const cached = localStorage.getItem(CACHE_KEY);
            		if (cached) {
            			try {
            				data = JSON.parse(cached);
            				render();
            			} catch (e) {}
            		}
            		try {
            			const imageResponse = await fetch("images.json", {
            				cache: "no-cache"
            			});
            			if (imageResponse.ok) {
            				imageManifest = await imageResponse.json();
            			}
            		} catch (e) {
            			imageManifest = {};
            		}
            		const response = await fetch(DATA_URL, {
            			cache: "no-cache"
            		});
            		if (!response.ok) throw new Error("GitHub returned HTTP " + response.status);
            		const fresh = parseNamesTxt(await response.text());
            		data = fresh;

            		prepareImageManifest();

            		try {
            			localStorage.setItem(CACHE_KEY, JSON.stringify(fresh));
            		} catch (e) {}

            		render();
            	} catch (err) {
            		if (!data.length) {
            			document.getElementById("status").textContent = "Could not load collector list.";
            			const error = document.getElementById("error");
            			error.style.display = "block";
            			error.textContent = "Could not load names.txt from GitHub: " + err.message;
            		}
            	}
            }

            document.getElementById("search").addEventListener("input", (e) => {
            	query = e.target.value;
            	visibleCount = PAGE_SIZE;
            	render();
            });
            document.getElementById("clear").addEventListener("click", () => {
            	document.getElementById("search").value = "";
            	query = "";
            	activeLetter = "";
            	visibleCount = PAGE_SIZE;
            	render();
            });

            (function() {
            	const tip = document.getElementById("hoverTip");
            	let hovering = false;
            	document.addEventListener("mousemove", (e) => {
            		const overImage = e.target.closest && e.target.closest(".carousel-img");
            		if (overImage) {
            			tip.style.transform = "translate(" + (e.clientX + 14) + "px," + (e.clientY + 14) + "px)";
            			if (!hovering) {
            				hovering = true;
            				tip.classList.add("show");
            			}
            		} else if (hovering) {
            			hovering = false;
            			tip.classList.remove("show");
            		}
            	});
            	document.addEventListener("mouseleave", () => {
            		hovering = false;
            		tip.classList.remove("show");
            	});
            })();

            loadData();
