// ================== DATE & TIME ==================
function updateTime() {
  // Mengambil elemen datetime
  const timeElement = document.getElementById('datetime'); 
  if (timeElement) {
    const now = new Date();
    const options = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    };
    // Mengubah ID ke 'datetime' sesuai HTML
    const formattedTime = now.toLocaleDateString('id-ID', options); 
    timeElement.textContent = formattedTime;
  }
}
setInterval(updateTime, 1000);
updateTime();

// ================== SHA-256 ==================
async function sha256(msg) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(msg));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ================== NAVIGATION ==================
function showPage(pageId) {
  // 1. Sembunyikan semua halaman
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  
  // 2. Nonaktifkan semua tombol navbar
  document
    .querySelectorAll(".navbar button")
    .forEach((b) => b.classList.remove("active"));
  
  // 3. Tampilkan halaman yang diminta
  const page = document.getElementById(pageId);
  if (page) {
      page.classList.add("active");
  } else {
      console.error(`Page ID ${pageId} tidak ditemukan.`);
      return;
  }

  // 4. Aktifkan tombol navbar yang sesuai
  // Mendapatkan nama tab (misal: 'home' dari 'page-home')
  const tabName = pageId.split("-").slice(1).join("-"); 
  const tabButton = document.getElementById("tab-" + tabName);
  if (tabButton) {
    tabButton.classList.add("active");
  } else {
      console.error(`Tab button ID tab-${tabName} tidak ditemukan.`);
  }

  // 5. Logic Khusus untuk halaman tertentu
  if (pageId === 'page-block') {
      // Pastikan hash di halaman Block terupdate saat pindah ke sana
      updateBlockHash(); 
  }
  // Tidak perlu memanggil renderChain() di sini, karena sudah dipanggil saat inisialisasi dan modifikasi data.
}

// Inisialisasi Event Listeners untuk Navbar setelah DOM siap
document.addEventListener('DOMContentLoaded', () => {
    // Navigasi Navbar
    ["home", "about", "hash", "block", "chain", "ecc", "consensus"].forEach((p) => {
        const t = document.getElementById("tab-" + p);
        if (t) {
            // Hapus event lama jika ada dan pasang event baru
            t.removeEventListener("click", () => showPage("page-" + p)); 
            t.addEventListener("click", () => showPage("page-" + p));
        }
    });

    // Navigasi Feature items (hanya perlu memanggil showPage)
    document.querySelectorAll(".feature-item").forEach((item, index) => {
        const pages = ["page-hash", "page-block", "page-chain", "page-ecc", "page-consensus"];
        if (pages[index]) {
            // Hapus event lama jika ada dan pasang event baru
            item.removeEventListener("click", () => showPage(pages[index]));
            item.addEventListener("click", () => showPage(pages[index]));
            item.style.cursor = "pointer"; // Ensure cursor is pointer
        }
    });
    
    // Tampilkan halaman 'home' secara default saat pertama kali dimuat
    showPage('page-home');
});


// ================== HASH PAGE ==================
document.getElementById("hash-input")?.addEventListener("input", async (e) => {
  document.getElementById("hash-output").textContent = await sha256(
    e.target.value
  );
});

// ================== BLOCK PAGE ==================
const blockData = document.getElementById("block-data");
const blockNonce = document.getElementById("block-nonce");
const blockHash = document.getElementById("block-hash");
const blockTimestamp = document.getElementById("block-timestamp");
const speedControl = document.getElementById("speed-control");

blockNonce?.addEventListener("input", (e) => {
  // Hanya menerima angka
  e.target.value = e.target.value.replace(/[^0-9]/g, ""); 
  updateBlockHash();
});
blockData?.addEventListener("input", updateBlockHash);

async function updateBlockHash() {
  const data = blockData.value;
  const nonce = blockNonce.value || "0";
  // Menambahkan timestamp ke hash untuk memastikan blok berubah saat timestamp berubah
  const ts = blockTimestamp.value; 
  blockHash.textContent = await sha256(data + ts + nonce);
}

