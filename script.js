// ============================================================
// 1. IMPORT LIBRARY (JANGAN DIUBAH)
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } 
    from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, doc, deleteDoc, updateDoc } 
    from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ============================================================
// 2. KONFIGURASI FIREBASE (SUDAH SESUAI DATA ANDA)
// ============================================================
const firebaseConfig = {
    apiKey: "AIzaSyAPOKCRgpRsXorlb1H3dgYI1beQazLlyeM",
    authDomain: "my-time-tracker-az2104.firebaseapp.com",
    projectId: "my-time-tracker-az2104",
    storageBucket: "my-time-tracker-az2104.firebasestorage.app",
    messagingSenderId: "433116282352",
    appId: "1:433116282352:web:428fef9f65ccc7e014b135",
    measurementId: "G-SL0FFM6PK9"
};

// ============================================================
// 3. INISIALISASI APP
// ============================================================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Variabel Global
let startTime;
let timerInterval;
let currentUser = null;
let currentTaskName = "";
let currentCategory = "";

// Variabel Grafik
let categoryChartInstance = null;
let trendChartInstance = null;

// Modal Bootstrap
const editModal = new bootstrap.Modal(document.getElementById('editModal'));

// Set Default Tanggal ke Hari Ini
document.getElementById('dateInput').valueAsDate = new Date();

// ============================================================
// 4. LOGIKA TEMA & NAVIGASI TAB
// ============================================================

// --- A. Dark/Light Mode ---
const themeToggleBtn = document.getElementById('themeToggle');
const htmlElement = document.documentElement;
const iconTheme = themeToggleBtn.querySelector('i');
const savedTheme = localStorage.getItem('theme') || 'light';

// Terapkan tema tersimpan
htmlElement.setAttribute('data-theme', savedTheme);
updateThemeIcon(savedTheme);

themeToggleBtn.addEventListener('click', () => {
    const currentTheme = htmlElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    htmlElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
});

function updateThemeIcon(theme) {
    if(theme === 'dark') {
        iconTheme.className = 'ph-bold ph-sun';
        // Warna teks grafik untuk Dark Mode (Putih)
        Chart.defaults.color = '#ffffff';
        Chart.defaults.borderColor = 'rgba(255,255,255,0.1)';
    } else {
        iconTheme.className = 'ph-bold ph-moon';
        // Warna teks grafik untuk Light Mode (Gelap)
        Chart.defaults.color = '#2d3436';
        Chart.defaults.borderColor = 'rgba(0,0,0,0.1)';
    }
    // Refresh grafik agar warna teks berubah
    if(categoryChartInstance) categoryChartInstance.update();
    if(trendChartInstance) trendChartInstance.update();
}

// --- B. Tab Switcher (Timer vs Manual) ---
const tabTimer = document.getElementById('tabTimer');
const tabManual = document.getElementById('tabManual');
const timerArea = document.getElementById('timerModeArea');
const manualArea = document.getElementById('manualModeArea');
const statusText = document.getElementById('statusText');

tabTimer.addEventListener('click', () => switchMode('timer'));
tabManual.addEventListener('click', () => switchMode('manual'));

function switchMode(mode) {
    if (mode === 'timer') {
        // Aktifkan Tab Timer
        tabTimer.classList.add('btn-tab-active', 'bg-white', 'shadow-sm');
        tabTimer.classList.remove('text-muted');
        tabManual.classList.remove('btn-tab-active', 'bg-white', 'shadow-sm');
        tabManual.classList.add('text-muted');
        
        timerArea.classList.remove('hidden');
        manualArea.classList.add('hidden');
        statusText.innerText = "Siap Merekam";
    } else {
        // Aktifkan Tab Manual
        tabManual.classList.add('btn-tab-active', 'bg-white', 'shadow-sm');
        tabManual.classList.remove('text-muted');
        tabTimer.classList.remove('btn-tab-active', 'bg-white', 'shadow-sm');
        tabTimer.classList.add('text-muted');
        
        manualArea.classList.remove('hidden');
        timerArea.classList.add('hidden');
        statusText.innerText = "Mode Input Manual";
    }
}

