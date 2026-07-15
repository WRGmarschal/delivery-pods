const $ = (selector) => document.querySelector(selector);
let token = sessionStorage.getItem("podCmsToken") || "";
let pages = [], current = null, sourceDoc = null, fields = [];
const editableSelector = "title, .hero-tag, h1, section h2, section h3, p.lead, .prow .pt, .bullets li, .feat p, .cell p, .price";

const blocks = {
  narrative: { name: "Narrative", note: "Headline + body", html: `<section class="sec"><div class="wrap"><div class="sec-head"><div class="eyebrow"><span class="tick"></span>New section</div><h2 class="h-lg">Add a clear, outcome-focused headline.</h2><p class="lead">Explain the opportunity, constraint, or business outcome in a concise paragraph.</p></div></div></section>` },
  problems: { name: "Problem list", note: "3 key challenges", html: `<section class="sec"><div class="wrap"><div class="sec-head"><div class="eyebrow"><span class="tick"></span>The challenge</div><h2 class="h-lg">The priorities competing for your team&rsquo;s attention.</h2></div><div class="plist"><div class="prow"><div class="pn">01</div><div class="pt">First high-priority challenge.</div></div><div class="prow"><div class="pn">02</div><div class="pt">Second high-priority challenge.</div></div><div class="prow"><div class="pn">03</div><div class="pt">Third high-priority challenge.</div></div></div></div></section>` },
  features: { name: "Feature grid", note: "3 capabilities", html: `<section class="sec"><div class="wrap"><div class="sec-head"><div class="eyebrow"><span class="tick"></span>What we can build</div><h2 class="h-lg">A focused pod for the work ahead.</h2></div><div class="feat3"><div class="feat"><div class="fn">01</div><h3>Capability one</h3><p>Describe the first capability and its outcome.</p></div><div class="feat"><div class="fn">02</div><h3>Capability two</h3><p>Describe the second capability and its outcome.</p></div><div class="feat"><div class="fn">03</div><h3>Capability three</h3><p>Describe the third capability and its outcome.</p></div></div></div></section>` },
  light: { name: "Light feature", note: "Contrast section", html: `<section class="sec light"><div class="wrap"><div class="cols2"><div class="sec-head"><div class="eyebrow"><span class="tick"></span>Why now</div><h2 class="h-lg">Create momentum without disrupting the roadmap.</h2></div><div><p class="lead">Give a focused team ownership of a clearly defined outcome while your core team stays focused on its highest-leverage priorities.</p><ul class="bullets"><li>Focused scope</li><li>Senior delivery team</li><li>Measurable progress</li></ul></div></div></div></section>` },
  cta: { name: "Call to action", note: "Conversion band", html: `<section class="ctaband reveal"><div class="wrap"><h2 class="h-md">Ready to turn the backlog into momentum?</h2><a class="btn solid" href="#contact">Build your pod</a></div></section>` },
  proof: { name: "Proof point", note: "Case-study block", html: `<section class="sec light"><div class="wrap"><div class="sec-head"><div class="eyebrow"><span class="tick"></span>Proof in practice</div><h2 class="h-lg">Built for outcomes, not output.</h2><p class="lead">Add a relevant customer result, delivery example, or evidence point here. Only use claims that your team can verify.</p></div></div></section>` },
};

function toast(message) { const el = $("#toast"); el.textContent = message; el.classList.add("show"); setTimeout(() => el.classList.remove("show"), 3200); }
async function api(url, options = {}) { const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", "X-CMS-Token": token, ...options.headers } }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Request failed"); return data; }
function pretty(path) { return path.replace(/\.html$/, "").replace(/-/g, " "); }
function titleCase(value) { return value.replace(/\b\w/g, (c) => c.toUpperCase()); }
function escapeHtml(value) { const div = document.createElement("div"); div.textContent = value; return div.innerHTML; }

function renderPages(filter = "") {
  const list = pages.filter((page) => pretty(page).includes(filter.toLowerCase()));
  $("#pages").innerHTML = list.map((page) => `<button class="page-btn ${current?.path === page ? "active" : ""}" data-path="${page}">${pretty(page)}</button>`).join("");
  document.querySelectorAll(".page-btn").forEach((button) => button.onclick = () => loadPage(button.dataset.path));
}

