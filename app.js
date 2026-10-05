// La eliminación de fondo corre 100% en el navegador (modelo de IA vía WebAssembly).
const LIB = "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/+esm";
const ORB = "https://cdn.jsdelivr.net/npm/@yogesharc/thinking-orbs@0.1.1/dist/orb-core.js";
let removeBackground, orbLib;

const $ = (id) => document.getElementById(id);
const dropzone = $("dropzone"), fileInput = $("fileInput"), grid = $("grid");
const results = $("results"), downloadAll = $("downloadAll");
const done = []; // {name, url}
let queue = Promise.resolve();

$("pickBtn").onclick = () => fileInput.click();
document.querySelector(".btn-small").onclick = (e) => { e.preventDefault(); fileInput.click(); };
fileInput.onchange = () => { handle(fileInput.files); fileInput.value = ""; };
["dragenter", "dragover"].forEach((ev) => dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add("over"); }));
["dragleave", "drop"].forEach((ev) => dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove("over"); }));
dropzone.addEventListener("drop", (e) => handle(e.dataTransfer.files));
$("clearBtn").onclick = () => { grid.innerHTML = ""; done.length = 0; results.hidden = true; downloadAll.hidden = true; };
downloadAll.onclick = () => done.forEach((d, i) => setTimeout(() => download(d), i * 300));

// Orbe animado (Thinking Orbs) dentro de un contenedor. Devuelve una función para detenerlo.
async function mountOrbIn(el, opts) {
  try {
    orbLib ??= await import(ORB);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", opts.size); svg.setAttribute("height", opts.size);
    svg.style.color = "var(--blue)";
    el.replaceChildren(svg);
    const orb = orbLib.mountOrb(svg, opts);
    return () => orb.destroy();
  } catch (e) { console.warn("Orbe no disponible", e); return () => {}; }
}
mountOrbIn($("heroOrb"), { state: "reasoning", size: 56, label: "QuitarFondo" });

const mode = () => document.querySelector('input[name="mode"]:checked').value;

// Modo logo: quita el color de fondo liso (esquinas y bordes) con bordes suaves.
async function removeSolid(file) {
  const bmp = await createImageBitmap(file);
  const c = document.createElement("canvas"); c.width = bmp.width; c.height = bmp.height;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height), d = img.data, w = c.width, h = c.height;
  const samples = [];
  const take = (x, y) => { const i = (y * w + x) * 4; samples.push([d[i], d[i + 1], d[i + 2]]); };
  const stepX = Math.max(1, Math.floor(w / 40)), stepY = Math.max(1, Math.floor(h / 40));
  for (let x = 0; x < w; x += stepX) { take(x, 0); take(x, h - 1); }
  for (let y = 0; y < h; y += stepY) { take(0, y); take(w - 1, y); }
  const med = (k) => samples.map((s) => s[k]).sort((a, b) => a - b)[samples.length >> 1];
  const bg = [med(0), med(1), med(2)];
  const t0 = 28, t1 = 80; // por debajo de t0 es fondo; por encima de t1 es objeto
  for (let i = 0; i < d.length; i += 4) {
    const dist = Math.hypot(d[i] - bg[0], d[i + 1] - bg[1], d[i + 2] - bg[2]);
    const a = Math.min(1, Math.max(0, (dist - t0) / (t1 - t0)));
    if (a > 0 && a < 1) for (let k = 0; k < 3; k++) d[i + k] = Math.min(255, Math.max(0, (d[i + k] - bg[k] * (1 - a)) / a));
    d[i + 3] = Math.round(d[i + 3] * a);
  }
  ctx.putImageData(img, 0, 0);
  return new Promise((res) => c.toBlob(res, "image/png"));
}

function download(d) { const a = document.createElement("a"); a.href = d.url; a.download = d.name; a.click(); }

function handle(files) {
  const imgs = [...files].filter((f) => /^image\/(png|jpe?g|webp)$/.test(f.type));
  if (!imgs.length) return;
  results.hidden = false;
  results.scrollIntoView({ behavior: "smooth" });
  imgs.forEach((file) => {
    const card = addCard(file);
    queue = queue.then(() => process(file, card)); // una a la vez para no saturar memoria
  });
}

function addCard(file) {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `<div class="thumb"><img alt=""><div class="status"><div class="orbbox"><div class="spin"></div></div><span>En cola…</span></div></div>
    <div class="card-foot"><span class="name"></span></div>`;
  card.querySelector("img").src = URL.createObjectURL(file);
  card.querySelector(".name").textContent = file.name;
  grid.prepend(card);
  return card;
}

async function process(file, card) {
  const status = card.querySelector(".status span");
  const solid = mode() === "solid";
  let stopOrb = () => {};
  try {
    status.textContent = solid ? "Quitando el color de fondo…" : "Quitando fondo… (la primera vez tarda más)";
    stopOrb = await mountOrbIn(card.querySelector(".orbbox"), { state: solid ? "working" : "reasoning", size: 56 });
    let blob;
    if (solid) blob = await removeSolid(file);
    else {
      removeBackground ??= (await import(LIB)).removeBackground;
      // modelo "isnet" completo: más preciso que el modelo ligero por defecto
      blob = await removeBackground(file, { model: "isnet", output: { format: "image/png" } });
    }
    stopOrb();
    const url = URL.createObjectURL(blob);
    const name = file.name.replace(/\.[^.]+$/, "") + "-sin-fondo.png";
    card.querySelector("img").src = url;
    card.querySelector(".status").remove();
    const a = document.createElement("a");
    a.className = "dl"; a.href = url; a.download = name; a.textContent = "Descargar PNG";
    card.querySelector(".card-foot").append(a);
    done.push({ name, url });
    downloadAll.hidden = done.length < 2;
  } catch (err) {
    console.error(err);
    const local = location.protocol === "file:";
    status.textContent = local
      ? "Error: abre el sitio con un servidor local o publicado (no con doble clic en el archivo)."
      : "Error al procesar la imagen: " + (err && err.message ? err.message : err);
    stopOrb();
    card.querySelector(".orbbox").remove();
  }
}
