// ============================================================
// 1. IMPORT LIBRARY
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } 
    from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, doc, deleteDoc, updateDoc } 
    from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ============================================================
// 2. KONFIGURASI FIREBASE (SUDAH SAYA ISI DENGAN DATA ANDA)
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
// 3. INISIALISASI
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
// 4. LOGIKA TEMA (DARK / LIGHT MODE)
// ============================================================
const themeToggleBtn = document.getElementById('themeToggle');
const htmlElement = document.documentElement;
const iconTheme = themeToggleBtn.querySelector('i');

const savedTheme = localStorage.getItem('theme') || 'light';
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
        // Update warna text grafik jadi putih
        Chart.defaults.color = '#ffffff';
        Chart.defaults.borderColor = 'rgba(255,255,255,0.1)';
    } else {
        iconTheme.className = 'ph-bold ph-moon';
        // Update warna text grafik jadi hitam
        Chart.defaults.color = '#2d3436';
        Chart.defaults.borderColor = 'rgba(0,0,0,0.1)';
    }
    // Update grafik jika sudah ada
    if(categoryChartInstance) categoryChartInstance.update();
    if(trendChartInstance) trendChartInstance.update();
}

// ============================================================
// 5. AUTHENTICATION
// ============================================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('userName').innerText = user.displayName;
        document.getElementById('loginSection').classList.add('hidden');
        document.getElementById('appSection').classList.remove('hidden');
        loadLogs(user.uid);
    } else {
        currentUser = null;
        document.getElementById('loginSection').classList.remove('hidden');
        document.getElementById('appSection').classList.add('hidden');
    }
});

document.getElementById('btnLogin').addEventListener('click', () => {
    signInWithPopup(auth, provider).catch((error) => alert(error.message));
});

document.getElementById('btnLogout').addEventListener('click', () => {
    if(confirm("Logout?")) signOut(auth);
});

// ============================================================
// 6. LOGIKA TIMER & INPUT MANUAL
// ============================================================
document.getElementById('btnStart').addEventListener('click', () => {
    const taskInput = document.getElementById('taskInput');
    const categoryInput = document.getElementById('categoryInput');
    
    if (taskInput.value.trim() === "") {
        alert("Isi nama kegiatan dulu!");
        taskInput.focus();
        return;
    }

    currentTaskName = taskInput.value;
    currentCategory = categoryInput.value;
    
    // Kunci Input
    taskInput.disabled = true;
    categoryInput.disabled = true;
    document.getElementById('dateInput').disabled = true;

    startTime = Date.now();
    document.getElementById('btnStart').classList.add('hidden');
    document.getElementById('btnStop').classList.remove('hidden');
    document.getElementById('statusText').innerText = `Fokus: ${currentTaskName}`;

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
    const now = new Date(); // Waktu saat tombol stop ditekan
    const durationSec = Math.floor((Date.now() - startTime) / 1000);

    // --- LOGIKA TANGGAL MANUAL ---
    // Cek apakah user memilih tanggal manual di input calendar
    const dateInputValue = document.getElementById('dateInput').value;
    let finalStartDate = new Date(startTime);
    let finalEndDate = now;

    if (dateInputValue) {
        // Jika user pilih tanggal (misal kemarin), kita manipulasi tanggalnya
        const selectedDate = new Date(dateInputValue);
        
        // Set tahun, bulan, tanggal sesuai pilihan user
        // Tapi jam/menit tetap sesuai waktu pengerjaan (biar realistis)
        finalStartDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
        finalEndDate = new Date(finalStartDate.getTime() + (durationSec * 1000));
    }

    // Reset UI
    document.getElementById('btnStop').classList.add('hidden');
    document.getElementById('btnStart').classList.remove('hidden');
    document.getElementById('timer').innerText = "00:00:00";
    document.getElementById('statusText').innerText = "Mode Pencatatan";
    
    const taskInput = document.getElementById('taskInput');
    const categoryInput = document.getElementById('categoryInput');
    taskInput.disabled = false;
    categoryInput.disabled = false;
    document.getElementById('dateInput').disabled = false;
    taskInput.value = ""; 

    if (currentUser) {
        try {
            await addDoc(collection(db, "logs"), {
                uid: currentUser.uid,
                task: currentTaskName,
                category: currentCategory,
                // Simpan dalam format String ISO agar mudah dibaca Chart.js
                start: finalStartDate.toISOString(), 
                end: finalEndDate.toISOString(),
                duration: durationSec,
                createdAt: serverTimestamp() // Tetap simpan waktu asli input untuk sorting
            });
        } catch (e) { console.error(e); alert("Gagal simpan data"); }
    }
});