document.getElementById("btn-mine")?.addEventListener("click", async () => {
  const data = blockData.value;
  const speedMultiplier = parseInt(speedControl.value) || 1;
  // Menghitung batch size untuk kecepatan mining
  const baseBatch = 1000; 
  const batchSize = baseBatch * speedMultiplier;
  // Mining Difficulty
  const miningDifficulty = document.getElementById("mining-difficulty").value;
  const difficulty = miningDifficulty || "0000"; 
  const status = document.getElementById("mining-status");
  
  // Mengupdate timestamp sebelum mining dimulai
  const timestamp = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Jakarta",
  });
  blockTimestamp.value = timestamp;
  
  blockHash.textContent = "";
  blockNonce.value = "0";
  let nonce = 0;
  if (status) status.textContent = "Mining...";

  async function mineStep() {
    const promises = [];
    // Menghitung hash dengan format: data + timestamp + nonce
    for (let i = 0; i < batchSize; i++) {
      promises.push(sha256(data + timestamp + (nonce + i)));
    }
    const results = await Promise.all(promises);
    for (let i = 0; i < results.length; i++) {
      const h = results[i];
      if (h.startsWith(difficulty)) {
        blockNonce.value = nonce + i;
        blockHash.textContent = h;
        if (status)
          status.textContent = `Mining selesai (Nonce=${nonce + i})`;
        return;
      }
    }
    nonce += batchSize;
    blockNonce.value = nonce;
    if (status) status.textContent = `Mining... Nonce=${nonce}`;
    
    // Menggunakan setTimeout(mineStep, 0) untuk menghindari blocking UI
    setTimeout(mineStep, 0); 
  }
  mineStep();
});

// ================== BLOCKCHAIN PAGE ==================
const ZERO_HASH = "0".repeat(64);
let blocks = [];
const chainDiv = document.getElementById("blockchain");

function renderChain() {
  if (!chainDiv) return;
  chainDiv.innerHTML = "";
  blocks.forEach((blk, i) => {
    const div = document.createElement("div");
    div.className = "blockchain-block";
    
    // Periksa validitas hash (tanpa re-mining)
    const isValid = blk.hash.startsWith("0000") && 
                    (i === 0 || blk.previousHash === blocks[i-1].hash);

    if (!isValid) {
        div.classList.add('invalid');
    }

    div.innerHTML = `
      <h3>Block #${blk.index}</h3>
      <label>Previous Hash:</label><div class="output">${blk.previousHash}</div>
      <label>Data:</label><textarea rows="2" onchange="onChainDataChange(${i},this.value)">${blk.data}</textarea>
      <button onclick="mineChainBlock(${i})" class="mine">Mine</button>
      <div id="status-${i}" class="status"></div>
      <label>Timestamp:</label><div class="output" id="timestamp-${i}">${blk.timestamp}</div>
      <label>Nonce:</label><div class="output" id="nonce-${i}">${blk.nonce}</div>
      <label>Hash:</label><div class="output" id="hash-${i}">${blk.hash}</div>`;
    
    chainDiv.appendChild(div);
  });
}

function addChainBlock() {
  const idx = blocks.length;
  // Gunakan hash dari blok terakhir sebagai previous hash
  const prev = idx ? blocks[idx - 1].hash : ZERO_HASH; 
  const blk = {
    index: idx,
    data: "",
    previousHash: prev,
    timestamp: "",
    nonce: 0,
    hash: "",
  };
  blocks.push(blk);
  renderChain();
}

// Saat data blok diubah
window.onChainDataChange = function (i, val) {
  blocks[i].data = val;
  blocks[i].nonce = 0;
  blocks[i].timestamp = "";
  blocks[i].hash = "";
  
  // Memastikan hash previous blok berikutnya juga diupdate
  for (let j = i + 1; j < blocks.length; j++) {
    blocks[j].previousHash = blocks[j - 1].hash;
    blocks[j].nonce = 0;
    blocks[j].timestamp = "";
    blocks[j].hash = "";
  }
  renderChain();
};