function extract(doc) {
  let count = 0; const result = [];
  for (const element of [...doc.querySelectorAll(editableSelector)].filter((el) => el.textContent.trim() && !el.closest("footer"))) {
    const nodes = []; const walker = doc.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) if (walker.currentNode.nodeValue.trim()) nodes.push(walker.currentNode);
    nodes.forEach((node, index) => result.push({ id: `field-${count++}`, value: node.nodeValue.trim(), node, label: `${element.tagName === "TITLE" ? "Browser title" : element.classList.contains("hero-tag") ? "Hero label" : `${element.tagName.toLowerCase()} · ${element.textContent.trim().slice(0, 35)}`}${nodes.length > 1 ? ` · part ${index + 1}` : ""}` }));
  }
  return result;
}

function renderFields() {
  fields = extract(sourceDoc);
  $("#fields").innerHTML = fields.map((field) => `<div class="field"><label>${escapeHtml(field.label)}</label><textarea data-id="${field.id}">${escapeHtml(field.value)}</textarea></div>`).join("");
  document.querySelectorAll("#fields textarea").forEach((textarea) => textarea.oninput = () => { const field = fields.find((item) => item.id === textarea.dataset.id); field.value = textarea.value; field.node.nodeValue = field.value; markDirty(); refreshPreview(); });
}

function sectionNodes() { return [...sourceDoc.body.children].filter((node) => node.tagName === "SECTION"); }
function sectionName(section, index) { const eyebrow = section.querySelector(".eyebrow"); const heading = section.querySelector("h1,h2,h3"); return { name: eyebrow?.textContent.trim() || section.id || (index === 0 ? "Hero" : `Section ${index + 1}`), note: heading?.textContent.trim().slice(0, 62) || section.className || "Content block" }; }
function renderSections() {
  const sections = sectionNodes();
  $("#sections").innerHTML = sections.map((section, index) => { const label = sectionName(section, index); return `<div class="section-row"><div><b>${escapeHtml(label.name)}</b><small>${escapeHtml(label.note)}</small></div><div class="section-actions"><button class="mini" data-action="up" data-index="${index}" title="Move up">↑</button><button class="mini" data-action="down" data-index="${index}" title="Move down">↓</button><button class="mini" data-action="copy" data-index="${index}" title="Duplicate">⧉</button><button class="mini" data-action="delete" data-index="${index}" title="Delete">×</button></div></div>`; }).join("");
  document.querySelectorAll(".section-actions button").forEach((button) => button.onclick = () => editSection(button.dataset.action, Number(button.dataset.index)));
}
function editSection(action, index) {
  const sections = sectionNodes(), section = sections[index]; if (!section) return;
  if (action === "up" && index > 0) section.parentNode.insertBefore(section, sections[index - 1]);
  if (action === "down" && index < sections.length - 1) section.parentNode.insertBefore(sections[index + 1], section);
  if (action === "copy") section.parentNode.insertBefore(section.cloneNode(true), section.nextSibling);
  if (action === "delete" && confirm("Remove this section from the page?")) section.remove(); else if (action === "delete") return;
  renderSections(); renderFields(); refreshPreview(); markDirty();
}
function addBlock(type) {
  const template = document.createElement("template"); template.innerHTML = blocks[type].html.trim();
  const footer = sourceDoc.body.querySelector("footer"); sourceDoc.body.insertBefore(sourceDoc.importNode(template.content.firstElementChild, true), footer || null);
  renderSections(); renderFields(); refreshPreview(); markDirty(); toast(`${blocks[type].name} block added`);
}