// ============================================================
// 5. OTENTIKASI (LOGIN/LOGOUT)
// ============================================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('userName').innerText = user.displayName;
        document.getElementById('loginSection').classList.add('hidden');
        document.getElementById('appSection').classList.remove('hidden');
        loadLogs(user.uid); // Load data user
    } else {
        currentUser = null;
        document.getElementById('loginSection').classList.remove('hidden');
        document.getElementById('appSection').classList.add('hidden');
    }
});

document.getElementById('btnLogin').addEventListener('click', () => {
    signInWithPopup(auth, provider).catch((error) => alert("Gagal Login: " + error.message));
});

document.getElementById('btnLogout').addEventListener('click', () => {
    if(confirm("Apakah Anda yakin ingin keluar?")) signOut(auth);
});

// ============================================================
// 6. LOGIKA TIMER (STOPWATCH)
// ============================================================
document.getElementById('btnStart').addEventListener('click', () => {
    const taskInput = document.getElementById('taskInput');
    const categoryInput = document.getElementById('categoryInput');
    
    // Validasi
    if (taskInput.value.trim() === "") {
        alert("Mohon isi nama kegiatan terlebih dahulu.");
        taskInput.focus();
        return;
    }

    currentTaskName = taskInput.value;
    currentCategory = categoryInput.value;
    
    // Kunci Input saat timer berjalan
    taskInput.disabled = true;
    categoryInput.disabled = true;
    document.getElementById('dateInput').disabled = true;
    tabManual.disabled = true; // Kunci tab manual

    startTime = Date.now();
    document.getElementById('btnStart').classList.add('hidden');
    document.getElementById('btnStop').classList.remove('hidden');
    document.getElementById('statusText').innerText = `Sedang Mengerjakan: ${currentTaskName}`;

    timerInterval = setInterval(() => {
        const diff = Math.floor((Date.now() - startTime) / 1000);
        const h = Math.floor(diff / 3600).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
        const s = (diff % 60).toString().padStart(2, '0');
        document.getElementById('timer').innerText = `${h}:${m}:${s}`;
    }, 1000);
});

document.getElementById('btnStop').addEventListener('click', async () => {
    clearInterval(timerInterval);
    const durationSec = Math.floor((Date.now() - startTime) / 1000);
    saveDataToFirebase(durationSec, true); // true = mode timer
});

// ============================================================
// 7. LOGIKA INPUT MANUAL
// ============================================================
document.getElementById('btnSaveManual').addEventListener('click', () => {
    const hrs = parseInt(document.getElementById('manualHours').value) || 0;
    const mins = parseInt(document.getElementById('manualMinutes').value) || 0;
    
    if (hrs === 0 && mins === 0) {
        alert("Durasi tidak boleh 0 jam 0 menit.");
        return;
    }
    if (document.getElementById('taskInput').value.trim() === "") {
        alert("Mohon isi nama kegiatan.");
        return;
    }

    // Konversi ke total detik
    const totalSeconds = (hrs * 3600) + (mins * 60);
    saveDataToFirebase(totalSeconds, false); // false = mode manual
});

// --- FUNGSI SIMPAN KE DATABASE (Digunakan Timer & Manual) ---
async function saveDataToFirebase(durationSec, isTimer) {
    const taskInput = document.getElementById('taskInput');
    const categoryInput = document.getElementById('categoryInput');
    const dateInput = document.getElementById('dateInput');
    
    // Hitung Waktu Mulai & Selesai
    // Kita gunakan tanggal yang dipilih user, tapi jamnya pakai jam saat ini
    const selectedDate = new Date(dateInput.value);
    const now = new Date();
    selectedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
    
    const finalStart = selectedDate.toISOString();
    const finalEnd = new Date(selectedDate.getTime() + (durationSec * 1000)).toISOString();

    if (currentUser) {
        try {
            await addDoc(collection(db, "logs"), {
                uid: currentUser.uid,
                task: taskInput.value,
                category: categoryInput.value,
                start: finalStart,
                end: finalEnd,
                duration: durationSec,
                createdAt: serverTimestamp()
            });
            
            // RESET TAMPILAN SETELAH SIMPAN
            if(isTimer) {
                document.getElementById('btnStop').classList.add('hidden');
                document.getElementById('btnStart').classList.remove('hidden');
                document.getElementById('timer').innerText = "00:00:00";
                tabManual.disabled = false;
            } else {
                document.getElementById('manualHours').value = "";
                document.getElementById('manualMinutes').value = "";
                alert("Data manual berhasil disimpan.");
            }

            document.getElementById('statusText').innerText = "Data tersimpan.";
            
            // Buka kunci input
            taskInput.disabled = false;
            categoryInput.disabled = false;
            dateInput.disabled = false;
            taskInput.value = "";

        } catch (e) {
            console.error(e);
            alert("Gagal menyimpan data ke server.");
        }
    }
}