window.mineChainBlock = function (i) {
  const blk = blocks[i];
  const prev = blk.previousHash;
  const data = blk.data;
  const difficulty = "0000";
  const batchSize = 1000 * 50; // Lebih cepat
  
  // Set nilai awal blok sebelum mining
  blk.nonce = 0;
  blk.timestamp = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Jakarta",
  });
  
  const t0 = performance.now();
  const status = document.getElementById(`status-${i}`);
  const ndiv = document.getElementById(`nonce-${i}`);
  const hdiv = document.getElementById(`hash-${i}`);
  const tdiv = document.getElementById(`timestamp-${i}`);
  
  if (status) status.textContent = "Proses mining...";
  
  async function step() {
    const promises = [];
    for (let j = 0; j < batchSize; j++)
      // Kombinasi hash: prev + data + timestamp + nonce
      promises.push(sha256(prev + data + blk.timestamp + (blk.nonce + j))); 
    
    const results = await Promise.all(promises);
    
    for (let j = 0; j < results.length; j++) {
      const h = results[j];
      if (h.startsWith(difficulty)) {
        blk.nonce += j;
        blk.hash = h;
        
        // Update DOM
        ndiv.textContent = blk.nonce;
        hdiv.textContent = blk.hash;
        tdiv.textContent = blk.timestamp;
        
        const dur = ((performance.now() - t0) / 1000).toFixed(3);
        if (status) status.textContent = `Mining selesai (${dur}s)`;
        
        // PENTING: Update blok berikutnya setelah blok ini berhasil di-mine
        if (i + 1 < blocks.length) {
            blocks[i + 1].previousHash = blk.hash;
        }

        renderChain(); // Render ulang untuk warna rantai
        return;
      }
    }
    
    blk.nonce += batchSize;
    ndiv.textContent = blk.nonce;
    setTimeout(step, 0);
  }
  step();
};

document.getElementById("btn-add-block")?.addEventListener("click", addChainBlock);
addChainBlock();


// ================== ECC DIGITAL SIGNATURE ==================
// ... (Kode ECC tidak diubah karena tidak ada permintaan spesifik)
const ec = new elliptic.ec("secp256k1");
const eccPrivate = document.getElementById("ecc-private");
const eccPublic = document.getElementById("ecc-public");
const eccMessage = document.getElementById("ecc-message");
const eccSignature = document.getElementById("ecc-signature");
const eccVerifyResult = document.getElementById("ecc-verify-result");
function randomPrivateHex() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
function normHex(h) {
  if (!h) return "";
  return h.toLowerCase().replace(/^0x/, "");
}
document.getElementById("btn-generate-key")?.addEventListener("click", () => {
  const priv = randomPrivateHex();
  const key = ec.keyFromPrivate(priv, "hex");
  const pub =
    "04" +
    key.getPublic().getX().toString("hex").padStart(64, "0") +
    key.getPublic().getY().toString("hex").padStart(64, "0");
  eccPrivate.value = priv;
  eccPublic.value = pub;
  eccSignature.value = "";
  eccVerifyResult.textContent = "";
});
document.getElementById("btn-sign")?.addEventListener("click", async () => {
  const msg = eccMessage.value;
  if (!msg) {
    alert("Isi pesan!");
    return;
  }
  const priv = normHex(eccPrivate.value.trim());
  if (!priv) {
    alert("Private key kosong!");
    return;
  }
  const hash = await sha256(msg);
  const sig = ec
    .keyFromPrivate(priv, "hex")
    .sign(hash, { canonical: true })
    .toDER("hex");
  eccSignature.value = sig;
  eccVerifyResult.textContent = "";
});
document.getElementById("btn-verify")?.addEventListener("click", async () => {
  try {
    const msg = eccMessage.value,
      sig = normHex(eccSignature.value.trim()),
      pub = normHex(eccPublic.value.trim());
    if (!msg || !sig || !pub) {
      alert("Lengkapi semua field!");
      return;
    }
    const key = ec.keyFromPublic(pub, "hex");
    const valid = key.verify(await sha256(msg), sig);
    eccVerifyResult.textContent = valid
      ? "Signature VALID!"
      : "Signature TIDAK valid!";
  } catch (e) {
    eccVerifyResult.textContent = "Error verifikasi";
  }
});