// ============================================================
// 7. READ DATA & UPDATE CHART
// ============================================================
function loadLogs(userId) {
    const q = query(collection(db, "logs"), where("uid", "==", userId), orderBy("createdAt", "desc"));
    
    onSnapshot(q, (snapshot) => {
        const tbody = document.getElementById('logBody');
        tbody.innerHTML = '';
        
        let logsData = []; // Tampung data untuk grafik

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td class="text-center opacity-50 py-4">Belum ada data.</td></tr>';
        }
        
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const docId = docSnap.id;
            logsData.push(data); // Masukkan ke array grafik

            // Format Durasi
            const h = Math.floor(data.duration / 3600).toString().padStart(2, '0');
            const m = Math.floor((data.duration % 3600) / 60).toString().padStart(2, '0');
            const s = (data.duration % 60).toString().padStart(2, '0');
            
            // Format Tanggal (Gunakan data.start agar sesuai pilihan manual)
            const dateObj = new Date(data.start);
            const dateStr = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
            const timeStr = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

            // Badge Warna
            let badgeClass = "bg-secondary";
            if(data.category === "Coding") badgeClass = "bg-primary";
            else if(data.category === "Belajar") badgeClass = "bg-success";
            else if(data.category === "Meeting") badgeClass = "bg-warning text-dark";
            else if(data.category === "Desain") badgeClass = "bg-danger";

            const row = `
            <tr>
                <td>
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="fw-bold">${data.task || '-'}</span>
                        <span class="badge ${badgeClass} rounded-pill" style="font-size:0.7rem">${data.category || 'Umum'}</span>
                    </div>
                    <div class="d-flex justify-content-between align-items-center opacity-75" style="font-size: 0.85rem">
                        <span><i class="ph-bold ph-calendar-blank me-1"></i> ${dateStr}, ${timeStr}</span>
                        <span class="fw-bold text-accent">${h}:${m}:${s}</span>
                    </div>
                    <div class="mt-2 text-end">
                        <button class="btn btn-sm btn-link text-decoration-none p-0 me-3 btn-edit" 
                            data-id="${docId}" data-task="${data.task}" data-cat="${data.category}">
                            <i class="ph-bold ph-pencil-simple"></i> Edit
                        </button>
                        <button class="btn btn-sm btn-link text-danger text-decoration-none p-0 btn-delete" 
                            data-id="${docId}">
                            <i class="ph-bold ph-trash"></i> Hapus
                        </button>
                    </div>
                </td>
            </tr>`;
            tbody.innerHTML += row;
        });

        // UPDATE GRAFIK SETIAP ADA DATA BARU
        updateCharts(logsData);
    });
}

// ============================================================
// 8. LOGIKA GRAFIK (CHART.JS)
// ============================================================
function updateCharts(logs) {
    // A. SIAPKAN DATA KATEGORI (Donut Chart)
    const categoryCounts = {};
    logs.forEach(log => {
        const cat = log.category || "Lainnya";
        // Hitung total durasi (detik) per kategori
        categoryCounts[cat] = (categoryCounts[cat] || 0) + log.duration;
    });

    // B. SIAPKAN DATA TREN 7 HARI TERAKHIR (Line Chart)
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const trendData = Array(7).fill(0); // 7 Hari
    const labelsData = [];

    // Buat label H-6 sampai Hari Ini
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        labelsData.push(days[d.getDay()]); // Ambil nama hari
        
        // Hitung total durasi untuk hari 'd'
        const dateString = d.toISOString().split('T')[0]; // Format YYYY-MM-DD
        
        let dailyTotal = 0;
        logs.forEach(log => {
            // Ambil tanggal saja (YYYY-MM-DD) dari data
            if(log.start) {
                const logDate = new Date(log.start).toISOString().split('T')[0];
                if (logDate === dateString) {
                    dailyTotal += log.duration;
                }
            }
        });
        trendData[6 - i] = (dailyTotal / 60).toFixed(1); // Konversi ke Menit
    }

    // --- RENDER DONUT CHART ---
    const ctxCat = document.getElementById('categoryChart');
    if (categoryChartInstance) categoryChartInstance.destroy(); // Hapus chart lama biar gak numpuk
    
    categoryChartInstance = new Chart(ctxCat, {
        type: 'doughnut',
        data: {
            labels: Object.keys(categoryCounts),
            datasets: [{
                data: Object.values(categoryCounts),
                backgroundColor: ['#4e54c8', '#1dd1a1', '#ff9f43', '#ff6b6b', '#a4b0be'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } } // Sembunyikan legenda biar rapi
        }
    });

    // --- RENDER LINE CHART ---
    const ctxTrend = document.getElementById('trendChart');
    if (trendChartInstance) trendChartInstance.destroy();

    trendChartInstance = new Chart(ctxTrend, {
        type: 'line',
        data: {
            labels: labelsData,
            datasets: [{
                label: 'Menit',
                data: trendData,
                borderColor: '#4e54c8',
                backgroundColor: 'rgba(78, 84, 200, 0.1)',
                fill: true,
                tension: 0.4 // Garis melengkung halus
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { display: false } },
                x: { grid: { display: false } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// ============================================================
// 9. LOGIKA EDIT & HAPUS
// ============================================================
document.getElementById('logBody').addEventListener('click', (e) => {
    if (e.target.closest('.btn-delete')) {
        const id = e.target.closest('.btn-delete').getAttribute('data-id');
        if(confirm("Hapus?")) deleteDoc(doc(db, "logs", id));
    }
    if (e.target.closest('.btn-edit')) {
        const btn = e.target.closest('.btn-edit');
        const id = btn.getAttribute('data-id');
        document.getElementById('editDocId').value = id;
        document.getElementById('editTaskInput').value = btn.getAttribute('data-task');
        document.getElementById('editCategoryInput').value = btn.getAttribute('data-cat');
        editModal.show();
    }
});

document.getElementById('btnSaveChanges').addEventListener('click', async () => {
    const id = document.getElementById('editDocId').value;
    try {
        await updateDoc(doc(db, "logs", id), {
            task: document.getElementById('editTaskInput').value,
            category: document.getElementById('editCategoryInput').value
        });
        editModal.hide();
    } catch (e) { alert("Error update"); }
});