// ============================================================
// 8. BACA DATA & RENDER TABEL (READ)
// ============================================================
function loadLogs(userId) {
    const q = query(collection(db, "logs"), where("uid", "==", userId), orderBy("createdAt", "desc"));
    
    onSnapshot(q, (snapshot) => {
        const tbody = document.getElementById('logBody');
        tbody.innerHTML = '';
        let logsData = []; // Array untuk grafik

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td class="text-center opacity-50 py-4">Belum ada aktivitas terekam.</td></tr>';
        }
        
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const docId = docSnap.id;
            logsData.push(data);

            // Format Durasi (Jam : Menit)
            const totalMin = Math.floor(data.duration / 60);
            const displayH = Math.floor(totalMin / 60);
            const displayM = totalMin % 60;
            const durationText = displayH > 0 ? `${displayH}j ${displayM}m` : `${displayM} menit`;
            
            // Format Tanggal (Contoh: 30 Jan)
            const dateObj = new Date(data.start);
            const dateStr = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
            const timeStr = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

            // Tentukan Warna Badge Kategori (Tanpa Emoji)
            let badgeClass = "bg-secondary"; // Default Abu-abu
            if(data.category === "Coding") badgeClass = "bg-primary";       // Biru
            else if(data.category === "Belajar") badgeClass = "bg-success"; // Hijau
            else if(data.category === "Meeting") badgeClass = "bg-warning text-dark"; // Kuning
            else if(data.category === "Desain") badgeClass = "bg-danger";   // Merah

            // Render Baris Tabel (Profesional Style)
            const row = `
            <tr>
                <td>
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="fw-bold text-dark">${data.task || '(Tanpa Nama)'}</span>
                        <span class="badge ${badgeClass} rounded-1 fw-normal" style="font-size:0.75rem; letter-spacing:0.5px;">${data.category}</span>
                    </div>
                    
                    <div class="d-flex justify-content-between align-items-center opacity-75 small">
                        <div class="d-flex align-items-center">
                            <i class="ph-bold ph-calendar-blank me-2"></i>
                            <span>${dateStr}, ${timeStr}</span>
                        </div>
                        <span class="fw-bold text-primary">${durationText}</span>
                    </div>
                    
                    <div class="mt-2 text-end border-top pt-2 mt-2" style="border-color: rgba(0,0,0,0.05) !important;">
                        <button class="btn btn-sm btn-link text-decoration-none p-0 me-3 btn-edit text-secondary" 
                            data-id="${docId}" data-task="${data.task}" data-cat="${data.category}" style="font-size: 0.85rem;">
                            <i class="ph-bold ph-pencil-simple me-1"></i> Edit
                        </button>
                        <button class="btn btn-sm btn-link text-decoration-none p-0 btn-delete text-danger" 
                            data-id="${docId}" style="font-size: 0.85rem;">
                            <i class="ph-bold ph-trash me-1"></i> Hapus
                        </button>
                    </div>
                </td>
            </tr>`;
            tbody.innerHTML += row;
        });

        // Update grafik setelah data tabel dimuat
        updateCharts(logsData);
    });
}

