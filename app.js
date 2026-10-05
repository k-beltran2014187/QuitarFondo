// La eliminación de fondo corre 100% en el navegador (modelo de IA vía WebAssembly).
const LIB = "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/+esm";
let removeBackground;

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
  card.innerHTML = `<div class="thumb"><img alt=""><div class="status"><div class="spin"></div><span>En cola…</span></div></div>
    <div class="card-foot"><span class="name"></span></div>`;
  card.querySelector("img").src = URL.createObjectURL(file);
  card.querySelector(".name").textContent = file.name;
  grid.prepend(card);
  return card;
}

async function process(file, card) {
  const status = card.querySelector(".status span");
  try {
    status.textContent = "Quitando fondo… (la primera vez tarda más)";
    removeBackground ??= (await import(LIB)).removeBackground;
    const blob = await removeBackground(file, { output: { format: "image/png" } });
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
    card.querySelector(".spin").remove();
  }
}