// ================== KONSENSUS PAGE ==================
// ... (Kode Konsensus tidak diubah karena tidak ada permintaan spesifik)
const ZERO = "0".repeat(64);
let balances = { A: 100, B: 100, C: 100 };
let txPool = [];
let chainsConsensus = { A: [], B: [], C: [] };

function updateBalancesDOM() {
  ["A", "B", "C"].forEach((u) => {
    const el = document.getElementById("saldo-" + u);
    if (el) el.textContent = balances[u];
  });
}
function parseTx(line) {
  const m = line.match(/^([A-C])\s*->\s*([A-C])\s*:\s*(\d+)$/);
  if (!m) return null;
  return { from: m[1], to: m[2], amt: parseInt(m[3]) };
}

// ======== Mining Helper ========
async function shaMine(prev, data, timestamp) {
  const diff = "000";
  const base = 1000;
  const batch = base * 50;
  return new Promise((resolve) => {
    let nonce = 0;
    async function loop() {
      const promises = [];
      for (let i = 0; i < batch; i++)
        promises.push(sha256(prev + data + timestamp + (nonce + i)));
      const results = await Promise.all(promises);
      for (let i = 0; i < results.length; i++) {
        const h = results[i];
        if (h.startsWith(diff)) {
          resolve({ nonce: nonce + i, hash: h });
          return;
        }
      }
      nonce += batch;
      setTimeout(loop, 0);
    }
    loop();
  });
}

// ======== Genesis dengan mining ========
async function createGenesisConsensus() {
  const diff = "000";
  const ts = new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" });
  for (let u of ["A", "B", "C"]) {
    let nonce = 0;
    let found = "";
    while (true) {
      // Menggunakan shaMine yang lebih cepat
      const h = await sha256(ZERO + "Genesis" + ts + nonce);
      if (h.startsWith(diff)) {
        found = h;
        break;
      }
      nonce++;
      // Limit nonce for quick genesis block creation, avoid infinite loop during development
      if (nonce > 100000) break; 
    }
    chainsConsensus[u] = [
      {
        index: 0,
        prev: ZERO,
        data: "Genesis Block: 100 coins",
        timestamp: ts,
        nonce,
        hash: found,
        invalid: false,
      },
    ];
  }
  renderConsensusChains();
  updateBalancesDOM();
}
// Panggil genesis saat DOM siap
document.addEventListener('DOMContentLoaded', createGenesisConsensus); 

// ======== Render Konsensus Chain ========
function renderConsensusChains() {
  ["A", "B", "C"].forEach((u) => {
    const cont = document.getElementById("chain-" + u);
    if (!cont) return;
    cont.innerHTML = "";
    chainsConsensus[u].forEach((blk, i) => {
      const d = document.createElement("div");
      d.className = "chain-block" + (blk.invalid ? " invalid" : "");
      d.innerHTML = `
        <div class="small"><strong>Block #${blk.index}</strong></div>
        <div class="small">Prev:</div><input class="small" value="${blk.prev}" readonly>
        <div class="small">Data:</div><textarea class="data" rows="3">${blk.data}</textarea>
        <div class="small">Timestamp:</div><input class="small" value="${blk.timestamp}" readonly>
        <div class="small">Nonce:</div><input class="small" value="${blk.nonce}" readonly>
        <div class="small">Hash:</div><input class="small" value="${blk.hash}" readonly>`;

      const ta = d.querySelector("textarea.data");
      ta.addEventListener("input", (e) => {
        chainsConsensus[u][i].data = e.target.value;
      });

      cont.appendChild(d);
    });
  });
}

// ======== Kirim Transaksi ========
["A", "B", "C"].forEach((u) => {
  document.getElementById("send-" + u)?.addEventListener("click", () => {
    const amt = parseInt(document.getElementById("amount-" + u).value);
    const to = document.getElementById("receiver-" + u).value;
    if (amt <= 0) {
      alert("Jumlah > 0");
      return;
    }
    if (balances[u] < amt) {
      alert("Saldo tidak cukup");
      return;
    }
    const tx = `${u} -> ${to} : ${amt}`;
    txPool.push(tx);
    document.getElementById("mempool").value = txPool.join("\n");
  });
});