// ============================================================
// 9. UPDATE GRAFIK (CHART.JS)
// ============================================================
function updateCharts(logs) {
    // A. Data Donut (Distribusi Kategori)
    const categoryCounts = {
        "Coding": 0, "Belajar": 0, "Meeting": 0, "Desain": 0, "Lainnya": 0
    };
    
    logs.forEach(log => {
        const cat = log.category || "Lainnya";
        if (categoryCounts[cat] !== undefined) {
            categoryCounts[cat] += log.duration;
        } else {
            categoryCounts["Lainnya"] += log.duration;
        }
    });

    // Warna yang SAMA dengan Badge di Tabel
    const chartColors = [
        '#0d6efd', // Coding (Primary Blue)
        '#198754', // Belajar (Success Green)
        '#ffc107', // Meeting (Warning Yellow)
        '#dc3545', // Desain (Danger Red)
        '#6c757d'  // Lainnya (Secondary Gray)
    ];

    // Render Donut Chart
    const ctxCat = document.getElementById('categoryChart');
    if (categoryChartInstance) categoryChartInstance.destroy();
    
    categoryChartInstance = new Chart(ctxCat, {
        type: 'doughnut',
        data: {
            labels: Object.keys(categoryCounts),
            datasets: [{
                data: Object.values(categoryCounts),
                backgroundColor: chartColors,
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false } // Sembunyikan legenda agar bersih
            },
            cutout: '70%' // Lubang tengah donat
        }
    });

    // B. Data Line (Tren 7 Hari)
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const trendData = Array(7).fill(0);
    const labelsData = [];

    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        labelsData.push(days[d.getDay()]); // Label Hari
        
        const dateString = d.toISOString().split('T')[0];
        let dailyTotal = 0;
        
        logs.forEach(log => {
            if(log.start && new Date(log.start).toISOString().startsWith(dateString)) {
                dailyTotal += log.duration;
            }
        });
        trendData[6 - i] = (dailyTotal / 60).toFixed(1); // Menit
    }

    // Render Line Chart
    const ctxTrend = document.getElementById('trendChart');
    if (trendChartInstance) trendChartInstance.destroy();

    trendChartInstance = new Chart(ctxTrend, {
        type: 'line',
        data: {
            labels: labelsData,
            datasets: [{
                label: 'Menit',
                data: trendData,
                borderColor: '#0d6efd', // Garis Biru Profesional
                backgroundColor: 'rgba(13, 110, 253, 0.1)', // Arsir Biru Transparan
                fill: true,
                tension: 0.3, // Kelengkungan garis halus
                pointRadius: 3,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { display: false }, // Sembunyikan sumbu Y agar bersih
                x: { grid: { display: false } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// ============================================================
// 10. EDIT & HAPUS DATA (CRUD)
// ============================================================
// Event Delegation (Menangani klik tombol di dalam tabel)
document.getElementById('logBody').addEventListener('click', (e) => {
    // Tombol Hapus
    if (e.target.closest('.btn-delete')) {
        const btn = e.target.closest('.btn-delete');
        const id = btn.getAttribute('data-id');
        if(confirm("Hapus aktivitas ini secara permanen?")) {
            deleteDoc(doc(db, "logs", id)).catch(err => alert("Gagal hapus: " + err.message));
        }
    }
    // Tombol Edit
    if (e.target.closest('.btn-edit')) {
        const btn = e.target.closest('.btn-edit');
        const id = btn.getAttribute('data-id');
        
        // Isi Form Modal
        document.getElementById('editDocId').value = id;
        document.getElementById('editTaskInput').value = btn.getAttribute('data-task');
        document.getElementById('editCategoryInput').value = btn.getAttribute('data-cat');
        
        editModal.show();
    }
});

// Simpan Perubahan (Tombol di Modal)
document.getElementById('btnSaveChanges').addEventListener('click', async () => {
    const id = document.getElementById('editDocId').value;
    const newTask = document.getElementById('editTaskInput').value;
    const newCat = document.getElementById('editCategoryInput').value;

    if (newTask.trim() === "") {
        alert("Nama kegiatan tidak boleh kosong.");
        return;
    }

    try {
        await updateDoc(doc(db, "logs", id), {
            task: newTask,
            category: newCat
        });
        editModal.hide();
    } catch (e) {
        console.error("Error update:", e);
        alert("Gagal memperbarui data.");
    }
});