function refreshPreview() { $("#preview").srcdoc = `<!DOCTYPE html>\n${sourceDoc.documentElement.outerHTML}`; }
function serialized() { return `<!DOCTYPE html>\n${sourceDoc.documentElement.outerHTML}`; }
function markDirty() { current.dirty = true; $("#status").textContent = current.isNew ? "Draft" : "Unpublished"; $("#status").style.color = "#b47713"; }
function openEditor() { $("#welcome").style.display = "none"; $("#editor").classList.add("open"); $("#saveBtn").disabled = false; $("#viewBtn").disabled = Boolean(current.isNew); $("#duplicateBtn").disabled = false; renderPages($("#search").value); }

async function loadPage(path) {
  if (current?.dirty && !confirm("Discard your unpublished changes?")) return;
  try { $("#crumb").textContent = "Loading…"; const data = await api(`/api/cms?action=read&path=${encodeURIComponent(path)}`); current = { ...data, dirty: false, isNew: false }; sourceDoc = new DOMParser().parseFromString(data.content, "text/html"); renderFields(); renderSections(); refreshPreview(); openEditor(); $("#crumb").textContent = pretty(path); $("#status").textContent = "Saved"; $("#status").style.color = ""; } catch (error) { toast(error.message); }
}

async function runAi(instruction) {
  const payloadFields = fields.slice(0, 80).map(({ id, value, label }) => ({ id, value, label }));
  const result = await api("/api/ai-edit", { method: "POST", body: JSON.stringify({ page: current.path, instruction, fields: payloadFields }) });
  for (const change of result.fields) { const field = fields.find((item) => item.id === change.id); if (!field) continue; field.value = change.value; field.node.nodeValue = field.value; }
  renderFields(); refreshPreview(); markDirty(); return result;
}

function replaceCompany(doc, oldCompany, newCompany) {
  if (!oldCompany || oldCompany.toLowerCase() === newCompany.toLowerCase()) return;
  const walker = doc.createTreeWalker(doc.documentElement, NodeFilter.SHOW_TEXT); const nodes = [];
  while (walker.nextNode()) if (!walker.currentNode.parentElement?.matches("script,style") && walker.currentNode.nodeValue.includes(oldCompany)) nodes.push(walker.currentNode);
  nodes.forEach((node) => node.nodeValue = node.nodeValue.split(oldCompany).join(newCompany));
}
function detectCompany(doc, fallback) { const tag = doc.querySelector(".hero-tag")?.textContent.match(/Prepared for\s+(.+)/i); if (tag) return tag[1].trim(); const title = doc.title.match(/for\s+(.+?)\s*\|/i); return title?.[1]?.trim() || titleCase(fallback); }

function showNewModal(duplicate = false) {
  $("#newForm").reset(); delete $("#pageSlug").dataset.touched; $("#useAi").checked = !duplicate; $("#modalTitle").textContent = duplicate ? "Duplicate this page" : "Create from a proven layout";
  $("#templatePage").innerHTML = pages.filter((page) => page !== "index.html").map((page) => `<option value="${page}" ${page === current?.path ? "selected" : ""}>${titleCase(pretty(page))}</option>`).join("");
  if (duplicate && current) { $("#companyName").value = titleCase(pretty(current.path)); $("#pageSlug").value = current.path.replace(/\.html$/, "") + "-copy"; }
  $("#newModal").showModal();
}

async function buildDraft(event) {
  event.preventDefault(); const company = $("#companyName").value.trim(); const slug = $("#pageSlug").value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); const templatePath = $("#templatePage").value;
  if (!company || !slug) return toast("Add a company name and page URL"); if (pages.includes(`${slug}.html`)) return toast("That page URL already exists");
  const button = $("#createBtn"); button.disabled = true; button.textContent = "Building…"; $("#newProgress").textContent = "Loading the layout…";
  try {
    const template = await api(`/api/cms?action=read&path=${encodeURIComponent(templatePath)}`); sourceDoc = new DOMParser().parseFromString(template.content, "text/html"); replaceCompany(sourceDoc, detectCompany(sourceDoc, pretty(templatePath)), company);
    current = { path: `${slug}.html`, sha: null, dirty: true, isNew: true }; fields = extract(sourceDoc); renderFields(); renderSections(); refreshPreview(); openEditor(); $("#crumb").textContent = `${company} · new draft`; $("#status").textContent = "Draft";
    if ($("#useAi").checked) { $("#newProgress").textContent = "AI is drafting the page copy…"; const brief = $("#pageBrief").value.trim(); await runAi(`Create a tailored first draft for ${company}. ${brief || "Adapt the existing copy to the company while preserving the page's structure, pricing, contact details, and any claims that cannot safely be changed."} Do not invent facts, customer metrics, partnerships, or product claims. Keep each field close to its original length.`); }
    $("#newModal").close(); toast("Draft ready. Review it, then publish.");
  } catch (error) { toast(error.message); $("#newProgress").textContent = error.message; } finally { button.disabled = false; button.textContent = "Build draft"; }
}