// ======== Mine Semua Transaksi ========
document.getElementById("btn-mine-all")?.addEventListener("click", async () => {
  if (txPool.length === 0) {
    alert("Tidak ada transaksi.");
    return;
  }
  const parsed = [];
  for (const t of txPool) {
    const tx = parseTx(t);
    if (!tx) {
      alert("Format salah: " + t);
      return;
    }
    parsed.push(tx);
  }
  const tmp = { ...balances };
  for (const tx of parsed) {
    if (tmp[tx.from] < tx.amt) {
      alert("Saldo " + tx.from + " tidak cukup.");
      return;
    }
    tmp[tx.from] -= tx.amt;
    tmp[tx.to] += tx.amt;
  }
  const ts = new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" });
  const data = txPool.join(" | ");
  
  // Mining secara paralel
  const mining = ["A", "B", "C"].map(async (u) => {
    const prev = chainsConsensus[u].at(-1).hash;
    const r = await shaMine(prev, data, ts);
    chainsConsensus[u].push({
      index: chainsConsensus[u].length,
      prev,
      data,
      timestamp: ts,
      nonce: r.nonce,
      hash: r.hash,
      invalid: false,
    });
  });
  await Promise.all(mining);
  
  balances = tmp;
  updateBalancesDOM();
  txPool = [];
  document.getElementById("mempool").value = "";
  renderConsensusChains();
  alert("Mining selesai (50× lebih cepat).");
});

// ======== Tombol VERIFY Konsensus ========
document.getElementById("btn-verify-consensus")?.addEventListener("click", async () => {
  try {
    for (const u of ["A", "B", "C"]) {
      for (let i = 1; i < chainsConsensus[u].length; i++) {
        const blk = chainsConsensus[u][i];
        const expectedPrev = chainsConsensus[u][i - 1].hash;
        
        // Recompute hash
        const recomputed = await sha256(
          blk.prev + blk.data + blk.timestamp + blk.nonce
        );
        
        // Cek validitas: Hash recomputed harus sama dengan hash di blok
        // DAN Previous Hash harus sama dengan hash blok sebelumnya
        blk.invalid = recomputed !== blk.hash || blk.prev !== expectedPrev;
      }
    }
    renderConsensusChains();
    alert("Verifikasi selesai — blok yang berubah ditandai merah.");
  } catch (err) {
    console.error("Error saat verifikasi Konsensus:", err);
    alert("Terjadi kesalahan saat verifikasi Konsensus. Cek console.");
  }
});

// ======== Tombol CONSENSUS ========
document.getElementById("btn-consensus")?.addEventListener("click", async () => {
  try {
    const maxLen = Math.max(
      chainsConsensus.A.length,
      chainsConsensus.B.length,
      chainsConsensus.C.length
    );
    for (let i = 0; i < maxLen; i++) {
      const vals = [];
      for (const u of ["A", "B", "C"])
        if (chainsConsensus[u][i]) vals.push(chainsConsensus[u][i].data);
      if (vals.length === 0) continue;
      
      // Menemukan data mayoritas
      const freq = {};
      let maj = vals[0];
      let maxc = 0;
      vals.forEach((v) => {
        freq[v] = (freq[v] || 0) + 1;
        if (freq[v] > maxc) {
          maxc = freq[v];
          maj = v;
        }
      });
      
      // Seragamkan semua rantai ke data mayoritas, lalu re-hash
      for (const u of ["A", "B", "C"]) {
        if (!chainsConsensus[u][i]) continue;
        const blk = chainsConsensus[u][i];
        
        // Terapkan data mayoritas
        blk.data = maj; 
        
        // Update Previous Hash dan Re-hash
        blk.prev = i === 0 ? ZERO : chainsConsensus[u][i - 1].hash;
        blk.hash = await sha256(
          blk.prev + blk.data + blk.timestamp + blk.nonce
        );
        blk.invalid = false;
      }
    }
    renderConsensusChains();
    alert("Konsensus selesai, semua blok diseragamkan.");
  } catch (e) {
    console.error(e);
    alert("Error konsensus.");
  }
});