async function login() { try { const data = await api("/api/cms?action=list"); pages = data.pages; sessionStorage.setItem("podCmsToken", token); $("#login").style.display = "none"; $("#pageCount").textContent = pages.length; renderPages(); } catch (error) { $("#loginError").textContent = error.message; } }

$("#loginForm").onsubmit = (event) => { event.preventDefault(); token = $("#token").value; login(); };
$("#search").oninput = (event) => renderPages(event.target.value); $("#newBtn").onclick = () => showNewModal(); $("#welcomeNew").onclick = () => showNewModal(); $("#duplicateBtn").onclick = () => showNewModal(true); $("#closeModal").onclick = () => $("#newModal").close(); $("#newForm").onsubmit = buildDraft;
$("#companyName").oninput = (event) => { if (!$("#pageSlug").dataset.touched) $("#pageSlug").value = event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }; $("#pageSlug").oninput = () => $("#pageSlug").dataset.touched = "true";
$("#viewBtn").onclick = () => window.open(`/${current.path.replace(/\.html$/, "")}`, "_blank");
$("#saveBtn").onclick = async () => { if (!current?.dirty) return toast("There are no unpublished changes"); if (!confirm(`${current.isNew ? "Create" : "Publish changes to"} ${pretty(current.path)}?`)) return; const button = $("#saveBtn"); button.disabled = true; button.textContent = "Publishing…"; try { const result = await api("/api/cms", { method: "POST", body: JSON.stringify({ action: current.isNew ? "create" : "save", path: current.path, sha: current.sha, content: serialized() }) }); current.sha = result.sha; current.isNew = false; current.dirty = false; if (!pages.includes(current.path)) pages.push(current.path); pages.sort(); $("#pageCount").textContent = pages.length; renderPages(); $("#status").textContent = "Published"; $("#status").style.color = ""; $("#viewBtn").disabled = false; toast("Published. Vercel will deploy it shortly."); } catch (error) { toast(error.message); } finally { button.disabled = false; button.textContent = "Publish changes"; } };
$("#aiBtn").onclick = async () => { const instruction = $("#aiPrompt").value.trim(); if (!instruction) return toast("Tell AI what you want changed"); const button = $("#aiBtn"); button.disabled = true; button.textContent = "Working…"; try { const result = await runAi(instruction); toast(result.summary || `AI proposed ${result.fields.length} edits`); } catch (error) { toast(error.message); } finally { button.disabled = false; button.textContent = "Generate edits"; } };
document.querySelectorAll(".tab").forEach((tab) => tab.onclick = () => { document.querySelectorAll(".tab,.tab-panel").forEach((item) => item.classList.remove("active")); tab.classList.add("active"); $(`#${tab.dataset.tab}Panel`).classList.add("active"); });
document.querySelectorAll(".device").forEach((device) => device.onclick = () => { document.querySelectorAll(".device").forEach((item) => item.classList.remove("active")); device.classList.add("active"); $("#preview").style.width = device.dataset.width; });
$("#blockGrid").innerHTML = Object.entries(blocks).map(([key, block]) => `<button class="block" data-block="${key}"><b>${block.name}</b><small>${block.note}</small></button>`).join(""); document.querySelectorAll(".block").forEach((button) => button.onclick = () => addBlock(button.dataset.block));
window.addEventListener("beforeunload", (event) => { if (current?.dirty) { event.preventDefault(); event.returnValue = ""; } }); if (token) login();
